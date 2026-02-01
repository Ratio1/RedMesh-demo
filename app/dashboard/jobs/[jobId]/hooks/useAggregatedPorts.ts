import { useMemo } from 'react';
import type { Job, WorkerReport } from '@/lib/api/types';
import type { AggregatedPortsData } from '../types';

/**
 * Aggregates open ports, service info, and web test results from all sources
 * (reports and job workers) into a unified data structure.
 */
export function useAggregatedPorts(
  reports: Record<string, WorkerReport>,
  job: Job | null
): AggregatedPortsData {
  return useMemo(() => {
    const portsSet = new Set<number>();
    const serviceMap = new Map<number, Record<string, unknown>>();
    const webTestsMap = new Map<number, Record<string, unknown>>();

    // Collect from reports
    Object.values(reports).forEach((report) => {
      if (report.openPorts && Array.isArray(report.openPorts)) {
        report.openPorts.forEach((port) => portsSet.add(port));
      }

      if (report.serviceInfo && typeof report.serviceInfo === 'object') {
        Object.entries(report.serviceInfo).forEach(([port, info]) => {
          const portNum = parseInt(port, 10);
          if (!isNaN(portNum) && info) {
            serviceMap.set(portNum, info as Record<string, unknown>);
          }
        });
      }

      if (report.webTestsInfo && typeof report.webTestsInfo === 'object') {
        Object.entries(report.webTestsInfo).forEach(([port, info]) => {
          const portNum = parseInt(port, 10);
          if (!isNaN(portNum) && info) {
            webTestsMap.set(portNum, info as Record<string, unknown>);
          }
        });
      }
    });

    // Collect from job workers
    job?.workers.forEach((worker) => {
      worker.openPorts.forEach((port) => portsSet.add(port));

      if (worker.serviceInfo && typeof worker.serviceInfo === 'object') {
        Object.entries(worker.serviceInfo).forEach(([port, info]) => {
          const portNum = parseInt(port, 10);
          if (!isNaN(portNum) && info) {
            serviceMap.set(portNum, info as Record<string, unknown>);
          }
        });
      }

      if (worker.webTestsInfo && typeof worker.webTestsInfo === 'object') {
        Object.entries(worker.webTestsInfo).forEach(([port, info]) => {
          const portNum = parseInt(port, 10);
          if (!isNaN(portNum) && info) {
            webTestsMap.set(portNum, info as Record<string, unknown>);
          }
        });
      }
    });

    const sortedPorts = Array.from(portsSet).sort((a, b) => a - b);

    // Count total services
    let totalServices = 0;
    serviceMap.forEach((info) => {
      totalServices += Object.keys(info).length;
    });

    // Count total findings
    let totalFindings = 0;
    webTestsMap.forEach((info) => {
      totalFindings += Object.keys(info).length;
    });

    return {
      ports: sortedPorts,
      services: serviceMap,
      webTests: webTestsMap,
      totalServices,
      totalFindings,
    };
  }, [reports, job?.workers]);
}
