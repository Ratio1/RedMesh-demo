'use client';

import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import type { Job } from '@/lib/api/types';

const DEFAULT_PORT_START = 1;
const DEFAULT_PORT_END = 65535;

interface JobHeaderProps {
  job: Job;
  stopping: boolean;
  stoppingMonitoring: boolean;
  actionLoading: boolean;
  onStopJob: () => void;
  onStopMonitoring: () => void;
  onRefresh: () => void;
}

export function JobHeader({
  job,
  stopping,
  stoppingMonitoring,
  actionLoading,
  onStopJob,
  onStopMonitoring,
  onRefresh,
}: JobHeaderProps) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Task detail</p>
        <h1 className="mt-2 text-3xl font-semibold text-slate-50">{job.displayName}</h1>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Badge tone="neutral" label={`Target: ${job.target}`} />
          <Badge tone="neutral" label={`Priority: ${job.priority}`} />
          <Badge tone="neutral" label={`Status: ${job.status}`} />
          <Badge
            tone={job.runMode === 'continuous' ? 'warning' : 'neutral'}
            label={job.runMode === 'continuous' ? 'Continuous Monitoring' : 'Single Pass'}
          />
          <Badge tone="neutral" label={`${(job.distribution ?? 'slice').toUpperCase()}`} />
          <Badge tone="neutral" label={`Ports: ${job.portRange?.start ?? DEFAULT_PORT_START}-${job.portRange?.end ?? DEFAULT_PORT_END}`} />
        </div>
      </div>
      <div className="flex flex-wrap gap-3">
        {job.status === 'running' && (
          <Button
            variant="danger"
            size="sm"
            onClick={onStopJob}
            disabled={stopping || actionLoading}
          >
            {stopping ? 'Stopping...' : 'Stop Job'}
          </Button>
        )}
        {job.status === 'stopping' && (
          <Button
            variant="danger"
            size="sm"
            disabled
            title="Stop already requested"
          >
            Stopping...
          </Button>
        )}
        {job.duration === 'continuous' && job.status === 'running' && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onStopMonitoring}
            disabled={stoppingMonitoring || actionLoading}
          >
            {stoppingMonitoring ? 'Stopping...' : 'Stop Monitoring'}
          </Button>
        )}
        {job.duration === 'continuous' && job.status === 'stopping' && (
          <Button
            variant="secondary"
            size="sm"
            disabled
            title="Stop already requested"
          >
            Stopping...
          </Button>
        )}
        <Button variant="secondary" size="sm" onClick={onRefresh}>
          Refresh task
        </Button>
        <Button asChild variant="secondary" size="sm">
          <Link href="/dashboard">Back to dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
