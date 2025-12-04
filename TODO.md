# Update Plan

Context from the brief: single-user admin login via injected `REDMESH_PASSWORD` (no token, no CStore), jobs distribute port ranges across workers or mirror ranges, and runs can be single-pass or continuous with optional tempo windows.

Observed gaps and opportunities in the current codebase:
- Auth (`components/auth/AuthContext.tsx`, `app/api/auth/login/route.ts`): still carries token/CStore branches and mock credentials instead of a minimal admin+password flow; login UI does not surface the injected password mode.
- Job model (`components/dashboard/JobForm.tsx`, `app/api/jobs/route.ts`, `lib/api/jobs.ts`): form and API omit distribution mode, duration (single-pass vs continuous), and tempo windows; worker slicing is implicit via `workerCount` only; Bearer header is sent even when no token exists.
- Config & docs (`lib/config/env.ts`, `README.md`): mock mode should only depend on missing endpoints/host, not on absent tokens; the simple admin password flow needs clearer documentation.
- Refresh & observability (`lib/hooks/useJobs.ts`, dashboard pages): jobs load once per mount and rely on manual refresh despite the spec calling for live progress from peers.
- Mock/test coverage (`lib/api/mockData.ts`, `__tests__`): mock jobs lack the new spec fields; no coverage for missing-token-but-live-mode auth, nor for empty-Authorization headers.

Refactor + code review plan (surgical steps):
1) **Authentication simplification**
   - Collapse auth to the injected `REDMESH_PASSWORD` for user `admin`, with optional mock credentials only when endpoints are missing.
   - Strip CStore/token handling from `AuthContext`, API route, and fetch helpers; ensure session storage only tracks the admin session.
   - Surface the active auth mode on the login screen and add a brief “admin + injected password” helper text.
   - Tests: cover correct password login, wrong password rejection, and mock-mode fallback.

2) **Job creation parity with brief**
   - Extend `lib/api/types.ts` + `lib/api/jobs.ts` normalization to carry `distribution` (split vs mirror), `duration` (single/continuous), and `tempo` (min/max seconds) fields.
   - Update `app/api/jobs/route.ts` validation and payload mapping; ensure mock responses in `lib/api/mockData.ts` seed these fields.
   - Expand `components/dashboard/JobForm.tsx` to capture the new options (with sane defaults per brief) and show them on `/dashboard/jobs/[jobId]`.
   - Tests: happy/failure paths for new fields in API route + JobForm UI.

3) **Runtime config simplification**
   - Keep `mockMode` tied to missing endpoints/host only; document the “local API + admin password” flow in `app/api/config/route.ts` and the README.
   - Clarify env expectations for CAR/WAR + PentesterApi01Plugin boot and the injected password in docs.

4) **Jobs data refresh**
   - Add lightweight polling (or backoff-based refresh) to `lib/hooks/useJobs.ts`; surface “last updated” in dashboard cards.
   - Guard against overlapping fetches with `AbortController`; keep manual refresh as an override.
   - Tests: verify polling interval and cleanup on unmount.

5) **API client cleanup**
   - Introduce a tiny JSON/request helper to centralize error parsing for `useJobs`, `AuthContext`, and `JobForm` instead of duplicating fetch + `response.json()` patterns.
   - Document the RedMesh FastAPI field mapping (e.g., `port_range`, `events`) near `lib/api/jobs.ts` to ease future reviews.

6) **Mock + UX polish**
   - Update mock jobs to reflect multi-worker slices vs mirrored ranges and include tempo/duration so UI states can be reviewed offline.
   - Add contextual hints in `JobForm` for distribution/tempo defaults and in `app/dashboard/jobs/[jobId]/page.tsx` to flag continuous runs.
