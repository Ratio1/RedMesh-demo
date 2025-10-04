'use client';

import { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement, cloneElement, isValidElement } from 'react';
import clsx from 'clsx';

const baseClass = 'inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

const variants: Record<string, string> = {
  primary: 'bg-gradient-to-r from-sky-500 to-cyan-400 text-slate-900 shadow-lg shadow-sky-500/30 hover:from-sky-400 hover:to-cyan-300 focus-visible:outline-sky-300',
  secondary: 'bg-white/5 text-slate-100 border border-white/10 hover:bg-white/10 focus-visible:outline-slate-200',
  danger: 'bg-rose-500/90 text-white hover:bg-rose-400 focus-visible:outline-rose-200'
};

const sizes: Record<'md' | 'sm', string> = {
  md: 'h-11 px-5 text-sm gap-2',
  sm: 'h-9 px-4 text-xs gap-1.5'
};

type ButtonProps = DetailedHTMLProps<ButtonHTMLAttributes<HTMLButtonElement>, HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
  asChild?: boolean;
};

export default function Button({
  className,
  variant = 'primary',
  size = 'md',
  asChild = false,
  ...props
}: ButtonProps): JSX.Element {
  if (asChild && isValidElement(props.children)) {
    const child = props.children as ReactElement;
    return cloneElement(child, {
      className: clsx(baseClass, variants[variant], sizes[size], child.props.className, className)
    });
  }

  return <button className={clsx(baseClass, variants[variant], sizes[size], className)} {...props} />;
}
