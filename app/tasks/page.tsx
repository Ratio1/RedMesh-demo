'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useEffect } from 'react';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import useJobs from '@/lib/hooks/useJobs';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import JobList from '@/components/dashboard/JobList';
import Loader, { JobListSkeleton } from '@/components/ui/Loader';
import { useRouter } from 'next/navigation';

type Filter = 'ongoing' | 'completed' | 'failed' | 'all';

export default function TasksPage(): JSX.Element {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const { jobs, ongoingJobs, completedJobs, failedJobs, loading, error, refresh } = useJobs();
  const [filter, setFilter] = useState<Filter>('ongoing');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/');
    }
  }, [authLoading, user, router]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-200">
        <Loader size="lg" message="Preparing workspace..." />
      </main>
    );
  }

  // Show skeletons while jobs are loading for the first time
  if (loading && jobs.length === 0) {
    return (
      <AppShell>
        <div className="space-y-6">
          <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tasks</p>
              <h1 className="text-3xl font-semibold text-slate-50">Task console</h1>
              <p className="text-sm text-slate-300">
                Review ongoing, completed, and failed tasks across your RedMesh mesh.
              </p>
            </div>
          </header>
          <Card
            title="Tasks"
            description="Filter tasks by status and inspect details."
          >
            <JobListSkeleton count={4} />
          </Card>
        </div>
      </AppShell>
    );
  }

  const filtered = (() => {
    switch (filter) {
      case 'ongoing':
        return ongoingJobs;
      case 'completed':
        return completedJobs;
      case 'failed':
        return failedJobs;
      default:
        return jobs;
    }
  })();

  const emptyState =
    filter === 'ongoing' ? 'No ongoing tasks right now.' : 'No tasks in this state right now.';

  return (
    <AppShell>
      <div className="space-y-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Tasks</p>
            <h1 className="text-3xl font-semibold text-slate-50">Task console</h1>
            <p className="text-sm text-slate-300">
              Review ongoing, completed, and failed tasks across your RedMesh mesh.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => refresh()} disabled={loading}>
              {loading ? 'Refreshing...' : 'Refresh'}
            </Button>
            <Button asChild size="sm">
              <Link href="/dashboard/jobs/new">Create task</Link>
            </Button>
          </div>
        </header>

        <Card
          title="Tasks"
          description="Filter tasks by status and inspect details."
          actions={
            <div className="flex flex-wrap gap-2">
              {(['ongoing', 'completed', 'failed', 'all'] as const).map((option) => (
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
            jobs={filtered}
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
          {error && (
            <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
              {error}
            </div>
          )}
        </Card>
        <Card
          title="Download report"
          description="Export the current task list for auditing."
          actions={
            <Button variant="secondary" size="sm">
              Download
            </Button>
          }
        >
          <p className="text-sm text-slate-300">
            Generate a CSV snapshot of the filtered tasks, including statuses, targets, and timestamps.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
