'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';

interface ProfileMenuProps {
  onSignOut: () => void;
}

export default function ProfileMenu({ onSignOut }: ProfileMenuProps): JSX.Element {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-900/70 text-slate-100 ring-1 ring-white/10 transition hover:ring-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/60"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          className="h-5 w-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
        >
          <circle cx="12" cy="8" r="4.25" />
          <path d="M5 19c1.5-3 4-4.5 7-4.5s5.5 1.5 7 4.5" />
        </svg>
      </button>
      {open && (
        <div
          className="absolute right-0 z-30 mt-2 w-44 overflow-hidden rounded-xl border border-white/10 bg-slate-900/95 shadow-lg shadow-black/60 backdrop-blur"
          role="menu"
        >
          <button
            type="button"
            className="block w-full px-4 py-2 text-left text-sm text-rose-300 transition hover:bg-rose-500/20"
            role="menuitem"
            onClick={() => {
              setOpen(false);
              onSignOut();
            }}
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
