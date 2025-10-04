'use client';

import clsx from 'clsx';
import { PropsWithChildren, ReactNode } from 'react';

interface CardProps extends PropsWithChildren {
  title?: string;
  description?: string;
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
        'rounded-2xl border border-white/10 bg-gradient-to-br from-white/5 via-white/3 to-transparent p-6 shadow-[0_24px_72px_rgba(15,23,42,0.35)] backdrop-blur-lg',
        className
      )}
    >
      {(title || actions) && (
        <header className="mb-4 flex items-start justify-between gap-3">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold text-slate-100">{title}</h2>}
            {description && <p className="text-sm text-slate-300/80">{description}</p>}
          </div>
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}
