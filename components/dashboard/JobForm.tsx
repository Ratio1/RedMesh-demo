'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Card from '@/components/ui/Card';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import type { Job, JobDistribution, JobDuration } from '@/lib/api/types';

interface NodePeer {
  id: string;
  address: string;
  label: string;
}

interface JobFormProps {
  onCreated?: (job: Job) => Promise<void> | void;
}

const priorities = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' },
  { value: 'critical', label: 'Critical' }
];

export default function JobForm({ onCreated }: JobFormProps): JSX.Element {
  const { token, user } = useAuth();
  const { config, loading: configLoading } = useAppConfig();
  const featureCatalog = config?.featureCatalog ?? [];
  const peersCount = config?.chainstorePeers?.length ?? 0;
  const computedMaxWorkers = config
    ? config.mockMode
      ? 100
      : Math.max(peersCount, 1)
    : 100;
  const maxWorkers = Math.max(computedMaxWorkers, 1);
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [target, setTarget] = useState('');
  const [portStart, setPortStart] = useState(1);
  const [portEnd, setPortEnd] = useState(1024);
  const [exceptions, setExceptions] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(() =>
    featureCatalog.map((feature) => feature.id)
  );
  const featuresTouchedRef = useRef(false);
  const [workerCount, setWorkerCount] = useState(2);
  const [priority, setPriority] = useState('medium');
  const [distribution, setDistribution] = useState<JobDistribution>('slice');
  const [duration, setDuration] = useState<JobDuration>('continuous');
  const [tempoMin, setTempoMin] = useState<string>('0.05');
  const [tempoMax, setTempoMax] = useState<string>('0.15');
  const [tempoEnabled, setTempoEnabled] = useState<boolean>(true);
  const [monitorInterval, setMonitorInterval] = useState<string>('60');
  const [selectedPeers, setSelectedPeers] = useState<string[]>([]);
  const [availablePeers, setAvailablePeers] = useState<NodePeer[]>([]);
  const [peersLoading, setPeersLoading] = useState(true);
  const peersTouchedRef = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedTempoMin = tempoMin ? Number(tempoMin) : undefined;
  const parsedTempoMax = tempoMax ? Number(tempoMax) : undefined;
  const tempoInvalid =
    tempoEnabled &&
    (!parsedTempoMin || !parsedTempoMax || parsedTempoMin <= 0 || parsedTempoMax < parsedTempoMin);
  const workerTrackFill =
    maxWorkers > 1 ? Math.round(((workerCount - 1) / (maxWorkers - 1)) * 100) : 0;

  useEffect(() => {
    if (!config?.featureCatalog?.length || featuresTouchedRef.current) {
      return;
    }

    setSelectedFeatures(config.featureCatalog.map((feature) => feature.id));
  }, [config?.featureCatalog]);

  // Fetch available peers from /api/nodes (same source as mesh page)
  useEffect(() => {
    let cancelled = false;
    setPeersLoading(true);

    (async () => {
      try {
        const response = await fetch('/api/nodes', { cache: 'no-store' });
        const payload = await response.json().catch(() => null);

        if (cancelled) return;

        if (response.ok && payload?.peers && Array.isArray(payload.peers)) {
          const fetchedPeers = payload.peers as NodePeer[];
          setAvailablePeers(fetchedPeers);

          // Auto-select all peers if not touched
          if (!peersTouchedRef.current) {
            setSelectedPeers(fetchedPeers.map((p) => p.address));
          }
        }
      } catch (error) {
        console.error('[JobForm] Failed to fetch peers:', error);
      } finally {
        if (!cancelled) {
          setPeersLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setWorkerCount((current) => {
      if (current < 1) return 1;
      if (current > maxWorkers) return maxWorkers;
      return current;
    });
  }, [maxWorkers]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    console.log('[JobForm] Submit started');
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (tempoInvalid) {
      console.log('[JobForm] Validation failed: tempoInvalid');
      setErrorMessage('Dune sand walking values are invalid. Provide both min and max seconds (min > 0, max >= min).');
      setIsSubmitting(false);
      return;
    }

    // Scan delay payload (dune sand walking - delay between individual scans)
    const scanDelayPayload =
      tempoEnabled && parsedTempoMin !== undefined && parsedTempoMax !== undefined
        ? { minSeconds: parsedTempoMin, maxSeconds: parsedTempoMax }
        : undefined;

    const requestBody = {
      name,
      summary,
      target,
      portRange: {
        start: Number(portStart) || 1,
        end: Number(portEnd) || 65535
      },
      exceptions: exceptions
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((value) => !Number.isNaN(value)),
      features: selectedFeatures,
      workerCount,
      priority,
      owner: user?.username,
      distribution,
      duration,
      scanDelay: scanDelayPayload,
      monitorInterval: duration === 'continuous' && monitorInterval ? Number(monitorInterval) : undefined,
      selectedPeers: selectedPeers.length > 0 ? selectedPeers : undefined
    };

    console.log('[JobForm] Sending request to /api/jobs:', requestBody);

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify(requestBody)
      });
      console.log('[JobForm] Response status:', response.status);

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error(payload?.message ?? 'Unable to create task.');
      }

      const createdJob = (payload as { job?: Job }).job;
      if (!createdJob) {
        throw new Error('Task response missing payload.');
      }

      setSuccessMessage(`Task "${createdJob.displayName ?? createdJob.id}" created.`);
      setName('');
      setSummary('');
      setTarget('');
      setPortStart(1);
      setPortEnd(1024);
      setExceptions('');
      setSelectedFeatures(featureCatalog.map((feature) => feature.id));
      featuresTouchedRef.current = false;
      setWorkerCount(2);
      setPriority('medium');
      setDistribution('slice');
      setDuration('continuous');
      setTempoMin('0.05');
      setTempoMax('0.15');
      setTempoEnabled(true);
      setMonitorInterval('60');
      setSelectedPeers(availablePeers.map((p) => p.address));
      peersTouchedRef.current = false;

      if (onCreated) {
        await onCreated(createdJob);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to create task.';
      setErrorMessage(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card
      title="Create a new task"
      description="Schedule a new RedMesh task for the current edge node."
      className="h-full"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="space-y-2">
          <label htmlFor="job-name" className="block text-sm font-medium text-slate-200">
            Task name
          </label>
          <Input
            id="job-name"
            placeholder="Firmware rollout for zone east"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="job-summary" className="block text-sm font-medium text-slate-200">
            Summary
          </label>
          <TextArea
            id="job-summary"
            placeholder="Short description of the task scope"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            required
            rows={4}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="job-target" className="block text-sm font-medium text-slate-200">
            Target host or network
          </label>
          <Input
            id="job-target"
            placeholder="10.0.5.12 or api.internal.local"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            required
          />
        </div>
        <div className="space-y-2">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">Port range</p>
            <p className="text-xs text-slate-400">Define the inclusive range to sweep.</p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <label htmlFor="job-port-start" className="block text-sm font-medium text-slate-200">
                Start port
              </label>
              <Input
                id="job-port-start"
                type="number"
                min={1}
                max={65535}
                value={portStart}
                onChange={(event) => setPortStart(Number(event.target.value))}
                required
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="job-port-end" className="block text-sm font-medium text-slate-200">
                End port
              </label>
              <Input
                id="job-port-end"
                type="number"
                min={1}
                max={65535}
                value={portEnd}
                onChange={(event) => setPortEnd(Number(event.target.value))}
                required
              />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="job-exceptions" className="block text-sm font-medium text-slate-200">
            Exclude ports (comma separated)
          </label>
          <Input
            id="job-exceptions"
            placeholder="22, 161"
            value={exceptions}
            onChange={(event) => setExceptions(event.target.value)}
          />
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">Tests</p>
            <p className="text-xs text-slate-400">All test modules are enabled by default.</p>
          </div>
          <div className="grid gap-2">
            {featureCatalog.map((feature) => {
              const active = selectedFeatures.includes(feature.id);
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() => {
                    featuresTouchedRef.current = true;
                    setSelectedFeatures((current) =>
                      active
                        ? current.filter((item) => item !== feature.id)
                        : [...current, feature.id]
                    );
                  }}
                  className={`flex items-center justify-between rounded-xl border px-4 py-2 text-sm transition ${
                    active
                      ? 'border-brand-primary/60 bg-brand-primary/15 text-slate-100'
                      : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-brand-primary/40'
                  }`}
                >
                  <div className="flex flex-col items-start">
                    <span>{feature.label}</span>
                    <span className="text-[0.7rem] text-slate-400">{feature.description}</span>
                  </div>
                  {active && <span className="text-xs uppercase text-brand-primary">Enabled</span>}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <p className="text-sm font-medium text-slate-200">Distribution</p>
            <p className="text-xs text-slate-400">Default: slice the port range across workers.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDistribution('slice')}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left text-sm transition ${
                distribution === 'slice'
                  ? 'border-brand-primary/60 bg-brand-primary/15 text-slate-100'
                  : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-brand-primary/40'
              }`}
            >
              <span className="font-semibold">Slice port range</span>
              <span className="text-[0.75rem] text-slate-400">
                Each worker receives a unique slice of the configured port range.
              </span>
            </button>
            <button
              type="button"
              onClick={() => setDistribution('mirror')}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left text-sm transition ${
                distribution === 'mirror'
                  ? 'border-brand-primary/60 bg-brand-primary/15 text-slate-100'
                  : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-brand-primary/40'
              }`}
            >
              <span className="font-semibold">Mirror port range</span>
              <span className="text-[0.75rem] text-slate-400">
                All workers scan the same range for redundancy or validation.
              </span>
            </button>
          </div>
          {/* TODO: Re-enable worker count slider when backend supports worker_count parameter
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label htmlFor="job-workers" className="block text-sm font-medium text-slate-200">
                Worker count
              </label>
              <span className="rounded-full border border-brand-primary px-3.5 py-1 text-base font-semibold text-brand-primary">
                Max: {maxWorkers} nodes
              </span>
            </div>
            <div className="pt-1">
              <input
                id="job-workers"
                type="range"
                min={1}
                max={maxWorkers}
                value={workerCount}
                onChange={(event) => setWorkerCount(Number(event.target.value) || 1)}
                className="w-full cursor-pointer appearance-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900"
                style={{
                  background: `linear-gradient(90deg, rgba(214,40,40,0.92) 0%, rgba(214,40,40,1) ${workerTrackFill}%, rgba(46,55,72,0.7) ${workerTrackFill}%, rgba(30,41,59,0.6) 100%)`,
                  height: '0.5rem',
                  borderRadius: '9999px',
                  boxShadow: '0 0 0 1px rgba(214,40,40,0.45), inset 0 0 0 1px rgba(8,12,20,0.55)'
                }}
              />
              <style jsx>{`
                #job-workers::-webkit-slider-thumb {
                  appearance: none;
                  height: 18px;
                  width: 18px;
                  border-radius: 9999px;
                  border: 2px solid #d62828;
                  background: #0b0d12;
                  box-shadow: 0 0 0 4px rgba(214, 40, 40, 0.18), 0 4px 14px rgba(0, 0, 0, 0.35);
                }
                #job-workers::-moz-range-thumb {
                  height: 18px;
                  width: 18px;
                  border-radius: 9999px;
                  border: 2px solid #d62828;
                  background: #0b0d12;
                  box-shadow: 0 0 0 4px rgba(214, 40, 40, 0.18), 0 4px 14px rgba(0, 0, 0, 0.35);
                }
                #job-workers::-webkit-slider-runnable-track {
                  appearance: none;
                }
                #job-workers::-moz-range-track {
                  appearance: none;
                }
              `}</style>
            </div>
            <div className="flex items-center justify-between text-sm text-slate-200">
              <span className="font-semibold text-slate-100">{workerCount} workers</span>
              <span className="text-slate-400">Selectable bar up to max nodes</span>
            </div>
          </div>
          */}
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200">Run mode</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setDuration('singlepass')}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left text-sm transition ${
                duration === 'singlepass'
                  ? 'border-brand-primary/60 bg-brand-primary/15 text-slate-100'
                  : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-brand-primary/40'
              }`}
            >
              <span className="font-semibold">Single-pass</span>
              <span className="text-[0.75rem] text-slate-400">Run once from start to end.</span>
            </button>
            <button
              type="button"
              onClick={() => setDuration('continuous')}
              className={`flex flex-col items-start rounded-xl border px-4 py-3 text-left text-sm transition ${
                duration === 'continuous'
                  ? 'border-brand-primary/60 bg-brand-primary/15 text-slate-100'
                  : 'border-white/10 bg-slate-900/40 text-slate-200 hover:border-brand-primary/40'
              }`}
            >
              <span className="font-semibold">Continuous monitoring</span>
              <span className="text-[0.75rem] text-slate-400">
                Keep re-running with randomized pauses between steps.
              </span>
            </button>
          </div>
          {duration === 'continuous' && (
            <div className="mt-3 space-y-2">
              <label htmlFor="monitor-interval" className="block text-sm font-medium text-slate-200">
                Monitor interval (seconds)
              </label>
              <p className="text-xs text-slate-400">
                Time to wait between scan passes. Leave at 0 to use the default configuration.
              </p>
              <Input
                id="monitor-interval"
                type="number"
                min={0}
                step={1}
                placeholder="60"
                value={monitorInterval}
                onChange={(event) => setMonitorInterval(event.target.value)}
                aria-label="Monitor interval in seconds"
              />
            </div>
          )}
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="tempo-min" className="block text-sm font-medium text-slate-200">
                Dune sand walking (seconds)
              </label>
              <button
                type="button"
                onClick={() =>
                  setTempoEnabled((current) => {
                    const next = !current;
                    if (next && !tempoMin && !tempoMax) {
                      setTempoMin('0.05');
                      setTempoMax('0.15');
                    }
                    return next;
                  })
                }
                aria-pressed={tempoEnabled}
                className={`inline-flex items-center gap-1 rounded-full border px-1 py-1 text-xs font-semibold transition ${
                  tempoEnabled
                    ? 'border-brand-primary/70 bg-brand-primary/10 text-brand-primary'
                    : 'border-white/15 bg-slate-900/60 text-slate-300 hover:border-brand-primary/40'
                }`}
              >
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    tempoEnabled ? 'text-slate-500' : 'bg-white/15 text-slate-100'
                  }`}
                >
                  Off
                </span>
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    tempoEnabled ? 'bg-brand-primary text-slate-900' : 'text-slate-500'
                  }`}
                >
                  On
                </span>
              </button>
            </div>
            <p className="text-xs text-slate-400">
              Toggle to enable randomized delays between port scans.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Random delay between individual port scans for stealth. Like walking on sand dunes — slow and quiet
            to avoid detection. Disable for fastest (but more detectable) scanning.
          </p>
          <p className="text-[0.75rem] italic text-brand-primary/80">
            In memory of Frank Herbert.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="tempo-min"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.05"
              value={tempoMin}
              onChange={(event) => setTempoMin(event.target.value)}
              invalid={tempoInvalid}
              disabled={!tempoEnabled}
              className={!tempoEnabled ? 'cursor-not-allowed opacity-50' : undefined}
              aria-label="Minimum delay (seconds)"
            />
            <Input
              id="tempo-max"
              type="number"
              min={0}
              step={0.01}
              placeholder="0.15"
              value={tempoMax}
              onChange={(event) => setTempoMax(event.target.value)}
              invalid={tempoInvalid}
              disabled={!tempoEnabled}
              className={!tempoEnabled ? 'cursor-not-allowed opacity-50' : undefined}
              aria-label="Maximum delay (seconds)"
            />
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="job-priority" className="block text-sm font-medium text-slate-200">
            Priority
          </label>
          <div className="flex gap-2">
            {priorities.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`flex-1 rounded-xl border border-white/10 px-4 py-2 text-sm transition hover:border-brand-primary/50 hover:bg-slate-800 ${
                  priority === option.value ? 'bg-brand-primary/15 text-slate-100' : 'bg-slate-900/50 text-slate-200'
                }`}
                onClick={() => setPriority(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium text-slate-200">Worker nodes</p>
              {availablePeers.length > 0 && (
                <span className="text-xs text-slate-400">
                  {selectedPeers.length} of {availablePeers.length} selected
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400">
              Select which nodes should run the scan. By default, all nodes are selected.
            </p>
          </div>
          {peersLoading ? (
            <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 text-center">
              <p className="text-sm text-slate-400">Loading worker nodes...</p>
            </div>
          ) : availablePeers.length > 0 ? (
            <>
              <div className="flex gap-2 mb-2">
                <button
                  type="button"
                  onClick={() => {
                    peersTouchedRef.current = true;
                    setSelectedPeers(availablePeers.map((p) => p.address));
                  }}
                  className="text-xs text-brand-primary hover:text-brand-primary/80 transition"
                >
                  Select all
                </button>
                <span className="text-slate-600">|</span>
                <button
                  type="button"
                  onClick={() => {
                    peersTouchedRef.current = true;
                    setSelectedPeers([]);
                  }}
                  className="text-xs text-slate-400 hover:text-slate-300 transition"
                >
                  Clear all
                </button>
              </div>
              <div className="grid gap-2 max-h-48 overflow-y-auto rounded-xl border border-white/10 bg-slate-900/30 p-3">
                {availablePeers.map((peer) => {
                  const active = selectedPeers.includes(peer.address);
                  // Use label if available, otherwise shorten the address
                  const displayName = peer.label || (peer.address.length > 30
                    ? `${peer.address.slice(0, 15)}...${peer.address.slice(-12)}`
                    : peer.address);
                  return (
                    <button
                      key={peer.address}
                      type="button"
                      onClick={() => {
                        peersTouchedRef.current = true;
                        setSelectedPeers((current) =>
                          active
                            ? current.filter((item) => item !== peer.address)
                            : [...current, peer.address]
                        );
                      }}
                      className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm transition ${
                        active
                          ? 'border-brand-primary/60 bg-brand-primary/15 text-slate-100'
                          : 'border-white/10 bg-slate-900/40 text-slate-400 hover:border-brand-primary/40 hover:text-slate-200'
                      }`}
                      title={peer.address}
                    >
                      <span className="text-xs">{displayName}</span>
                      {active && (
                        <span className="ml-2 text-xs uppercase text-brand-primary">Selected</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <div className="rounded-xl border border-white/10 bg-slate-900/30 p-4 text-center">
              <p className="text-sm text-slate-400">
                No worker nodes configured. All available nodes will be used.
              </p>
            </div>
          )}
        </div>
        {successMessage && (
          <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/15 px-4 py-3 text-sm text-emerald-100">
            {successMessage}
          </div>
        )}
        {errorMessage && (
          <div className="rounded-lg border border-rose-500/30 bg-rose-500/15 px-4 py-3 text-sm text-rose-100">
            {errorMessage}
          </div>
        )}
        <Button
          type="submit"
          disabled={
            isSubmitting ||
            !name.trim() ||
            !summary.trim() ||
            !target.trim() ||
            (Number(portEnd) || 0) < (Number(portStart) || 0) ||
            tempoInvalid
          }
        >
          {isSubmitting ? 'Creating...' : 'Create task'}
        </Button>
      </form>
    </Card>
  );
}
