import { useMemo } from 'react';
import type { Job, WorkerReport, JobWorkerStatus } from '@/lib/api/types';

/**
 * Merges job.workers with reports data to get complete worker info.
 * Used for detailed reports section where service info and web tests are needed.
 */
export function useMergedWorkers(
  job: Job | null,
  reports: Record<string, WorkerReport>
): JobWorkerStatus[] {
  return useMemo(() => {
    if (!job) return [];

    const workersMap = new Map<string, JobWorkerStatus>();

    // Helper to create unique key from worker id and port range
    const makeKey = (id: string, startPort: number, endPort: number) =>
      `${id}:${startPort}-${endPort}`;

    // Start with job.workers
    job.workers.forEach((worker) => {
      const key = makeKey(worker.id, worker.startPort, worker.endPort);
      workersMap.set(key, { ...worker });
    });

    // Merge in data from reports (which may have more complete openPorts)
    // Reports are keyed by node address (Qm...), but job.workers use localWorkerId (RM-X-...)
    Object.entries(reports).forEach(([_nodeAddress, report]) => {
      const displayId = report.localWorkerId || _nodeAddress;
      const key = makeKey(displayId, report.startPort, report.endPort);
      const existing = workersMap.get(key);

      if (existing) {
        // Merge openPorts from both sources (same worker, same port range)
        const allPorts = new Set([...existing.openPorts, ...report.openPorts]);
        workersMap.set(key, {
          ...existing,
          openPorts: Array.from(allPorts).sort((a, b) => a - b),
          serviceInfo: { ...existing.serviceInfo, ...report.serviceInfo },
          webTestsInfo: { ...existing.webTestsInfo, ...report.webTestsInfo },
        });
      } else {
        // Worker only exists in reports, add it
        workersMap.set(key, {
          id: displayId,
          startPort: report.startPort,
          endPort: report.endPort,
          progress: report.done ? 100 : 0,
          done: report.done,
          canceled: report.canceled,
          portsScanned: report.portsScanned,
          openPorts: report.openPorts,
          serviceInfo: report.serviceInfo,
          webTestsInfo: report.webTestsInfo,
          completedTests: report.completedTests,
        });
      }
    });

    return Array.from(workersMap.values());
  }, [job, reports]);
}
