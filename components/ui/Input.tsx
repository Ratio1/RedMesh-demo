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
        'w-full rounded-lg border bg-white/5 px-4 py-3 text-sm text-slate-50 shadow-inner transition focus:border-sky-400 focus:outline-none focus:ring-2 focus:ring-sky-500/40',
        invalid ? 'border-rose-400/60 focus:ring-rose-400/50' : 'border-white/10',
        className
      )}
      {...props}
    />
  );
}
