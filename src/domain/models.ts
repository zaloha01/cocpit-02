/**
 * Domain Models
 * 
 * Type definitions for domain entities.
 * These represent the core data structures used throughout the application.
 */

import type { AppScope } from '../storage/schema';

/**
 * Money amount in CZK
 */
export type Money = number;

/**
 * Month key in format "YYYY-MM"
 */
export type MonthKey = string;

/**
 * Scope alias
 */
export type Scope = AppScope;

/**
 * Recurring payment rule
 * Amount is stored as negative for expenses in state
 */
export type RecurringRule = {
  id: string;
  name: string;
  amount: Money; // negative for expenses
  frequency: 'monthly' | 'quarterly' | 'yearly' | 'weekly';
  scope: Scope;
  categoryMain: string;
  categorySub?: string;
  isSplitEnabled?: boolean; // DEPRECATED: use spreadEnabled instead
  splitMonths?: number; // DEPRECATED: use spreadMonths instead
  spreadEnabled?: boolean; // if true, amount is spread across months
  spreadMonths?: number; // number of months to spread across (1-24)
  spreadStartMonth?: string; // YYYY-MM, DEPRECATED
  spreadMode?: 'fixed' | 'catchup'; // "fixed" = static split, "catchup" = dynamic target based on saved amount
  dueDate?: string; // YYYY-MM-DD, required when spreadEnabled
  active: boolean;
};

/**
 * Monthly ledger entry (instance for a specific month)
 */
export type MonthlyLedgerEntry = {
  id: string;
  sourceId: string; // ID of the source rule/debt/goal
  sourceType: 'recurring' | 'debt' | 'goal';
  month: MonthKey;
  dueAmount: Money; // amount that must be paid (or target for catchup mode)
  paidAmount: Money; // amount already paid (to vendor)
  savedAmount?: Money; // amount saved to reserve (for catchup spreadMode)
  paidBy?: 'self' | 'gift' | 'loan';
  paidByName?: string; // name of person who paid (for gift/loan)
};

/**
 * Income entry (planned or received)
 */
export type IncomeEntry = {
  id: string;
  person: 'Karin' | 'Karel' | 'Other';
  title: string; // e.g., "Výplata", "DPH", "Bonus", "Vánoce"
  amount: number;
  expectedDate?: string; // YYYY-MM-DD, for planned incomes
  receivedDate?: string; // YYYY-MM-DD, for received incomes
  status: 'planned' | 'received';
  confidence?: number; // 0..100, optional, default 100
  scope: Scope | 'other'; // "rodina" | "ico" | "sro_karin" | "weecon" | "other"
};

/**
 * Variable expense/income ledger entry
 */
export type VariableExpenseEntry = {
  id: string;
  month: MonthKey; // YYYY-MM
  scope: Scope; // rodina | ico | sro_karin | weecon
  direction: 'expense' | 'income'; // expense is default for UI
  amount: number; // positive number; direction decides sign
  categoryMain: string;
  categorySub?: string;
  note?: string;
  date?: string; // YYYY-MM-DD optional ("kdy reálně odešlo/přišlo")
  createdAt: string; // ISO string
};

/**
 * Income state structure (DEPRECATED - kept for migration)
 */
export type IncomeState = {
  karinAvg: number;
  karinActual: Record<MonthKey, number>;
  karelActual: Record<MonthKey, number>;
  otherIncome: Array<{
    id: string;
    month: MonthKey;
    amount: number;
    note?: string;
  }>;
  borrowedIncome: Array<{
    id: string;
    month: MonthKey;
    amount: number;
    from?: string;
    note?: string;
  }>;
};

/**
 * Goal state structure
 * savedTotal is derived from transactions and never below 0
 */
export type GoalState = {
  id: string;
  name: string;
  targetAmount?: number;
  savedTotal: number; // derived, but stored for performance
  transactions: Array<{
    id: string;
    month: MonthKey;
    amount: number; // positive = deposit, negative = withdrawal
    note?: string;
  }>;
};

/**
 * Debt state structure
 * Debts without plan do not create monthly obligations automatically
 */
export type DebtState = {
  id: string;
  direction: 'iOwe' | 'owedToMe';
  counterparty: string;
  amountTotal: number;
  amountRemaining: number;
  dueDate?: string;
  confidence?: 'certain' | 'uncertain';
  plan?: Array<{
    month: MonthKey;
    amount: number;
  }>;
  active: boolean;
};
