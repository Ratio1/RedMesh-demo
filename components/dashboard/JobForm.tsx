'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Card from '@/components/ui/Card';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import { REDMESH_FEATURE_CATALOG } from '@/lib/domain/features';
import type { Job, JobDistribution, JobDuration } from '@/lib/api/types';

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
  const { config } = useAppConfig();
  const featureCatalog =
    config?.featureCatalog && config.featureCatalog.length > 0
      ? config.featureCatalog
      : REDMESH_FEATURE_CATALOG;
  const maxWorkers = 50;
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
  const [payloadUri, setPayloadUri] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [distribution, setDistribution] = useState<JobDistribution>('slice');
  const [duration, setDuration] = useState<JobDuration>('singlepass');
  const [tempoMin, setTempoMin] = useState<string>('');
  const [tempoMax, setTempoMax] = useState<string>('');
  const [tempoEnabled, setTempoEnabled] = useState<boolean>(false);
  const [tempoStepsMin, setTempoStepsMin] = useState<string>('');
  const [tempoStepsMax, setTempoStepsMax] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const parsedTempoMin = tempoMin ? Number(tempoMin) : undefined;
  const parsedTempoMax = tempoMax ? Number(tempoMax) : undefined;
  const tempoFieldsActive = duration === 'continuous' || tempoEnabled;
  const tempoInvalid =
    tempoFieldsActive &&
    (!parsedTempoMin || !parsedTempoMax || parsedTempoMin <= 0 || parsedTempoMax < parsedTempoMin);
  const parsedTempoStepsMin = tempoStepsMin ? Number(tempoStepsMin) : undefined;
  const parsedTempoStepsMax = tempoStepsMax ? Number(tempoStepsMax) : undefined;
  const tempoStepsProvided =
    tempoFieldsActive && (parsedTempoStepsMin !== undefined || parsedTempoStepsMax !== undefined);
  const tempoStepsInvalid =
    tempoStepsProvided &&
    (!Number.isInteger(parsedTempoStepsMin) ||
      !Number.isInteger(parsedTempoStepsMax) ||
      (parsedTempoStepsMin ?? 0) <= 0 ||
      (parsedTempoStepsMax ?? 0) < (parsedTempoStepsMin ?? 0));
  const workerTrackFill =
    maxWorkers > 2 ? Math.round(((workerCount - 2) / (maxWorkers - 2)) * 100) : 0;

  useEffect(() => {
    if (!config?.featureCatalog?.length || featuresTouchedRef.current) {
      return;
    }

    setSelectedFeatures(config.featureCatalog.map((feature) => feature.id));
  }, [config?.featureCatalog]);

  useEffect(() => {
    if (duration === 'continuous') {
      setTempoEnabled(true);
      setTempoMin((current) => (current ? current : '30'));
      setTempoMax((current) => (current ? current : '300'));
    } else {
      setTempoEnabled(false);
    }
  }, [duration]);

  useEffect(() => {
    setWorkerCount((current) => {
      if (current < 2) return 2;
      if (current > maxWorkers) return maxWorkers;
      return current;
    });
  }, [maxWorkers]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    if (tempoInvalid || tempoStepsInvalid) {
      setErrorMessage(
        tempoStepsInvalid
          ? 'Tests-before-pause range is invalid. Provide min and max whole numbers (min > 0, max >= min).'
          : duration === 'continuous'
          ? 'Continuous monitoring requires a tempo window with a valid min and max (min > 0, max >= min).'
          : 'Tempo window is incomplete. Provide both min and max seconds or leave both fields empty.'
      );
      setIsSubmitting(false);
      return;
    }

    const tempoPayload =
      tempoFieldsActive && parsedTempoMin !== undefined && parsedTempoMax !== undefined
        ? { minSeconds: parsedTempoMin, maxSeconds: parsedTempoMax }
        : undefined;
    const tempoStepsPayload =
      tempoFieldsActive && parsedTempoStepsMin !== undefined && parsedTempoStepsMax !== undefined
        ? { min: parsedTempoStepsMin, max: parsedTempoStepsMax }
        : undefined;

    try {
      const response = await fetch('/api/jobs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
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
          payloadUri: payloadUri || undefined,
          priority,
          notes: notes || undefined,
          owner: user?.username,
          distribution,
          duration,
          tempo: tempoPayload,
          tempoSteps: tempoStepsPayload
        })
      });

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
      setPayloadUri('');
      setNotes('');
      setPriority('medium');
      setDistribution('slice');
      setDuration('singlepass');
      setTempoMin('');
      setTempoMax('');
      setTempoEnabled(false);
      setTempoStepsMin('');
      setTempoStepsMax('');

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
                min={2}
                max={maxWorkers}
                value={workerCount}
                onChange={(event) => setWorkerCount(Number(event.target.value) || 2)}
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
        </div>
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-200">Duration</p>
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
        </div>
        <div className="space-y-3 rounded-xl border border-white/10 bg-slate-900/30 p-4">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label htmlFor="tempo-min" className="block text-sm font-medium text-slate-200">
                Tempo between tests (seconds)
              </label>
              {duration === 'singlepass' && (
                <button
                  type="button"
                  onClick={() =>
                    setTempoEnabled((current) => {
                      const next = !current;
                      if (next && !tempoMin && !tempoMax) {
                        setTempoMin('30');
                        setTempoMax('300');
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
              )}
            </div>
            <p className="text-xs text-slate-400">
              Optional for single-pass (toggle to enable); required for continuous runs.
            </p>
          </div>
          <p className="text-xs text-slate-400">
            Tempo is the pause duration between step sessions: set a min/max break and each pause is re-randomized inside
            that window (e.g. 30-300 seconds). Steps define how many tests run in a session before that pause.
          </p>
          <p className="text-[0.75rem] italic text-brand-primary/80">
            Also known as &quot;Dune sand walking&quot; in memory of Frank Herbert.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Input
              id="tempo-min"
              type="number"
              min={1}
              placeholder="30"
              value={tempoMin}
              onChange={(event) => setTempoMin(event.target.value)}
              invalid={tempoInvalid}
              disabled={!tempoFieldsActive}
              className={!tempoFieldsActive ? 'cursor-not-allowed opacity-50' : undefined}
              aria-label="Minimum tempo (seconds)"
            />
            <Input
              id="tempo-max"
              type="number"
              min={1}
              placeholder="300"
              value={tempoMax}
              onChange={(event) => setTempoMax(event.target.value)}
              invalid={tempoInvalid}
              disabled={!tempoFieldsActive}
              className={!tempoFieldsActive ? 'cursor-not-allowed opacity-50' : undefined}
              aria-label="Maximum tempo (seconds)"
            />
          </div>
          <div className="space-y-2 rounded-lg border border-white/15 bg-slate-900/40 p-3">
            <p className="text-sm font-medium text-slate-200">Tests before pause (steps)</p>
            <p className="text-xs text-slate-400">
              Number of test cycles to run before pausing for the next tempo window.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1">
                <label htmlFor="tempo-steps-min" className="block text-sm font-medium text-slate-200">
                  Min steps
                </label>
                <Input
                  id="tempo-steps-min"
                  type="number"
                  min={1}
                  placeholder="3"
                  value={tempoStepsMin}
                  onChange={(event) => setTempoStepsMin(event.target.value)}
                  invalid={tempoStepsInvalid}
                  disabled={!tempoFieldsActive}
                  className={!tempoFieldsActive ? 'cursor-not-allowed opacity-50' : undefined}
                  aria-label="Minimum steps before pause"
                />
              </div>
              <div className="space-y-1">
                <label htmlFor="tempo-steps-max" className="block text-sm font-medium text-slate-200">
                  Max steps
                </label>
                <Input
                  id="tempo-steps-max"
                  type="number"
                  min={1}
                  placeholder="10"
                  value={tempoStepsMax}
                  onChange={(event) => setTempoStepsMax(event.target.value)}
                  invalid={tempoStepsInvalid}
                  disabled={!tempoFieldsActive}
                  className={!tempoFieldsActive ? 'cursor-not-allowed opacity-50' : undefined}
                  aria-label="Maximum steps before pause"
                />
              </div>
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <label htmlFor="job-payload" className="block text-sm font-medium text-slate-200">
            Payload URI (optional)
          </label>
          <Input
            id="job-payload"
            placeholder="r1fs://path/to/payload"
            value={payloadUri}
            onChange={(event) => setPayloadUri(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor="job-notes" className="block text-sm font-medium text-slate-200">
            Operator notes (optional)
          </label>
          <TextArea
            id="job-notes"
            placeholder="Escalation contacts, scope boundaries, credentials, etc."
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
          />
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
            tempoInvalid ||
            tempoStepsInvalid
          }
        >
          {isSubmitting ? 'Creating...' : 'Create task'}
        </Button>
      </form>
    </Card>
  );
}
