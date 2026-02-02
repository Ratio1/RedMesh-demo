'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import type { AggregatedPortsData } from '../types';

interface DiscoveredPortsProps {
  aggregatedPorts: AggregatedPortsData;
}

export function DiscoveredPorts({ aggregatedPorts }: DiscoveredPortsProps) {
  const [selectedPort, setSelectedPort] = useState<number | null>(null);
  const [portsExpanded, setPortsExpanded] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  return (
    <Card
      title="Discovered Open Ports"
      description={`${aggregatedPorts.ports.length} unique port${aggregatedPorts.ports.length !== 1 ? 's' : ''} found across all workers. Click a port to see details.`}
      className="lg:col-span-2"
    >
      {aggregatedPorts.ports.length === 0 ? (
        <p className="text-sm text-slate-400">No open ports discovered yet.</p>
      ) : (
        <div className="space-y-4">
          {/* Port Pills - Red and Clickable */}
          <div className="flex flex-wrap gap-2">
            {(aggregatedPorts.ports.length > 100 && !portsExpanded
              ? aggregatedPorts.ports.slice(0, 50)
              : aggregatedPorts.ports
            ).map((port) => {
              const hasService = aggregatedPorts.services.has(port);
              const hasWebTests = aggregatedPorts.webTests.has(port);
              const isSelected = selectedPort === port;
              return (
                <button
                  key={port}
                  onClick={() => setSelectedPort(isSelected ? null : port)}
                  className={`inline-flex items-center justify-center rounded-full px-3 py-1.5 text-sm font-medium transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-brand-primary text-white ring-2 ring-brand-primary ring-offset-2 ring-offset-slate-900'
                      : hasService || hasWebTests
                      ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/50 hover:bg-brand-primary/30'
                      : 'bg-slate-700/50 text-slate-300 border border-slate-600 hover:bg-slate-700'
                  }`}
                >
                  {port}
                </button>
              );
            })}
            {aggregatedPorts.ports.length > 100 && !portsExpanded && (
              <span className="inline-flex items-center text-sm text-slate-400">
                +{aggregatedPorts.ports.length - 50} more
              </span>
            )}
          </div>
          {aggregatedPorts.ports.length > 100 && (
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setPortsExpanded(!portsExpanded)}
            >
              {portsExpanded ? 'Show Less' : `Show All ${aggregatedPorts.ports.length} Ports`}
            </Button>
          )}

          {/* Selected Port Details */}
          {selectedPort !== null && (
            <div className="mt-4 p-4 rounded-lg bg-slate-800/50 border border-brand-primary/30">
              <div className="flex items-center justify-between mb-4">
                <h4 className="text-lg font-semibold text-brand-primary">
                  Port {selectedPort} Details
                </h4>
                <button
                  onClick={() => setSelectedPort(null)}
                  className="text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-4">
                {/* Service Info for Selected Port */}
                {aggregatedPorts.services.has(selectedPort) && (
                  <div className="rounded-lg bg-slate-800/50 border border-brand-primary/20 p-4">
                    <p className="text-xs uppercase tracking-widest text-brand-primary mb-3">
                      Service Detection Results
                    </p>
                    <div className="space-y-2">
                      {Object.entries(aggregatedPorts.services.get(selectedPort) as Record<string, unknown>).map(([probeName, result]) => {
                        if (result === null || result === undefined) return null;
                        const resultStr = String(result);
                        const isVulnerability = resultStr.includes('VULNERABILITY');
                        const isError = resultStr.includes('failed') || resultStr.includes('timed out');
                        const resultKey = `service-${selectedPort}-${probeName}`;
                        const isExpanded = expandedResults.has(resultKey);
                        const shouldTruncate = resultStr.length > 200;

                        return (
                          <div
                            key={probeName}
                            className={`rounded px-3 py-2 text-sm ${
                              isVulnerability
                                ? 'bg-amber-900/30 border border-amber-500/30'
                                : isError
                                ? 'bg-slate-800/50 border border-white/5'
                                : 'bg-slate-900/50 border border-white/5'
                            }`}
                          >
                            <span className={`font-medium ${
                              isVulnerability ? 'text-amber-300' : isError ? 'text-slate-500' : 'text-slate-300'
                            }`}>
                              {probeName.replace(/^_service_info_/, '')}:
                            </span>{' '}
                            <span className={`${
                              isVulnerability ? 'text-amber-200' : isError ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                              {shouldTruncate && !isExpanded
                                ? resultStr.slice(0, 200) + '...'
                                : resultStr}
                            </span>
                            {shouldTruncate && (
                              <button
                                onClick={() => {
                                  const newSet = new Set(expandedResults);
                                  if (isExpanded) {
                                    newSet.delete(resultKey);
                                  } else {
                                    newSet.add(resultKey);
                                  }
                                  setExpandedResults(newSet);
                                }}
                                className="ml-2 text-xs text-brand-primary hover:underline"
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Web Tests / Vulnerabilities for Selected Port */}
                {aggregatedPorts.webTests.has(selectedPort) && (
                  <div className="rounded-lg bg-slate-800/50 border border-brand-primary/20 p-4">
                    <p className="text-xs uppercase tracking-widest text-brand-primary mb-3">
                      Web Security Tests
                    </p>
                    <div className="space-y-2">
                      {Object.entries(aggregatedPorts.webTests.get(selectedPort) as Record<string, unknown>).map(([testName, result]) => {
                        if (result === null || result === undefined) return null;
                        const resultStr = String(result);
                        const isError = resultStr.startsWith('ERROR:');
                        const isVulnerable = resultStr.includes('VULNERABLE') || resultStr.includes('vulnerability');
                        const resultKey = `web-${selectedPort}-${testName}`;
                        const isExpanded = expandedResults.has(resultKey);
                        const shouldTruncate = resultStr.length > 200;

                        return (
                          <div
                            key={testName}
                            className={`rounded px-3 py-2 text-sm ${
                              isVulnerable
                                ? 'bg-rose-900/30 border border-rose-500/30'
                                : isError
                                ? 'bg-slate-800/50 border border-white/5'
                                : 'bg-slate-900/50 border border-white/5'
                            }`}
                          >
                            <span className={`font-medium ${
                              isVulnerable ? 'text-rose-300' : isError ? 'text-slate-500' : 'text-slate-300'
                            }`}>
                              {testName.replace(/^_web_test_/, '')}:
                            </span>{' '}
                            <span className={`${
                              isVulnerable ? 'text-rose-200' : isError ? 'text-slate-500' : 'text-slate-400'
                            }`}>
                              {shouldTruncate && !isExpanded
                                ? resultStr.slice(0, 200) + '...'
                                : resultStr}
                            </span>
                            {shouldTruncate && (
                              <button
                                onClick={() => {
                                  const newSet = new Set(expandedResults);
                                  if (isExpanded) {
                                    newSet.delete(resultKey);
                                  } else {
                                    newSet.add(resultKey);
                                  }
                                  setExpandedResults(newSet);
                                }}
                                className="ml-2 text-xs text-brand-primary hover:underline"
                              >
                                {isExpanded ? 'Show less' : 'Show more'}
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* No details available */}
                {!aggregatedPorts.services.has(selectedPort) && !aggregatedPorts.webTests.has(selectedPort) && (
                  <p className="text-sm text-slate-400">
                    No service detection or vulnerability data available for this port yet.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
