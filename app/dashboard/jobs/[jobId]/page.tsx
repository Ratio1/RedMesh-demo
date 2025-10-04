'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import useJobs from '@/lib/hooks/useJobs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import { format } from 'date-fns';

function formatDate(value?: string): string {
  if (!value) {
    return '--';
  }

  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch (_error) {
    return value;
  }
}

export default function JobDetailsPage(): JSX.Element {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { jobs, refresh, loading: jobsLoading } = useJobs();

  if (!loading && !user) {
    router.replace('/');
    return <main className="flex min-h-screen items-center justify-center">Redirecting...</main>;
  }

  const job = jobs.find((candidate) => candidate.id === params.jobId);

  if (jobsLoading) {
    return (
      <AppShell>
        <Card title="Loading job" description="Fetching the latest telemetry from RedMesh." />
      </AppShell>
    );
  }

  if (!job) {
    return (
      <AppShell>
        <Card title="Job not found" description="Return to the dashboard to view the latest jobs.">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Job detail</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">{job.displayName}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <Badge tone="neutral" label={`Target: ${job.target}`} />
              <Badge tone="neutral" label={`Priority: ${job.priority}`} />
              <Badge tone="neutral" label={`Status: ${job.status}`} />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="secondary" size="sm" onClick={() => refresh()}>
              Refresh job
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card title="Timeline" className="lg:col-span-2">
            <ol className="space-y-3">
              {job.timeline.map((entry) => (
                <li key={`${entry.label}-${entry.at}`} className="flex items-start gap-3 text-sm text-slate-200">
                  <span className="mt-1 h-2 w-2 rounded-full bg-sky-400" />
                  <div>
                    <p className="font-medium text-slate-100">{entry.label}</p>
                    <p className="text-xs text-slate-400">{formatDate(entry.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>

          <Card title="Meta" description="Operational metadata and ownership">
            <dl className="space-y-3 text-sm text-slate-200">
              <div className="flex items-center justify-between">
                <dt>Initiator</dt>
                <dd className="font-semibold text-slate-100">{job.initiator}</dd>
              </div>
              {job.owner && (
                <div className="flex items-center justify-between">
                  <dt>Owner</dt>
                  <dd className="text-slate-100">{job.owner}</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt>Created</dt>
                <dd className="text-slate-100">{formatDate(job.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Started</dt>
                <dd className="text-slate-100">{formatDate(job.startedAt)}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Completed</dt>
                <dd className="text-slate-100">{formatDate(job.completedAt)}</dd>
              </div>
              {job.payloadUri && (
                <div className="flex items-start justify-between gap-3">
                  <dt>Payload URI</dt>
                  <dd className="break-all text-emerald-200">{job.payloadUri}</dd>
                </div>
              )}
              {job.exceptionPorts.length > 0 && (
                <div className="flex items-start justify-between gap-3">
                  <dt>Exception ports</dt>
                  <dd className="text-slate-100">{job.exceptionPorts.join(', ')}</dd>
                </div>
              )}
            </dl>
          </Card>
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card title="Worker activity" description="Per-worker coverage and progress">
            {job.workers.length === 0 ? (
              <p className="text-sm text-slate-300">No workers attached yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
                  <thead className="text-xs uppercase tracking-widest text-slate-400">
                    <tr>
                      <th className="px-3 py-2">Worker</th>
                      <th className="px-3 py-2">Port range</th>
                      <th className="px-3 py-2">Progress</th>
                      <th className="px-3 py-2">Open ports</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {job.workers.map((worker) => (
                      <tr key={worker.id}>
                        <td className="px-3 py-2 font-semibold text-slate-100">{worker.id}</td>
                        <td className="px-3 py-2 text-slate-300">
                          {worker.startPort} - {worker.endPort}
                        </td>
                        <td className="px-3 py-2 text-slate-300">{worker.progress}%</td>
                        <td className="px-3 py-2 text-slate-300">
                          {worker.openPorts.length ? worker.openPorts.join(', ') : 'None'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card title="Aggregate findings" description="Consolidated report from all workers">
            {job.aggregate ? (
              <div className="space-y-4 text-sm text-slate-200">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Open ports</p>
                  <p className="mt-1 font-semibold text-slate-100">
                    {job.aggregate.openPorts.length ? job.aggregate.openPorts.join(', ') : 'None detected'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Service summary</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(job.aggregate.serviceSummary).map(([key, value]) => (
                      <li key={key} className="text-slate-300">
                        <span className="font-medium text-slate-100">{key}:</span> {value}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Web findings</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(job.aggregate.webFindings).map(([key, value]) => (
                      <li key={key} className="text-slate-300">
                        <span className="font-medium text-slate-100">{key}:</span> {value}
                      </li>
                    ))}
                  </ul>
                </div>
                {job.aggregate.notes && (
                  <div>
                    <p className="text-xs uppercase tracking-widest text-slate-400">Notes</p>
                    <p className="mt-1 text-slate-300">{job.aggregate.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-slate-300">Aggregated findings will appear once workers publish their reports.</p>
            )}
          </Card>
        </section>
      </div>
    </AppShell>
  );
}
