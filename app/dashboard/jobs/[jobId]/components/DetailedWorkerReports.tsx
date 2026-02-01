'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { JobWorkerStatus } from '@/lib/api/types';

interface DetailedWorkerReportsProps {
  mergedWorkers: JobWorkerStatus[];
}

export function DetailedWorkerReports({ mergedWorkers }: DetailedWorkerReportsProps) {
  const [detailedResultsExpanded, setDetailedResultsExpanded] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());

  const workersWithFindings = mergedWorkers.filter(
    w => Object.keys(w.serviceInfo).length > 0 || Object.keys(w.webTestsInfo).length > 0
  );

  if (workersWithFindings.length === 0) {
    return null;
  }

  return (
    <Card
      title={
        <button
          onClick={() => setDetailedResultsExpanded(!detailedResultsExpanded)}
          className="flex items-center gap-2 w-full text-left cursor-pointer group"
        >
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${detailedResultsExpanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <span>Detailed Scan Results</span>
          <span className="text-xs text-slate-500 font-normal">
            ({workersWithFindings.length} workers with findings)
          </span>
        </button>
      }
      description={detailedResultsExpanded ? "Service detection and vulnerability probe results per worker" : undefined}
    >
      {!detailedResultsExpanded ? (
        <p className="text-sm text-slate-400">
          Click to expand and view detailed scan results from workers with findings.
        </p>
      ) : (
        <div className="space-y-6">
          {workersWithFindings.map((worker) => (
            <div key={worker.id} className="rounded-lg border border-white/10 bg-slate-800/50 p-4">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h4 className="text-sm font-semibold text-slate-100">{worker.id}</h4>
                  <p className="text-xs text-slate-400">
                    Ports {worker.startPort} - {worker.endPort} | {worker.portsScanned} scanned | {worker.openPorts.length} open
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  {worker.webTested && (
                    <Badge tone="neutral" label="Web Tested" />
                  )}
                  <Badge tone={worker.done ? 'success' : 'warning'} label={worker.done ? 'Done' : 'In Progress'} />
                </div>
              </div>

              {/* Service Info */}
              {Object.keys(worker.serviceInfo).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                    Service Detection ({Object.keys(worker.serviceInfo).length} ports)
                  </p>
                  <div className="space-y-2">
                    {Object.entries(worker.serviceInfo).map(([port, probes]) => (
                      <div key={port} className="rounded bg-slate-900/50 p-3">
                        <p className="text-sm font-semibold text-brand-primary mb-2">Port {port}</p>
                        <div className="space-y-1">
                          {Object.entries(probes as Record<string, unknown>).map(([probeName, result]) => {
                            if (result === null || result === undefined) return null;
                            const resultStr = String(result);
                            const isVulnerability = resultStr.includes('VULNERABILITY');
                            const isError = resultStr.includes('failed') || resultStr.includes('timed out');

                            return (
                              <div
                                key={probeName}
                                className={`text-xs rounded px-2 py-1 ${
                                  isVulnerability
                                    ? 'bg-amber-900/30 border border-amber-500/30'
                                    : isError
                                    ? 'bg-slate-800/50 text-slate-500'
                                    : 'bg-slate-800/50'
                                }`}
                              >
                                <span className={`font-medium ${
                                  isVulnerability ? 'text-amber-300' : isError ? 'text-slate-500' : 'text-slate-300'
                                }`}>
                                  {probeName.replace(/^_service_info_/, '')}:
                                </span>{' '}
                                <span className={isVulnerability ? 'text-amber-200' : isError ? 'text-slate-500' : 'text-slate-400'}>
                                  {resultStr.length > 100 ? resultStr.slice(0, 100) + '...' : resultStr}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Web Tests Info */}
              {Object.keys(worker.webTestsInfo).length > 0 && (
                <div className="mb-4">
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                    Web Security Tests ({Object.keys(worker.webTestsInfo).length} ports)
                  </p>
                  <div className="space-y-2">
                    {Object.entries(worker.webTestsInfo).map(([port, tests]) => (
                      <div key={port} className="rounded bg-slate-900/50 p-3">
                        <p className="text-sm font-semibold text-blue-400 mb-2">Port {port}</p>
                        <div className="space-y-1">
                          {Object.entries(tests as Record<string, unknown>).map(([testName, result]) => {
                            if (result === null || result === undefined) return null;
                            const resultStr = String(result);
                            const isError = resultStr.startsWith('ERROR:');
                            const isVulnerable = resultStr.includes('VULNERABLE') || resultStr.includes('vulnerability');

                            return (
                              <div
                                key={testName}
                                className={`text-xs rounded px-2 py-1 ${
                                  isVulnerable
                                    ? 'bg-rose-900/30 border border-rose-500/30'
                                    : isError
                                    ? 'bg-slate-800/50 text-slate-500'
                                    : 'bg-slate-800/50'
                                }`}
                              >
                                <span className={`font-medium ${
                                  isVulnerable ? 'text-rose-300' : isError ? 'text-slate-500' : 'text-slate-300'
                                }`}>
                                  {testName.replace(/^_web_test_/, '')}:
                                </span>{' '}
                                <span className={isVulnerable ? 'text-rose-200' : isError ? 'text-slate-500' : 'text-slate-400'}>
                                  {resultStr.length > 100 ? resultStr.slice(0, 100) + '...' : resultStr}
                                </span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Completed Tests Summary */}
              {worker.completedTests && worker.completedTests.length > 0 && (
                <div>
                  <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                    Completed Tests ({worker.completedTests.length})
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(expandedTests.has(worker.id) ? worker.completedTests : worker.completedTests.slice(0, 20)).map((test) => (
                      <span
                        key={test}
                        className="rounded bg-emerald-900/30 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-300"
                      >
                        {test.replace(/^_/, '')}
                      </span>
                    ))}
                    {worker.completedTests.length > 20 && (
                      <button
                        onClick={() => {
                          const newSet = new Set(expandedTests);
                          if (expandedTests.has(worker.id)) {
                            newSet.delete(worker.id);
                          } else {
                            newSet.add(worker.id);
                          }
                          setExpandedTests(newSet);
                        }}
                        className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer transition-colors"
                      >
                        {expandedTests.has(worker.id)
                          ? 'Show less'
                          : `+${worker.completedTests.length - 20} more`}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
