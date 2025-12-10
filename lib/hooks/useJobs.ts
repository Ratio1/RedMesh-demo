'use client';

import { useAuth } from '@/components/auth/AuthContext';
import { Job } from '@/lib/api/types';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface JobsState {
  jobs: Job[];
  ongoingJobs: Job[];
  completedJobs: Job[];
  failedJobs: Job[];
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export default function useJobs(): JobsState {
  const { token, loading: authLoading } = useAuth();
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const inFlightRef = useRef<AbortController | null>(null);

  const loadJobs = useCallback(async () => {
    if (authLoading) {
      // Wait for auth state to resolve before attempting to load jobs.
      return;
    }

    // Cancel any in-flight request when a new one starts.
    if (inFlightRef.current) {
      inFlightRef.current.abort();
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/jobs', {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? 'Unable to load jobs.');
      }

      setJobs((payload as { jobs?: Job[] }).jobs ?? []);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to load jobs.';
      setError(message);
    } finally {
      setLoading(false);
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
    }
  }, [token, authLoading]);

  useEffect(() => {
    void loadJobs();
    }, [loadJobs]);

  useEffect(() => {
    return () => {
      if (inFlightRef.current) {
        inFlightRef.current.abort();
      }
    };
  }, []);

  const split = useMemo(() => {
    const ongoing = jobs.filter((job) => job.status === 'running' || job.status === 'queued');
    const completed = jobs.filter((job) => job.status === 'completed');
    const failed = jobs.filter((job) => job.status === 'failed');
    return { ongoing, completed, failed };
  }, [jobs]);

  return {
    jobs,
    ongoingJobs: split.ongoing,
    completedJobs: split.completed,
    failedJobs: split.failed,
    loading,
    error,
    refresh: loadJobs
  };
}
