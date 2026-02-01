'use client';

import Card from '@/components/ui/Card';
import type { WorkerActivityItem } from '../types';

interface WorkerActivityTableProps {
  workerActivity: WorkerActivityItem[];
}

export function WorkerActivityTable({ workerActivity }: WorkerActivityTableProps) {
  return (
    <Card title="Worker activity" description="Per-worker coverage and progress">
      {workerActivity.length === 0 ? (
        <p className="text-sm text-slate-300">No workers attached yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-white/10 text-left text-sm text-slate-200">
            <thead className="text-xs uppercase tracking-widest text-slate-400">
              <tr>
                <th className="px-3 py-2">Node</th>
                <th className="px-3 py-2">Port range</th>
                <th className="px-3 py-2">Progress</th>
                <th className="px-3 py-2 text-brand-primary">Open ports</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {workerActivity.map((worker) => (
                <tr key={`${worker.nodeAddress}-${worker.startPort}-${worker.endPort}`}>
                  <td className="px-3 py-2 font-mono text-xs text-slate-100" title={worker.nodeAddress}>
                    {worker.nodeAddress.length > 20
                      ? `${worker.nodeAddress.slice(0, 8)}...${worker.nodeAddress.slice(-8)}`
                      : worker.nodeAddress}
                  </td>
                  <td className="px-3 py-2 text-slate-300">
                    {worker.startPort} - {worker.endPort}
                  </td>
                  <td className="px-3 py-2 text-slate-300">{worker.progress}%</td>
                  <td className="px-3 py-2">
                    {worker.openPorts.length ? (
                      <span className="font-semibold text-brand-primary">{worker.openPorts.join(', ')}</span>
                    ) : (
                      <span className="text-slate-500">None</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
