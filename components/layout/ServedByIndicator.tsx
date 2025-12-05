'use client';

import clsx from 'clsx';
import { useAppConfig } from '@/components/layout/AppConfigContext';

interface ServedByIndicatorProps {
  className?: string;
}

export default function ServedByIndicator({ className }: ServedByIndicatorProps): JSX.Element {
  const { config, loading } = useAppConfig();

  const hostId = config?.hostId ?? null;
  const label = hostId ? `Served by ${hostId}` : loading ? 'Detecting R1EN...' : 'R1EN unavailable';

  return (
    <div className={clsx('flex items-center gap-2 text-xs text-slate-400', className)} aria-live="polite">
      <span className="whitespace-nowrap text-slate-200">{label}</span>
    </div>
  );
}
