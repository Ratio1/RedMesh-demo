'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import useJob from '@/lib/hooks/useJob';
import { useJobActions } from '@/lib/hooks/useJobActions';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import CopyableText from '@/components/ui/CopyableText';
import Loader from '@/components/ui/Loader';
import { format } from 'date-fns';
import jsPDF from 'jspdf';
import type { WorkerReport } from '@/lib/api/types';

const DEFAULT_PORT_START = 1;
const DEFAULT_PORT_END = 65535;

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
  const { job, reports, refresh, loading: jobLoading, error: jobError, notFound } = useJob(params.jobId);
  const { stopJob, stopMonitoring, loading: actionLoading } = useJobActions();
  const [stopping, setStopping] = useState(false);
  const [stoppingMonitoring, setStoppingMonitoring] = useState(false);
  const [expandedReports, setExpandedReports] = useState<Set<string>>(new Set());
  const [portsExpanded, setPortsExpanded] = useState(false);
  const [expandedTests, setExpandedTests] = useState<Set<string>>(new Set());
  const [expandedFeatures, setExpandedFeatures] = useState(false);
  const [expandedResults, setExpandedResults] = useState<Set<string>>(new Set());

  // Aggregate all open ports from worker reports
  const aggregatedPorts = useMemo(() => {
    const portsSet = new Set<number>();
    const serviceMap = new Map<number, Record<string, unknown>>();

    Object.values(reports).forEach((report) => {
      const workerReport = report as WorkerReport;
      if (workerReport.openPorts && Array.isArray(workerReport.openPorts)) {
        workerReport.openPorts.forEach((port) => portsSet.add(port));
      }
      // Collect service info for each port
      if (workerReport.serviceInfo && typeof workerReport.serviceInfo === 'object') {
        Object.entries(workerReport.serviceInfo).forEach(([port, info]) => {
          const portNum = parseInt(port, 10);
          if (!isNaN(portNum) && info) {
            serviceMap.set(portNum, info as Record<string, unknown>);
          }
        });
      }
    });

    const sortedPorts = Array.from(portsSet).sort((a, b) => a - b);
    return { ports: sortedPorts, services: serviceMap };
  }, [reports]);

  const handleStopJob = async () => {
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
    let y = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 15;
    const contentWidth = pageWidth - margin * 2;

    // Colors
    const colors = {
      primary: [16, 185, 129] as [number, number, number],      // emerald-500
      secondary: [71, 85, 105] as [number, number, number],     // slate-500
      danger: [239, 68, 68] as [number, number, number],        // red-500
      warning: [245, 158, 11] as [number, number, number],      // amber-500
      text: [30, 41, 59] as [number, number, number],           // slate-800
      muted: [100, 116, 139] as [number, number, number],       // slate-500
      light: [241, 245, 249] as [number, number, number],       // slate-100
    };

    const checkPageBreak = (needed: number) => {
      if (y + needed > pageHeight - 20) {
        doc.addPage();
        y = 20;
        return true;
      }
      return false;
    };

    const addHeader = (text: string, size: number = 12, color: [number, number, number] = colors.primary) => {
      checkPageBreak(15);
      doc.setFontSize(size);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...color);
      doc.text(text, margin, y);
      y += size * 0.5 + 2;
      doc.setTextColor(...colors.text);
    };

    const addText = (text: string, indent: number = 0, bold: boolean = false) => {
      doc.setFontSize(9);
      doc.setFont('Helvetica', bold ? 'bold' : 'normal');
      doc.setTextColor(...colors.text);
      const wrapped = doc.splitTextToSize(text, contentWidth - indent);
      wrapped.forEach((line: string) => {
        checkPageBreak(5);
        doc.text(line, margin + indent, y);
        y += 4.5;
      });
    };

    const addLabelValue = (label: string, value: string, indent: number = 0) => {
      checkPageBreak(5);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...colors.muted);
      doc.text(label + ':', margin + indent, y);
      const labelWidth = doc.getTextWidth(label + ': ');
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(...colors.text);
      const valueWrapped = doc.splitTextToSize(value, contentWidth - indent - labelWidth - 5);
      doc.text(valueWrapped[0] || '—', margin + indent + labelWidth, y);
      y += 4.5;
      if (valueWrapped.length > 1) {
        valueWrapped.slice(1).forEach((line: string) => {
          checkPageBreak(5);
          doc.text(line, margin + indent + labelWidth, y);
          y += 4.5;
        });
      }
    };

    const addDivider = () => {
      y += 3;
      checkPageBreak(5);
      doc.setDrawColor(...colors.light);
      doc.setLineWidth(0.5);
      doc.line(margin, y, pageWidth - margin, y);
      y += 6;
    };

    const addBox = (title: string, content: () => void, bgColor: [number, number, number] = colors.light) => {
      checkPageBreak(30);
      const startY = y;
      y += 4;
      content();
      const endY = y + 2;
      // Draw background box
      doc.setFillColor(...bgColor);
      doc.setDrawColor(200, 200, 200);
      doc.roundedRect(margin - 2, startY - 2, contentWidth + 4, endY - startY + 4, 2, 2, 'FD');
      // Redraw content on top
      y = startY + 4;
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text(title, margin + 2, y);
      y += 6;
      content();
      y += 4;
    };

    // === COVER PAGE ===
    // Header bar
    doc.setFillColor(...colors.primary);
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('Helvetica', 'bold');
    doc.text('RedMesh Scan Report', margin, 28);

    doc.setFontSize(10);
    doc.setFont('Helvetica', 'normal');
    doc.text(`Generated: ${formatDate(new Date().toISOString())}`, margin, 38);

    y = 55;

    // Task Overview Box
    doc.setFillColor(...colors.light);
    doc.roundedRect(margin, y, contentWidth, 45, 3, 3, 'F');
    y += 8;

    doc.setTextColor(...colors.text);
    doc.setFontSize(14);
    doc.setFont('Helvetica', 'bold');
    doc.text(job.displayName, margin + 5, y);
    y += 8;

    doc.setFontSize(9);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(...colors.muted);
    doc.text(`Target: ${job.target}`, margin + 5, y);
    y += 5;
    doc.text(`Job ID: ${job.id}`, margin + 5, y);
    y += 5;

    // Status badge
    const statusColor = job.status === 'completed' ? colors.primary :
                        job.status === 'failed' ? colors.danger :
                        job.status === 'running' ? colors.warning : colors.secondary;
    doc.setFillColor(...statusColor);
    doc.roundedRect(margin + 5, y, 50, 8, 2, 2, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'bold');
    doc.text(job.status.toUpperCase(), margin + 10, y + 5.5);

    // Priority badge
    doc.setFillColor(...colors.secondary);
    doc.roundedRect(margin + 60, y, 40, 8, 2, 2, 'F');
    doc.text(job.priority.toUpperCase(), margin + 65, y + 5.5);

    y += 25;

    // Summary Stats
    addHeader('Summary Statistics', 11);
    y += 2;

    const totalOpenPorts = job.aggregate?.openPorts?.length || job.workers.reduce((sum, w) => sum + w.openPorts.length, 0);
    const totalPortsScanned = job.workers.reduce((sum, w) => sum + w.portsScanned, 0);
    const workersWithDetails = job.workers.filter(w => Object.keys(w.serviceInfo).length > 0 || Object.keys(w.webTestsInfo).length > 0);
    const workersWithFindings = workersWithDetails.length;

    const stats = [
      { label: 'Workers', value: String(job.workerCount) },
      { label: 'Port Range', value: `${job.portRange?.start ?? 1} - ${job.portRange?.end ?? 65535}` },
      { label: 'Ports Scanned', value: String(totalPortsScanned) },
      { label: 'Open Ports Found', value: String(totalOpenPorts) },
      { label: 'Workers with Findings', value: String(workersWithFindings) },
    ];

    doc.setFillColor(...colors.light);
    doc.roundedRect(margin, y, contentWidth, 20, 2, 2, 'F');
    y += 5;

    const statWidth = contentWidth / stats.length;
    stats.forEach((stat, i) => {
      const x = margin + i * statWidth + statWidth / 2;
      doc.setFontSize(14);
      doc.setFont('Helvetica', 'bold');
      doc.setTextColor(...colors.primary);
      doc.text(stat.value, x, y + 4, { align: 'center' });
      doc.setFontSize(7);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(...colors.muted);
      doc.text(stat.label, x, y + 10, { align: 'center' });
    });

    y += 25;
    addDivider();

    // Task Description
    if (job.summary && job.summary !== 'RedMesh scan job') {
      addHeader('Task Description', 11);
      const descWrapped = doc.splitTextToSize(job.summary, contentWidth);
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(...colors.text);
      descWrapped.forEach((line: string) => {
        checkPageBreak(4);
        doc.text(line, margin, y);
        y += 4.5;
      });
      y += 3;
    }

    // Configuration Section
    addHeader('Scan Configuration', 11);
    addLabelValue('Run Mode', job.runMode === 'continuous' ? 'Continuous Monitoring' : 'Single Pass');
    addLabelValue('Distribution', (job.distribution ?? 'slice').toUpperCase());
    addLabelValue('Port Order', (job.portOrder ?? 'sequential').toUpperCase());
    addLabelValue('Port Range', `${job.portRange?.start ?? 1} - ${job.portRange?.end ?? 65535}`);
    if (job.tempo) {
      addLabelValue('Scan Delay', `${job.tempo.minSeconds}s - ${job.tempo.maxSeconds}s`);
    }
    addLabelValue('Current Pass', String(job.currentPass));
    if (job.monitorInterval) {
      addLabelValue('Monitor Interval', `${job.monitorInterval}s`);
    }
    if (job.monitoringStatus) {
      addLabelValue('Monitoring Status', job.monitoringStatus);
    }
    if (job.nextPassAt) {
      addLabelValue('Next Pass At', formatDate(job.nextPassAt));
    }
    y += 5;

    // Timing Section
    addHeader('Timing', 11);
    addLabelValue('Created', formatDate(job.createdAt));
    addLabelValue('Updated', formatDate(job.updatedAt));
    addLabelValue('Started', formatDate(job.startedAt));
    addLabelValue('Completed', formatDate(job.completedAt));
    if (job.finalizedAt) {
      addLabelValue('Finalized', formatDate(job.finalizedAt));
    }
    y += 5;

    // Ownership & Launcher Info
    addHeader('Launcher Information', 11);
    if (job.initiatorAlias) {
      addLabelValue('Launcher Alias', job.initiatorAlias);
    }
    if (job.initiatorAddress) {
      addLabelValue('Launcher Address', job.initiatorAddress);
    } else {
      addLabelValue('Initiator', job.initiator);
    }
    if (job.owner && job.owner !== job.initiatorAddress) {
      addLabelValue('Owner', job.owner);
    }
    y += 5;

    // Enabled Features (full list)
    if (job.featureSet && job.featureSet.length > 0) {
      addHeader(`Enabled Features (${job.featureSet.length})`, 11);
      // Show features organized by type
      const serviceFeatures = job.featureSet.filter(f => f.includes('service_info'));
      const webFeatures = job.featureSet.filter(f => f.includes('web_test'));
      const otherFeatures = job.featureSet.filter(f => !f.includes('service_info') && !f.includes('web_test'));

      if (serviceFeatures.length > 0) {
        doc.setFontSize(8);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.secondary);
        checkPageBreak(5);
        doc.text(`Service Detection (${serviceFeatures.length}):`, margin, y);
        y += 4;
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.text);
        const serviceText = serviceFeatures.map(f => f.replace(/^_service_info_/, '')).join(', ');
        const serviceWrapped = doc.splitTextToSize(serviceText, contentWidth - 5);
        serviceWrapped.forEach((line: string) => {
          checkPageBreak(4);
          doc.text(line, margin + 5, y);
          y += 4;
        });
        y += 2;
      }

      if (webFeatures.length > 0) {
        doc.setFontSize(8);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.secondary);
        checkPageBreak(5);
        doc.text(`Web Security Tests (${webFeatures.length}):`, margin, y);
        y += 4;
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.text);
        const webText = webFeatures.map(f => f.replace(/^_web_test_/, '')).join(', ');
        const webWrapped = doc.splitTextToSize(webText, contentWidth - 5);
        webWrapped.forEach((line: string) => {
          checkPageBreak(4);
          doc.text(line, margin + 5, y);
          y += 4;
        });
        y += 2;
      }

      if (otherFeatures.length > 0) {
        doc.setFontSize(8);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.secondary);
        checkPageBreak(5);
        doc.text(`Other Features (${otherFeatures.length}):`, margin, y);
        y += 4;
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.text);
        const otherText = otherFeatures.map(f => f.replace(/^_/, '')).join(', ');
        const otherWrapped = doc.splitTextToSize(otherText, contentWidth - 5);
        otherWrapped.forEach((line: string) => {
          checkPageBreak(4);
          doc.text(line, margin + 5, y);
          y += 4;
        });
      }
      y += 3;
    }

    // Excluded Features
    if (job.excludedFeatures && job.excludedFeatures.length > 0) {
      addHeader(`Excluded Features (${job.excludedFeatures.length})`, 11, colors.muted);
      const excludedText = job.excludedFeatures.map(f => f.replace(/^_/, '').replace(/_/g, ' ')).join(', ');
      const excludedWrapped = doc.splitTextToSize(excludedText, contentWidth);
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(...colors.muted);
      excludedWrapped.forEach((line: string) => {
        checkPageBreak(4);
        doc.text(line, margin, y);
        y += 4;
      });
      y += 3;
    }

    // Exception Ports
    if (job.exceptionPorts && job.exceptionPorts.length > 0) {
      addHeader('Exception Ports', 11);
      addText(job.exceptionPorts.join(', '));
      y += 3;
    }

    // Worker Assignments
    if (job.workers.length > 0) {
      addHeader(`Worker Assignments (${job.workers.length})`, 11);
      job.workers.forEach((worker) => {
        checkPageBreak(8);
        doc.setFontSize(8);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.secondary);
        // Truncate worker ID for display if too long
        const displayId = worker.id.length > 50 ? worker.id.slice(0, 25) + '...' + worker.id.slice(-20) : worker.id;
        doc.text(displayId, margin, y);
        y += 4;
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.text);
        const workerStatus = worker.done ? 'Done' : worker.canceled ? 'Canceled' : 'In Progress';
        doc.text(`Ports ${worker.startPort}-${worker.endPort} | Status: ${workerStatus}`, margin + 5, y);
        y += 5;
      });
      y += 3;
    }

    // === PAGE 2: FINDINGS ===
    // Only add a new page if there's content to display
    const hasFindings = totalOpenPorts > 0 || job.aggregate || workersWithDetails.length > 0;
    if (hasFindings) {
      doc.addPage();
      y = 20;
    }

    // Open Ports Section (only if ports were found)
    if (totalOpenPorts > 0) {
      addHeader('Discovered Open Ports', 14, colors.primary);
      y += 2;

      const allPorts = new Set<number>();
      job.workers.forEach(w => w.openPorts.forEach(p => allPorts.add(p)));
      const sortedPorts = Array.from(allPorts).sort((a, b) => a - b);

      doc.setFillColor(236, 253, 245); // emerald-50
      doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'F');
      y += 5;
      doc.setFontSize(9);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(...colors.text);
      const portsText = sortedPorts.join(', ');
      const wrappedPorts = doc.splitTextToSize(portsText, contentWidth - 10);
      wrappedPorts.forEach((line: string) => {
        checkPageBreak(5);
        doc.text(line, margin + 5, y);
        y += 4.5;
      });
      y += 4;
      addDivider();
    }

    // Aggregate Findings
    if (job.aggregate) {
      addHeader('Aggregate Findings', 12);
      y += 2;

      if (Object.keys(job.aggregate.serviceSummary).length > 0) {
        addHeader('Service Summary', 10, colors.secondary);
        Object.entries(job.aggregate.serviceSummary).forEach(([port, info]) => {
          addLabelValue(`Port ${port}`, String(info), 5);
        });
        y += 3;
      }

      if (Object.keys(job.aggregate.webFindings).length > 0) {
        addHeader('Web Findings', 10, colors.secondary);
        Object.entries(job.aggregate.webFindings).forEach(([key, finding]) => {
          addLabelValue(key, String(finding), 5);
        });
        y += 3;
      }

      addDivider();
    }

    // === DETAILED WORKER REPORTS ===
    if (workersWithDetails.length > 0) {
      addHeader('Detailed Worker Reports', 14, colors.primary);
      y += 5;

      workersWithDetails.forEach((worker, idx) => {
        checkPageBreak(50);

        // Worker header
        doc.setFillColor(...colors.light);
        doc.roundedRect(margin, y, contentWidth, 18, 2, 2, 'F');
        y += 5;

        doc.setFontSize(11);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.text);
        doc.text(`Worker: ${worker.id}`, margin + 5, y);

        // Status badge
        const workerStatusColor = worker.done ? colors.primary : worker.canceled ? colors.danger : colors.warning;
        doc.setFillColor(...workerStatusColor);
        doc.roundedRect(pageWidth - margin - 35, y - 4, 30, 7, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFontSize(7);
        doc.text(worker.done ? 'DONE' : worker.canceled ? 'CANCELED' : 'RUNNING', pageWidth - margin - 32, y);

        y += 6;
        doc.setFontSize(8);
        doc.setTextColor(...colors.muted);
        doc.text(`Ports ${worker.startPort}-${worker.endPort} | ${worker.portsScanned} scanned | ${worker.openPorts.length} open`, margin + 5, y);
        y += 10;

        // Service Info
        if (Object.keys(worker.serviceInfo).length > 0) {
          addHeader('Service Detection Results', 10, colors.primary);

          Object.entries(worker.serviceInfo).forEach(([port, probes]) => {
            checkPageBreak(20);

            doc.setFontSize(9);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(...colors.primary);
            doc.text(`Port ${port}`, margin + 5, y);
            y += 5;

            Object.entries(probes as Record<string, unknown>).forEach(([probeName, result]) => {
              if (result === null || result === undefined) return;

              checkPageBreak(8);
              const resultStr = String(result);
              const isVulnerability = resultStr.includes('VULNERABILITY');
              const isError = resultStr.includes('failed') || resultStr.includes('timed out');

              doc.setFontSize(8);
              doc.setFont('Helvetica', 'bold');
              doc.setTextColor(...(isVulnerability ? colors.warning : isError ? colors.muted : colors.secondary));
              const cleanProbeName = probeName.replace(/^_service_info_/, '');
              doc.text(`${cleanProbeName}:`, margin + 10, y);

              doc.setFont('Helvetica', 'normal');
              doc.setTextColor(...(isVulnerability ? colors.warning : isError ? [180, 180, 180] as [number, number, number] : colors.text));
              const wrappedResult = doc.splitTextToSize(resultStr, contentWidth - 50);
              wrappedResult.forEach((line: string, lineIdx: number) => {
                if (lineIdx === 0) {
                  doc.text(line, margin + 10 + doc.getTextWidth(cleanProbeName + ': '), y);
                } else {
                  checkPageBreak(4);
                  y += 4;
                  doc.text(line, margin + 15, y);
                }
              });
              y += 5;
            });
            y += 3;
          });
        }

        // Web Tests Info
        if (Object.keys(worker.webTestsInfo).length > 0) {
          addHeader('Web Security Tests', 10, [59, 130, 246]); // blue-500

          Object.entries(worker.webTestsInfo).forEach(([port, tests]) => {
            checkPageBreak(20);

            doc.setFontSize(9);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(59, 130, 246);
            doc.text(`Port ${port}`, margin + 5, y);
            y += 5;

            Object.entries(tests as Record<string, unknown>).forEach(([testName, result]) => {
              if (result === null || result === undefined) return;

              checkPageBreak(8);
              const resultStr = String(result);
              const isError = resultStr.startsWith('ERROR:');
              const isVulnerable = resultStr.includes('VULNERABLE') || resultStr.includes('vulnerability');

              doc.setFontSize(8);
              doc.setFont('Helvetica', 'bold');
              doc.setTextColor(...(isVulnerable ? colors.danger : isError ? colors.muted : colors.secondary));
              const cleanTestName = testName.replace(/^_web_test_/, '');
              doc.text(`${cleanTestName}:`, margin + 10, y);

              doc.setFont('Helvetica', 'normal');
              doc.setTextColor(...(isVulnerable ? colors.danger : isError ? [180, 180, 180] as [number, number, number] : colors.text));
              const wrappedResult = doc.splitTextToSize(resultStr, contentWidth - 50);
              wrappedResult.forEach((line: string, lineIdx: number) => {
                if (lineIdx === 0) {
                  doc.text(line, margin + 10 + doc.getTextWidth(cleanTestName + ': '), y);
                } else {
                  checkPageBreak(4);
                  y += 4;
                  doc.text(line, margin + 15, y);
                }
              });
              y += 5;
            });
            y += 3;
          });
        }

        // Completed tests summary
        if (worker.completedTests && worker.completedTests.length > 0) {
          checkPageBreak(15);
          doc.setFontSize(8);
          doc.setFont('Helvetica', 'bold');
          doc.setTextColor(...colors.muted);
          doc.text(`Completed Tests (${worker.completedTests.length}):`, margin + 5, y);
          y += 4;
          doc.setFont('Helvetica', 'normal');
          const testsText = worker.completedTests.map(t => t.replace(/^_/, '')).join(', ');
          const wrappedTests = doc.splitTextToSize(testsText, contentWidth - 10);
          wrappedTests.forEach((line: string) => {
            checkPageBreak(4);
            doc.text(line, margin + 5, y);
            y += 4;
          });
        }

        y += 10;

        if (idx < workersWithDetails.length - 1) {
          addDivider();
        }
      });
    }

    // === PASS HISTORY WITH REPORTS ===
    if (job.passHistory && job.passHistory.length > 0) {
      doc.addPage();
      y = 20;
      addHeader('Pass History', 14, colors.primary);
      y += 5;

      job.passHistory.forEach((pass, passIdx) => {
        checkPageBreak(30);

        // Pass header
        doc.setFillColor(236, 253, 245); // emerald-50
        doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
        y += 4;

        doc.setFontSize(11);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.primary);
        doc.text(`Pass #${pass.passNr}`, margin + 5, y + 4);

        doc.setFontSize(8);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.muted);
        doc.text(`Completed: ${formatDate(pass.completedAt)}`, margin + 60, y + 4);

        y += 15;

        // Reports for this pass
        if (pass.reports && Object.keys(pass.reports).length > 0) {
          Object.entries(pass.reports).forEach(([nodeAddr, cid], reportIdx) => {
            checkPageBreak(50);

            // Worker node header
            doc.setFontSize(9);
            doc.setFont('Helvetica', 'bold');
            doc.setTextColor(...colors.secondary);
            doc.text(`Worker: ${nodeAddr}`, margin + 5, y);
            y += 4;

            doc.setFontSize(7);
            doc.setFont('Helvetica', 'normal');
            doc.setTextColor(...colors.muted);
            doc.text(`CID: ${cid}`, margin + 5, y);
            y += 6;

            // Get report data if available
            const report = reports[cid] as WorkerReport | undefined;
            if (report) {
              // Report summary stats
              doc.setFontSize(8);
              doc.setTextColor(...colors.text);

              const statsLines = [
                `Target: ${report.target || job.target}`,
                `Port Range: ${report.startPort} - ${report.endPort}`,
                `Ports Scanned: ${report.portsScanned}`,
                `Open Ports: ${report.nrOpenPorts || report.openPorts?.length || 0}`,
                `Web Tested: ${report.webTested ? 'Yes' : 'No'}`,
                `Progress: ${report.progress}`,
                `Status: ${report.done ? 'Done' : report.canceled ? 'Canceled' : 'In Progress'}`
              ];

              statsLines.forEach((line) => {
                checkPageBreak(4);
                doc.text(line, margin + 10, y);
                y += 4;
              });
              y += 2;

              // Open ports
              if (report.openPorts && report.openPorts.length > 0) {
                checkPageBreak(10);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(...colors.primary);
                doc.text('Open Ports:', margin + 10, y);
                y += 4;
                doc.setFont('Helvetica', 'normal');
                doc.setTextColor(...colors.text);
                const portsStr = report.openPorts.join(', ');
                const wrappedPorts = doc.splitTextToSize(portsStr, contentWidth - 20);
                wrappedPorts.forEach((line: string) => {
                  checkPageBreak(4);
                  doc.text(line, margin + 15, y);
                  y += 4;
                });
                y += 2;
              }

              // Service Info (full JSON)
              if (report.serviceInfo && Object.keys(report.serviceInfo).length > 0) {
                checkPageBreak(15);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(...colors.primary);
                doc.text('Service Info:', margin + 10, y);
                y += 5;
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(...colors.text);

                Object.entries(report.serviceInfo).forEach(([port, info]) => {
                  checkPageBreak(8);
                  doc.setFont('Helvetica', 'bold');
                  doc.text(`Port ${port}:`, margin + 15, y);
                  y += 4;
                  doc.setFont('Helvetica', 'normal');

                  const infoJson = JSON.stringify(info, null, 2);
                  const infoLines = infoJson.split('\n');
                  infoLines.forEach((line) => {
                    checkPageBreak(3.5);
                    const wrapped = doc.splitTextToSize(line, contentWidth - 25);
                    wrapped.forEach((wl: string) => {
                      doc.text(wl, margin + 20, y);
                      y += 3.5;
                    });
                  });
                  y += 2;
                });
                doc.setFontSize(8);
                y += 2;
              }

              // Web Tests Info (full JSON)
              if (report.webTestsInfo && Object.keys(report.webTestsInfo).length > 0) {
                checkPageBreak(15);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(59, 130, 246); // blue
                doc.text('Web Tests Info:', margin + 10, y);
                y += 5;
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(7);
                doc.setTextColor(...colors.text);

                Object.entries(report.webTestsInfo).forEach(([port, tests]) => {
                  checkPageBreak(8);
                  doc.setFont('Helvetica', 'bold');
                  doc.text(`Port ${port}:`, margin + 15, y);
                  y += 4;
                  doc.setFont('Helvetica', 'normal');

                  const testsJson = JSON.stringify(tests, null, 2);
                  const testsLines = testsJson.split('\n');
                  testsLines.forEach((line) => {
                    checkPageBreak(3.5);
                    const wrapped = doc.splitTextToSize(line, contentWidth - 25);
                    wrapped.forEach((wl: string) => {
                      doc.text(wl, margin + 20, y);
                      y += 3.5;
                    });
                  });
                  y += 2;
                });
                doc.setFontSize(8);
                y += 2;
              }

              // Completed Tests
              if (report.completedTests && report.completedTests.length > 0) {
                checkPageBreak(10);
                doc.setFont('Helvetica', 'bold');
                doc.setTextColor(...colors.muted);
                doc.text(`Completed Tests (${report.completedTests.length}):`, margin + 10, y);
                y += 4;
                doc.setFont('Helvetica', 'normal');
                doc.setFontSize(7);
                const testsStr = report.completedTests.map(t => t.replace(/^_/, '')).join(', ');
                const wrappedTests = doc.splitTextToSize(testsStr, contentWidth - 20);
                wrappedTests.forEach((line: string) => {
                  checkPageBreak(3.5);
                  doc.text(line, margin + 15, y);
                  y += 3.5;
                });
                doc.setFontSize(8);
              }

              // Full Report JSON
              checkPageBreak(20);
              y += 5;
              doc.setFont('Helvetica', 'bold');
              doc.setFontSize(8);
              doc.setTextColor(...colors.secondary);
              doc.text('Full Report JSON:', margin + 10, y);
              y += 5;

              doc.setFont('Courier', 'normal');
              doc.setFontSize(6);
              doc.setTextColor(...colors.text);

              const fullJson = JSON.stringify(report, null, 2);
              const jsonLines = fullJson.split('\n');
              jsonLines.forEach((line) => {
                checkPageBreak(3);
                const wrapped = doc.splitTextToSize(line, contentWidth - 15);
                wrapped.forEach((wl: string) => {
                  doc.text(wl, margin + 15, y);
                  y += 3;
                });
              });

              doc.setFont('Helvetica', 'normal');
              doc.setFontSize(8);
            } else {
              doc.setFontSize(8);
              doc.setTextColor(...colors.muted);
              doc.text('Report data not available (CID not fetched)', margin + 10, y);
              y += 5;
            }

            y += 8;

            // Divider between reports
            if (reportIdx < Object.keys(pass.reports).length - 1) {
              doc.setDrawColor(200, 200, 200);
              doc.setLineWidth(0.3);
              doc.line(margin + 10, y, pageWidth - margin - 10, y);
              y += 5;
            }
          });
        }

        y += 10;

        // Divider between passes
        if (passIdx < job.passHistory!.length - 1) {
          addDivider();
        }
      });
    }

    // === TIMELINE ===
    if (job.timeline.length > 0) {
      checkPageBreak(40);
      addDivider();
      addHeader('Timeline', 12);
      y += 2;

      job.timeline.forEach((entry, idx) => {
        checkPageBreak(10);
        doc.setFillColor(...colors.primary);
        doc.circle(margin + 3, y - 1, 2, 'F');
        if (idx < job.timeline.length - 1) {
          doc.setDrawColor(...colors.light);
          doc.setLineWidth(1);
          doc.line(margin + 3, y + 2, margin + 3, y + 10);
        }
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.text);
        doc.text(entry.label, margin + 10, y);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.muted);
        doc.text(formatDate(entry.at), margin + 10, y + 4);
        y += 12;
      });
    }

    // Footer on all pages
    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setTextColor(...colors.muted);
      doc.text(`RedMesh Report - ${job.displayName}`, margin, pageHeight - 10);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth - margin - 20, pageHeight - 10);
    }

    doc.save(`redmesh-report-${job.id.slice(0, 8)}.pdf`);
  };

  if (!loading && !user) {
    router.replace('/');
    return <main className="flex min-h-screen items-center justify-center">Redirecting...</main>;
  }

  // Show loader while job is loading or while auth is still loading
  if (jobLoading || loading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader size="lg" message="Fetching task telemetry..." />
        </div>
      </AppShell>
    );
  }

  if (jobError) {
    return (
      <AppShell>
        <Card title="Unable to load task" description={jobError}>
          <Button variant="secondary" onClick={() => refresh()}>
            Retry
          </Button>
        </Card>
      </AppShell>
    );
  }

  // Only show "not found" when we explicitly received a 404 response
  if (notFound) {
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

  // If we get here without a job, something unexpected happened - show loader as fallback
  if (!job) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh]">
          <Loader size="lg" message="Fetching task telemetry..." />
        </div>
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
              <Badge tone="neutral" label={`Ports: ${job.portRange?.start ?? DEFAULT_PORT_START}-${job.portRange?.end ?? DEFAULT_PORT_END}`} />
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
                <dd className="text-slate-100">{job.workerCount}</dd>
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

          {/* Discovered Open Ports Card */}
          <Card
            title="Discovered Open Ports"
            description={`${aggregatedPorts.ports.length} unique port${aggregatedPorts.ports.length !== 1 ? 's' : ''} found across all workers`}
            className="lg:col-span-2"
          >
            {aggregatedPorts.ports.length === 0 ? (
              <p className="text-sm text-slate-400">No open ports discovered yet.</p>
            ) : (
              <div className="space-y-4">
                {/* Port Pills */}
                <div className="flex flex-wrap gap-2">
                  {(aggregatedPorts.ports.length > 100 && !portsExpanded
                    ? aggregatedPorts.ports.slice(0, 50)
                    : aggregatedPorts.ports
                  ).map((port) => {
                    const hasService = aggregatedPorts.services.has(port);
                    return (
                      <span
                        key={port}
                        className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ${
                          hasService
                            ? 'bg-emerald-900/40 border border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-700/50 border border-slate-600/50 text-slate-200'
                        }`}
                      >
                        {port}
                        {hasService && (
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" title="Service detected" />
                        )}
                      </span>
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

                {/* Service Details */}
                {aggregatedPorts.services.size > 0 && (
                  <div className="border-t border-white/10 pt-4">
                    <p className="text-xs uppercase tracking-widest text-slate-400 mb-3">
                      Detected Services ({aggregatedPorts.services.size})
                    </p>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {Array.from(aggregatedPorts.services.entries()).map(([port, info]) => (
                        <div
                          key={port}
                          className="rounded bg-slate-800/50 border border-white/5 p-3 text-sm"
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="font-semibold text-emerald-400">Port {port}</span>
                          </div>
                          <pre className="text-xs text-slate-300 overflow-x-auto whitespace-pre-wrap">
                            {typeof info === 'object' ? JSON.stringify(info, null, 2) : String(info)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
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

        {/* Detailed Worker Reports - Service Info and Web Tests */}
        {job.workers.some(w => Object.keys(w.serviceInfo).length > 0 || Object.keys(w.webTestsInfo).length > 0) && (
          <Card title="Detailed Scan Results" description="Service detection and vulnerability probe results per worker">
            <div className="space-y-6">
              {job.workers.filter(w => Object.keys(w.serviceInfo).length > 0 || Object.keys(w.webTestsInfo).length > 0).map((worker) => (
                <div key={worker.id} className="rounded-lg border border-white/10 bg-slate-800/50 p-4">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h4 className="text-sm font-semibold text-slate-100">{worker.id}</h4>
                      <p className="text-xs text-slate-400">
                        Ports {worker.startPort} - {worker.endPort} | {worker.portsScanned} scanned | {worker.openPorts.length} open
                      </p>
                    </div>
                    <div className="flex gap-2">
                      {worker.webTested && (
                        <Badge tone="success" label="Web Tested" />
                      )}
                      <Badge tone={worker.done ? 'success' : 'warning'} label={worker.done ? 'Done' : 'In Progress'} />
                    </div>
                  </div>

                  {/* Service Info Section */}
                  {Object.keys(worker.serviceInfo).length > 0 && (
                    <div className="mb-4">
                      <p className="text-xs uppercase tracking-widest text-emerald-400 mb-3">
                        Service Detection Results
                      </p>
                      <div className="space-y-3">
                        {Object.entries(worker.serviceInfo).map(([port, probes]) => (
                          <div key={port} className="rounded bg-slate-900/50 border border-white/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-emerald-400">Port {port}</span>
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            </div>
                            <div className="grid gap-2">
                              {Object.entries(probes as Record<string, unknown>).map(([probeName, result]) => {
                                if (result === null || result === undefined) return null;
                                const resultStr = String(result);
                                const isVulnerability = resultStr.includes('VULNERABILITY');
                                const isError = resultStr.includes('failed') || resultStr.includes('timed out');
                                const resultKey = `service-${worker.id}-${port}-${probeName}`;
                                const isExpanded = expandedResults.has(resultKey);
                                const needsExpand = resultStr.length > 150;
                                return (
                                  <div
                                    key={probeName}
                                    className={`rounded px-2 py-1.5 text-xs ${
                                      isVulnerability
                                        ? 'bg-amber-900/30 border border-amber-500/30'
                                        : isError
                                        ? 'bg-slate-800/50 border border-white/5'
                                        : 'bg-emerald-900/20 border border-emerald-500/20'
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
                                      {needsExpand && !isExpanded ? `${resultStr.slice(0, 150)}` : resultStr}
                                    </span>
                                    {needsExpand && (
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
                                        className="ml-1 text-emerald-400 hover:text-emerald-300 hover:underline transition-colors"
                                      >
                                        {isExpanded ? 'Show less' : '...Show more'}
                                      </button>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Web Tests Section */}
                  {Object.keys(worker.webTestsInfo).length > 0 && (
                    <div>
                      <p className="text-xs uppercase tracking-widest text-blue-400 mb-3">
                        Web Security Tests
                      </p>
                      <div className="space-y-3">
                        {Object.entries(worker.webTestsInfo).map(([port, tests]) => (
                          <div key={port} className="rounded bg-slate-900/50 border border-white/5 p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-semibold text-blue-400">Port {port}</span>
                            </div>
                            <div className="grid gap-2">
                              {Object.entries(tests as Record<string, unknown>).map(([testName, result]) => {
                                if (result === null || result === undefined) return null;
                                const resultStr = String(result);
                                const isError = resultStr.startsWith('ERROR:');
                                const isVulnerable = resultStr.includes('VULNERABLE') || resultStr.includes('vulnerability');
                                const resultKey = `web-${worker.id}-${port}-${testName}`;
                                const isExpanded = expandedResults.has(resultKey);
                                const needsExpand = resultStr.length > 150;
                                return (
                                  <div
                                    key={testName}
                                    className={`rounded px-2 py-1.5 text-xs ${
                                      isVulnerable
                                        ? 'bg-rose-900/30 border border-rose-500/30'
                                        : isError
                                        ? 'bg-slate-800/50 border border-white/5'
                                        : 'bg-blue-900/20 border border-blue-500/20'
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
                                      {needsExpand && !isExpanded ? `${resultStr.slice(0, 150)}` : resultStr}
                                    </span>
                                    {needsExpand && (
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
                                        className="ml-1 text-blue-400 hover:text-blue-300 hover:underline transition-colors"
                                      >
                                        {isExpanded ? 'Show less' : '...Show more'}
                                      </button>
                                    )}
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
                    <div className="mt-4 pt-4 border-t border-white/10">
                      <p className="text-xs uppercase tracking-widest text-slate-400 mb-2">
                        Completed Tests ({worker.completedTests.length})
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {(expandedTests.has(worker.id) ? worker.completedTests : worker.completedTests.slice(0, 20)).map((test) => (
                          <span
                            key={test}
                            className="rounded bg-slate-700/50 border border-white/10 px-2 py-0.5 text-xs text-slate-400"
                          >
                            {test.replace(/^_/, '').replace(/_/g, ' ')}
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
          </Card>
        )}

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
