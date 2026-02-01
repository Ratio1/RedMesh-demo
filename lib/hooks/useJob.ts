'use client';

import { useAuth } from '@/components/auth/AuthContext';
import { Job, WorkerReport, LlmAnalysis } from '@/lib/api/types';
import { useCallback, useEffect, useRef, useState } from 'react';

interface JobState {
  job: Job | null;
  reports: Record<string, WorkerReport>;
  /** LLM analysis content for each pass (passNr -> analysis) */
  llmAnalyses: Record<number, LlmAnalysis>;
  loading: boolean;
  error: string | null;
  notFound: boolean;
  refresh: () => Promise<void>;
}

/**
 * Hook for fetching a single job with its reports.
 * More efficient than useJobs when you only need one job's data.
 */
export default function useJob(jobId: string): JobState {
  const { token, loading: authLoading } = useAuth();
  const [job, setJob] = useState<Job | null>(null);
  const [reports, setReports] = useState<Record<string, WorkerReport>>({});
  const [llmAnalyses, setLlmAnalyses] = useState<Record<number, LlmAnalysis>>({});
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);
  const inFlightRef = useRef<AbortController | null>(null);

  const loadJob = useCallback(async () => {
    if (authLoading || !jobId) {
      return;
    }

    // Cancel any in-flight request
    if (inFlightRef.current) {
      inFlightRef.current.abort();
    }
    const controller = new AbortController();
    inFlightRef.current = controller;

    setLoading(true);
    setError(null);
    setNotFound(false);

    try {
      const response = await fetch(`/api/jobs/${jobId}?includeReports=true`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        signal: controller.signal
      });

      if (response.status === 404) {
        setNotFound(true);
        setJob(null);
        return;
      }

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? 'Unable to load job.');
      }

      setJob(payload.job ?? null);
      setReports((payload.reports as Record<string, WorkerReport>) ?? {});
      setLlmAnalyses((payload.llmAnalyses as Record<number, LlmAnalysis>) ?? {});
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      const message = err instanceof Error ? err.message : 'Unable to load job.';
      setError(message);
    } finally {
      setLoading(false);
      if (inFlightRef.current === controller) {
        inFlightRef.current = null;
      }
    }
  }, [jobId, token, authLoading]);

  useEffect(() => {
    void loadJob();
  }, [loadJob]);

  useEffect(() => {
    return () => {
      if (inFlightRef.current) {
        inFlightRef.current.abort();
      }
    };
  }, []);

  return {
    job,
    reports,
    llmAnalyses,
    loading,
    error,
    notFound,
    refresh: loadJob
  };
}