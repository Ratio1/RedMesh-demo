# RedMesh API Integration Plan

## Executive Summary

The newly created `lib/services/redmeshApi.ts` service correctly maps to the actual RedMesh backend API endpoints. However, the existing UI infrastructure (`lib/api/jobs.ts`) calls hypothetical `/jobs` endpoints that don't exist in the real API. This document outlines the required changes to connect the service to the UI.

---

## Current State Analysis

### Existing Data Flow
```
┌─────────────────────────────────────────────────────────────┐
│                     UI COMPONENTS                           │
│  JobList.tsx, JobForm.tsx, Job Detail Page                  │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│              useJobs() Hook (lib/hooks/useJobs.ts)          │
│              Calls: GET /api/jobs                           │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           /api/jobs Route (app/api/jobs/route.ts)           │
│           Calls: fetchJobs(), createJob()                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│           lib/api/jobs.ts                                   │
│           Calls: ${redmeshApiUrl}/jobs  ❌ WRONG ENDPOINT   │
└─────────────────────────────────────────────────────────────┘
```

### The Problem: Endpoint Mismatch

| What Existing Code Calls | What RedMesh API Actually Has |
|--------------------------|-------------------------------|
| `GET /jobs` | `GET /list_network_jobs` |
| `GET /jobs` | `GET /list_local_jobs` |
| `POST /jobs` | `POST /launch_test` |
| ❌ Not implemented | `GET /get_job_status?job_id=X` |
| ❌ Not implemented | `GET /stop_and_delete_job?job_id=X` |
| ❌ Not implemented | `POST /stop_monitoring` |
| ❌ Not implemented | `GET /list_features` |
| ❌ Not implemented | `GET /get_report?cid=X` |

### Type Mismatch

The UI expects `Job` type, but RedMesh returns `JobSpecs`:

| UI Type (`Job`) | RedMesh Type (`JobSpecs`) |
|-----------------|---------------------------|
| `id` | `job_id` |
| `displayName` | (none - needs generation) |
| `initiator` | `launcher` |
| `status` | (derived from workers state) |
| `workers: JobWorkerStatus[]` | `workers: Record<string, WorkerAssignment>` |
| `aggregate` | (from report) |

---

## Required Implementation

### Part 1: Type Transformation Layer

**Create:** `lib/api/jobTransformers.ts`

```typescript
// Transforms JobSpecs from RedMesh API to Job for UI
export function jobSpecsToJob(specs: JobSpecs): Job

// Transforms CreateJobInput from UI to LaunchTestRequest for API
export function createJobInputToLaunchRequest(input: CreateJobInput): LaunchTestRequest

// Transforms GetJobStatusResponse to Job (handles all status variants)
export function jobStatusResponseToJob(response: GetJobStatusResponse, specs?: JobSpecs): Job
```

**Transformation details:**
- `job_id` → `id`
- `launcher` → `initiator`
- Generate `displayName` from target + job_id
- Derive `status` from workers' `finished` states
- Convert `workers` Record to Array
- Map `distribution_strategy` ('SLICE'/'MIRROR') to `distribution` ('slice'/'mirror')
- Map `run_mode` ('SINGLEPASS'/'CONTINUOUS_MONITORING') to `duration` ('singlepass'/'continuous')

---

### Part 2: Update Jobs Service

**Modify:** `lib/api/jobs.ts`

#### fetchJobs() Changes:
```typescript
// Before
const response = await fetch(`${config.redmeshApiUrl}/jobs`, { headers });

// After
import { getRedMeshApiService } from '../services/redmeshApi';
import { jobSpecsToJob } from './jobTransformers';

const api = getRedMeshApiService();
const networkJobs = await api.listNetworkJobs();
const jobs = Object.values(networkJobs).map(jobSpecsToJob);
```

#### createJob() Changes:
```typescript
// Before
const response = await fetch(`${config.redmeshApiUrl}/jobs`, { method: 'POST', ... });

// After
const api = getRedMeshApiService();
const request = createJobInputToLaunchRequest(input);
const response = await api.launchTest(request);
return jobSpecsToJob(response.job_specs);
```

---

### Part 3: New API Routes

#### 3.1 Single Job Status & Delete
**Create:** `app/api/jobs/[jobId]/route.ts`

```typescript
// GET /api/jobs/[jobId] - Get job status
export async function GET(request: Request, { params }: { params: { jobId: string } }) {
  const api = getRedMeshApiService();
  const status = await api.getJobStatus(params.jobId);
  const job = jobStatusResponseToJob(status);
  return NextResponse.json({ job });
}

// DELETE /api/jobs/[jobId] - Stop and delete job
export async function DELETE(request: Request, { params }: { params: { jobId: string } }) {
  const api = getRedMeshApiService();
  const result = await api.stopAndDeleteJob(params.jobId);
  return NextResponse.json(result);
}
```

#### 3.2 Stop Monitoring
**Create:** `app/api/jobs/[jobId]/stop-monitoring/route.ts`

```typescript
// POST /api/jobs/[jobId]/stop-monitoring
export async function POST(request: Request, { params }: { params: { jobId: string } }) {
  const body = await request.json();
  const api = getRedMeshApiService();
  const result = await api.stopMonitoring({
    job_id: params.jobId,
    stop_type: body.stop_type ?? 'SOFT'
  });
  return NextResponse.json(result);
}
```

#### 3.3 Features List
**Create:** `app/api/features/route.ts`

```typescript
// GET /api/features
export async function GET() {
  const api = getRedMeshApiService();
  const features = await api.listFeatures();
  return NextResponse.json(features);
}
```

#### 3.4 Report Retrieval
**Create:** `app/api/reports/[cid]/route.ts`

```typescript
// GET /api/reports/[cid]
export async function GET(request: Request, { params }: { params: { cid: string } }) {
  const api = getRedMeshApiService();
  const report = await api.getReport(params.cid);
  return NextResponse.json(report);
}
```

---

## Files Summary

### Files to Create
| File | Purpose |
|------|---------|
| `lib/api/jobTransformers.ts` | Type transformation functions |
| `app/api/jobs/[jobId]/route.ts` | Single job GET/DELETE |
| `app/api/jobs/[jobId]/stop-monitoring/route.ts` | Stop monitoring endpoint |
| `app/api/features/route.ts` | Features list endpoint |
| `app/api/reports/[cid]/route.ts` | Report retrieval endpoint |

### Files to Modify
| File | Changes |
|------|---------|
| `lib/api/jobs.ts` | Use redmeshApi service instead of direct fetch |

---

## Implementation Order

1. **Create `lib/api/jobTransformers.ts`**
   - Core transformation functions
   - Unit tests for transformations

2. **Update `lib/api/jobs.ts`**
   - Import redmeshApi service
   - Update fetchJobs() to use listNetworkJobs()
   - Update createJob() to use launchTest()
   - Keep mock mode support

3. **Create new API routes** (in order of importance):
   - `/api/jobs/[jobId]` - Essential for job details
   - `/api/features` - Needed for job creation form
   - `/api/jobs/[jobId]/stop-monitoring` - For continuous jobs
   - `/api/reports/[cid]` - For historical reports

4. **Testing**
   - Verify existing UI still works
   - Test new endpoints manually

---

## Decisions Made

1. **Job listing source:** Use `listNetworkJobs()` only (all jobs across the network)
2. **Features:** Use Dynamic API - fetch from `/api/features` endpoint
3. **UI additions:** Include UI changes for stop job, stop monitoring, view reports

---

## Part 4: UI Changes

### 4.1 Job List Component
**File:** `components/dashboard/JobList.tsx`

Add action buttons in the button area (around line 158-160):
- **Stop Job button** - Show for jobs with `status === 'running'`
- Uses `Button` component with `variant="danger"`

```tsx
{job.status === 'running' && (
  <Button variant="danger" size="sm" onClick={() => onStopJob(job.id)}>
    Stop Job
  </Button>
)}
```

### 4.2 Job Detail Page
**File:** `app/dashboard/jobs/[jobId]/page.tsx`

Add to header actions section (lines 152-159):
- **Stop Job button** - Conditional on `job.status === 'running'`
- **Stop Monitoring button** - Conditional on `job.duration === 'continuous' && job.status === 'running'`

### 4.3 JobForm Dynamic Features
**File:** `components/dashboard/JobForm.tsx`

Update to fetch features from `/api/features` endpoint instead of static catalog:
- Add `useEffect` to fetch features on mount
- Replace `config.featureCatalog` with fetched data
- Add loading state while fetching

### 4.4 New Hook for Job Actions
**Create:** `lib/hooks/useJobActions.ts`

```typescript
export function useJobActions() {
  const stopJob = async (jobId: string) => { /* calls DELETE /api/jobs/[jobId] */ }
  const stopMonitoring = async (jobId: string, stopType: 'SOFT' | 'HARD') => { /* calls POST /api/jobs/[jobId]/stop-monitoring */ }
  return { stopJob, stopMonitoring };
}
```

### 4.5 Features Hook
**Create:** `lib/hooks/useFeatures.ts`

```typescript
export function useFeatures() {
  const [features, setFeatures] = useState<ListFeaturesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  // Fetches from /api/features
  return { features, loading, refresh };
}
```

---

## Complete File List

### Files to Create
| File | Purpose |
|------|---------|
| `lib/api/jobTransformers.ts` | Type transformation functions |
| `app/api/jobs/[jobId]/route.ts` | Single job GET/DELETE |
| `app/api/jobs/[jobId]/stop-monitoring/route.ts` | Stop monitoring endpoint |
| `app/api/features/route.ts` | Features list endpoint |
| `app/api/reports/[cid]/route.ts` | Report retrieval endpoint |
| `lib/hooks/useJobActions.ts` | Hook for stop/delete actions |
| `lib/hooks/useFeatures.ts` | Hook for dynamic features |

### Files to Modify
| File | Changes |
|------|---------|
| `lib/api/jobs.ts` | Use redmeshApi service + transformers |
| `components/dashboard/JobList.tsx` | Add Stop Job button |
| `app/dashboard/jobs/[jobId]/page.tsx` | Add Stop Job & Stop Monitoring buttons |
| `components/dashboard/JobForm.tsx` | Use dynamic features from API |

---

## Implementation Order

1. **Backend Layer** (no UI changes yet)
   - Create `lib/api/jobTransformers.ts`
   - Update `lib/api/jobs.ts` to use redmeshApi service
   - Create API routes: `/api/jobs/[jobId]`, `/api/features`, `/api/jobs/[jobId]/stop-monitoring`, `/api/reports/[cid]`

2. **Hooks Layer**
   - Create `lib/hooks/useJobActions.ts`
   - Create `lib/hooks/useFeatures.ts`

3. **UI Layer**
   - Update `JobList.tsx` with Stop Job button
   - Update job detail page with Stop Job & Stop Monitoring buttons
   - Update `JobForm.tsx` with dynamic features

4. **Testing**
   - Verify existing functionality still works
   - Test new stop/delete functionality
   - Test dynamic features loading

---

## Notes

- The existing mock mode (`config.mockMode || config.forceMockTasks`) should continue to work
- Authentication token handling should be preserved (passed through headers)
- The `normalizeJob()` function in `lib/api/jobs.ts` has extensive field mapping that should be leveraged in the transformers
- Button component already has `variant="danger"` which is perfect for destructive actions