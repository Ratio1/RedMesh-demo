'use client';

import { useState } from 'react';
import { format } from 'date-fns';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import CopyableText from '@/components/ui/CopyableText';
import type { Job } from '@/lib/api/types';
import type { WorkerActivityItem } from '../types';

const DEFAULT_PORT_START = 1;
const DEFAULT_PORT_END = 65535;

function formatDate(value?: string): string {
  if (!value) return '--';
  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return value;
  }
}

interface JobMetaProps {
  job: Job;
  workerActivity: WorkerActivityItem[];
}

export function JobMeta({ job, workerActivity }: JobMetaProps) {
  const [expandedFeatures, setExpandedFeatures] = useState(false);

  return (
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
          <dt>Job ID</dt>
          <dd>
            <CopyableText text={job.id} className="font-mono text-xs text-slate-100" />
          </dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Created</dt>
          <dd className="text-slate-100">{formatDate(job.createdAt)}</dd>
        </div>
        <div className="flex items-center justify-between">
          <dt>Started</dt>
          <dd className="text-slate-100">{formatDate(job.startedAt)}</dd>
        </div>
        {job.completedAt && (
          <div className="flex items-center justify-between">
            <dt>Completed</dt>
            <dd className="text-slate-100">{formatDate(job.completedAt)}</dd>
          </div>
        )}
        {job.finalizedAt && (
          <div className="flex items-center justify-between">
            <dt>Finalized</dt>
            <dd className="text-slate-100">{formatDate(job.finalizedAt)}</dd>
          </div>
        )}
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
          <dd className="text-slate-100">{job.portRange?.start ?? DEFAULT_PORT_START} - {job.portRange?.end ?? DEFAULT_PORT_END}</dd>
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
          <dd className="text-slate-100">{workerActivity.length || job.workerCount}</dd>
        </div>
      </dl>

      {/* Enabled Features */}
      {job.featureSet && job.featureSet.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
            Enabled Features ({job.featureSet.length})
          </p>
          <div className="flex flex-wrap gap-1">
            {(expandedFeatures ? job.featureSet : job.featureSet.slice(0, 10)).map((feature) => (
              <span
                key={feature}
                className="rounded bg-emerald-900/30 border border-emerald-500/30 px-2 py-0.5 text-xs text-emerald-300"
              >
                {feature.replace(/^_/, '').replace(/_/g, ' ')}
              </span>
            ))}
            {job.featureSet.length > 10 && (
              <button
                onClick={() => setExpandedFeatures(!expandedFeatures)}
                className="text-xs text-emerald-400 hover:text-emerald-300 hover:underline cursor-pointer transition-colors"
              >
                {expandedFeatures ? 'Show less' : `+${job.featureSet.length - 10} more`}
              </button>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
