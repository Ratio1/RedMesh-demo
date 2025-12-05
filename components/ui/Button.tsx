'use client';

import { ButtonHTMLAttributes, DetailedHTMLProps, ReactElement, cloneElement, isValidElement } from 'react';
import clsx from 'clsx';

const baseClass = 'inline-flex items-center justify-center rounded-md border border-transparent px-4 py-2 font-medium transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';

const variants: Record<string, string> = {
  primary: 'bg-gradient-to-r from-brand-primary to-[#b30025] text-white shadow-lg shadow-brand-primary/35 hover:from-[#c11f1f] hover:to-[#99001f] focus-visible:outline-brand-primary',
  secondary: 'bg-slate-900 text-slate-100 border border-white/15 hover:border-brand-primary hover:bg-slate-800 focus-visible:outline-brand-primary',
  danger: 'bg-[#e23d4b] text-white hover:bg-[#c92f3c] focus-visible:outline-[#e23d4b]'
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
