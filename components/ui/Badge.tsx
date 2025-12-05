'use client';

import clsx from 'clsx';

interface BadgeProps {
  label: string;
  tone?: 'neutral' | 'success' | 'warning' | 'danger';
  className?: string;
}

const toneStyles: Record<NonNullable<BadgeProps['tone']>, string> = {
  neutral: 'bg-white/10 text-slate-100 border border-white/15',
  success: 'bg-emerald-500/15 text-emerald-200 border border-emerald-500/40',
  warning: 'bg-amber-500/15 text-amber-100 border border-amber-500/40',
  danger: 'bg-rose-500/15 text-rose-100 border border-rose-500/40'
};

export default function Badge({ label, tone = 'neutral', className }: BadgeProps): JSX.Element {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium uppercase tracking-wide',
        toneStyles[tone],
        className
      )}
    >
      {label}
    </span>
  );
}
