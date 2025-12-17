# Backend Implementation: Task Name and Description Fields

## Overview

The frontend UI has input fields for task `name` and `description` when creating a job. These are sent as `task_name` and `task_description` to match the backend API.

## Current Backend Endpoint

```python
def launch_test(
    self,
    target: str = "",
    start_port: int = 1,
    end_port: int = 65535,
    exceptions: str = "64297",
    distribution_strategy: str = "",
    port_order: str = "",
    excluded_features: list[str] = None,
    run_mode: str = "",
    monitor_interval: int = 0,
    scan_min_delay: float = 0.0,
    scan_max_delay: float = 0.0,
    task_name: str = "",        # Human-readable job name
    task_description: str = "", # Job description/summary
):
```

## Frontend Mapping

| Frontend Field | Backend Parameter | Notes |
|---------------|-------------------|-------|
| `name` | `task_name` | Optional, user-provided job name |
| `summary` | `task_description` | Optional, user-provided description |
| `scanDelay.minSeconds` | `scan_min_delay` | Delay between scans (dune sand walking) |
| `scanDelay.maxSeconds` | `scan_max_delay` | Delay between scans (dune sand walking) |

## Implementation Tasks

### Task 1: Store fields in JobSpecs

Ensure `task_name` and `task_description` are stored in the job specs dictionary:

```python
job_specs = {
    "job_id": job_id,
    "target": target,
    # ... existing fields ...
    "task_name": task_name,
    "task_description": task_description,
}
```

### Task 2: Return fields in job responses

Ensure the fields are returned when listing jobs or getting job status:

```python
return {
    "job_id": job_specs["job_id"],
    "target": job_specs["target"],
    "task_name": job_specs.get("task_name", ""),
    "task_description": job_specs.get("task_description", ""),
    # ... other fields
}
```

## Fallback Behavior

If `task_name` is not provided, the frontend generates a display name:
```typescript
displayName: specs.task_name || `${specs.target} - ${specs.job_id.slice(0, 8)}`
```

If `task_description` is not provided, the frontend uses a default:
```typescript
summary: specs.task_description || 'RedMesh scan job'
```
