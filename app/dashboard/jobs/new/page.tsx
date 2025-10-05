'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import AppShell from '@/components/layout/AppShell';
import { useAuth } from '@/components/auth/AuthContext';
import JobForm from '@/components/dashboard/JobForm';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

export default function NewJobPage(): JSX.Element {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/');
    }
  }, [loading, user, router]);

  if (!user) {
    return (
      <main className="flex min-h-screen items-center justify-center text-slate-200">
        Redirecting...
      </main>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Job creation</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-50">Configure a new RedMesh job</h1>
            <p className="mt-2 text-sm text-slate-300">
              Define the target scope, port strategy, and feature set. The payload matches the RedMesh FastAPI
              contract so it can be replayed directly against the edge node.
            </p>
          </div>
          <Button asChild variant="secondary" size="sm">
            <Link href="/dashboard">Back to dashboard</Link>
          </Button>
        </div>
        <div className="grid gap-6 lg:grid-cols-[1.3fr_1fr]">
          <JobForm
            onCreated={(job) => {
              router.replace(`/dashboard/jobs/${job.id}`);
            }}
          />
          <Card
            title="Tips"
            description="Keep these guidelines in mind when dispatching a job."
            className="h-fit"
          >
            <ul className="space-y-3 text-sm text-slate-200">
              <li>
                Ensure the port range matches the exposure expected by the RedMesh worker mix-ins. Large ranges
                (e.g., 1-65535) will be split across workers based on the configured count.
              </li>
              <li>
                Use the feature toggles to match the `red_mesh` plugin capabilities (`service_info_*`,
                `web_test_*`). This mirrors the feature discovery helpers from the Edge Node repository.
              </li>
              <li>
                Optional payload URIs should reference R1FS paths so Worker App Runner instances can fetch the
                artifacts in production.
              </li>
            </ul>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
