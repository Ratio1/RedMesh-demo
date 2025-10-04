'use client';

import { useAuth } from '@/components/auth/AuthContext';
import { Job } from '@/lib/api/types';
import { useCallback, useEffect, useMemo, useState } from 'react';

interface JobsState {
  jobs: Job[];
  ongoingJobs: Job[];
  completedJobs: Job[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export default function useJobs(): JobsState {
  const { token } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jobs', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? 'Unable to load jobs.');
      }

      setJobs((payload as { jobs?: Job[] }).jobs ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load jobs.';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const split = useMemo(() => {
    const ongoing = jobs.filter((job) => job.status === 'running' || job.status === 'queued');
    const completed = jobs.filter((job) => job.status === 'completed' || job.status === 'failed');
    return { ongoing, completed };
  }, [jobs]);

  return {
    jobs,
    ongoingJobs: split.ongoing,
    completedJobs: split.completed,
    loading,
    error,
    refresh: loadJobs
  };
}
