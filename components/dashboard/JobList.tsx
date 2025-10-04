'use client';

import Link from 'next/link';
import { Job } from '@/lib/api/types';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { formatDistanceToNow, parseISO } from 'date-fns';

interface JobListProps {
  title: string;
  description?: string;
  jobs: Job[];
  emptyState: string;
}

function StatusBadge({ status }: { status: Job['status'] }): JSX.Element {
  switch (status) {
    case 'running':
      return <Badge tone="warning" label="Running" />;
    case 'completed':
      return <Badge tone="success" label="Completed" />;
    case 'failed':
      return <Badge tone="danger" label="Failed" />;
    case 'queued':
      return <Badge tone="neutral" label="Queued" />;
    case 'cancelled':
      return <Badge tone="neutral" label="Cancelled" />;
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

export default function JobList({ title, description, jobs, emptyState }: JobListProps): JSX.Element {
  return (
    <Card title={title} description={description}>
      {jobs.length === 0 ? (
        <div className="flex items-center justify-between rounded-xl border border-dashed border-white/15 bg-white/5 px-4 py-6 text-sm text-slate-300">
          <p>{emptyState}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {jobs.map((job) => (
            <article
              key={job.id}
              className="rounded-2xl border border-white/10 bg-slate-900/60 p-5 shadow-inner shadow-slate-900/40 transition hover:border-sky-400/40"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <h3 className="text-lg font-semibold text-slate-100">{job.displayName}</h3>
                    <StatusBadge status={job.status} />
                    <Badge tone="neutral" label={`Priority: ${job.priority}`} />
                    <Badge tone="neutral" label={`Workers: ${job.workerCount}`} />
                  </div>
                  <p className="text-sm text-slate-300/90">{job.summary}</p>
                  <div className="flex flex-wrap gap-4 text-xs text-slate-400">
                    <span>Target {job.target}</span>
                    <span>Initiator {job.initiator}</span>
                    {job.owner && <span>Owner {job.owner}</span>}
                    <span>Created {formatRelative(job.createdAt)}</span>
                    {job.startedAt && <span>Started {formatRelative(job.startedAt)}</span>}
                    {job.completedAt && <span>Completed {formatRelative(job.completedAt)}</span>}
                  </div>
                  <LatestEvent timeline={job.timeline} />
                  {job.aggregate && job.aggregate.openPorts.length > 0 && (
                    <div className="rounded-xl border border-sky-400/20 bg-sky-500/10 p-4 text-xs text-sky-100">
                      <p className="text-sm font-semibold text-sky-200">Aggregate findings</p>
                      <div className="mt-2 flex flex-wrap gap-3">
                        <span>
                          Open ports: {job.aggregate.openPorts.join(', ')}
                        </span>
                        <span>
                          Services monitored: {Object.keys(job.aggregate.serviceSummary).length}
                        </span>
                      </div>
                    </div>
                  )}
                  {job.lastError && (
                    <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-100">
                      Last error: {job.lastError}
                    </div>
                  )}
                </div>
                <div className="flex flex-col items-end gap-3">
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/dashboard/jobs/${job.id}`}>View details</Link>
                  </Button>
                  {job.workers.length > 0 && (
                    <div className="space-y-2 rounded-xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200">
                      <p className="text-sm font-semibold text-slate-100">Worker progress</p>
                      <ul className="space-y-2">
                        {job.workers.slice(0, 3).map((worker) => (
                          <li key={worker.id} className="flex items-center justify-between gap-4">
                            <span className="font-medium text-slate-100">{worker.id}</span>
                            <span className="text-slate-300">{worker.progress}%</span>
                          </li>
                        ))}
                        {job.workers.length > 3 && (
                          <li className="text-slate-400">+{job.workers.length - 3} more workers</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </Card>
  );
}
