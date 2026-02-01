'use client';

import { ReactNode, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Job } from '@/lib/api/types';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { InlineLoader } from '@/components/ui/Loader';
import { formatDistanceToNow, parseISO } from 'date-fns';
import { useJobActions } from '@/lib/hooks/useJobActions';
// Note: Link import removed - using programmatic navigation for loading state

interface JobListProps {
  title: string;
  description?: string;
  jobs: Job[];
  emptyState: string;
  emptyAction?: ReactNode;
  bare?: boolean;
  onJobStopped?: (jobId: string) => void;
}

function StatusBadge({ status }: { status: Job['status'] }): JSX.Element {
  switch (status) {
    case 'running':
      return <Badge tone="warning" label="Running" />;
    case 'stopping':
      return <Badge tone="warning" label="Stopping..." />;
    case 'completed':
      return <Badge tone="success" label="Completed" />;
    case 'stopped':
      return <Badge tone="success" label="Stopped" />;
    default:
      return <Badge tone="neutral" label={status} />;
  }
}

function formatRelative(timestamp?: string): string {
  if (!timestamp) {
    return '--';
  }

  try {
    return formatDistanceToNow(parseISO(timestamp), { addSuffix: true });
  } catch (_error) {
    return timestamp;
  }
}

function LatestEvent({ timeline }: { timeline: Job['timeline'] }): JSX.Element | null {
  if (!timeline.length) {
    return null;
  }

  const latest = timeline.reduce((acc, entry) => (entry.at > acc.at ? entry : acc), timeline[0]);
  return (
    <span className="text-xs text-slate-400">
      Last event: {latest.label} ({formatRelative(latest.at)})
    </span>
  );
}

function computeCompletion(job: Job): number {
  if (job.status === 'completed' || job.status === 'stopped') {
    return 100;
  }
  // 'running' and 'stopping' - calculate from worker progress
  if (job.workers.length) {
    const avg = job.workers.reduce((acc, worker) => acc + (worker.progress ?? 0), 0) / job.workers.length;
    return Math.min(100, Math.max(0, Math.round(avg)));
  }
  return 0;
}

export default function JobList({
  title,
  description,
  jobs,
  emptyState,
  emptyAction,
  bare = false,
  onJobStopped
}: JobListProps): JSX.Element {
  const router = useRouter();
  const { stopJob, loading: actionLoading } = useJobActions();
  const [stoppingJobId, setStoppingJobId] = useState<string | null>(null);
  const [navigatingToJobId, setNavigatingToJobId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleViewDetails = (jobId: string) => {
    setNavigatingToJobId(jobId);
    router.push(`/dashboard/tasks/${jobId}`);
  };

  const handleStopJob = async (job: Job) => {
    const confirmed = window.confirm(
      `Are you sure you want to stop the job "${job.displayName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) {
      return;
    }

    setStoppingJobId(job.id);
    setActionError(null);

    try {
      await stopJob(job.id);
      onJobStopped?.(job.id);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop job.';
      setActionError(message);
      // Show error as alert for now (toast would be better)
      window.alert(`Error: ${message}`);
    } finally {
      setStoppingJobId(null);
    }
  };

  const content =
    jobs.length === 0 ? (
      <div className="flex items-center justify-between rounded-xl border border-dashed border-white/15 bg-slate-900/50 px-4 py-6 text-sm text-slate-200">
        <div>
          <p>{emptyState}</p>
          {emptyAction && <div className="mt-3">{emptyAction}</div>}
        </div>
      </div>
    ) : (
      <div className="space-y-4">
        {jobs.map((job) => (
          <article
            key={job.id}
            className="rounded-2xl border border-white/10 bg-slate-900/70 p-5 shadow-inner shadow-slate-950/40 transition hover:border-brand-primary/50"
          >
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-3">
                <h3 className="text-lg font-semibold text-slate-100">{job.displayName}</h3>
                <StatusBadge status={job.status} />
                <Badge
                  tone={job.runMode === 'continuous' ? 'warning' : 'neutral'}
                  label={job.runMode === 'continuous' ? 'Continuous' : 'Single Pass'}
                />
                <Badge tone="neutral" label={`Priority: ${job.priority}`} />
                <Badge tone="neutral" label={`Workers: ${job.workerCount}`} />
                {job.runMode === 'continuous' && job.currentPass > 1 && (
                  <Badge tone="success" label={`Pass #${job.currentPass}`} />
                )}
              </div>
              <p className="text-sm text-slate-300">{job.summary}</p>
              <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                <span>Target: {job.target}</span>
                <span>Ports: {job.portRange.start}-{job.portRange.end}</span>
                <span>Initiator: {job.initiator}</span>
                {job.owner && <span>Owner: {job.owner}</span>}
                <span>Created {formatRelative(job.createdAt)}</span>
                {job.startedAt && <span>Started {formatRelative(job.startedAt)}</span>}
                {job.completedAt && <span>Completed {formatRelative(job.completedAt)}</span>}
              </div>
              <LatestEvent timeline={job.timeline} />
              {job.aggregate && job.aggregate.openPorts.length > 0 && (
                <div className="rounded-xl border border-brand-primary/25 bg-brand-primary/10 p-4 text-xs text-slate-100">
                  <p className="text-sm font-semibold text-brand-primary">Aggregate findings</p>
                  <div className="mt-2 flex flex-wrap gap-3">
                    <span>
                      Open ports:{' '}
                      <span className="font-semibold text-brand-primary">
                        {job.aggregate.openPorts.join(', ')}
                      </span>
                    </span>
                    <span>
                      Services monitored: {Object.keys(job.aggregate.serviceSummary).length}
                    </span>
                  </div>
                </div>
              )}
              {job.lastError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/15 p-3 text-xs text-rose-100">
                  Last error: {job.lastError}
                </div>
              )}
              <div className="flex flex-col gap-3 border-t border-white/10 pt-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="w-full max-w-xl">
                  <div className="flex items-center justify-between text-[11px] uppercase tracking-[0.12em] text-slate-400">
                    <span>Completion</span>
                    <span className="text-slate-200">{computeCompletion(job)}%</span>
                  </div>
                  <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-white/10">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-500 to-emerald-600 transition-[width] duration-300"
                      style={{ width: `${computeCompletion(job)}%` }}
                    />
                  </div>
                </div>
                <div className="flex gap-2 lg:self-end">
                  {job.status === 'running' && (
                    <Button
                      variant="danger"
                      size="sm"
                      onClick={() => handleStopJob(job)}
                      disabled={stoppingJobId === job.id || actionLoading}
                    >
                      {stoppingJobId === job.id ? 'Stopping...' : 'Stop'}
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
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => handleViewDetails(job.id)}
                    disabled={navigatingToJobId === job.id}
                  >
                    {navigatingToJobId === job.id ? (
                      <>
                        <InlineLoader className="mr-2" />
                        Loading...
                      </>
                    ) : (
                      'View details'
                    )}
                  </Button>
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>
    );

  if (bare) {
    return content;
  }

  return (
    <Card title={title} description={description}>
      {content}
    </Card>
  );
}
