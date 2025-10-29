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
    <div
      className={clsx(
        'pointer-events-none fixed bottom-4 right-4 rounded-full bg-slate-950/80 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.3em] text-slate-300 shadow-lg shadow-black/40 ring-1 ring-white/10 backdrop-blur',
        className
      )}
      aria-live="polite"
    >
      {label}
    </div>
  );
}
