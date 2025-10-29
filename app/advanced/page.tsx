'use client';

import Link from 'next/link';
import AppShell from '@/components/layout/AppShell';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function AdvancedPage(): JSX.Element {
  const { config, refresh } = useAppConfig();

  const formatStatus = (status: unknown, fallback: string) => {
    if (!status) {
      return fallback;
    }

    if (typeof status === 'string') {
      return status;
    }

    if (typeof status === 'object') {
      const maybeStatus = (status as Record<string, unknown>).status ??
        (status as Record<string, unknown>).state ??
        (status as Record<string, unknown>).message;
      if (typeof maybeStatus === 'string') {
        return maybeStatus;
      }
      try {
        return JSON.stringify(status);
      } catch (_error) {
        return fallback;
      }
    }

    return fallback;
  };

  return (
    <AppShell>
      <div className="space-y-6">
        <Card
          title="RedMesh Swagger"
          description="Inspect the live RedMesh API contract and run ad-hoc requests."
          actions={
            config?.swaggerUrl ? (
              <Link
                href={config.swaggerUrl}
                target="_blank"
                className="inline-flex h-10 items-center justify-center rounded-full bg-sky-500/90 px-5 text-sm font-medium text-slate-900 shadow-lg shadow-sky-500/30 transition hover:bg-sky-400"
              >
                Open docs
              </Link>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => refresh()}>
                Reload config
              </Button>
            )
          }
        >
          <p className="text-sm leading-relaxed text-slate-300">
            The Swagger UI is published by the RedMesh API on the edge node. Access requires network
            proximity or tunnelling provided by the Ratio1 Worker App Runner. Environment variable
            <code className="mx-1 rounded bg-white/10 px-2 py-0.5 text-xs">EE_REDMESH_API_URL</code> must be set.
          </p>
          {!config?.swaggerUrl && (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              Swagger endpoint is not configured. Confirm the RedMesh API URL is accessible and the worker
              exported <code>EE_REDMESH_API_URL</code>.
            </p>
          )}
        </Card>
        <Card
          title="Service endpoints"
          description="Validate environment assumptions for this deployment."
        >
          <ul className="space-y-3 text-sm text-slate-200">
            <li>
              <strong className="text-slate-100">RedMesh API</strong>
              <div className="text-xs text-slate-400">
                {config?.redmeshApiConfigured ? 'Configured via EE_REDMESH_API_URL' : 'Not detected'}
              </div>
            </li>
            <li>
              <strong className="text-slate-100">CStore API</strong>
              <div className="text-xs text-slate-400">
                {config?.chainstoreApiConfigured ? 'Configured via EE_CHAINSTORE_API_URL' : 'Not detected'}
              </div>
            </li>
            <li>
              <strong className="text-slate-100">R1FS API</strong>
              <div className="text-xs text-slate-400">
                {config?.r1fsApiConfigured ? 'Configured via EE_R1FS_API_URL' : 'Optional in UI'}
              </div>
            </li>
            <li>
              <strong className="text-slate-100">Host</strong>
              <div className="text-xs text-slate-400">{config?.hostId ?? 'Unknown edge node'}</div>
            </li>
            <li>
              <strong className="text-slate-100">Mode</strong>
              <div className="text-xs text-slate-400">
                {config?.mockMode ? 'Mock data enabled (missing env vars)' : 'Live API mode'}
              </div>
            </li>
            <li>
              <strong className="text-slate-100">ChainStore peers</strong>
              <div className="text-xs text-slate-400">
                {config?.chainstorePeers?.length
                  ? config.chainstorePeers.join(', ')
                  : 'None configured'}
              </div>
            </li>
          </ul>
        </Card>
        <Card title="Edge service status" description="Live telemetry sourced via @ratio1/edge-sdk-ts">
          <dl className="space-y-3 text-sm text-slate-200">
            <div>
              <dt className="font-semibold text-slate-100">CStore</dt>
              <dd className="text-xs text-slate-400">
                {config?.cstoreError
                  ? `Error: ${config.cstoreError}`
                  : formatStatus(config?.cstoreStatus, 'Unavailable')}
              </dd>
            </div>
            <div>
              <dt className="font-semibold text-slate-100">R1FS</dt>
              <dd className="text-xs text-slate-400">
                {config?.r1fsError
                  ? `Error: ${config.r1fsError}`
                  : formatStatus(config?.r1fsStatus, 'Unavailable')}
              </dd>
            </div>
          </dl>
        </Card>
        <Card
          title="CStore authentication diagnostics"
          description="Use the RedMesh token to validate credential syncs."
        >
          <ol className="list-decimal space-y-3 pl-5 text-sm text-slate-200">
            <li>
              Confirm <code className="mx-1 rounded bg-white/10 px-2 py-0.5 text-xs">REDMESH_TOKEN</code> is
              provisioned to the Worker App Runner.
            </li>
            <li>Fetch <code>/api/auth/login</code> with mock credentials to validate fallback behaviour.</li>
            <li>
              When connected to real infrastructure, CStore should respond to
              <code className="mx-1 rounded bg-white/10 px-2 py-0.5 text-xs">POST /auth/verify</code> requests.
            </li>
          </ol>
        </Card>
      </div>
    </AppShell>
  );
}
