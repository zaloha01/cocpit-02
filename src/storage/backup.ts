/**
 * Backup Functions
 * 
 * Handles export and import of application state.
 * Used for creating backups and restoring data.
 */

import type { AppState } from './schema';
import { SCHEMA_VERSION } from './schema';

/**
 * Export backup structure
 */
export type BackupExport = {
  schemaVersion: number;
  exportedAt: string;
  data: AppState;
};

/**
 * Export current AppState as backup object
 */
export function exportBackup(state: AppState): BackupExport {
  return {
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    data: state,
  };
}

/**
 * Import mode: merge or replace
 */
export type ImportMode = 'merge' | 'replace';

/**
 * Import preview summary
 */
export type ImportPreview = {
  mode: ImportMode;
  changesSummary: {
    recurringRulesCount: { current: number; incoming: number };
    monthlyLedgerCount: { current: number; incoming: number };
    goalsCount: { current: number; incoming: number };
    debtsCount: { current: number; incoming: number };
    willOverwrite: boolean;
  };
};

/**
 * Preview import changes without applying them
 */
export function previewImport(
  current: AppState,
  incoming: AppState,
  mode: ImportMode
): ImportPreview {
  const willOverwrite = mode === 'replace';

  return {
    mode,
    changesSummary: {
      recurringRulesCount: {
        current: Array.isArray(current.recurringRules) ? current.recurringRules.length : 0,
        incoming: Array.isArray(incoming.recurringRules) ? incoming.recurringRules.length : 0,
      },
      monthlyLedgerCount: {
        current: Array.isArray(current.monthlyLedger) ? current.monthlyLedger.length : 0,
        incoming: Array.isArray(incoming.monthlyLedger) ? incoming.monthlyLedger.length : 0,
      },
      goalsCount: {
        current: typeof current.goals === 'object' && current.goals !== null && !Array.isArray(current.goals)
          ? Object.keys(current.goals).length
          : 0,
        incoming: typeof incoming.goals === 'object' && incoming.goals !== null && !Array.isArray(incoming.goals)
          ? Object.keys(incoming.goals).length
          : 0,
      },
      debtsCount: {
        current: typeof current.debts === 'object' && current.debts !== null && !Array.isArray(current.debts)
          ? Object.keys(current.debts).length
          : 0,
        incoming: typeof incoming.debts === 'object' && incoming.debts !== null && !Array.isArray(incoming.debts)
          ? Object.keys(incoming.debts).length
          : 0,
      },
      willOverwrite,
    },
  };
}

/**
 * Apply import based on mode (merge or replace)
 */
export function applyImport(
  current: AppState,
  incoming: AppState,
  mode: ImportMode
): AppState {
  if (mode === 'replace') {
    return {
      ...incoming,
      schemaVersion: current.schemaVersion, // Keep current schema version
      meta: {
        ...incoming.meta,
        updatedAt: new Date().toISOString(),
        deviceId: current.meta.deviceId, // Keep current device ID
      },
    };
  }

  // Merge mode: shallow merge with simple rules
  const merged: AppState = {
    ...current,
    ...incoming,
    schemaVersion: current.schemaVersion,
    meta: {
      ...current.meta,
      updatedAt: new Date().toISOString(),
      deviceId: current.meta.deviceId,
    },
    settings: {
      ...current.settings,
      ...incoming.settings,
    },
    wallet: {
      ...current.wallet,
      ...incoming.wallet,
      weeklySnapshots: mergeArrays(current.wallet.weeklySnapshots, incoming.wallet.weeklySnapshots),
    },
    recurringRules: mergeArrays(current.recurringRules, incoming.recurringRules),
    monthlyLedger: mergeArrays(current.monthlyLedger, incoming.monthlyLedger),
    incomeEntries: mergeArrays(current.incomeEntries || [], incoming.incomeEntries || []),
    variableExpenseLedger: mergeArrays(
      current.variableExpenseLedger || [],
      incoming.variableExpenseLedger || []
    ),
    walletCheckpoints: mergeArrays(
      current.walletCheckpoints || [],
      incoming.walletCheckpoints || []
    ),
    debts: mergeArrays(current.debts || [], incoming.debts || []),
    debtPayments: mergeArrays(current.debtPayments || [], incoming.debtPayments || []),
    categories: {
      main: Array.isArray(incoming.categories?.main) 
        ? [...new Set([...(current.categories?.main || []), ...incoming.categories.main])]
        : (current.categories?.main || []),
      sub: {
        ...current.categories.sub,
        ...incoming.categories.sub,
      },
    },
    // Simple object merge for complex types
    incomes: {
      karinAvg: incoming.incomes?.karinAvg ?? current.incomes?.karinAvg ?? 53000,
      karinActual: { ...(current.incomes?.karinActual || {}), ...(incoming.incomes?.karinActual || {}) },
      karelActual: { ...(current.incomes?.karelActual || {}), ...(incoming.incomes?.karelActual || {}) },
      otherIncome: [...(current.incomes?.otherIncome || []), ...(incoming.incomes?.otherIncome || [])],
      borrowedIncome: [...(current.incomes?.borrowedIncome || []), ...(incoming.incomes?.borrowedIncome || [])],
    },
    goals: { ...current.goals, ...incoming.goals },
    expected: { ...current.expected, ...incoming.expected },
  };

  return merged;
}

/**
 * Helper: merge arrays, deduplicating by id if items have id property
 */
function mergeArrays<T extends { id?: string }>(current: T[], incoming: T[]): T[] {
  if (!Array.isArray(current)) return Array.isArray(incoming) ? incoming : [];
  if (!Array.isArray(incoming)) return current;

  // If items have id, deduplicate
  if (current.length > 0 && typeof current[0]?.id === 'string') {
    const existingIds = new Set(current.map((item) => item.id).filter(Boolean));
    const newItems = incoming.filter((item) => !item.id || !existingIds.has(item.id));
    return [...current, ...newItems];
  }

  // Otherwise, just concatenate
  return [...current, ...incoming];
}

/**
 * Restore from last backup in localStorage
 * Looks for backup in localStorage key 'financeos.backup' or uses current state as backup
 */
export function restoreFromLastBackup(currentState?: AppState): AppState | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    // Try to find backup in localStorage
    const backupKey = 'financeos.backup';
    const backupData = localStorage.getItem(backupKey);
    
    if (backupData) {
      try {
        const parsed = JSON.parse(backupData);
        if (parsed && parsed.data && typeof parsed.data === 'object') {
          // Validate it looks like AppState
          if (parsed.data.schemaVersion && parsed.data.meta) {
            // If currentState provided, use applyImport; otherwise return parsed data directly
            if (currentState) {
              return applyImport(currentState, parsed.data, 'replace');
            }
            return parsed.data as AppState;
          }
        }
      } catch (parseError) {
        console.error('Failed to parse backup:', parseError);
      }
    }

    // If no backup found, try to use current state as backup source
    // (in case current state is actually the "last good" state)
    const currentStateKey = 'financeos.appstate.v1';
    const currentStateData = localStorage.getItem(currentStateKey);
    
    if (currentStateData) {
      try {
        const parsed = JSON.parse(currentStateData);
        if (parsed && parsed.schemaVersion && parsed.meta) {
          // This is the current state - return it as-is (no change needed)
          return parsed as AppState;
        }
      } catch (parseError) {
        console.error('Failed to parse current state as backup:', parseError);
      }
    }

    return null;
  } catch (error) {
    console.error('Failed to restore from backup:', error);
    return null;
  }
}
