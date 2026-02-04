/**
 * Scope Context
 * 
 * Global scope state management for the application.
 * Provides the current active scope and setter function.
 * Scope is persisted to localStorage.
 */

'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import type { AppScope } from '@/src/storage/schema';

const SCOPE_STORAGE_KEY = 'financeos.activeScope';
const DEFAULT_SCOPE: AppScope = 'rodina';

type ScopeContextType = {
  scope: AppScope;
  setScope: (scope: AppScope) => void;
};

const ScopeContext = createContext<ScopeContextType | undefined>(undefined);

export function ScopeProvider({ children }: { children: ReactNode }) {
  // Initialize with default scope (SSR-safe)
  // Will be updated from localStorage on client-side mount
  const [scope, setScopeState] = useState<AppScope>(DEFAULT_SCOPE);
  const [isMounted, setIsMounted] = useState(false);

  // Load scope from localStorage on mount (client-side only)
  useEffect(() => {
    setIsMounted(true);
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(SCOPE_STORAGE_KEY);
      if (stored && (stored === 'rodina' || stored === 'ico' || stored === 'sro_karin' || stored === 'weecon')) {
        setScopeState(stored as AppScope);
      }
    }
  }, []);

  // Persist scope to localStorage when it changes
  const setScope = (newScope: AppScope) => {
    setScopeState(newScope);
    if (typeof window !== 'undefined') {
      localStorage.setItem(SCOPE_STORAGE_KEY, newScope);
    }
  };

  // Always render children (SSR-safe)
  // Scope will be default during SSR, then updated from localStorage on client
  return (
    <ScopeContext.Provider value={{ scope, setScope }}>
      {children}
    </ScopeContext.Provider>
  );
}

export function useScope(): ScopeContextType {
  const context = useContext(ScopeContext);
  if (context === undefined) {
    throw new Error('useScope must be used within a ScopeProvider');
  }
  return context;
}
