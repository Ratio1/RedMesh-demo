'use client';

import { FormEvent, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import TextArea from '@/components/ui/TextArea';
import Card from '@/components/ui/Card';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import { REDMESH_FEATURE_CATALOG, getDefaultFeatureIds } from '@/lib/domain/features';
import type { Job } from '@/lib/api/types';

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
  const [name, setName] = useState('');
  const [summary, setSummary] = useState('');
  const [target, setTarget] = useState('');
  const [portStart, setPortStart] = useState(1);
  const [portEnd, setPortEnd] = useState(1024);
  const [exceptions, setExceptions] = useState('');
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>(getDefaultFeatureIds());
  const [workerCount, setWorkerCount] = useState(2);
  const [payloadUri, setPayloadUri] = useState('');
  const [notes, setNotes] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

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
          owner: user?.username
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
      setSelectedFeatures(getDefaultFeatureIds());
      setWorkerCount(2);
      setPayloadUri('');
      setNotes('');
      setPriority('medium');

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
          <p className="text-sm font-medium text-slate-200">Feature set</p>
          <div className="grid gap-2">
            {(config?.featureCatalog ?? REDMESH_FEATURE_CATALOG).map((feature) => {
              const active = selectedFeatures.includes(feature.id);
              return (
                <button
                  key={feature.id}
                  type="button"
                  onClick={() =>
                    setSelectedFeatures((current) =>
                      active
                        ? current.filter((item) => item !== feature.id)
                        : [...current, feature.id]
                    )
                  }
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
        <div className="space-y-2">
          <label htmlFor="job-workers" className="block text-sm font-medium text-slate-200">
            Worker count
          </label>
          <Input
            id="job-workers"
            type="number"
            min={1}
            max={16}
            value={workerCount}
            onChange={(event) => setWorkerCount(Number(event.target.value) || 1)}
            required
          />
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
            (Number(portEnd) || 0) < (Number(portStart) || 0)
          }
        >
          {isSubmitting ? 'Creating...' : 'Create task'}
        </Button>
      </form>
    </Card>
  );
}
