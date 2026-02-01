'use client';

import React, { useState, useMemo } from 'react';
import { format } from 'date-fns';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import type { LlmAnalysis as LlmAnalysisType } from '@/lib/api/types';

interface LlmAnalysisProps {
  analysis: LlmAnalysisType;
  passNr?: number;
}

/**
 * Simple markdown to React renderer
 * Handles: headers, bold, lists, code blocks, paragraphs
 */
function renderMarkdown(content: string): React.ReactNode[] {
  const lines = content.split('\n');
  const elements: React.ReactNode[] = [];
  let currentList: string[] = [];
  let inCodeBlock = false;
  let codeBlockContent: string[] = [];
  let codeBlockLang = '';

  const flushList = () => {
    if (currentList.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-3 text-slate-300">
          {currentList.map((item, i) => (
            <li key={i} dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(item) }} />
          ))}
        </ul>
      );
      currentList = [];
    }
  };

  const flushCodeBlock = () => {
    if (codeBlockContent.length > 0) {
      elements.push(
        <pre
          key={`code-${elements.length}`}
          className="bg-slate-900 rounded-lg p-4 my-3 overflow-x-auto text-sm text-slate-300 font-mono"
        >
          <code>{codeBlockContent.join('\n')}</code>
        </pre>
      );
      codeBlockContent = [];
      codeBlockLang = '';
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code block handling
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        flushCodeBlock();
        inCodeBlock = false;
      } else {
        flushList();
        inCodeBlock = true;
        codeBlockLang = line.slice(3).trim();
      }
      continue;
    }

    if (inCodeBlock) {
      codeBlockContent.push(line);
      continue;
    }

    // Headers
    if (line.startsWith('# ')) {
      flushList();
      elements.push(
        <h1
          key={`h1-${i}`}
          className="text-2xl font-bold text-slate-100 mt-6 mb-3 first:mt-0"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.slice(2)) }}
        />
      );
      continue;
    }
    if (line.startsWith('## ')) {
      flushList();
      elements.push(
        <h2
          key={`h2-${i}`}
          className="text-xl font-semibold text-slate-100 mt-5 mb-2 border-b border-white/10 pb-2"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.slice(3)) }}
        />
      );
      continue;
    }
    if (line.startsWith('### ')) {
      flushList();
      elements.push(
        <h3
          key={`h3-${i}`}
          className="text-lg font-semibold text-slate-200 mt-4 mb-2"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.slice(4)) }}
        />
      );
      continue;
    }
    if (line.startsWith('#### ')) {
      flushList();
      elements.push(
        <h4
          key={`h4-${i}`}
          className="text-base font-semibold text-slate-200 mt-3 mb-1"
          dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line.slice(5)) }}
        />
      );
      continue;
    }

    // List items
    if (line.match(/^[-*]\s/)) {
      currentList.push(line.slice(2));
      continue;
    }
    if (line.match(/^\d+\.\s/)) {
      currentList.push(line.replace(/^\d+\.\s/, ''));
      continue;
    }

    // Empty line
    if (line.trim() === '') {
      flushList();
      continue;
    }

    // Regular paragraph
    flushList();
    elements.push(
      <p
        key={`p-${i}`}
        className="text-slate-300 my-2 leading-relaxed"
        dangerouslySetInnerHTML={{ __html: formatInlineMarkdown(line) }}
      />
    );
  }

  flushList();
  flushCodeBlock();

  return elements;
}

/**
 * Format inline markdown (bold, italic, code, links)
 */
function formatInlineMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong class="font-semibold text-slate-100">$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em class="italic">$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-slate-800 px-1.5 py-0.5 rounded text-sm font-mono text-brand-primary">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-brand-primary hover:underline" target="_blank" rel="noopener noreferrer">$1</a>');
}

function formatDate(value?: string): string {
  if (!value) return '--';
  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return value;
  }
}

export function LlmAnalysis({ analysis, passNr }: LlmAnalysisProps) {
  const [expanded, setExpanded] = useState(true);

  const renderedContent = useMemo(() => {
    return renderMarkdown(analysis.content);
  }, [analysis.content]);

  // Determine risk level from content for badge color
  const getRiskTone = (): 'danger' | 'warning' | 'success' | 'neutral' => {
    const content = analysis.content.toLowerCase();
    if (content.includes('critical') || content.includes('high risk')) return 'danger';
    if (content.includes('medium') || content.includes('medium-high')) return 'warning';
    if (content.includes('low risk') || content.includes('minimal')) return 'success';
    return 'neutral';
  };

  return (
    <Card
      title={
        <button
          onClick={() => setExpanded(!expanded)}
          className="flex items-center gap-2 w-full text-left cursor-pointer group"
        >
          <svg
            className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          <svg
            className="w-5 h-5 text-brand-primary"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span>AI Security Analysis</span>
          {passNr !== undefined && (
            <span className="text-xs text-slate-500 font-normal">
              (Pass #{passNr})
            </span>
          )}
        </button>
      }
      description={expanded ? undefined : 'Click to expand the AI-generated security assessment'}
    >
      {!expanded ? (
        <div className="flex items-center gap-4">
          <Badge tone={getRiskTone()} label={analysis.analysisType.replace(/_/g, ' ')} />
          <span className="text-sm text-slate-400">
            Analyzed by {analysis.model} on {formatDate(analysis.createdAt)}
          </span>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Metadata Bar */}
          <div className="flex flex-wrap items-center gap-4 p-3 rounded-lg bg-slate-800/50 border border-white/5">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Type:</span>
              <Badge tone="neutral" label={analysis.analysisType.replace(/_/g, ' ')} />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Open Ports:</span>
              <span className="text-sm font-medium text-brand-primary">
                {analysis.scanSummary.openPorts}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Generated:</span>
              <span className="text-sm text-slate-300">
                {formatDate(analysis.createdAt)}
              </span>
            </div>
          </div>

          {/* Analysis Content */}
          <div className="prose prose-invert max-w-none">
            {renderedContent}
          </div>
        </div>
      )}
    </Card>
  );
}
