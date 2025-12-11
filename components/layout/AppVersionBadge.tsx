'use client';

import clsx from 'clsx';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import { APP_VERSION } from '@/lib/config/version';

interface AppVersionBadgeProps {
  className?: string;
  subtle?: boolean;
}

export default function AppVersionBadge({
  className,
  subtle = false
}: AppVersionBadgeProps): JSX.Element {
  const { config } = useAppConfig();
  const version = config?.appVersion ?? APP_VERSION;

  return (
    <span
      className={clsx(
        'inline-flex items-center gap-2 rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold text-slate-100',
        subtle ? 'tracking-[0.18em]' : 'tracking-[0.14em]',
        className
      )}
      aria-label={`App version ${version}`}
    >
      {version}
    </span>
  );
}
