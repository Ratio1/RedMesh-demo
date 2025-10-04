'use client';

import { useEffect } from 'react';
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
      <div className="grid w-full max-w-4xl grid-cols-1 gap-10 rounded-3xl border border-white/10 bg-slate-900/60 p-10 shadow-[0_40px_120px_rgba(8,47,73,0.45)] backdrop-blur-xl lg:grid-cols-[1.1fr_1fr]">
        <div className="space-y-6">
          <p className="text-sm font-semibold uppercase tracking-[0.4em] text-sky-300">Ratio1 RedMesh</p>
          <h1 className="text-3xl font-bold text-slate-50 sm:text-4xl">
            Sign in to manage RedMesh workloads
          </h1>
          <p className="text-sm leading-relaxed text-slate-300">
            Authenticate with your RedMesh Demo credentials to inspect jobs, schedule new deployments, and
            check the Ratio1 Edge Node {config?.hostId ? `(${config.hostId})` : ''} RedMesh state.
          </p>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-xs text-slate-200/80">
            <p className="font-semibold text-slate-100">Runtime checks</p>
            <ul className="mt-3 space-y-1.5">
              <li>
                <span className="text-slate-300">RedMesh API</span> -{' '}
                <strong className={config?.redmeshApiConfigured ? 'text-emerald-300' : 'text-rose-300'}>
                  {config?.redmeshApiConfigured ? 'detected' : 'missing'}
                </strong>
              </li>
              <li>
                <span className="text-slate-300">CStore API</span> -{' '}
                <strong className={config?.chainstoreApiConfigured ? 'text-emerald-300' : 'text-rose-300'}>
                  {config?.chainstoreApiConfigured ? 'detected' : 'missing'}
                </strong>
              </li>
              <li>
                <span className="text-slate-300">R1FS API</span> -{' '}
                <strong className={config?.r1fsApiConfigured ? 'text-emerald-300' : 'text-amber-300'}>
                  {config?.r1fsApiConfigured ? 'detected' : 'optional'}
                </strong>
              </li>
            </ul>
          </div>
        </div>
        <div className="rounded-2xl border border-white/5 bg-slate-900/80 p-8 shadow-inner shadow-slate-900/40">
          <LoginForm />
        </div>
      </div>
    </main>
  );
}
