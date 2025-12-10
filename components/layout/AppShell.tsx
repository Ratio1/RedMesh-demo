'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { PropsWithChildren, useState } from 'react';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import Button from '@/components/ui/Button';
import ProfileMenu from '@/components/layout/ProfileMenu';
import clsx from 'clsx';
import ServedByIndicator from '@/components/layout/ServedByIndicator';
import AppVersionBadge from '@/components/layout/AppVersionBadge';

const navItems = [
  { href: '/dashboard', label: 'Tasks' },
  { href: '/mesh', label: 'Mesh' },
  { href: '/advanced', label: 'Advanced' }
];

function StatusDot({ active }: { active: boolean }): JSX.Element {
  return (
    <span
      className={clsx(
        'h-2 w-2 rounded-full',
        active
          ? 'bg-emerald-400 shadow-[0_0_0_4px_rgba(52,211,153,0.2)]'
          : 'bg-rose-400 shadow-[0_0_0_4px_rgba(248,113,113,0.18)]'
      )}
      aria-hidden
    />
  );
}

export default function AppShell({ children }: PropsWithChildren<{}>): JSX.Element {
  const { user, signOut } = useAuth();
  const { config } = useAppConfig();
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  const displayName = user?.displayName ?? user?.username ?? 'Signed out';
  const roleLabel = user ? user.roles.join(', ') || 'No roles' : 'Signed out';

  const apiStatus = {
    redmesh: Boolean(config?.redmeshApiConfigured),
    cstore: Boolean(config?.chainstoreApiConfigured),
    r1fs: Boolean(config?.r1fsApiConfigured),
    peers: Boolean(config?.chainstorePeers?.length)
  };

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
        <div className="relative mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-6 py-4">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="flex items-center gap-6" onClick={() => setMobileOpen(false)}>
              <Image src="/RedMeshLogo.svg" alt="RedMesh" width={120} height={120} priority />
              <span className="sr-only">RedMesh Dashboard</span>
            </Link>
            <div className="hidden items-center gap-2 sm:flex">
              {config?.environment && (
                <span className="items-center rounded-full border border-brand-primary/40 bg-brand-primary/10 px-3 py-1 text-[9px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                  Env: {config.environment}
                </span>
              )}
              <AppVersionBadge subtle />
            </div>
          </div>
          <nav className="hidden items-center gap-2 sm:flex">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setMobileOpen(false)}
                className={clsx(
                  'rounded-full px-4 py-2 text-sm font-medium transition',
                  pathname === item.href
                    ? 'text-brand-primary'
                    : 'text-slate-200 hover:text-brand-primary'
                )}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-4">
            <div className="hidden items-center gap-3 sm:flex">
              <div className="text-right">
                <p className="text-base font-semibold text-brand-primary">
                  {displayName}
                </p>
                <p className="text-xs text-slate-400">{roleLabel}</p>
              </div>
              {user && <ProfileMenu onSignOut={signOut} />}
              {user && (
                <Button asChild size="sm">
                  <Link href="/dashboard/jobs/new">Create task</Link>
                </Button>
              )}
            </div>
            {user && (
              <Button asChild size="sm" className="sm:hidden">
                <Link href="/dashboard/jobs/new">Create task</Link>
              </Button>
            )}
            <button
              type="button"
              className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/15 bg-slate-900/60 text-slate-200 transition hover:border-brand-primary hover:text-brand-primary sm:hidden"
              aria-label="Toggle navigation"
              onClick={() => setMobileOpen((prev) => !prev)}
            >
              <span className="sr-only">Toggle navigation</span>
              <svg
                aria-hidden="true"
                className={clsx('h-5 w-5 transition', mobileOpen ? 'rotate-90 text-brand-primary' : '')}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
              >
                {mobileOpen ? (
                  <>
                    <path d="M6 6l12 12" />
                    <path d="M18 6l-12 12" />
                  </>
                ) : (
                  <>
                    <path d="M4 7h16" />
                    <path d="M4 12h16" />
                    <path d="M4 17h16" />
                  </>
                )}
              </svg>
            </button>
          </div>
          {mobileOpen && (
            <div className="absolute left-0 right-0 top-full z-30 mt-2 flex flex-col gap-2 rounded-2xl border border-white/10 bg-slate-950/95 p-4 shadow-lg shadow-black/50 sm:hidden">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className={clsx(
                    'rounded-lg px-3 py-2 text-sm font-medium transition',
                    pathname === item.href
                      ? 'bg-brand-primary/10 text-brand-primary'
                      : 'text-slate-200 hover:bg-white/5 hover:text-brand-primary'
                  )}
                >
                  {item.label}
                </Link>
              ))}
              {config?.environment && (
                <div className="rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-brand-primary">
                  Env: {config.environment}
                </div>
              )}
              <AppVersionBadge className="justify-center" subtle />
              {user && (
                <div className="flex items-center justify-between rounded-lg border border-white/10 bg-slate-900/60 px-3 py-2">
                  <div className="text-left">
                    <p className="text-sm font-semibold text-brand-primary">{displayName}</p>
                    <p className="text-[11px] text-slate-400">{roleLabel}</p>
                  </div>
                  <ProfileMenu onSignOut={signOut} />
                </div>
              )}
            </div>
          )}
        </div>
      </header>
      <main className="flex-1">
        <div className="mx-auto w-full max-w-6xl px-6 py-10">{children}</div>
      </main>
      <footer className="border-t border-white/10 bg-slate-950/80">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-6 py-4 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative flex items-center gap-3 text-slate-300 group">
            <span className="text-slate-500">API Status</span>
            <div className="invisible absolute bottom-full left-0 z-40 mb-2 w-56 rounded-xl border border-white/10 bg-slate-950/90 p-3 text-xs text-slate-200 shadow-lg shadow-black/40 opacity-0 transition group-hover:visible group-hover:opacity-100">
              <p className="mb-2 text-[11px] uppercase tracking-[0.2em] text-slate-400">API Status</p>
              <ul className="space-y-1">
                <li className="flex items-center justify-between">
                  <span>RedMesh API</span>
                  <StatusDot active={apiStatus.redmesh} />
                </li>
                <li className="flex items-center justify-between">
                  <span>CStore API</span>
                  <StatusDot active={apiStatus.cstore} />
                </li>
                <li className="flex items-center justify-between">
                  <span>R1FS API</span>
                  <StatusDot active={apiStatus.r1fs} />
                </li>
                <li className="flex items-center justify-between">
                  <span>ChainStore peers</span>
                  <StatusDot active={apiStatus.peers} />
                </li>
              </ul>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-slate-500">
            <AppVersionBadge />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-slate-500">© 2025 Ratio1 RedMesh</p>
            <ServedByIndicator className="rounded-full border border-white/15 bg-slate-900/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-200" />
          </div>
        </div>
      </footer>
    </div>
  );
}
