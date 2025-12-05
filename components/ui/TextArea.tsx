'use client';

import { DetailedHTMLProps, TextareaHTMLAttributes } from 'react';
import clsx from 'clsx';

type Props = DetailedHTMLProps<TextareaHTMLAttributes<HTMLTextAreaElement>, HTMLTextAreaElement> & {
  invalid?: boolean;
};

export default function TextArea({ className, invalid, ...props }: Props): JSX.Element {
  return (
    <textarea
      className={clsx(
        'w-full rounded-lg border bg-slate-900/60 px-4 py-3 text-sm text-slate-100 shadow-inner shadow-slate-950/40 transition focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/30',
        invalid ? 'border-[#e23d4b] focus:ring-[#e23d4b]/50' : 'border-white/15',
        className
      )}
      {...props}
    />
  );
}
