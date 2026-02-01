'use client';

import clsx from 'clsx';
import { PropsWithChildren, ReactNode } from 'react';

interface CardProps extends PropsWithChildren {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export default function Card({
  title,
  description,
  actions,
  className,
  children
}: CardProps): JSX.Element {
  return (
    <section
      className={clsx(
        'rounded-2xl border border-white/10 bg-gradient-to-br from-slate-900/70 via-slate-900/60 to-slate-900/40 p-6 shadow-[0_24px_72px_rgba(0,0,0,0.45)] backdrop-blur-lg',
        className
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold text-slate-50">{title}</h2>}
            {description && <p className="text-sm text-slate-300/80">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
