/**
 * AppState Actions
 * 
 * Action creators for modifying application state.
 * All state changes should go through these actions.
 */

import type { AppStateStore } from './AppStateStore';
import type { AppState } from '../storage/schema';
import type { RecurringRule, Scope, IncomeEntry, VariableExpenseEntry } from '../domain/models';

/**
 * Sets the current wallet balance
 */
export function setCurrentBalance(store: AppStateStore, balance: number): void {
  store.setState((prev) => ({
    ...prev,
    wallet: {
      ...prev.wallet,
      currentBalance: balance,
    },
  }));
}

/**
 * Adds a weekly snapshot to the wallet
 */
export function addWeeklySnapshot(
  store: AppStateStore,
  snapshot: { date: string; balance: number; note?: string }
): void {
  store.setState((prev) => ({
    ...prev,
    wallet: {
      ...prev.wallet,
      weeklySnapshots: [
        ...prev.wallet.weeklySnapshots,
        {
          id: `snapshot_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          date: snapshot.date,
          balance: snapshot.balance,
          note: snapshot.note,
        },
      ],
    },
  }));
}

/**
 * Sets the main category list
 */
export function setCategoryMain(store: AppStateStore, categories: string[]): void {
  store.setState((prev) => ({
    ...prev,
    settings: {
      ...prev.settings,
      categoryMain: categories,
    },
    categories: {
      ...prev.categories,
      main: categories,
    },
  }));
}

/**
 * Adds a subcategory to a main category
 */
export function addCategorySub(store: AppStateStore, mainCategory: string, subName: string): void {
  store.setState((prev) => {
    const existingSubs = prev.categories.sub[mainCategory] || [];
    if (existingSubs.includes(subName)) {
      return prev; // Already exists, no change
    }
    return {
      ...prev,
      categories: {
        ...prev.categories,
        sub: {
          ...prev.categories.sub,
          [mainCategory]: [...existingSubs, subName],
        },
      },
    };
  });
}

/**
 * Input type for adding a recurring rule (UI-friendly, amount is positive)
 */
export type RecurringRuleInput = {
  name: string;
  amount: number; // positive input from UI
  frequency: RecurringRule['frequency'];
  scope: Scope;
  categoryMain: string;
  categorySub?: string;
  isSplitEnabled?: boolean; // DEPRECATED: use spreadEnabled
  splitMonths?: number; // DEPRECATED: use spreadMonths
  spreadEnabled?: boolean;
  spreadMonths?: number; // 1-24
  spreadStartMonth?: string; // YYYY-MM, DEPRECATED
  spreadMode?: 'fixed' | 'catchup'; // "fixed" = static split, "catchup" = dynamic target
  dueDate?: string; // YYYY-MM-DD, required for spreadMode="toDueDate"
  active?: boolean;
};

/**
 * Adds a new recurring rule
 * Converts positive amount to negative for storage
 */
export function addRecurringRule(store: AppStateStore, ruleInput: RecurringRuleInput): void {
  store.setState((prev) => {
    const newRule: RecurringRule = {
      id: `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name: ruleInput.name,
      amount: -Math.abs(ruleInput.amount), // Store as negative
      frequency: ruleInput.frequency,
      scope: ruleInput.scope,
      categoryMain: ruleInput.categoryMain,
      categorySub: ruleInput.categorySub,
      isSplitEnabled: ruleInput.isSplitEnabled ?? false, // Keep for backward compatibility
      splitMonths: ruleInput.splitMonths,
      spreadEnabled: ruleInput.spreadEnabled ?? false,
      spreadMonths: ruleInput.spreadMonths,
      spreadStartMonth: ruleInput.spreadStartMonth,
      spreadMode: ruleInput.spreadMode ?? 'catchup',
      dueDate: ruleInput.dueDate,
      active: ruleInput.active ?? true,
    };

    return {
      ...prev,
      recurringRules: [...prev.recurringRules, newRule],
    };
  });
}

/**
 * Updates an existing recurring rule
 */
export function updateRecurringRule(
  store: AppStateStore,
  id: string,
  patch: Partial<RecurringRuleInput>
): void {
  store.setState((prev) => {
    const rules = prev.recurringRules.map((rule) => {
      if (rule.id !== id) return rule;

      const updated: RecurringRule = { ...rule };

      if (patch.name !== undefined) updated.name = patch.name;
      if (patch.amount !== undefined) updated.amount = -Math.abs(patch.amount); // Store as negative
      if (patch.frequency !== undefined) updated.frequency = patch.frequency;
      if (patch.scope !== undefined) updated.scope = patch.scope;
      if (patch.categoryMain !== undefined) updated.categoryMain = patch.categoryMain;
      if (patch.categorySub !== undefined) updated.categorySub = patch.categorySub;
      if (patch.isSplitEnabled !== undefined) updated.isSplitEnabled = patch.isSplitEnabled;
      if (patch.splitMonths !== undefined) updated.splitMonths = patch.splitMonths;
      if (patch.spreadEnabled !== undefined) updated.spreadEnabled = patch.spreadEnabled;
      if (patch.spreadMonths !== undefined) updated.spreadMonths = patch.spreadMonths;
      if (patch.spreadStartMonth !== undefined) updated.spreadStartMonth = patch.spreadStartMonth;
      if (patch.spreadMode !== undefined) updated.spreadMode = patch.spreadMode;
      if (patch.dueDate !== undefined) updated.dueDate = patch.dueDate;
      if (patch.active !== undefined) updated.active = patch.active;

      return updated;
    });

    return {
      ...prev,
      recurringRules: rules,
    };
  });
}

/**
 * Deletes a recurring rule
 */
export function deleteRecurringRule(store: AppStateStore, id: string): void {
  store.setState((prev) => ({
    ...prev,
    recurringRules: prev.recurringRules.filter((rule) => rule.id !== id),
  }));
}

/**
 * Toggles the active state of a recurring rule
 */
export function toggleRecurringRuleActive(store: AppStateStore, id: string): void {
  store.setState((prev) => ({
    ...prev,
    recurringRules: prev.recurringRules.map((rule) =>
      rule.id === id ? { ...rule, active: !rule.active } : rule
    ),
  }));
}

/**
 * Sets Karin average income
 */
export function setKarinAvg(store: AppStateStore, amount: number): void {
  store.setState((prev) => ({
    ...prev,
    incomes: {
      karinAvg: amount,
      karinActual: prev.incomes?.karinActual || {},
      karelActual: prev.incomes?.karelActual || {},
      otherIncome: prev.incomes?.otherIncome || [],
      borrowedIncome: prev.incomes?.borrowedIncome || [],
    },
  }));
}

/**
 * Sets Karin actual income for a specific month
 * Pass null to remove override (use average)
 */
export function setKarinActual(store: AppStateStore, month: string, amount: number | null): void {
  store.setState((prev) => {
    const karinActual = { ...(prev.incomes?.karinActual || {}) };
    if (amount === null) {
      delete karinActual[month];
    } else {
      karinActual[month] = amount;
    }
    return {
      ...prev,
      incomes: {
        karinAvg: prev.incomes?.karinAvg ?? 53000,
        karinActual,
        karelActual: prev.incomes?.karelActual || {},
        otherIncome: prev.incomes?.otherIncome || [],
        borrowedIncome: prev.incomes?.borrowedIncome || [],
      },
    };
  });
}

/**
 * Sets Karel actual income for a specific month
 * Pass null to remove
 */
export function setKarelActual(store: AppStateStore, month: string, amount: number | null): void {
  store.setState((prev) => {
    const karelActual = { ...(prev.incomes?.karelActual || {}) };
    if (amount === null) {
      delete karelActual[month];
    } else {
      karelActual[month] = amount;
    }
    return {
      ...prev,
      incomes: {
        karinAvg: prev.incomes?.karinAvg ?? 53000,
        karinActual: prev.incomes?.karinActual || {},
        karelActual,
        otherIncome: prev.incomes?.otherIncome || [],
        borrowedIncome: prev.incomes?.borrowedIncome || [],
      },
    };
  });
}

/**
 * Adds other income (one-off, already received)
 */
export function addOtherIncome(
  store: AppStateStore,
  income: { month: string; amount: number; note?: string }
): void {
  store.setState((prev) => ({
    ...prev,
    incomes: {
      karinAvg: prev.incomes?.karinAvg ?? 53000,
      karinActual: prev.incomes?.karinActual || {},
      karelActual: prev.incomes?.karelActual || {},
      otherIncome: [
        ...(prev.incomes?.otherIncome || []),
        {
          id: `other_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          month: income.month,
          amount: income.amount,
          note: income.note,
        },
      ],
      borrowedIncome: prev.incomes?.borrowedIncome || [],
    },
  }));
}

/**
 * Deletes other income
 */
export function deleteOtherIncome(store: AppStateStore, id: string): void {
  store.setState((prev) => ({
    ...prev,
    incomes: {
      karinAvg: prev.incomes?.karinAvg ?? 53000,
      karinActual: prev.incomes?.karinActual || {},
      karelActual: prev.incomes?.karelActual || {},
      otherIncome: (prev.incomes?.otherIncome || []).filter((item) => item.id !== id),
      borrowedIncome: prev.incomes?.borrowedIncome || [],
    },
  }));
}

/**
 * Adds borrowed income (příjem z půjčených zdrojů)
 */
export function addBorrowedIncome(
  store: AppStateStore,
  income: { month: string; amount: number; from?: string; note?: string }
): void {
  store.setState((prev) => ({
    ...prev,
    incomes: {
      karinAvg: prev.incomes?.karinAvg ?? 53000,
      karinActual: prev.incomes?.karinActual || {},
      karelActual: prev.incomes?.karelActual || {},
      otherIncome: prev.incomes?.otherIncome || [],
      borrowedIncome: [
        ...(prev.incomes?.borrowedIncome || []),
        {
          id: `borrowed_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
          month: income.month,
          amount: income.amount,
          from: income.from,
          note: income.note,
        },
      ],
    },
  }));
}

/**
 * Deletes borrowed income
 */
export function deleteBorrowedIncome(store: AppStateStore, id: string): void {
  store.setState((prev) => ({
    ...prev,
    incomes: {
      karinAvg: prev.incomes?.karinAvg ?? 53000,
      karinActual: prev.incomes?.karinActual || {},
      karelActual: prev.incomes?.karelActual || {},
      otherIncome: prev.incomes?.otherIncome || [],
      borrowedIncome: (prev.incomes?.borrowedIncome || []).filter((item) => item.id !== id),
    },
  }));
}

// ============================================================================
// MONTHLY LEDGER ENTRIES
// ============================================================================
// Monthly ledger entries are instances created from recurring rules/debts.
// Changes in dashboard update only the instance, never the source rule.
// ============================================================================

/**
 * Updates a monthly ledger entry (paidAmount, paidBy, etc.)
 * This modifies only the instance, not the source rule.
 */
export function updateMonthlyLedgerEntry(
  store: AppStateStore,
  id: string,
  patch: {
    paidAmount?: number;
    savedAmount?: number;
    paidBy?: 'self' | 'gift' | 'loan';
    paidByName?: string;
  },
  entryData?: { sourceId: string; sourceType: 'recurring' | 'debt' | 'goal'; month: string; dueAmount: number }
): void {
  store.setState((prev) => {
    const ledger = prev.monthlyLedger || [];
    const existingIndex = ledger.findIndex((e) => e.id === id);

    // Ensure numeric safety
    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    if (existingIndex >= 0) {
      // Update existing entry
      const existing = ledger[existingIndex];
      const updated = { ...existing, ...patch };
      if (patch.paidAmount !== undefined) {
        updated.paidAmount = safeNumber(patch.paidAmount);
      }
      if (patch.savedAmount !== undefined) {
        updated.savedAmount = safeNumber(patch.savedAmount);
      }
      const newLedger = [...ledger];
      newLedger[existingIndex] = updated;
      console.log('[updateMonthlyLedgerEntry] Updated entry:', { id, paidAmount: updated.paidAmount });
      return {
        ...prev,
        monthlyLedger: newLedger,
      };
    } else if (entryData) {
      // Create new entry if it doesn't exist
      const newEntry = {
        id,
        sourceId: entryData.sourceId,
        sourceType: entryData.sourceType,
        month: entryData.month,
        dueAmount: safeNumber(entryData.dueAmount),
        paidAmount: patch.paidAmount !== undefined ? safeNumber(patch.paidAmount) : 0,
        savedAmount: patch.savedAmount !== undefined ? safeNumber(patch.savedAmount) : 0,
        paidBy: patch.paidBy,
        paidByName: patch.paidByName,
      };
      console.log('[updateMonthlyLedgerEntry] Created entry:', { id, paidAmount: newEntry.paidAmount });
      return {
        ...prev,
        monthlyLedger: [...ledger, newEntry],
      };
    }

    // Entry not found and no entryData provided - cannot create
    console.warn('[updateMonthlyLedgerEntry] Entry not found and no entryData:', id);
    return prev;
  });
}

/**
 * Marks a monthly ledger entry as fully paid
 */
export function markMonthlyLedgerEntryPaid(
  store: AppStateStore,
  id: string,
  amount?: number,
  paidBy?: 'self' | 'gift' | 'loan',
  paidByName?: string,
  entryData?: { sourceId: string; sourceType: 'recurring' | 'debt' | 'goal'; month: string; dueAmount: number }
): void {
  store.setState((prev) => {
    const ledger = prev.monthlyLedger || [];
    const existingIndex = ledger.findIndex((e) => e.id === id);

    // Ensure numeric safety
    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    if (existingIndex >= 0) {
      // Update existing entry
      const existing = ledger[existingIndex];
      const due = safeNumber(existing.dueAmount);
      const paidAmount = amount !== undefined ? safeNumber(amount) : due;
      const updated = [...ledger];
      updated[existingIndex] = {
        ...existing,
        dueAmount: due,
        paidAmount,
        paidBy: paidBy || 'self',
        paidByName: paidByName,
      };
      console.log('[markMonthlyLedgerEntryPaid] Updated entry:', { id, paidAmount });
      return {
        ...prev,
        monthlyLedger: updated,
      };
    } else if (entryData) {
      // Create new entry if it doesn't exist
      const due = safeNumber(entryData.dueAmount);
      const paidAmount = amount !== undefined ? safeNumber(amount) : due;
      const newEntry = {
        id,
        sourceId: entryData.sourceId,
        sourceType: entryData.sourceType,
        month: entryData.month,
        dueAmount: due,
        paidAmount,
        paidBy: paidBy || 'self',
        paidByName: paidByName,
      };
      console.log('[markMonthlyLedgerEntryPaid] Created entry:', { id, paidAmount });
      return {
        ...prev,
        monthlyLedger: [...ledger, newEntry],
      };
    }

    // Entry not found and no entryData provided - cannot create
    console.warn('[markMonthlyLedgerEntryPaid] Entry not found and no entryData:', id);
    return prev;
  });
}

/**
 * Marks a monthly ledger entry as partially paid
 */
export function markMonthlyLedgerEntryPartial(
  store: AppStateStore,
  id: string,
  amount: number,
  paidBy?: 'self' | 'gift' | 'loan',
  paidByName?: string,
  entryData?: { sourceId: string; sourceType: 'recurring' | 'debt' | 'goal'; month: string; dueAmount: number }
): void {
  store.setState((prev) => {
    const ledger = prev.monthlyLedger || [];
    const existingIndex = ledger.findIndex((e) => e.id === id);

    // Ensure numeric safety
    const safeAmount = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const paid = safeAmount(amount);

    if (existingIndex >= 0) {
      // Update existing entry
      const existing = ledger[existingIndex];
      const due = safeAmount(existing.dueAmount);
      const updated = [...ledger];
      updated[existingIndex] = {
        ...existing,
        dueAmount: due,
        paidAmount: Math.min(paid, due),
        paidBy: paidBy || 'self',
        paidByName: paidByName,
      };
      console.log('[markMonthlyLedgerEntryPartial] Updated entry:', { id, paidAmount: updated[existingIndex].paidAmount });
      return {
        ...prev,
        monthlyLedger: updated,
      };
    } else if (entryData) {
      // Create new entry if it doesn't exist
      const due = safeAmount(entryData.dueAmount);
      const newEntry = {
        id,
        sourceId: entryData.sourceId,
        sourceType: entryData.sourceType,
        month: entryData.month,
        dueAmount: due,
        paidAmount: Math.min(paid, due),
        paidBy: paidBy || 'self',
        paidByName: paidByName,
      };
      console.log('[markMonthlyLedgerEntryPartial] Created entry:', { id, paidAmount: newEntry.paidAmount });
      return {
        ...prev,
        monthlyLedger: [...ledger, newEntry],
      };
    }

    // Entry not found and no entryData provided - cannot create
    console.warn('[markMonthlyLedgerEntryPartial] Entry not found and no entryData:', id);
    return prev;
  });
}

/**
 * Marks a monthly ledger entry as unpaid (resets paidAmount)
 */
export function markMonthlyLedgerEntryUnpaid(store: AppStateStore, id: string): void {
  store.setState((prev) => {
    const ledger = prev.monthlyLedger || [];
    const existingIndex = ledger.findIndex((e) => e.id === id);

    if (existingIndex >= 0) {
      // Update existing entry
      const updated = [...ledger];
      updated[existingIndex] = {
        ...ledger[existingIndex],
        paidAmount: 0,
        paidBy: undefined,
        paidByName: undefined,
      };
      console.log('[markMonthlyLedgerEntryUnpaid] Updated entry:', { id, paidAmount: 0 });
      return {
        ...prev,
        monthlyLedger: updated,
      };
    }

    // Entry not found - nothing to update
    console.warn('[markMonthlyLedgerEntryUnpaid] Entry not found:', id);
    return prev;
  });
}

/**
 * Updates savedAmount for a monthly ledger entry (for catchup reserve tracking)
 */
export function updateMonthlyLedgerSavedAmount(
  store: AppStateStore,
  id: string,
  savedAmount: number,
  entryData?: { sourceId: string; sourceType: 'recurring' | 'debt' | 'goal'; month: string; dueAmount: number }
): void {
  store.setState((prev) => {
    const ledger = prev.monthlyLedger || [];
    const existingIndex = ledger.findIndex((e) => e.id === id);

    // Ensure numeric safety
    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    const safeSavedAmount = safeNumber(savedAmount);

    if (existingIndex >= 0) {
      // Update existing entry
      const updated = [...ledger];
      updated[existingIndex] = {
        ...ledger[existingIndex],
        savedAmount: safeSavedAmount,
      };
      console.log('[updateMonthlyLedgerSavedAmount] Updated entry:', { id, savedAmount: safeSavedAmount });
      return {
        ...prev,
        monthlyLedger: updated,
      };
    } else if (entryData) {
      // Create new entry if it doesn't exist
      const newEntry = {
        id,
        sourceId: entryData.sourceId,
        sourceType: entryData.sourceType,
        month: entryData.month,
        dueAmount: safeNumber(entryData.dueAmount),
        paidAmount: 0,
        savedAmount: safeSavedAmount,
      };
      console.log('[updateMonthlyLedgerSavedAmount] Created entry:', { id, savedAmount: safeSavedAmount });
      return {
        ...prev,
        monthlyLedger: [...ledger, newEntry],
      };
    }

    // Entry not found and no entryData provided - cannot create
    console.warn('[updateMonthlyLedgerSavedAmount] Entry not found and no entryData:', id);
    return prev;
  });
}

// ============================================================================
// INCOME ENTRIES
// ============================================================================

/**
 * Input type for adding/updating income entry
 */
export type IncomeEntryInput = {
  person: 'Karin' | 'Karel' | 'Other';
  title: string;
  amount: number;
  expectedDate?: string; // YYYY-MM-DD, required if status="planned"
  receivedDate?: string; // YYYY-MM-DD, required if status="received"
  status: 'planned' | 'received';
  confidence?: number; // 0..100, default 100
  scope: Scope | 'other';
};

/**
 * Adds a new income entry
 */
export function addIncomeEntry(store: AppStateStore, entryInput: IncomeEntryInput): void {
  store.setState((prev) => {
    const newEntry: IncomeEntry = {
      id: `income_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      person: entryInput.person,
      title: entryInput.title,
      amount: entryInput.amount,
      expectedDate: entryInput.expectedDate,
      receivedDate: entryInput.receivedDate,
      status: entryInput.status,
      confidence: entryInput.confidence ?? 100,
      scope: entryInput.scope,
    };

    return {
      ...prev,
      incomeEntries: [...(prev.incomeEntries || []), newEntry],
    };
  });
}

/**
 * Updates an existing income entry
 */
export function updateIncomeEntry(
  store: AppStateStore,
  id: string,
  patch: Partial<IncomeEntryInput>
): void {
  store.setState((prev) => {
    const entries = prev.incomeEntries || [];
    return {
      ...prev,
      incomeEntries: entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              confidence: patch.confidence ?? entry.confidence ?? 100,
            }
          : entry
      ),
    };
  });
}

/**
 * Deletes an income entry
 */
export function deleteIncomeEntry(store: AppStateStore, id: string): void {
  store.setState((prev) => ({
    ...prev,
    incomeEntries: (prev.incomeEntries || []).filter((entry) => entry.id !== id),
  }));
}

/**
 * Sets Karin average income (baseline)
 */
export function setKarinAverageIncome(store: AppStateStore, amount: number): void {
  store.setState((prev) => ({
    ...prev,
    settings: {
      ...prev.settings,
      karinAverageIncome: amount,
    },
  }));
}

// ============================================================================
// VARIABLE EXPENSE LEDGER
// ============================================================================

/**
 * Input type for adding/updating variable expense entry
 */
export type VariableExpenseEntryInput = {
  month: string; // YYYY-MM
  scope: Scope;
  direction?: 'expense' | 'income'; // default 'expense'
  amount: number; // positive number
  categoryMain: string;
  categorySub?: string;
  note?: string;
  date?: string; // YYYY-MM-DD optional
};

/**
 * Adds a new variable expense entry
 */
export function addVariableExpenseEntry(
  store: AppStateStore,
  entryInput: VariableExpenseEntryInput
): void {
  store.setState((prev) => {
    const newEntry: VariableExpenseEntry = {
      id: `var_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      month: entryInput.month,
      scope: entryInput.scope,
      direction: entryInput.direction ?? 'expense',
      amount: entryInput.amount,
      categoryMain: entryInput.categoryMain,
      categorySub: entryInput.categorySub,
      note: entryInput.note,
      date: entryInput.date,
      createdAt: new Date().toISOString(),
    };

    return {
      ...prev,
      variableExpenseLedger: [...(prev.variableExpenseLedger || []), newEntry],
    };
  });
}

/**
 * Updates an existing variable expense entry
 */
export function updateVariableExpenseEntry(
  store: AppStateStore,
  id: string,
  patch: Partial<VariableExpenseEntryInput>
): void {
  store.setState((prev) => {
    const entries = prev.variableExpenseLedger || [];
    return {
      ...prev,
      variableExpenseLedger: entries.map((entry) =>
        entry.id === id
          ? {
              ...entry,
              ...patch,
              direction: patch.direction ?? entry.direction,
            }
          : entry
      ),
    };
  });
}

/**
 * Deletes a variable expense entry
 */
export function deleteVariableExpenseEntry(store: AppStateStore, id: string): void {
  store.setState((prev) => ({
    ...prev,
    variableExpenseLedger: (prev.variableExpenseLedger || []).filter((entry) => entry.id !== id),
  }));
}
