'use client';

import { useCallback, useState } from 'react';

export type StopType = 'SOFT' | 'HARD';

interface StopJobResult {
  status: string;
  job_id: string;
  message: string;
}

interface StopMonitoringResult {
  job_id: string;
  monitoring_status: string;
  stop_type: StopType;
  passes_completed: number;
  pass_history: Array<{
    pass_number: number;
    completed_at: number;
    report_cid: string;
  }>;
}

interface UseJobActionsReturn {
  stopJob: (jobId: string) => Promise<StopJobResult>;
  stopMonitoring: (jobId: string, stopType?: StopType) => Promise<StopMonitoringResult>;
  loading: boolean;
  error: string | null;
  clearError: () => void;
}

/**
 * Hook for job actions (stop, delete, stop monitoring).
 * Provides loading and error states for UI feedback.
 */
export function useJobActions(): UseJobActionsReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const stopJob = useCallback(async (jobId: string): Promise<StopJobResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}`, {
        method: 'DELETE'
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.message || 'Failed to stop job.';
        setError(message);
        throw new Error(message);
      }

      return payload as StopJobResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop job.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const stopMonitoring = useCallback(async (
    jobId: string,
    stopType: StopType = 'SOFT'
  ): Promise<StopMonitoringResult> => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/jobs/${encodeURIComponent(jobId)}/stop-monitoring`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ stop_type: stopType })
      });

      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        const message = payload?.message || 'Failed to stop monitoring.';
        setError(message);
        throw new Error(message);
      }

      return payload as StopMonitoringResult;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to stop monitoring.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    stopJob,
    stopMonitoring,
    loading,
    error,
    clearError
  };
}
