/**
 * Storage Provider
 * 
 * React context provider that abstracts storage access.
 * UI components should never access storage directly.
 */

'use client';

import React, { createContext, useContext } from 'react';
import type { AppState } from './schema';

/**
 * Storage provider interface
 * Defines the contract for storage implementations
 */
export interface IStorageProvider {
  load(): Promise<AppState>;
  save(state: AppState): Promise<void>;
  clear(): Promise<void>;
}

interface StorageContextValue {
  storage: IStorageProvider;
}

const StorageContext = createContext<StorageContextValue | null>(null);

export function StorageProvider({ 
  children,
  storage,
}: { 
  children: React.ReactNode;
  storage: IStorageProvider;
}) {
  return (
    <StorageContext.Provider value={{ storage }}>
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage() {
  const context = useContext(StorageContext);
  if (!context) {
    throw new Error('useStorage must be used within StorageProvider');
  }
  return context.storage;
}
