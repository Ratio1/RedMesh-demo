'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import useJobs from '@/lib/hooks/useJobs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import JobList from '@/components/dashboard/JobList';

export default function DashboardPage(): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();
  const { config } = useAppConfig();
  const { jobs, ongoingJobs, completedJobs, loading: loadingJobs, error, refresh } = useJobs();

  const totalOpenPorts = completedJobs.reduce((acc, job) => {
    const openPorts = job.aggregate?.openPorts ?? [];
    return acc + openPorts.length;
  }, 0);

  const highPriorityActive = jobs.filter(
    (job) => (job.status === 'running' || job.status === 'queued') && (job.priority === 'high' || job.priority === 'critical')
  ).length;

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [user, loading, router]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-200">
        Preparing your workspace...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <Card
          title="Mesh operations overview"
          description="Monitor live and historical jobs running on this Ratio1 Edge Node."
          actions={
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loadingJobs}>
                {loadingJobs ? 'Refreshing...' : 'Refresh'}
              </Button>
              <Button asChild size="sm">
                <Link href="/dashboard/jobs/new">Create job</Link>
              </Button>
            </div>
          }
        >
            <div className="grid gap-4 sm:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-sky-500/10 px-4 py-5 shadow-inner shadow-sky-900/40">
                <p className="text-xs font-medium uppercase tracking-widest text-sky-200">Ongoing</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{ongoingJobs.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-emerald-500/10 px-4 py-5 shadow-inner shadow-emerald-900/40">
                <p className="text-xs font-medium uppercase tracking-widest text-emerald-200">Completed</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{completedJobs.length}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-amber-500/10 px-4 py-5 shadow-inner shadow-amber-900/40">
                <p className="text-xs font-medium uppercase tracking-widest text-amber-200">High priority</p>
                <p className="mt-3 text-3xl font-semibold text-slate-50">{highPriorityActive}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-5 shadow-inner shadow-slate-900/40">
                <p className="text-xs font-medium uppercase tracking-widest text-slate-300">Edge Node</p>
                <p className="mt-3 text-lg font-semibold text-slate-50">
                  {config?.hostId ?? 'Unknown host'}
                </p>
                <p className="text-xs text-slate-400">{config?.mockMode ? 'Mock environment' : 'Live environment'}</p>
              </div>
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                <p className="text-slate-200">Known open ports</p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">{totalOpenPorts}</p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                <p className="text-slate-200">Jobs with findings</p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  {completedJobs.filter((job) => (job.aggregate?.openPorts?.length ?? 0) > 0).length}
                </p>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs text-slate-300">
                <p className="text-slate-200">Errors reported</p>
                <p className="mt-1 text-2xl font-semibold text-slate-50">
                  {jobs.filter((job) => Boolean(job.lastError)).length}
                </p>
              </div>
            </div>
            {error && (
              <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
                {error}
              </div>
            )}
        </Card>
        <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-6">
            <JobList
              title="Ongoing jobs"
              description="Queued and running workflows"
              jobs={ongoingJobs}
              emptyState="No jobs are running at the moment. Create one to get started."
            />
            <JobList
              title="Completed & failed jobs"
              description="Recently finished operations"
              jobs={completedJobs}
              emptyState="No jobs have completed yet."
            />
          </div>
          <Card
            title="Quick actions"
            description="Jump into workload creation or keep refining the dashboard data."
            className="h-fit"
          >
            <div className="space-y-4 text-sm text-slate-200">
              <p>
                Ready to orchestrate a new RedMesh engagement? Use the dedicated creation flow to configure
                targets, features, and worker count with full validation against the Edge Node configuration.
              </p>
              <Button asChild>
                <Link href="/dashboard/jobs/new">Create a new job</Link>
              </Button>
              <p className="text-xs text-slate-400">
                The form mirrors the payload expected by the RedMesh FastAPI (`pentester_api_01`) and will
                surface mock data when Worker variables are missing.
              </p>
            </div>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
