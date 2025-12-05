'use client';

import { DetailedHTMLProps, InputHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = DetailedHTMLProps<InputHTMLAttributes<HTMLInputElement>, HTMLInputElement> & {
  invalid?: boolean;
};

export default function Input({ className, invalid, ...props }: Props): JSX.Element {
  return (
    <input
      className={clsx(
        'w-full rounded-lg border bg-slate-900/60 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-slate-950/40 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30',
        invalid ? 'border-[#e23d4b] focus:ring-[#e23d4b]/50' : 'border-white/15',
        className
      )}
      {...props}
    />
  );
}
