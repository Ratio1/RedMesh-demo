'use client';

import Card from '@/components/ui/Card';
import type { Job } from '@/lib/api/types';
import type { AggregatedPortsData } from '../types';

interface AggregateFindingsProps {
  job: Job;
  aggregatedPorts: AggregatedPortsData;
}

export function AggregateFindings({ job, aggregatedPorts }: AggregateFindingsProps) {
  const hasNoFindings = !job.aggregate &&
    aggregatedPorts.ports.length === 0 &&
    aggregatedPorts.services.size === 0;

  return (
    <Card
      title="Aggregate Findings"
      description="Quick overview of scan results"
      className="lg:col-span-2"
    >
      {hasNoFindings ? (
        <p className="text-sm text-slate-400">
          {job.status === 'completed' || job.status === 'stopped'
            ? 'No open ports or services were detected during this scan.'
            : 'Aggregated findings will appear once workers publish their reports.'}
        </p>
      ) : (
        <div className="space-y-4">
          {/* Metrics row */}
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-4 rounded-lg bg-brand-primary/10 border border-brand-primary/30">
              <div className="text-3xl font-bold text-brand-primary">
                {aggregatedPorts.ports.length}
              </div>
              <div className="text-xs text-slate-400 mt-1">Open Ports</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-800/50 border border-white/10">
              <div className="text-3xl font-bold text-slate-100">
                {aggregatedPorts.totalServices}
              </div>
              <div className="text-xs text-slate-400 mt-1">Services</div>
            </div>
            <div className="text-center p-4 rounded-lg bg-slate-800/50 border border-white/10">
              <div className="text-3xl font-bold text-slate-100">
                {aggregatedPorts.totalFindings}
              </div>
              <div className="text-xs text-slate-400 mt-1">Findings</div>
            </div>
          </div>

          {/* Port list */}
          {aggregatedPorts.ports.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-slate-500 uppercase tracking-wide">Ports:</span>
              <span className="text-sm text-slate-300">
                {aggregatedPorts.ports.join(', ')}
              </span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
