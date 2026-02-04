/**
 * Root Layout
 * 
 * Next.js App Router root layout component.
 * Includes Tailwind CSS and basic HTML structure.
 */

import type { Metadata } from 'next';
import AppShell from '@/src/ui/components/AppShell';
import { ScopeProvider } from '@/src/ui/contexts/ScopeContext';
import './globals.css';

export const metadata: Metadata = {
  title: 'FinanceOS v2',
  description: 'Personal finance management application',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="cs">
      <body>
        <ScopeProvider>
          <AppShell>{children}</AppShell>
        </ScopeProvider>
      </body>
    </html>
  );
}
