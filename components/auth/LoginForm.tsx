'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/auth/AuthContext';
import { useAppConfig } from '@/components/layout/AppConfigContext';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function LoginForm(): JSX.Element {
  const { signIn, error, loading } = useAuth();
  const { config } = useAppConfig();
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLocalError(null);

    try {
      await signIn(username.trim(), password.trim());
      router.replace('/dashboard');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Authentication failed.';
      setLocalError(message);
    }
  };

  return (
    <form className="space-y-6" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-200" htmlFor="username">
          Username
        </label>
        <Input
          id="username"
          placeholder="Enter your operator ID"
          autoComplete="username"
          value={username}
          onChange={(event) => setUsername(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <label className="block text-sm font-medium text-slate-200" htmlFor="password">
          Password
        </label>
        <Input
          id="password"
          type="password"
          placeholder="Enter your password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>
      {(localError || error) && (
        <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {localError || error}
        </div>
      )}
      {config?.mockMode && (
        <div className="rounded-lg border border-sky-500/30 bg-sky-500/10 px-4 py-3 text-xs text-slate-200">
          Mock mode is active. Try <code>admin / admin123</code> or <code>operator / operator123</code>.
        </div>
      )}
      <Button type="submit" disabled={loading || !username || !password}>
        {loading ? 'Signing in...' : 'Sign in'}
      </Button>
    </form>
  );
}
