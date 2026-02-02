'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import useJobs from '@/lib/hooks/useJobs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import JobList from '@/components/dashboard/JobList';
import Loader, { JobListSkeleton, DashboardStatsSkeleton } from '@/components/ui/Loader';

export default function DashboardPage(): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { config } = useAppConfig();
  const { jobs, ongoingJobs, completedJobs, stoppedJobs, loading: loadingJobs, error, refresh } = useJobs();
  const [filter, setFilter] = useState<'ongoing' | 'completed' | 'stopped'>('completed');

  // Jobs that have at least one completed pass (have findings data)
  const finishedJobs = [...completedJobs, ...stoppedJobs];
  const jobsWithPassHistory = finishedJobs.filter((job) => job.passHistory && job.passHistory.length > 0);

  const filteredJobs = filter === 'ongoing' ? ongoingJobs : filter === 'stopped' ? stoppedJobs : completedJobs;

  const emptyState =
    filter === 'ongoing' ? 'No ongoing tasks right now.' :
    filter === 'stopped' ? 'No stopped tasks.' :
    'No completed tasks yet.';

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-200">
        <Loader size="lg" message="Preparing your workspace..." />
      </main>
    );
  }

  // Show skeletons while jobs are loading for the first time
  if (loadingJobs && jobs.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <Card
            title="Mesh operations overview"
            description="Monitor live and historical tasks running on this Ratio1 Edge Node."
          >
            <DashboardStatsSkeleton />
          </Card>
          <Card
            title="Tasks"
            description="Filter tasks by status and inspect their details."
          >
            <JobListSkeleton count={3} />
          </Card>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Card
          title="Mesh operations overview"
          description="Monitor live and historical tasks running on this Ratio1 Edge Node."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loadingJobs}>
                {loadingJobs ? 'Refreshing...' : 'Refresh'}
              </Button>
            </div>
          }
        >
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="relative overflow-hidden rounded-2xl border border-emerald-500/40 bg-emerald-500/5 px-4 py-5 shadow-inner shadow-emerald-900/40">
                <div className="absolute inset-0 animate-pulse bg-emerald-500/15" aria-hidden />
                <div className="relative">
                  <p className="text-xs font-medium uppercase tracking-widest text-emerald-200">Ongoing</p>
                  <p className="mt-3 text-3xl font-semibold text-slate-50">{ongoingJobs.length}</p>
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-5 shadow-inner shadow-emerald-900/40">
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-200">Completed</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{completedJobs.length}</p>
              </div>
              <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-5 shadow-inner shadow-amber-900/40">
                <p className="text-xs font-medium uppercase tracking-widest text-amber-200">Stopped</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">
                  {stoppedJobs.length}
                </p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/60 px-4 py-5 shadow-inner shadow-black/40">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-300">Edge Node</p>
                <p className="mt-3 text-lg font-semibold text-slate-50">
                  {config?.hostId ?? 'Unknown host'}
                </p>
                <p className="text-xs text-slate-400">{config?.mockMode ? 'Mock environment' : 'Live environment'}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-brand-primary/30 bg-brand-primary/10 px-4 py-3 text-xs text-slate-300">
                <p className="text-brand-primary font-medium">Total tasks</p>
                <p className="mt-1 text-2xl font-semibold text-brand-primary">{jobs.length}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
                <p className="text-slate-200">Tasks with scan data</p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  {jobsWithPassHistory.length}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-slate-900/60 px-4 py-3 text-xs text-slate-300">
                <p className="text-slate-200">Errors reported</p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  {jobs.filter((job) => Boolean(job.lastError)).length}
                </p>
              </div>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-[#e23d4b]/30 bg-[#e23d4b]/15 px-4 py-3 text-sm text-slate-100">
                {error}
              </div>
            )}
        </Card>
        <Card
          title="Tasks"
          description="Filter tasks by status and inspect their details."
          actions={
            <div className="flex gap-2">
              {(['completed', 'ongoing', 'stopped'] as const).map((option) => (
                <Button
                  key={option}
                  variant={filter === option ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setFilter(option)}
                >
                  {option.charAt(0).toUpperCase() + option.slice(1)}
                </Button>
              ))}
            </div>
          }
        >
          <JobList
            title=""
            description=""
            jobs={filteredJobs}
            emptyState={emptyState}
            emptyAction={
              filter === 'ongoing' ? (
                <Button asChild size="sm">
                  <Link href="/dashboard/jobs/new">Create task now</Link>
                </Button>
              ) : undefined
            }
            bare
          />
        </Card>
      </div>
    </AppShell>
  );
}
