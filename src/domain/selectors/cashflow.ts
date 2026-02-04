/**
 * Cashflow Selectors
 * 
 * Central selectors for cashflow calculations.
 * Single source of truth for payment-related computations.
 */

import type { AppState } from '../../storage/schema';
import type { DebtItem, DebtPayment, Scope } from '../models';
import { sum } from '../calc';
import { selectByScope } from '../selectors';

/**
 * Safe number conversion helper
 */
function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Parse date string (YYYY-MM-DD or ISO string) and extract year and month
 */
function parseDateToYearMonth(dateStr: string): { year: number; month: number } | null {
  if (!dateStr || typeof dateStr !== 'string') return null;

  // Handle ISO string (with time) or YYYY-MM-DD
  const datePart = dateStr.split('T')[0]; // Take date part if ISO
  const parts = datePart.split('-');
  
  if (parts.length < 2) return null;

  const year = parseInt(parts[0], 10);
  const month = parseInt(parts[1], 10);

  if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
  if (month < 1 || month > 12) return null;

  return { year, month };
}

/**
 * Select paid amounts for outgoing debts (i_owe) in a given month
 * 
 * @param state - Application state
 * @param year - Year (e.g., 2026)
 * @param month - Month (1-12)
 * @param scope - Optional scope filter
 * @returns Sum of payment amounts for i_owe debts in the specified month
 * 
 * Test scenario:
 * - Outgoing dluh 10 000, payment 3 000 dne 2026-02-10
 * - selectPaidThisMonthOutgoing(state, 2026, 2) => 3 000
 */
export function selectPaidThisMonthOutgoing(
  state: AppState,
  year: number,
  month: number,
  scope?: Scope
): number {
  const debts = (state.debts || []) as DebtItem[];
  const payments = (state.debtPayments || []) as DebtPayment[];

  if (!Array.isArray(debts) || !Array.isArray(payments)) {
    return 0;
  }

  // Validate month
  if (!Number.isFinite(month) || month < 1 || month > 12) {
    return 0;
  }

  // Filter debts by scope if provided
  const filteredDebts = scope ? selectByScope(debts, scope) : debts;

  // Get i_owe debt IDs
  const iOweDebtIds = new Set(
    filteredDebts
      .filter((debt) => debt.direction === 'i_owe')
      .map((debt) => debt.id)
  );

  // Filter payments for i_owe debts in the specified month
  const monthPayments = payments.filter((payment) => {
    // Check if payment belongs to an i_owe debt
    if (!iOweDebtIds.has(payment.debtId)) return false;

    // Parse payment date
    const paymentDate = parseDateToYearMonth(payment.date);
    if (!paymentDate) return false;

    // Check if payment is in the specified month
    return paymentDate.year === year && paymentDate.month === month;
  });

  return sum(monthPayments.map((p) => safeNumber(p.amount)));
}
