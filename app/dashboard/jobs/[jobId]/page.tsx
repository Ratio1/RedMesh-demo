'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import useJobs from '@/lib/hooks/useJobs';
import { useJobActions } from '@/lib/hooks/useJobActions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import CopyableText from '@/components/ui/CopyableText';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import type { WorkerReport } from '@/lib/api/types';

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
  const { jobs, reports, refresh, loading: jobsLoading, error: jobsError } = useJobs();
  const { stopJob, stopMonitoring, loading: actionLoading } = useJobActions();
  const [stopping, setStopping] = useState(false);
  const [stoppingMonitoring, setStoppingMonitoring] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  const handleStopJob = async () => {
    const job = jobs.find((candidate) => candidate.id === params.jobId);
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
    const job = jobs.find((candidate) => candidate.id === params.jobId);
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
    const doc = new jsPDF();
    let y = 16;

    const addSection = (title: string, lines: string[]) => {
      doc.setFont('Helvetica', 'bold');
      doc.text(title, 15, y);
      y += 6;
      doc.setFont('Helvetica', 'normal');
      lines.forEach((line) => {
        const wrapped = doc.splitTextToSize(line, 180);
        doc.text(wrapped, 15, y);
        y += wrapped.length * 6;
      });
      y += 4;
    };

    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(14);
    doc.text('RedMesh Task Report', 15, 22);
    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, 15, 28);
    doc.line(15, 32, 195, 32);
    y = 38;

    addSection('Overview', [
      `Task: ${job.displayName}`,
      `Status: ${job.status}`,
      `Priority: ${job.priority}`,
      `Target: ${job.target}`,
      `Summary: ${job.summary}`
    ]);

    addSection('Ownership & Timing', [
      `Initiator: ${job.initiator}`,
      `Owner: ${job.owner ?? '—'}`,
      `Created: ${formatDate(job.createdAt)}`,
      `Started: ${formatDate(job.startedAt)}`,
      `Completed: ${formatDate(job.completedAt)}`
    ]);

    if (job.payloadUri) {
      addSection('Payload', [`URI: ${job.payloadUri}`]);
    }

    if (job.exceptionPorts.length) {
      addSection('Exception ports', [job.exceptionPorts.join(', ')]);
    }

    if (job.timeline.length) {
      addSection(
        'Timeline',
        job.timeline.map((entry) => `${entry.label} @ ${formatDate(entry.at)}`)
      );
    }

    if (job.aggregate) {
      addSection('Aggregate findings', [
        `Open ports: ${job.aggregate.openPorts.length ? job.aggregate.openPorts.join(', ') : 'None detected'}`,
        `Services: ${Object.keys(job.aggregate.serviceSummary).join(', ') || 'None'}`,
        `Web findings: ${Object.keys(job.aggregate.webFindings).join(', ') || 'None'}`
      ]);
    }

    // Worker Reports from pass_history
    if (job.passHistory && job.passHistory.length > 0) {
      job.passHistory.forEach((pass) => {
        // Check if we need a new page
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        addSection(`Pass #${pass.passNr} - Completed: ${formatDate(pass.completedAt)}`, []);

        Object.entries(pass.reports).forEach(([nodeAddr, cid]) => {
          const report = reports[cid] as WorkerReport | undefined;
          const shortAddr = `${nodeAddr.slice(0, 20)}...`;

          if (report) {
            // Check if we need a new page
            if (y > 220) {
              doc.addPage();
              y = 20;
            }

            const reportLines = [
              `Worker Node: ${shortAddr}`,
              `Local Worker ID: ${report.localWorkerId || 'N/A'}`,
              `Target: ${report.target || 'N/A'}`,
              `Port Range: ${report.startPort} - ${report.endPort}`,
              `Ports Scanned: ${report.portsScanned}`,
              `Progress: ${report.progress}`,
              `Status: ${report.done ? 'Done' : report.canceled ? 'Canceled' : 'In Progress'}`,
              `Open Ports Count: ${report.nrOpenPorts || 0}`,
              `Open Ports: ${report.openPorts?.length ? report.openPorts.join(', ') : 'None'}`,
              `Web Tested: ${report.webTested ? 'Yes' : 'No'}`
            ];

            if (report.exceptions?.length) {
              reportLines.push(`Exception Ports: ${report.exceptions.join(', ')}`);
            }

            if (report.initiator) {
              reportLines.push(`Initiator: ${report.initiator.slice(0, 30)}...`);
            }

            if (report.jobId) {
              reportLines.push(`Job ID: ${report.jobId}`);
            }

            if (report.completedTests?.length) {
              reportLines.push(`Completed Tests (${report.completedTests.length}): ${report.completedTests.join(', ')}`);
            }

            reportLines.push(`Report CID: ${cid}`);

            addSection('Worker Report:', reportLines);

            // Add service info if available
            if (report.serviceInfo && Object.keys(report.serviceInfo).length > 0) {
              // Check if we need a new page
              if (y > 240) {
                doc.addPage();
                y = 20;
              }
              const serviceLines = Object.entries(report.serviceInfo).map(([port, info]) => {
                const infoStr = typeof info === 'object' ? JSON.stringify(info) : String(info);
                return `  Port ${port}: ${infoStr.slice(0, 100)}${infoStr.length > 100 ? '...' : ''}`;
              });
              addSection(`  Service Info (${Object.keys(report.serviceInfo).length} services):`, serviceLines);
            }

            // Add web test results if available
            if (report.webTestsInfo && Object.keys(report.webTestsInfo).length > 0) {
              // Check if we need a new page
              if (y > 240) {
                doc.addPage();
                y = 20;
              }
              const webLines = Object.entries(report.webTestsInfo).map(([test, result]) => {
                const resultStr = typeof result === 'object' ? JSON.stringify(result) : String(result);
                return `  ${test}: ${resultStr.slice(0, 80)}${resultStr.length > 80 ? '...' : ''}`;
              });
              addSection(`  Web Test Results (${Object.keys(report.webTestsInfo).length} tests):`, webLines);
            }
          } else {
            addSection('Worker Report:', [`Worker Node: ${shortAddr}`, `Report CID: ${cid}`, 'Report data not available']);
          }
        });
      });
    }

    doc.save(`task-${job.id}.pdf`);
  };

  if (!loading && !user) {
    router.replace('/');
    return <main className="flex min-h-screen items-center justify-center">Redirecting...</main>;
  }

  const job = jobs.find((candidate) => candidate.id === params.jobId);

  if (jobsLoading) {
    return (
      <AppShell>
        <Card title="Loading task" description="Fetching the latest telemetry from RedMesh." />
      </AppShell>
    );
  }

  if (jobsError) {
    return (
      <AppShell>
        <Card title="Unable to load task" description={jobsError}>
          <Button variant="secondary" onClick={() => refresh()}>
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }

  if (!job) {
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

  return (
    <AppShell>
      <div className="space-y-6">
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
              <Badge tone="neutral" label={`Ports: ${job.portRange.start}-${job.portRange.end}`} />
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {(job.status === 'running' || job.status === 'queued') && (
              <Button
                variant="danger"
                size="sm"
                onClick={handleStopJob}
                disabled={stopping || actionLoading}
              >
                {stopping ? 'Stopping...' : 'Stop Job'}
              </Button>
            )}
            {job.duration === 'continuous' && job.status === 'running' && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleStopMonitoring}
                disabled={stoppingMonitoring || actionLoading}
              >
                {stoppingMonitoring ? 'Stopping...' : 'Stop Monitoring'}
              </Button>
            )}
            <Button variant="secondary" size="sm" onClick={() => refresh()}>
              Refresh task
            </Button>
            <Button asChild variant="secondary" size="sm">
              <Link href="/dashboard">Back to dashboard</Link>
            </Button>
          </div>
        </div>

        <section className="grid gap-6 lg:grid-cols-3">
          <Card title="Aggregate findings" description="Consolidated report from all workers" className="lg:col-span-2">
            {job.aggregate ? (
              <div className="space-y-4 text-sm text-slate-300">
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Open ports</p>
                  <p className="mt-1 font-semibold text-slate-50">
                    {job.aggregate.openPorts.length ? job.aggregate.openPorts.join(', ') : 'None detected'}
                  </p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Service summary</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(job.aggregate.serviceSummary).map(([key, value]) => (
                      <li key={key} className="text-slate-300">
                        <span className="font-medium text-slate-50">{key}:</span> {value}
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400">Web findings</p>
                  <ul className="mt-1 space-y-1">
                    {Object.entries(job.aggregate.webFindings).map(([key, value]) => (
                      <li key={key} className="text-slate-300">
                        <span className="font-medium text-slate-50">{key}:</span> {value}
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
              <p className="text-sm text-slate-400">Aggregated findings will appear once workers publish their reports.</p>
            )}
          </Card>

          <Card title="Meta" description="Operational metadata and ownership">
            <dl className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between gap-3">
                <dt className="shrink-0">Initiator</dt>
                <dd className="min-w-0">
                  <CopyableText text={job.initiator} className="font-semibold text-slate-100" />
                </dd>
              </div>
              {job.owner && (
                <div className="flex items-center justify-between gap-3">
                  <dt className="shrink-0">Owner</dt>
                  <dd className="min-w-0">
                    <CopyableText text={job.owner} className="text-slate-100" />
                  </dd>
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
              {job.finalizedAt && (
                <div className="flex items-center justify-between">
                  <dt>Finalized</dt>
                  <dd className="text-slate-100">{formatDate(job.finalizedAt)}</dd>
                </div>
              )}
              {job.payloadUri && (
                <div className="flex items-start justify-between gap-3">
                  <dt>Payload URI</dt>
                  <dd className="break-all text-emerald-300">{job.payloadUri}</dd>
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

          {/* Scan Configuration Card */}
          <Card title="Scan Configuration" description="Job execution parameters" className="lg:col-span-1">
            <dl className="space-y-3 text-sm text-slate-300">
              <div className="flex items-center justify-between">
                <dt>Run Mode</dt>
                <dd>
                  <Badge
                    tone={job.runMode === 'continuous' ? 'warning' : 'success'}
                    label={job.runMode === 'continuous' ? 'Continuous' : 'Single Pass'}
                  />
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Distribution</dt>
                <dd className="text-slate-100 uppercase">{job.distribution}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Port Order</dt>
                <dd className="text-slate-100 uppercase">{job.portOrder}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Port Range</dt>
                <dd className="text-slate-100">{job.portRange.start} - {job.portRange.end}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt>Current Pass</dt>
                <dd className="font-semibold text-emerald-400">{job.currentPass}</dd>
              </div>
              {job.monitorInterval && (
                <div className="flex items-center justify-between">
                  <dt>Monitor Interval</dt>
                  <dd className="text-slate-100">{job.monitorInterval}s</dd>
                </div>
              )}
              {job.nextPassAt && (
                <div className="flex items-center justify-between">
                  <dt>Next Pass At</dt>
                  <dd className="text-amber-400">{formatDate(job.nextPassAt)}</dd>
                </div>
              )}
              {job.tempo && (
                <div className="flex items-center justify-between">
                  <dt>Scan Delay</dt>
                  <dd className="text-slate-100">{job.tempo.minSeconds}s - {job.tempo.maxSeconds}s</dd>
                </div>
              )}
              <div className="flex items-center justify-between">
                <dt>Workers</dt>
                <dd className="text-slate-100">{job.workerCount}</dd>
              </div>
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
                  <tbody className="divide-y divide-white/10">
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

          <Card title="Timeline">
            <ol className="space-y-3">
              {job.timeline.map((entry) => (
                <li key={`${entry.label}-${entry.at}`} className="flex items-start gap-3 text-sm text-slate-300">
                  <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary" />
                  <div>
                    <p className="font-medium text-slate-100">{entry.label}</p>
                    <p className="text-xs text-slate-400">{formatDate(entry.at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        </section>

        {/* Worker Reports Section */}
        {job.passHistory && job.passHistory.length > 0 && (
          <Card title="Worker Reports" description="Detailed scan results from each worker node">
            <div className="space-y-6">
              {job.passHistory.map((pass) => (
                <div key={pass.passNr} className="space-y-4">
                  <div className="flex items-center justify-between border-b border-white/10 pb-2">
                    <h4 className="text-sm font-semibold text-slate-100">
                      Pass #{pass.passNr}
                    </h4>
                    <span className="text-xs text-slate-400">
                      Completed: {formatDate(pass.completedAt)}
                    </span>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    {Object.entries(pass.reports).map(([nodeAddr, cid]) => {
                      const report = reports[cid] as WorkerReport | undefined;
                      const isExpanded = expandedReports.has(cid);
                      const shortAddr = `${nodeAddr.slice(0, 12)}...${nodeAddr.slice(-8)}`;

                      return (
                        <div
                          key={cid}
                          className="rounded-lg border border-white/10 bg-slate-800/50 p-4"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs text-slate-400">Worker Node</p>
                              <CopyableText
                                text={nodeAddr}
                                className="text-sm font-medium text-slate-100"
                              />
                            </div>
                            <Button
                              variant="secondary"
                              size="sm"
                              onClick={() => {
                                const newSet = new Set(expandedReports);
                                if (isExpanded) {
                                  newSet.delete(cid);
                                } else {
                                  newSet.add(cid);
                                }
                                setExpandedReports(newSet);
                              }}
                            >
                              {isExpanded ? 'Collapse' : 'Expand'}
                            </Button>
                          </div>

                          {report ? (
                            <div className="mt-3 space-y-3 text-sm">
                              {/* Worker ID and Target */}
                              <div className="flex items-center gap-2 text-xs">
                                <span className="rounded bg-slate-700 px-2 py-0.5 font-mono text-slate-200">
                                  {report.localWorkerId}
                                </span>
                                <span className="text-slate-400">scanning</span>
                                <span className="font-medium text-slate-200">{report.target}</span>
                              </div>

                              {/* Stats Grid */}
                              <div className="grid grid-cols-2 gap-2 text-xs">
                                <div>
                                  <span className="text-slate-400">Port Range:</span>{' '}
                                  <span className="text-slate-200">
                                    {report.startPort} - {report.endPort}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Ports Scanned:</span>{' '}
                                  <span className="text-slate-200">{report.portsScanned}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Progress:</span>{' '}
                                  <span className="text-emerald-400 font-semibold">{report.progress}</span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Status:</span>{' '}
                                  <Badge
                                    tone={report.done ? 'success' : report.canceled ? 'danger' : 'warning'}
                                    label={report.done ? 'Done' : report.canceled ? 'Canceled' : 'In Progress'}
                                  />
                                </div>
                                <div>
                                  <span className="text-slate-400">Open Ports:</span>{' '}
                                  <span className={report.nrOpenPorts > 0 ? 'text-emerald-400 font-semibold' : 'text-slate-200'}>
                                    {report.nrOpenPorts}
                                  </span>
                                </div>
                                <div>
                                  <span className="text-slate-400">Web Tested:</span>{' '}
                                  <span className={report.webTested ? 'text-emerald-400' : 'text-slate-500'}>
                                    {report.webTested ? 'Yes' : 'No'}
                                  </span>
                                </div>
                              </div>

                              {/* Exception Ports */}
                              {report.exceptions && report.exceptions.length > 0 && (
                                <div className="text-xs">
                                  <span className="text-slate-400">Exceptions:</span>{' '}
                                  <span className="text-amber-400">{report.exceptions.join(', ')}</span>
                                </div>
                              )}

                              {/* Open Ports Highlight */}
                              {report.openPorts && report.openPorts.length > 0 && (
                                <div className="rounded bg-emerald-900/20 border border-emerald-500/30 p-2">
                                  <p className="text-xs uppercase tracking-widest text-emerald-400 mb-1">
                                    Open Ports Detected ({report.openPorts.length})
                                  </p>
                                  <p className="font-semibold text-emerald-300">
                                    {report.openPorts.join(', ')}
                                  </p>
                                </div>
                              )}

                              {isExpanded && (
                                <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                                  {/* Initiator Info */}
                                  {report.initiator && (
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
                                        Initiator
                                      </p>
                                      <CopyableText
                                        text={report.initiator}
                                        className="text-xs font-mono text-slate-300"
                                      />
                                    </div>
                                  )}

                                  {/* Job ID */}
                                  {report.jobId && (
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
                                        Job ID
                                      </p>
                                      <span className="text-xs font-mono text-slate-300">{report.jobId}</span>
                                    </div>
                                  )}

                                  {/* Service Info */}
                                  {report.serviceInfo && Object.keys(report.serviceInfo).length > 0 && (
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                                        Service Info ({Object.keys(report.serviceInfo).length} services)
                                      </p>
                                      <div className="space-y-2">
                                        {Object.entries(report.serviceInfo).map(([port, info]) => (
                                          <div key={port} className="rounded bg-slate-900/50 p-2 text-xs">
                                            <span className="font-semibold text-emerald-400">Port {port}:</span>
                                            <pre className="mt-1 overflow-x-auto text-slate-300 whitespace-pre-wrap">
                                              {typeof info === 'object' ? JSON.stringify(info, null, 2) : String(info)}
                                            </pre>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Web Test Results */}
                                  {report.webTestsInfo && Object.keys(report.webTestsInfo).length > 0 && (
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                                        Web Test Results ({Object.keys(report.webTestsInfo).length} tests)
                                      </p>
                                      <div className="space-y-2">
                                        {Object.entries(report.webTestsInfo).map(([test, result]) => (
                                          <div key={test} className="rounded bg-slate-900/50 p-2 text-xs">
                                            <span className="font-semibold text-slate-100">{test}:</span>
                                            <pre className="mt-1 overflow-x-auto text-slate-300 whitespace-pre-wrap">
                                              {typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result)}
                                            </pre>
                                          </div>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Completed Tests */}
                                  {report.completedTests && report.completedTests.length > 0 && (
                                    <div>
                                      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                                        Completed Tests ({report.completedTests.length})
                                      </p>
                                      <div className="flex flex-wrap gap-1">
                                        {report.completedTests.map((test) => (
                                          <span
                                            key={test}
                                            className="rounded bg-emerald-900/30 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-300"
                                          >
                                            {test}
                                          </span>
                                        ))}
                                      </div>
                                    </div>
                                  )}

                                  {/* Report CID */}
                                  <div>
                                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                                      Report CID (R1FS)
                                    </p>
                                    <div className="flex items-center gap-2">
                                      <CopyableText
                                        text={cid}
                                        className="text-xs font-mono text-slate-400"
                                      />
                                      <Button
                                        variant="secondary"
                                        size="sm"
                                        onClick={() => {
                                          const blob = new Blob(
                                            [JSON.stringify(report, null, 2)],
                                            { type: 'application/json' }
                                          );
                                          const url = URL.createObjectURL(blob);
                                          const a = document.createElement('a');
                                          a.href = url;
                                          a.download = `report-${cid.slice(0, 12)}.json`;
                                          document.body.appendChild(a);
                                          a.click();
                                          document.body.removeChild(a);
                                          URL.revokeObjectURL(url);
                                        }}
                                      >
                                        Download JSON
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              )}
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-slate-500">
                              Report data not available
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

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
