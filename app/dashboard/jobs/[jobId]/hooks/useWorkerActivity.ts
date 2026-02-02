import { useMemo } from 'react';
import type { WorkerReport } from '@/lib/api/types';
import type { WorkerActivityItem } from '../types';

/**
 * Builds worker activity data from reports.
 * Each report represents one node's work with its assigned port range.
 */
export function useWorkerActivity(
  reports: Record<string, WorkerReport>
): WorkerActivityItem[] {
  return useMemo(() => {
    if (!reports || Object.keys(reports).length === 0) return [];

    return Object.entries(reports)
      .map(([nodeAddress, report]) => ({
        nodeAddress,
        startPort: report.startPort,
        endPort: report.endPort,
        progress: report.done
          ? 100
          : Math.round(
              (report.portsScanned / (report.endPort - report.startPort + 1)) * 100
            ),
        openPorts: report.openPorts,
        done: report.done,
      }))
      .sort((a, b) => a.startPort - b.startPort);
  }, [reports]);
}
