'use client';

import {
  PropsWithChildren,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';
import type { AuthSuccess, UserAccount } from '@/lib/api/types';

interface AuthContextValue {
  user: UserAccount | null;
  token: string | null;
  loading: boolean;
  error: string | null;
  signIn: (username: string, password: string) => Promise<void>;
  signOut: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const SESSION_STORAGE_KEY = 'redmesh-demo-session';

type StoredSession = { user: UserAccount; token: string };

function readSession(): StoredSession | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(SESSION_STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StoredSession) : null;
  } catch (_error) {
    return null;
  }
}

function persistSession(session: StoredSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    if (session) {
      window.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
    } else {
      window.localStorage.removeItem(SESSION_STORAGE_KEY);
    }
  } catch (_error) {
    // Ignore persistence errors in constrained environments.
  }
}

export function AuthProvider({ children }: PropsWithChildren<{}>): JSX.Element {
  const [user, setUser] = useState<UserAccount | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const session = readSession();
    if (session) {
      setUser(session.user);
      setToken(session.token);
    }
    setLoading(false);
  }, []);

  const signIn = useCallback(async (username: string, password: string) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ username, password })
      });

      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) {
        throw new Error((payload as { message?: string })?.message ?? 'Unable to sign in.');
      }

      const authPayload = payload as AuthSuccess;
      setUser(authPayload.user);
      setToken(authPayload.token);
      persistSession({ user: authPayload.user, token: authPayload.token });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to sign in.';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    setToken(null);
    setError(null);
    persistSession(null);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      loading,
      error,
      signIn,
      signOut
    }),
    [user, token, loading, error, signIn, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }

  return context;
}
