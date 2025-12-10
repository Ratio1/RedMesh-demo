'use client';

import { useEffect } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import LoginForm from '@/components/auth/LoginForm';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';

export default function Home(): JSX.Element {
  const { user, loading } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();

  useEffect(() => {
    if (!loading && user) {
      router.replace('/dashboard');
    }
  }, [user, loading, router]);

  if (user) {
    return <main className="flex min-h-screen items-center justify-center">Redirecting...</main>;
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-16">
      <div className="grid w-full max-w-4xl grid-cols-1 gap-8 rounded-3xl border border-white/10 bg-slate-950/70 p-8 shadow-[0_32px_96px_rgba(0,0,0,0.4)] backdrop-blur-xl lg:grid-cols-[1.1fr_1fr] lg:items-stretch">
        <div className="flex flex-col justify-between space-y-5 pb-2 lg:pb-0">
          <div className="flex items-center gap-3">
            <Image src="/RedMeshLogo.svg" alt="RedMesh" width={192} height={192} priority />
          </div>
          <h1 className="text-3xl font-bold text-slate-50 sm:text-4xl">
            Sign in to manage RedMesh workloads
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Authenticate with your RedMesh Demo credentials to inspect tasks, schedule new deployments, and
            check the Ratio1 Edge Node {config?.hostId ? `(${config.hostId})` : ''} RedMesh state.
          </p>
          <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-4 text-xs text-slate-300 lg:self-end">
            <p className="font-semibold text-slate-100">Runtime checks</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-3">
              <StatusPill label="RedMesh API" ok={config?.redmeshApiConfigured} optional={false} />
              <StatusPill label="CStore API" ok={config?.chainstoreApiConfigured} optional={false} />
              <StatusPill label="R1FS API" ok={config?.r1fsApiConfigured} optional />
            </div>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-slate-900/60 p-8 shadow-inner shadow-slate-950/40">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}

function StatusPill({ label, ok, optional }: { label: string; ok?: boolean; optional?: boolean }): JSX.Element {
  return (
    <div className="flex items-start justify-between rounded-xl border border-white/10 bg-slate-900/70 px-3 py-2">
      <div className="flex flex-col">
        <span className="text-[11px] uppercase tracking-[0.18em] text-slate-300">{label}</span>
        <span className={ok ? 'text-emerald-300' : optional ? 'text-amber-300' : 'text-rose-300'}>
          {ok ? 'Live' : optional ? 'optional' : 'missing'}
        </span>
      </div>
    </div>
  );
}
