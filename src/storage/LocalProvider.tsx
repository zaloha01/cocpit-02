/**
 * Local Storage Provider
 * 
 * Implementation of storage provider using browser localStorage.
 * This is the default storage mechanism for the application.
 */

'use client';

import React from 'react';
import type { IStorageProvider } from './StorageProvider';
import type { AppState } from './schema';
import { createDefaultState, SCHEMA_VERSION, migrateSchema, validateSchema } from './schema';

const STORAGE_KEY = 'financeos.appstate.v1';

/**
 * LocalStorage-based storage provider implementation
 */
export class LocalStorageProvider implements IStorageProvider {
  async load(): Promise<AppState> {
    if (typeof window === 'undefined') {
      return createDefaultState();
    }

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) {
        return createDefaultState();
      }

      const parsed = JSON.parse(stored);
      
      // Validate schema
      if (!validateSchema(parsed)) {
        return createDefaultState();
      }

      // Check schema version
      if (parsed.schemaVersion !== SCHEMA_VERSION) {
        return migrateSchema(parsed, parsed.schemaVersion, SCHEMA_VERSION);
      }

      // Normalize incomes structure if missing or incomplete
      const normalized = parsed as AppState;
      if (!normalized.incomes || typeof normalized.incomes !== 'object') {
        normalized.incomes = {
          karinAvg: 53000,
          karinActual: {},
          karelActual: {},
          otherIncome: [],
          borrowedIncome: [],
        };
      } else {
        // Ensure all required fields exist
        normalized.incomes = {
          karinAvg: normalized.incomes.karinAvg ?? 53000,
          karinActual: normalized.incomes.karinActual || {},
          karelActual: normalized.incomes.karelActual || {},
          otherIncome: normalized.incomes.otherIncome || [],
          borrowedIncome: normalized.incomes.borrowedIncome || [],
        };
      }

      // Normalize monthlyLedger to ensure it's always an array
      if (!Array.isArray(normalized.monthlyLedger)) {
        normalized.monthlyLedger = [];
      }

      // Normalize incomeEntries to ensure it's always an array
      if (!Array.isArray(normalized.incomeEntries)) {
        normalized.incomeEntries = [];
      }

      // Normalize variableExpenseLedger to ensure it's always an array
      if (!Array.isArray(normalized.variableExpenseLedger)) {
        normalized.variableExpenseLedger = [];
      }

      // Normalize settings.karinAverageIncome
      if (normalized.settings && normalized.settings.karinAverageIncome === undefined) {
        normalized.settings.karinAverageIncome = normalized.incomes?.karinAvg ?? 53000;
      }

      return normalized;
    } catch (error) {
      console.error('Failed to load state from localStorage:', error);
      return createDefaultState();
    }
  }

  async save(state: AppState): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      const json = JSON.stringify(state);
      localStorage.setItem(STORAGE_KEY, json);
    } catch (error) {
      console.error('Failed to save state to localStorage:', error);
      throw error;
    }
  }

  async clear(): Promise<void> {
    if (typeof window === 'undefined') {
      return;
    }

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
      throw error;
    }
  }
}

/**
 * LocalProvider component
 * Provides local storage functionality to the application
 */
export function LocalProvider({ children }: { children: React.ReactNode }) {
  // This component is kept for future React context integration
  // For now, LocalStorageProvider is used directly
  return <>{children}</>;
}
