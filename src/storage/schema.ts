/**
 * Storage Schema
 * 
 * Defines the structure and validation for AppState data.
 * Used for versioning, migration, and data integrity.
 */

import type { RecurringRule, MonthlyLedgerEntry, IncomeEntry, VariableExpenseEntry, WalletCheckpoint, DebtItem, DebtPayment } from '../domain/models';

/**
 * Current schema version
 */
export const SCHEMA_VERSION = 7;

/**
 * Application scope types
 */
export type AppScope = 'rodina' | 'ico' | 'sro_karin' | 'weecon';

/**
 * Application state structure
 */
export type AppState = {
  schemaVersion: number;
  meta: {
    updatedAt: string;
    deviceId: string;
  };
  settings: {
    currency: 'CZK';
    scopes: AppScope[];
    categoryMain: string[];
    karinAverageIncome?: number; // Karin baseline income (editable)
  };
  wallet: {
    currentBalance: number;
    weeklySnapshots: Array<{
      id: string;
      date: string;
      balance: number;
      note?: string;
    }>;
  };
  recurringRules: RecurringRule[];
  monthlyLedger: MonthlyLedgerEntry[];
  incomeEntries: IncomeEntry[]; // New income structure
  variableExpenseLedger: VariableExpenseEntry[]; // Variable spending entries
  walletCheckpoints: WalletCheckpoint[]; // Weekly wallet reconciliation checkpoints
  debts: DebtItem[]; // Debt items (komu dlužím / kdo dluží mně)
  debtPayments: DebtPayment[]; // Debt payments (splátky)
  incomes: {
    // DEPRECATED: kept for migration
    karinAvg: number;
    karinActual: Record<string /*YYYY-MM*/, number>;
    karelActual: Record<string /*YYYY-MM*/, number>;
    otherIncome: Array<{ id: string; month: string; amount: number; note?: string }>;
    borrowedIncome: Array<{ id: string; month: string; amount: number; from?: string; note?: string }>;
  };
  goals: any; // placeholder
  expected: any; // placeholder
  categories: {
    main: string[];
    sub: Record<string, string[]>;
  };
};

/**
 * Creates a default AppState with initial values
 */
export function createDefaultState(): AppState {
  // Generate deviceId once (persist in localStorage if needed, but for now generate)
  const deviceId = typeof window !== 'undefined' 
    ? localStorage.getItem('financeos.deviceId') || `device_${Math.random().toString(36).substring(2, 15)}`
    : `device_${Math.random().toString(36).substring(2, 15)}`;
  
  if (typeof window !== 'undefined' && !localStorage.getItem('financeos.deviceId')) {
    localStorage.setItem('financeos.deviceId', deviceId);
  }

  return {
    schemaVersion: SCHEMA_VERSION,
    meta: {
      updatedAt: new Date().toISOString(),
      deviceId,
    },
    settings: {
      currency: 'CZK',
      scopes: ['rodina', 'ico', 'sro_karin', 'weecon'],
      karinAverageIncome: 53000,
      categoryMain: [
        'Bydlení',
        'Jídlo',
        'Doprava',
        'Zdraví',
        'Zábava',
        'Oblečení',
        'Vzdělávání',
        'Dary',
        'Firemní peněženka – pohyblivé',
        'Ostatní',
      ],
    },
    wallet: {
      currentBalance: 0,
      weeklySnapshots: [],
    },
    recurringRules: [],
    monthlyLedger: [],
    incomeEntries: [],
    variableExpenseLedger: [],
    walletCheckpoints: [],
    debts: [],
    debtPayments: [],
    incomes: {
      karinAvg: 53000,
      karinActual: {},
      karelActual: {},
      otherIncome: [],
      borrowedIncome: [],
    },
    goals: {},
    expected: {},
    categories: {
      main: [
        'Bydlení',
        'Jídlo',
        'Doprava',
        'Zdraví',
        'Zábava',
        'Oblečení',
        'Vzdělávání',
        'Dary',
        'Firemní peněženka – pohyblivé',
        'Ostatní',
      ],
      sub: {},
    },
  };
}

/**
 * Schema validation function
 * @param data - Data to validate
 * @returns Whether data matches schema
 */
export function validateSchema(data: unknown): data is AppState {
  if (!data || typeof data !== 'object') return false;
  const state = data as Partial<AppState>;
  return (
    typeof state.schemaVersion === 'number' &&
    typeof state.meta === 'object' &&
    state.meta !== null &&
    typeof state.meta.updatedAt === 'string' &&
    typeof state.meta.deviceId === 'string' &&
    typeof state.settings === 'object' &&
    state.settings !== null &&
    typeof state.wallet === 'object' &&
    state.wallet !== null
  );
}

/**
 * Migration function
 * Migrates data from one schema version to another
 */
export function migrateSchema(data: unknown, fromVersion: number, toVersion: number): AppState {
  // Migrate from version 1 to 2: add spreadEnabled/spreadMonths to recurring rules
  if (fromVersion === 1 && toVersion === 2) {
    const state = data as any;
    if (state.recurringRules && Array.isArray(state.recurringRules)) {
      state.recurringRules = state.recurringRules.map((rule: any) => ({
        ...rule,
        spreadEnabled: rule.spreadEnabled ?? rule.isSplitEnabled ?? false,
        spreadMonths: rule.spreadMonths ?? rule.splitMonths ?? 1,
        spreadStartMonth: rule.spreadStartMonth ?? undefined,
        spreadMode: 'forward', // default to forward for backward compat
      }));
    }
    state.schemaVersion = 2;
    return state as AppState;
  }
  
  // Migrate from version 2 to 3: change spreadMode from 'forward'|'toDueDate' to 'fixed'|'catchup'
  if (fromVersion === 2 && toVersion === 3) {
    const state = data as any;
    if (state.recurringRules && Array.isArray(state.recurringRules)) {
      state.recurringRules = state.recurringRules.map((rule: any) => {
        // Map old spreadMode values to new ones
        let newSpreadMode: 'fixed' | 'catchup' = 'fixed';
        if (rule.spreadMode === 'toDueDate') {
          newSpreadMode = 'catchup';
        } else if (rule.spreadMode === 'forward') {
          newSpreadMode = 'fixed';
        } else {
          // Default to fixed for backward compat (preserves old behavior)
          newSpreadMode = 'fixed';
        }
        return {
          ...rule,
          spreadMode: newSpreadMode,
        };
      });
    }
    state.schemaVersion = 3;
    return state as AppState;
  }
  
  // Migrate from version 3 to 4: add incomeEntries and settings.karinAverageIncome
  if (fromVersion === 3 && toVersion === 4) {
    const state = data as any;
    // Initialize new fields
    if (!state.incomeEntries) {
      state.incomeEntries = [];
    }
    if (!state.variableExpenseLedger) {
      state.variableExpenseLedger = [];
    }
    if (!state.settings) {
      state.settings = {};
    }
    if (state.settings.karinAverageIncome === undefined) {
      state.settings.karinAverageIncome = state.incomes?.karinAvg ?? 53000;
    }
    state.schemaVersion = 4;
    return state as AppState;
  }
  
  // Migrate from version 4 to 5: ensure variableExpenseLedger exists
  if (fromVersion === 4 && toVersion === 5) {
    const state = data as any;
    if (!state.variableExpenseLedger) {
      state.variableExpenseLedger = [];
    }
    state.schemaVersion = 5;
    return state as AppState;
  }
  
  // Migrate from version 5 to 6: add walletCheckpoints
  if (fromVersion === 5 && toVersion === 6) {
    const state = data as any;
    if (!state.walletCheckpoints) {
      state.walletCheckpoints = [];
    }
    state.schemaVersion = 6;
    return state as AppState;
  }
  
  // Migrate from version 6 to 7: add debts and debtPayments
  if (fromVersion === 6 && toVersion === 7) {
    const state = data as any;
    // Convert debts to array if it exists as object (from old debts: any)
    if (!state.debts || !Array.isArray(state.debts)) {
      state.debts = [];
    }
    // Convert debtPayments to array if it exists as object
    if (!state.debtPayments || !Array.isArray(state.debtPayments)) {
      state.debtPayments = [];
    }
    state.schemaVersion = 7;
    return state as AppState;
  }
  
  // Chain migrations if needed
  if (fromVersion < toVersion) {
    let current = data as any;
    // Migrate step by step
    if (fromVersion === 1) {
      current = migrateSchema(current, 1, 2);
    }
    if (current.schemaVersion === 2 && toVersion >= 3) {
      current = migrateSchema(current, 2, 3);
    }
    if (current.schemaVersion === 3 && toVersion >= 4) {
      current = migrateSchema(current, 3, 4);
    }
    if (current.schemaVersion === 4 && toVersion >= 5) {
      current = migrateSchema(current, 4, 5);
    }
    if (current.schemaVersion === 5 && toVersion >= 6) {
      current = migrateSchema(current, 5, 6);
    }
    if (current.schemaVersion === 6 && toVersion >= 7) {
      current = migrateSchema(current, 6, 7);
    }
    return current as AppState;
  }
  
  // If no migration needed, return as-is
  if (fromVersion === toVersion) {
    return data as AppState;
  }
  
  // Unknown migration path - return default state
  console.warn(`Unknown migration path: ${fromVersion} -> ${toVersion}`);
  return createDefaultState();
}
