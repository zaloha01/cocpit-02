/**
 * Domain Selectors
 * 
 * Pure functions that query and transform AppState data.
 * Selectors are used to extract specific pieces of information
 * from the application state for display in the UI.
 */

import type { AppState } from '../storage/schema';
import type {
  Money,
  MonthKey,
  Scope,
  RecurringRule,
  MonthlyLedgerEntry,
  IncomeState,
  IncomeEntry,
  GoalState,
  DebtState,
  DebtItem,
  DebtPayment,
  WalletCheckpoint,
} from './models';
import { sum, clampMin, parseMonthKey, formatMonthKey } from './calc';

/**
 * Helper to filter items by scope
 * If item.scope is missing, it passes through only when scope is undefined (for backward compatibility)
 */
export function selectByScope<T extends { scope?: Scope | string }>(items: T[], scope?: Scope | string): T[] {
  if (!Array.isArray(items)) return [];
  if (scope === undefined) return items; // No filter
  return items.filter((item) => {
    if (!item.scope) {
      // Item without scope: pass through only if scope is undefined
      return scope === undefined;
    }
    return item.scope === scope;
  });
}

/**
 * Get income planned total for a month (informational only)
 */
export function getIncomePlannedTotal(state: AppState, month: MonthKey): number {
  const entries = state.incomeEntries || [];
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return sum(
    entries
      .filter((entry) => {
        if (entry.status !== 'planned') return false;
        if (!entry.expectedDate) return false;
        // Extract YYYY-MM from expectedDate (YYYY-MM-DD)
        const dateParts = entry.expectedDate.split('-');
        if (dateParts.length < 2) return false;
        const entryMonth = `${dateParts[0]}-${dateParts[1]}`;
        return entryMonth === month;
      })
      .map((entry) => safeNumber(entry.amount))
  );
}

/**
 * Get income received total for a month (real money)
 */
export function getIncomeReceivedTotal(state: AppState, month: MonthKey): number {
  const entries = state.incomeEntries || [];
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return sum(
    entries
      .filter((entry) => {
        if (entry.status !== 'received') return false;
        if (!entry.receivedDate) return false;
        // Extract YYYY-MM from receivedDate (YYYY-MM-DD)
        const dateParts = entry.receivedDate.split('-');
        if (dateParts.length < 2) return false;
        const entryMonth = `${dateParts[0]}-${dateParts[1]}`;
        return entryMonth === month;
      })
      .map((entry) => safeNumber(entry.amount))
  );
}

/**
 * Get Karin actual income for a month (from received entries) or baseline
 */
export function getKarinIncome(state: AppState, month: MonthKey): number {
  const entries = state.incomeEntries || [];
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Find received Karin entry for this month
  const karinReceived = entries.find((entry) => {
    if (entry.person !== 'Karin' || entry.status !== 'received') return false;
    if (!entry.receivedDate) return false;
    const dateParts = entry.receivedDate.split('-');
    if (dateParts.length < 2) return false;
    const entryMonth = `${dateParts[0]}-${dateParts[1]}`;
    return entryMonth === month;
  });

  if (karinReceived) {
    return safeNumber(karinReceived.amount);
  }

  // Use baseline from settings
  return safeNumber(state.settings?.karinAverageIncome ?? 53000);
}

/**
 * Get effective income for a month
 * Only includes actually received income (not expected/planned)
 */
export function getEffectiveIncome(
  state: AppState,
  month: MonthKey
): { totalReceived: number; breakdown: { karin: number; karel: number; other: number; borrowed: number } } {
  const entries = state.incomeEntries || [];
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Filter received entries for this month
  const receivedEntries = entries.filter((entry) => {
    if (entry.status !== 'received') return false;
    if (!entry.receivedDate) return false;
    const dateParts = entry.receivedDate.split('-');
    if (dateParts.length < 2) return false;
    const entryMonth = `${dateParts[0]}-${dateParts[1]}`;
    return entryMonth === month;
  });

  // Karin income: from received entries or baseline
  const karin = getKarinIncome(state, month);

  // Karel income: sum of received Karel entries
  const karel = sum(
    receivedEntries
      .filter((entry) => entry.person === 'Karel')
      .map((entry) => safeNumber(entry.amount))
  );

  // Other income: sum of received Other entries
  const other = sum(
    receivedEntries
      .filter((entry) => entry.person === 'Other')
      .map((entry) => safeNumber(entry.amount))
  );

  // Borrowed income: not in new model, keep 0 for now
  const borrowed = 0;

  const totalReceived = karin + karel + other + borrowed;

  return {
    totalReceived,
    breakdown: {
      karin,
      karel,
      other,
      borrowed,
    },
  };
}

/**
 * Calculate saved total for a goal from transactions
 * Clamped to minimum 0
 */
export function getGoalSavedTotal(goal: GoalState): number {
  const transactions = goal.transactions || [];
  const total = sum(transactions.map((t) => t.amount));
  return clampMin(total, 0);
}

/**
 * Build monthly obligations from recurring rules
 */
export function buildMonthlyObligationsFromRecurring(
  state: AppState,
  month: MonthKey,
  scopeFilter?: Scope[]
): MonthlyLedgerEntry[] {
  const rules = (state.recurringRules || []) as RecurringRule[];
  const entries: MonthlyLedgerEntry[] = [];

  for (const rule of rules) {
    if (!rule.active) continue;
    if (scopeFilter && !scopeFilter.includes(rule.scope)) continue;

    const { year, month: monthNum } = parseMonthKey(month);
    const totalAmount = Math.abs(rule.amount); // Convert to positive for due amount

    // Check if spreading is enabled (prefer new field, fallback to old for backward compatibility)
    const spreadEnabled = rule.spreadEnabled ?? rule.isSplitEnabled ?? false;
    const spreadMonths = rule.spreadMonths ?? rule.splitMonths ?? 1;
    const safeSpreadMonths = Math.max(1, Math.min(24, spreadMonths)); // Clamp 1-24

    let shouldInclude = false;
    let dueAmount = totalAmount;

    // Determine if this month should have an obligation
    if (spreadEnabled) {
      // For spreadEnabled, dueDate is required
      if (!rule.dueDate) {
        continue; // Skip if no dueDate
      }
      
      // Extract YYYY-MM from dueDate (YYYY-MM-DD)
      const dueDateParts = rule.dueDate.split('-');
      if (dueDateParts.length < 2) {
        continue; // Invalid date format
      }
      
      const dueYear = parseInt(dueDateParts[0], 10);
      const dueMonthNum = parseInt(dueDateParts[1], 10);
      const dueMonth = formatMonthKey(dueYear, dueMonthNum);
      
      // Calculate startMonth by going backwards (spreadMonths-1) from dueMonth
      const dueParsed = parseMonthKey(dueMonth);
      let startYear = dueParsed.year;
      let startMonthNum = dueParsed.month - (safeSpreadMonths - 1);
      
      // Handle year rollback
      while (startMonthNum < 1) {
        startMonthNum += 12;
        startYear -= 1;
      }
      
      const startMonth = formatMonthKey(startYear, startMonthNum);
      
      // Check if current month is within spread window [startMonth..dueMonth]
      const start = parseMonthKey(startMonth);
      const current = parseMonthKey(month);
      const dueParsedCurrent = parseMonthKey(dueMonth);
      const monthsDiff = (current.year - start.year) * 12 + (current.month - start.month);
      const dueMonthsDiff = (dueParsedCurrent.year - start.year) * 12 + (dueParsedCurrent.month - start.month);
      
      if (monthsDiff < 0 || monthsDiff > dueMonthsDiff) {
        continue; // Outside the spread window
      }
      
      shouldInclude = true;
      
      // Get existing entry to access savedAmount
      const existingEntry = (state.monthlyLedger || []).find(
        (entry) => entry.sourceId === rule.id && entry.month === month && entry.sourceType === 'recurring'
      );
      
      const spreadMode = rule.spreadMode ?? 'catchup'; // default to catchup for new rules
      
      if (spreadMode === 'catchup') {
        // Calculate savedSoFar from startMonth up to previous month
        let savedSoFar = 0;
        const currentParsed = parseMonthKey(month);
        const startParsed = parseMonthKey(startMonth);
        
        // Iterate through months from startMonth to month-1
        let checkYear = startParsed.year;
        let checkMonth = startParsed.month;
        
        while (checkYear < currentParsed.year || (checkYear === currentParsed.year && checkMonth < currentParsed.month)) {
          const checkMonthKey = formatMonthKey(checkYear, checkMonth);
          const checkEntry = (state.monthlyLedger || []).find(
            (e) => e.sourceId === rule.id && e.month === checkMonthKey && e.sourceType === 'recurring'
          );
          savedSoFar += (checkEntry?.savedAmount || 0);
          
          // Move to next month
          checkMonth += 1;
          if (checkMonth > 12) {
            checkMonth = 1;
            checkYear += 1;
          }
        }
        
        // Calculate months left including this month
        const monthsLeftIncludingThis = dueMonthsDiff - monthsDiff + 1;
        
        // Calculate remaining and target
        const remaining = Math.max(0, totalAmount - savedSoFar);
        const targetThisMonth = remaining > 0 ? Math.ceil(remaining / monthsLeftIncludingThis) : 0;
        
        dueAmount = targetThisMonth;
      } else {
        // Fixed mode: static split
        const baseAmount = totalAmount / safeSpreadMonths;
        const floorAmount = Math.floor(baseAmount);
        const remainder = totalAmount - (floorAmount * safeSpreadMonths);
        // Distribute remainder to earliest month(s) in the range
        if (monthsDiff < remainder) {
          dueAmount = floorAmount + 1;
        } else {
          dueAmount = floorAmount;
        }
      }
    } else {
      // No spreading: check if rule applies to this month based on frequency
      if (rule.frequency === 'monthly') {
        shouldInclude = true;
      } else if (rule.frequency === 'quarterly') {
        // Quarterly: Jan, Apr, Jul, Oct (simple version)
        shouldInclude = monthNum % 3 === 1;
      } else if (rule.frequency === 'yearly') {
        // Yearly: January (simple version)
        shouldInclude = monthNum === 1;
      } else if (rule.frequency === 'weekly') {
        // Weekly: approximate as amount * 4.345 weeks per month
        shouldInclude = true;
        dueAmount = totalAmount * 4.345;
      }
    }

    if (!shouldInclude) continue;

    // Check if there's already a ledger entry for this rule in this month
    // NOTE: monthlyLedger entries are instances that can be modified in dashboard
    // without affecting the source recurring rule (see ARCHITECTURE.md)
    const existingEntry = (state.monthlyLedger || []).find(
      (entry) => entry.sourceId === rule.id && entry.month === month && entry.sourceType === 'recurring'
    );

    // Ensure numeric safety
    const safeNumber = (v: unknown): number => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };

    entries.push({
      id: existingEntry?.id || `recurring_${rule.id}_${month}`,
      sourceId: rule.id,
      sourceType: 'recurring',
      month,
      dueAmount: safeNumber(dueAmount),
      paidAmount: safeNumber(existingEntry?.paidAmount),
      savedAmount: safeNumber(existingEntry?.savedAmount),
      paidBy: existingEntry?.paidBy,
      paidByName: existingEntry?.paidByName,
    });
  }

  return entries;
}

/**
 * Build monthly obligations from debt payment plans
 * Note: New DebtItem model doesn't have plans, so this returns empty array
 * Debts are managed separately via debtPayments
 */
export function buildMonthlyObligationsFromDebtPlans(
  state: AppState,
  month: MonthKey,
  scopeFilter?: Scope[]
): MonthlyLedgerEntry[] {
  // New DebtItem model doesn't use plans, debts are tracked via payments
  // Return empty array - debts are managed separately
  return [];
}

/**
 * Build monthly goal payments (deposits/withdrawals)
 * Returns the net amount (positive = deposits, negative = withdrawals)
 */
export function buildMonthlyGoalPayments(state: AppState, month: MonthKey): Money {
  const goals = (state.goals || {}) as Record<string, GoalState>;
  let total = 0;

  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  for (const goal of Object.values(goals)) {
    const transactions = goal.transactions || [];
    const monthTransactions = transactions.filter((t) => t.month === month);
    total += sum(monthTransactions.map((t) => safeNumber(t.amount)));
  }

  return Number.isFinite(total) ? total : 0;
}

/**
 * Compute total amount that must be paid
 */
export function computeMustPayTotal(obligations: MonthlyLedgerEntry[]): Money {
  if (!obligations || obligations.length === 0) return 0;
  return sum(
    obligations.map((o) => {
      const n = Number(o.dueAmount);
      return Number.isFinite(n) ? n : 0;
    })
  );
}

/**
 * Compute total amount that has been paid
 */
export function computePaidTotal(
  obligations: MonthlyLedgerEntry[],
  goalsPaidThisMonth: Money
): Money {
  const safeGoals = Number(goalsPaidThisMonth) || 0;
  if (!obligations || obligations.length === 0) {
    return Number.isFinite(safeGoals) ? safeGoals : 0;
  }
  const obligationsPaid = sum(
    obligations.map((o) => {
      const n = Number(o.paidAmount);
      return Number.isFinite(n) ? n : 0;
    })
  );
  const total = obligationsPaid + safeGoals;
  return Number.isFinite(total) ? total : 0;
}

/**
 * Compute total amount remaining to be paid
 */
export function computeRemainingTotal(obligations: MonthlyLedgerEntry[]): Money {
  if (!obligations || obligations.length === 0) return 0;
  return sum(
    obligations.map((o) => {
      const dueNum = Number(o.dueAmount);
      const paidNum = Number(o.paidAmount);
      const due = Number.isFinite(dueNum) ? dueNum : 0;
      const paid = Number.isFinite(paidNum) ? paidNum : 0;
      const remaining = Math.max(0, due - paid);
      return Number.isFinite(remaining) ? remaining : 0;
    })
  );
}

/**
 * Get variable expense total for a month and scope
 */
export function getVariableExpenseTotal(
  state: AppState,
  month: MonthKey,
  scope: Scope = 'rodina'
): Money {
  const entries = state.variableExpenseLedger || [];
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  return sum(
    entries
      .filter((entry) => {
        return entry.month === month && entry.scope === scope && entry.direction === 'expense';
      })
      .map((entry) => safeNumber(entry.amount))
  );
}

/**
 * Compute variable spend (pohyblivé výdaje)
 * Uses variable expense ledger for rodina scope
 */
export function computeVariableSpend(state: AppState, month: MonthKey, paidTotal: Money): Money {
  // Use ledger entries for rodina scope
  return getVariableExpenseTotal(state, month, 'rodina');
}

/**
 * Compute Karel deficit (how much Karel still needs to earn)
 */
export function computeKarelDeficit(
  state: AppState,
  month: MonthKey,
  mustPayTotal: Money,
  walletBalance: Money
): Money {
  const income = getEffectiveIncome(state, month);
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };
  // Only count non-Karel income sources (Karin + other + borrowed)
  const karin = safeNumber(income.breakdown.karin);
  const other = safeNumber(income.breakdown.other);
  const borrowed = safeNumber(income.breakdown.borrowed);
  const nonKarelIncome = karin + other + borrowed;
  const mustPay = safeNumber(mustPayTotal);
  const wallet = safeNumber(walletBalance);
  const deficit = Math.max(0, mustPay - nonKarelIncome - wallet);
  return Number.isFinite(deficit) ? deficit : 0;
}

/**
 * Calculate debt status (paid total, remaining, status)
 */
export function calculateDebtStatus(
  debt: DebtItem,
  payments: DebtPayment[]
): { paidTotal: number; remaining: number; status: 'unpaid' | 'partial' | 'paid' } {
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const principal = safeNumber(debt.principal);
  const outstanding = safeNumber(debt.outstanding);
  
  // Sum payments for this debt
  const debtPayments = payments.filter((p) => p.debtId === debt.id);
  const paidTotal = sum(debtPayments.map((p) => safeNumber(p.amount)));
  
  // Remaining is the outstanding amount (which should be principal - paidTotal)
  const remaining = Math.max(0, outstanding);
  
  let status: 'unpaid' | 'partial' | 'paid';
  if (paidTotal === 0) {
    status = 'unpaid';
  } else if (remaining <= 0 || paidTotal >= principal) {
    status = 'paid';
  } else {
    status = 'partial';
  }

  return { paidTotal, remaining, status };
}

/**
 * Get total outstanding debts (i_owe) for a scope
 */
export function getDebtsOutstandingTotal(state: AppState, scope?: Scope): number {
  const debts = (state.debts || []) as DebtItem[];
  if (!Array.isArray(debts)) return 0;

  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Filter by scope if provided
  const filteredDebts = scope ? selectByScope(debts, scope) : debts;
  
  // Sum outstanding for i_owe debts
  return sum(
    filteredDebts
      .filter((debt) => debt.direction === 'i_owe')
      .map((debt) => safeNumber(debt.outstanding))
  );
}

/**
 * Get total outstanding receivables (owed_to_me) for a scope
 */
export function getReceivablesOutstandingTotal(state: AppState, scope?: Scope): number {
  const debts = (state.debts || []) as DebtItem[];
  if (!Array.isArray(debts)) return 0;

  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Filter by scope if provided
  const filteredDebts = scope ? selectByScope(debts, scope) : debts;
  
  // Sum outstanding for owed_to_me debts
  return sum(
    filteredDebts
      .filter((debt) => debt.direction === 'owed_to_me')
      .map((debt) => safeNumber(debt.outstanding))
  );
}

/**
 * Get total uncertain receivables (owed_to_me with confidence < 100) for a scope
 */
export function getUncertainReceivablesTotal(state: AppState, scope?: Scope): number {
  const debts = (state.debts || []) as DebtItem[];
  if (!Array.isArray(debts)) return 0;

  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // Filter by scope if provided
  const filteredDebts = scope ? selectByScope(debts, scope) : debts;
  
  // Sum outstanding for uncertain receivables
  return sum(
    filteredDebts
      .filter((debt) => debt.direction === 'owed_to_me' && debt.confidence < 100)
      .map((debt) => safeNumber(debt.outstanding))
  );
}


/**
 * Compute implied variable spend between two wallet checkpoints
 * Calculates the difference in wallet balance and subtracts known income/expenses
 * to determine implied variable spending
 */
export function computeImpliedVariableSpendBetween(
  state: AppState,
  previousCheckpoint: WalletCheckpoint,
  currentCheckpoint: WalletCheckpoint
): number {
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  const previousBalance = safeNumber(previousCheckpoint.amountActual);
  const currentBalance = safeNumber(currentCheckpoint.amountActual);
  const balanceChange = currentBalance - previousBalance;

  // Extract month keys from checkpoint dates
  const previousDateParts = previousCheckpoint.date.split('-');
  const currentDateParts = currentCheckpoint.date.split('-');
  
  if (previousDateParts.length < 2 || currentDateParts.length < 2) {
    return 0; // Invalid date format
  }

  const previousMonth = `${previousDateParts[0]}-${previousDateParts[1]}` as MonthKey;
  const currentMonth = `${currentDateParts[0]}-${currentDateParts[1]}` as MonthKey;

  // Get income received between checkpoints
  const previousIncome = getEffectiveIncome(state, previousMonth);
  const currentIncome = getEffectiveIncome(state, currentMonth);
  const totalIncome = previousIncome.totalReceived + currentIncome.totalReceived;

  // Get paid amounts (obligations + goals) between checkpoints
  const previousObligations = buildMonthlyObligationsFromRecurring(state, previousMonth);
  const currentObligations = buildMonthlyObligationsFromRecurring(state, currentMonth);
  const allObligations = [...previousObligations, ...currentObligations];
  const previousGoals = buildMonthlyGoalPayments(state, previousMonth);
  const currentGoals = buildMonthlyGoalPayments(state, currentMonth);
  const totalPaid = computePaidTotal(allObligations, previousGoals + currentGoals);

  // Implied variable spend = balance change - income + paid expenses
  // If balance decreased, it means money was spent (negative change)
  // If income came in, it increases balance (positive)
  // If expenses were paid, it decreases balance (negative)
  // So: impliedSpend = -balanceChange + income - paidExpenses
  // Or: impliedSpend = income - paidExpenses - balanceChange
  const impliedSpend = totalIncome - totalPaid - balanceChange;

  return Number.isFinite(impliedSpend) ? impliedSpend : 0;
}
