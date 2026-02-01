import jsPDF from 'jspdf';
import { format } from 'date-fns';
import type { Job, WorkerReport, LlmAnalysis } from '@/lib/api/types';
import type { AggregatedPortsData, WorkerActivityItem } from '@/app/dashboard/jobs/[jobId]/types';

type RGB = [number, number, number];

interface PDFColors {
  primary: RGB;
  secondary: RGB;
  danger: RGB;
  warning: RGB;
  success: RGB;
  info: RGB;
  text: RGB;
  muted: RGB;
  light: RGB;
}

function formatDate(value?: string): string {
  if (!value) return '--';
  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return value;
  }
}

interface GenerateJobReportParams {
  job: Job;
  reports: Record<string, WorkerReport>;
  aggregatedPorts: AggregatedPortsData;
  workerActivity: WorkerActivityItem[];
  llmAnalyses?: Record<number, LlmAnalysis>;
}

/**
 * Generates a PDF report for a job scan.
 */
export function generateJobReport({
  job,
  reports,
  aggregatedPorts,
  workerActivity,
  llmAnalyses,
}: GenerateJobReportParams): void {
  const doc = new jsPDF();
  let y = 20;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;

  const colors: PDFColors = {
    primary: [214, 40, 40],     // brand-primary #d62828
    secondary: [71, 85, 105],   // slate-500
    danger: [239, 68, 68],      // red-500
    warning: [245, 158, 11],    // amber-500
    success: [34, 197, 94],     // green-500
    info: [59, 130, 246],       // blue-500
    text: [30, 41, 59],         // slate-800
    muted: [100, 116, 139],     // slate-500
    light: [241, 245, 249],     // slate-100
  };

  // Helper functions
  const checkPageBreak = (needed: number): boolean => {
    if (y + needed > pageHeight - 20) {
      doc.addPage();
      y = 20;
      return true;
    }
    return false;
  };

  const addHeader = (text: string, size: number = 12, color: RGB = colors.primary): void => {
    checkPageBreak(15);
    doc.setFontSize(size);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(...color);
    doc.text(text, margin, y);
    y += size * 0.5 + 2;
    doc.setTextColor(...colors.text);
  };

  const addText = (text: string, indent: number = 0, bold: boolean = false): void => {
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

  const addLabelValue = (label: string, value: string, indent: number = 0): void => {
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

  const addDivider = (): void => {
    y += 3;
    checkPageBreak(5);
    doc.setDrawColor(...colors.light);
    doc.setLineWidth(0.5);
    doc.line(margin, y, pageWidth - margin, y);
    y += 6;
  };

  /**
   * Render LLM analysis markdown content to PDF
   */
  const renderLlmAnalysis = (analysis: LlmAnalysis, passNr?: number): void => {
    // Section header with AI icon indicator
    checkPageBreak(40);

    // Header bar
    doc.setFillColor(147, 51, 234); // purple-600
    doc.roundedRect(margin, y, contentWidth, 14, 2, 2, 'F');
    y += 4;

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(12);
    doc.setFont('Helvetica', 'bold');
    const title = passNr !== undefined ? `AI Security Analysis (Pass #${passNr})` : 'AI Security Analysis';
    doc.text(title, margin + 5, y + 5);
    y += 18;

    // Description box
    doc.setFillColor(243, 232, 255); // purple-100
    doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'F');
    y += 4;
    doc.setFontSize(8);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(107, 33, 168); // purple-700
    const description = 'This AI-generated security assessment is automatically created for completed scans. ' +
      'It analyzes discovered services, open ports, and potential vulnerabilities to provide actionable insights.';
    const descWrapped = doc.splitTextToSize(description, contentWidth - 10);
    descWrapped.forEach((line: string) => {
      doc.text(line, margin + 5, y + 3);
      y += 4;
    });
    y += 6;

    // Metadata bar
    doc.setFillColor(...colors.light);
    doc.roundedRect(margin, y, contentWidth, 12, 2, 2, 'F');
    y += 4;

    doc.setFontSize(7);
    doc.setFont('Helvetica', 'normal');
    doc.setTextColor(...colors.muted);
    const metaInfo = [
      `Model: ${analysis.model}`,
      `Type: ${analysis.analysisType.replace(/_/g, ' ')}`,
      `Open Ports: ${analysis.scanSummary.openPorts}`,
      `Generated: ${formatDate(analysis.createdAt)}`,
    ];
    doc.text(metaInfo.join('  |  '), margin + 5, y + 4);
    y += 15;

    // Render markdown content
    const lines = analysis.content.split('\n');
    let inCodeBlock = false;
    let inList = false;

    for (const line of lines) {
      // Code block handling
      if (line.startsWith('```')) {
        inCodeBlock = !inCodeBlock;
        if (inCodeBlock) {
          y += 2;
          doc.setFillColor(30, 41, 59); // slate-800
        }
        continue;
      }

      if (inCodeBlock) {
        checkPageBreak(5);
        doc.setFillColor(30, 41, 59);
        doc.rect(margin, y - 3, contentWidth, 5, 'F');
        doc.setFont('Courier', 'normal');
        doc.setFontSize(7);
        doc.setTextColor(200, 200, 200);
        const wrapped = doc.splitTextToSize(line, contentWidth - 10);
        wrapped.forEach((wl: string) => {
          doc.text(wl, margin + 5, y);
          y += 4;
        });
        continue;
      }

      // Headers
      if (line.startsWith('# ')) {
        checkPageBreak(12);
        y += 4;
        doc.setFontSize(14);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.text);
        const text = line.slice(2).replace(/\*\*/g, '');
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((wl: string) => {
          doc.text(wl, margin, y);
          y += 6;
        });
        y += 2;
        continue;
      }
      if (line.startsWith('## ')) {
        checkPageBreak(10);
        y += 3;
        doc.setFontSize(11);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.primary);
        const text = line.slice(3).replace(/\*\*/g, '');
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((wl: string) => {
          doc.text(wl, margin, y);
          y += 5;
        });
        // Underline
        doc.setDrawColor(...colors.light);
        doc.setLineWidth(0.3);
        doc.line(margin, y, pageWidth - margin, y);
        y += 4;
        continue;
      }
      if (line.startsWith('### ')) {
        checkPageBreak(8);
        y += 2;
        doc.setFontSize(10);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.secondary);
        const text = line.slice(4).replace(/\*\*/g, '');
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((wl: string) => {
          doc.text(wl, margin, y);
          y += 4.5;
        });
        y += 1;
        continue;
      }
      if (line.startsWith('#### ')) {
        checkPageBreak(7);
        y += 1;
        doc.setFontSize(9);
        doc.setFont('Helvetica', 'bold');
        doc.setTextColor(...colors.text);
        const text = line.slice(5).replace(/\*\*/g, '');
        const wrapped = doc.splitTextToSize(text, contentWidth);
        wrapped.forEach((wl: string) => {
          doc.text(wl, margin, y);
          y += 4;
        });
        continue;
      }

      // List items
      if (line.match(/^[-*]\s/)) {
        checkPageBreak(5);
        inList = true;
        doc.setFontSize(8);
        doc.setFont('Helvetica', 'normal');
        doc.setTextColor(...colors.text);

        // Check for bold text in list item
        let text = line.slice(2);
        const boldMatch = text.match(/^\*\*([^*]+)\*\*:?\s*(.*)/);
        if (boldMatch) {
          doc.setFont('Helvetica', 'bold');
          doc.text('• ' + boldMatch[1] + ':', margin + 5, y);
          const labelWidth = doc.getTextWidth('• ' + boldMatch[1] + ': ');
          doc.setFont('Helvetica', 'normal');
          if (boldMatch[2]) {
            const wrapped = doc.splitTextToSize(boldMatch[2], contentWidth - 10 - labelWidth);
            wrapped.forEach((wl: string, idx: number) => {
              if (idx === 0) {
                doc.text(wl, margin + 5 + labelWidth, y);
              } else {
                y += 4;
                checkPageBreak(4);
                doc.text(wl, margin + 10, y);
              }
            });
          }
        } else {
          text = text.replace(/\*\*([^*]+)\*\*/g, '$1');
          const wrapped = doc.splitTextToSize('• ' + text, contentWidth - 5);
          wrapped.forEach((wl: string, idx: number) => {
            if (idx > 0) {
              checkPageBreak(4);
            }
            doc.text(wl, margin + 5, y);
            y += 4;
          });
          y -= 4; // Adjust for loop increment
        }
        y += 4;
        continue;
      }

      // Empty line
      if (line.trim() === '') {
        inList = false;
        y += 3;
        continue;
      }

      // Regular paragraph
      checkPageBreak(5);
      doc.setFontSize(8);
      doc.setFont('Helvetica', 'normal');
      doc.setTextColor(...colors.text);

      // Handle inline formatting
      let text = line
        .replace(/\*\*([^*]+)\*\*/g, '$1') // Remove bold markers (can't do real bold inline easily)
        .replace(/\*([^*]+)\*/g, '$1')     // Remove italic markers
        .replace(/`([^`]+)`/g, '$1');       // Remove code markers

      const wrapped = doc.splitTextToSize(text, contentWidth);
      wrapped.forEach((wl: string) => {
        checkPageBreak(4);
        doc.text(wl, margin, y);
        y += 4;
      });
      y += 1;
    }

    y += 5;
    addDivider();
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

  // Status label and badge
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...colors.muted);
  doc.text('Status:', margin + 5, y);
  y += 4;

  const statusColor = job.status === 'completed' ? colors.primary :
                      job.status === 'stopped' ? colors.primary :
                      job.status === 'stopping' ? colors.warning :
                      job.status === 'running' ? colors.warning : colors.secondary;
  doc.setFillColor(...statusColor);
  doc.roundedRect(margin + 5, y, 50, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.text(job.status.toUpperCase(), margin + 10, y + 5.5);

  // Priority label and badge
  doc.setFontSize(7);
  doc.setFont('Helvetica', 'normal');
  doc.setTextColor(...colors.muted);
  doc.text('Priority:', margin + 60, y - 4);

  doc.setFillColor(...colors.secondary);
  doc.roundedRect(margin + 60, y, 40, 8, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(8);
  doc.setFont('Helvetica', 'bold');
  doc.text(job.priority.toUpperCase(), margin + 65, y + 5.5);

  y += 20;

  // Summary Stats - use reports data for accurate counts
  addHeader('Summary Statistics', 11);
  y += 2;

  const reportsList = Object.values(reports);
  const totalOpenPorts = aggregatedPorts.ports.length;
  const totalPortsScanned = reportsList.reduce((sum, r) => sum + r.portsScanned, 0);
  const workersWithDetails = job.workers.filter(w => Object.keys(w.serviceInfo).length > 0 || Object.keys(w.webTestsInfo).length > 0);
  const workersWithFindings = reportsList.filter(r => r.openPorts.length > 0 || Object.keys(r.serviceInfo).length > 0).length;

  const stats = [
    { label: 'Workers', value: String(workerActivity.length || job.workerCount) },
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

  // AI Security Analysis for singlepass jobs (show at top level)
  if (job.runMode === 'singlepass' && llmAnalyses && llmAnalyses[1]) {
    doc.addPage();
    y = 20;
    renderLlmAnalysis(llmAnalyses[1]);
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
  const hasFindings = totalOpenPorts > 0 || job.aggregate || workersWithDetails.length > 0;
  if (hasFindings) {
    doc.addPage();
    y = 20;
  }

  // Open Ports Section
  if (totalOpenPorts > 0) {
    addHeader('Discovered Open Ports', 14, colors.primary);
    y += 2;

    const allPorts = new Set<number>();
    job.workers.forEach(w => w.openPorts.forEach(p => allPorts.add(p)));
    aggregatedPorts.ports.forEach(p => allPorts.add(p));
    const sortedPorts = Array.from(allPorts).sort((a, b) => a - b);

    doc.setFillColor(254, 226, 226);
    doc.roundedRect(margin, y, contentWidth, 15, 2, 2, 'F');
    y += 5;
    doc.setFontSize(9);
    doc.setFont('Helvetica', 'bold');
    doc.setTextColor(...colors.primary);
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
            doc.setTextColor(...(isVulnerability ? colors.warning : isError ? [180, 180, 180] as RGB : colors.text));
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
        addHeader('Web Security Tests', 10, [59, 130, 246]);

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
            doc.setTextColor(...(isVulnerable ? colors.danger : isError ? [180, 180, 180] as RGB : colors.text));
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
      doc.setFillColor(254, 226, 226);
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

      // LLM Analysis for this pass (continuous mode)
      if (llmAnalyses && llmAnalyses[pass.passNr]) {
        renderLlmAnalysis(llmAnalyses[pass.passNr], pass.passNr);
      }

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
              doc.setFont('Helvetica', 'bold');
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
              doc.setTextColor(59, 130, 246);
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
}
