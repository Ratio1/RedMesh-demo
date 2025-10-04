'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import clsx from 'clsx';

const navItems = [
  { href: '/dashboard', label: 'Jobs' },
  { href: '/advanced', label: 'Advanced' }
];

export default function AppShell({ children }: PropsWithChildren<{}>): JSX.Element {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-500/20 text-sky-300">
                <span className="text-lg font-semibold">RM</span>
              </div>
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-300">Ratio1</p>
                <h1 className="text-lg font-semibold text-slate-50">RedMesh Edge Console</h1>
              </div>
            </Link>
            {config?.mockMode && <Badge tone="warning" label="Mock Mode" />}
            {config?.environment && (
              <Badge tone="neutral" label={`Env: ${config.environment}`} />
            )}
          </div>
          <nav className="flex items-center gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={clsx(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  pathname === item.href
                    ? 'bg-white/10 text-sky-200 shadow-inner shadow-sky-500/10'
                    : 'text-slate-300 hover:bg-white/10 hover:text-slate-100'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden flex-col text-xs uppercase tracking-widest text-slate-400 sm:flex">
              {config?.hostId && <span>Host {config.hostId}</span>}
              {config?.featureCatalog && (
                <span>{config.featureCatalog.length} features</span>
              )}
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right text-sm">
                <p className="font-semibold text-slate-100">{user?.displayName ?? user?.username}</p>
                <p className="text-xs text-slate-400">{user?.roles.join(', ') || 'operator'}</p>
              </div>
              <Button variant="secondary" size="sm" onClick={signOut}>
                Sign out
              </Button>
            </div>
          </div>
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
      </main>
    </div>
  );
}
