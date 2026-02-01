'use client';

import { format } from 'date-fns';
import Card from '@/components/ui/Card';
import type { JobTimelineEntry } from '@/lib/api/types';

function formatDate(value?: string): string {
  if (!value) return '--';
  try {
    return format(new Date(value), 'MMM d, yyyy HH:mm:ss');
  } catch {
    return value;
  }
}

interface JobTimelineProps {
  timeline: JobTimelineEntry[];
}

export function JobTimeline({ timeline }: JobTimelineProps) {
  return (
    <Card title="Timeline">
      <ol className="space-y-3">
        {timeline.map((entry) => (
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
  );
}
