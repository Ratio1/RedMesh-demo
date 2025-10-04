'use client';

import { PropsWithChildren } from 'react';
import { AppConfigProvider } from '@/components/layout/AppConfigContext';
import { AuthProvider } from '@/components/auth/AuthContext';

export default function Providers({ children }: PropsWithChildren<{}>): JSX.Element {
  return (
    <AppConfigProvider>
      <AuthProvider>{children}</AuthProvider>
    </AppConfigProvider>
  );
}
