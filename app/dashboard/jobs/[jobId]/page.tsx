'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import useJob from '@/lib/hooks/useJob';
import { useJobActions } from '@/lib/hooks/useJobActions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Loader from '@/components/ui/Loader';

// Local hooks
import { useAggregatedPorts, useWorkerActivity, useMergedWorkers } from './hooks';

// Local components
import {
  JobHeader,
  AggregateFindings,
  JobMeta,
  DiscoveredPorts,
  WorkerActivityTable,
  JobTimeline,
  DetailedWorkerReports,
  WorkerReportsHistory,
  LlmAnalysis,
} from './components';

// PDF generation
import { generateJobReport } from '@/lib/pdf/generateJobReport';

export default function JobDetailsPage(): JSX.Element {
  const params = useParams<{ jobId: string }>();
  const router = useRouter();
  const { user, loading } = useAuth();
  const { job, reports, llmAnalyses, refresh, loading: jobLoading, error: jobError, notFound } = useJob(params.jobId);
  const { stopJob, stopMonitoring, loading: actionLoading } = useJobActions();

  const [stopping, setStopping] = useState(false);
  const [stoppingMonitoring, setStoppingMonitoring] = useState(false);

  // Derived data
  const aggregatedPorts = useAggregatedPorts(reports, job);
  const workerActivity = useWorkerActivity(reports);
  const mergedWorkers = useMergedWorkers(job, reports);

  // Event handlers
  const handleStopJob = async () => {
    if (!job) return;

    const confirmed = window.confirm(
      `Are you sure you want to stop the job "${job.displayName}"?\n\nThis action cannot be undone.`
    );

    if (!confirmed) return;

    setStopping(true);
    try {
      await stopJob(params.jobId);
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop job.';
      window.alert(`Error: ${message}`);
    } finally {
      setStopping(false);
    }
  };

  const handleStopMonitoring = async () => {
    if (!job) return;

    const confirmed = window.confirm(
      `Stop monitoring for "${job.displayName}"?\n\nThe current pass will complete before stopping (SOFT stop).`
    );

    if (!confirmed) return;

    setStoppingMonitoring(true);
    try {
      await stopMonitoring(params.jobId, 'SOFT');
      await refresh();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop monitoring.';
      window.alert(`Error: ${message}`);
    } finally {
      setStoppingMonitoring(false);
    }
  };

  const handleDownload = () => {
    if (!job) return;
    generateJobReport({
      job,
      reports,
      aggregatedPorts,
      workerActivity,
    });
  };

  // Auth redirect
  if (!loading && !user) {
    router.replace('/');
    return <main className="flex min-h-screen items-center justify-center">Redirecting...</main>;
  }

  // Loading state
  if (jobLoading || loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader size="lg" message="Fetching task telemetry..." />
        </div>
      </AppShell>
    );
  }

  // Error state
  if (jobError) {
    return (
      <AppShell>
        <Card title="Unable to load task" description={jobError}>
          <Button variant="secondary" onClick={() => refresh()}>
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }

  // Not found state
  if (notFound) {
    return (
      <AppShell>
        <Card title="Task not found" description="Return to the dashboard to view the latest tasks.">
          <Button asChild>
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </Card>
      </AppShell>
    );
  }

  // Fallback loader
  if (!job) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader size="lg" message="Fetching task telemetry..." />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <JobHeader
          job={job}
          stopping={stopping}
          stoppingMonitoring={stoppingMonitoring}
          actionLoading={actionLoading}
          onStopJob={handleStopJob}
          onStopMonitoring={handleStopMonitoring}
          onRefresh={refresh}
        />

        <section className="grid gap-6 lg:grid-cols-3">
          <AggregateFindings job={job} aggregatedPorts={aggregatedPorts} />
          <JobMeta job={job} workerActivity={workerActivity} />
        </section>

        {/* LLM Analysis for singlepass jobs - show above discovered ports */}
        {job.runMode === 'singlepass' && llmAnalyses[1] && (
          <section>
            <LlmAnalysis analysis={llmAnalyses[1]} />
          </section>
        )}

        <section>
          <DiscoveredPorts aggregatedPorts={aggregatedPorts} />
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <WorkerActivityTable workerActivity={workerActivity} />
          <JobTimeline timeline={job.timeline} />
        </section>

        <DetailedWorkerReports mergedWorkers={mergedWorkers} />

        <WorkerReportsHistory job={job} reports={reports} llmAnalyses={llmAnalyses} />

        <Card
          title="Download report"
          description="Export this task for offline review."
          actions={
            <Button variant="primary" size="sm" onClick={handleDownload}>
              Download
            </Button>
          }
        >
          <p className="text-sm text-slate-300">
            Download a summary of this task including timeline, worker activity, and aggregate findings.
          </p>
        </Card>
      </div>
    </AppShell>
  );
}
