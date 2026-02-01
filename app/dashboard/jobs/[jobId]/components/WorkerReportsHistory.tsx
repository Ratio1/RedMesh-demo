'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import CopyableText from '@/components/ui/CopyableText';
import type { Job, WorkerReport, PassHistoryEntry } from '@/lib/api/types';

function formatDate(value?: string): string {
  if (!value) return '--';
  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return value;
  }
}

interface WorkerReportsHistoryProps {
  job: Job;
  reports: Record<string, WorkerReport>;
}

export function WorkerReportsHistory({ job, reports }: WorkerReportsHistoryProps) {
  const [workerReportsExpanded, setWorkerReportsExpanded] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());

  if (!job.passHistory || job.passHistory.length === 0) {
    return null;
  }

  const downloadReportJson = (report: WorkerReport, cid: string) => {
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
  };

  return (
    <Card
      title={
        <button
          onClick={() => setWorkerReportsExpanded(!workerReportsExpanded)}
          className="flex items-center gap-2 w-full text-left cursor-pointer group"
        >
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${workerReportsExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>Worker Reports</span>
          <span className="text-xs text-slate-500 font-normal">
            ({job.passHistory.length} pass{job.passHistory.length !== 1 ? 'es' : ''})
          </span>
        </button>
      }
      description={workerReportsExpanded ? "Detailed scan results from each worker node" : undefined}
    >
      {!workerReportsExpanded ? (
        <p className="text-sm text-slate-400">
          Click to expand and view detailed reports from each pass.
        </p>
      ) : (
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
                        <div className={`mt-3 space-y-3 ${!isExpanded ? 'hidden' : ''}`}>
                          {/* Worker ID and Target */}
                          <div className="text-xs">
                            <span className="text-slate-400">Worker ID:</span>{' '}
                            <span className="text-slate-200">
                              {report.localWorkerId}
                            </span>
                          </div>

                          {/* Stats Grid */}
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-slate-400">Port Range:</span>{' '}
                              <span className="text-slate-200">{report.startPort} - {report.endPort}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Ports Scanned:</span>{' '}
                              <span className="text-slate-200">{report.portsScanned}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Open Ports:</span>{' '}
                              <span className="text-brand-primary font-semibold">{report.openPorts?.length || 0}</span>
                            </div>
                            <div>
                              <span className="text-slate-400">Status:</span>{' '}
                              <Badge
                                tone={report.done ? 'success' : report.canceled ? 'danger' : 'warning'}
                                label={report.done ? 'Done' : report.canceled ? 'Canceled' : 'Running'}
                              />
                            </div>
                          </div>

                          {/* Open Ports List */}
                          {report.openPorts && report.openPorts.length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                                Open Ports ({report.openPorts.length})
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {report.openPorts.map((port) => (
                                  <span
                                    key={port}
                                    className="rounded bg-brand-primary/20 border border-brand-primary/50 px-2 py-0.5 text-xs font-semibold text-brand-primary"
                                  >
                                    {port}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Service Info */}
                          {report.serviceInfo && Object.keys(report.serviceInfo).length > 0 && (
                            <div>
                              <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                                Service Info ({Object.keys(report.serviceInfo).length} ports)
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
                                onClick={() => downloadReportJson(report, cid)}
                              >
                                Download JSON
                              </Button>
                            </div>
                          </div>
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
      )}
    </Card>
  );
}
