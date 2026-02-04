/**
 * Debt Selectors
 * 
 * Central selectors for debt calculations.
 * Single source of truth for debt-related computations.
 */

import type { AppState } from '../../storage/schema';
import type { DebtItem, DebtPayment, Scope } from '../models';
import { sum } from '../calc';
import { selectByScope } from '../selectors';

type DebtWithDerived = DebtItem & {
  paidTotal: number;
  remaining: number;
  status: 'paid' | 'open';
};

/**
 * Safe number conversion helper
 */
function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Select debts with derived values (paidTotal, remaining, status)
 * 
 * @param state - Application state
 * @param scope - Optional scope filter
 * @returns Array of debts with derived values
 * 
 * Test scenario:
 * - Outgoing dluh 10 000, payment 3 000 dne 2026-02-10
 * - => remaining 7 000; status "open"
 */
export function selectDebtsWithDerived(
  state: AppState,
  scope?: Scope
): DebtWithDerived[] {
  const debts = (state.debts || []) as DebtItem[];
  const payments = (state.debtPayments || []) as DebtPayment[];

  if (!Array.isArray(debts) || !Array.isArray(payments)) {
    return [];
  }

  // Filter debts by scope if provided
  const filteredDebts = scope ? selectByScope(debts, scope) : debts;

  return filteredDebts.map((debt) => {
    // Sum payments for this debt
    const debtPayments = payments.filter((p) => p.debtId === debt.id);
    const paidTotal = sum(debtPayments.map((p) => safeNumber(p.amount)));

    // Remaining = max(0, principal - paidTotal)
    // Note: We use principal, not outstanding, as per requirements
    const principal = safeNumber(debt.principal);
    const remaining = Math.max(0, principal - paidTotal);

    // Status: paid if remaining === 0, otherwise open
    const status: 'paid' | 'open' = remaining === 0 ? 'paid' : 'open';

    return {
      ...debt,
      paidTotal,
      remaining,
      status,
    };
  });
}

/**
 * Select total payables remaining (sum of remaining for outgoing debts)
 * 
 * @param state - Application state
 * @param scope - Optional scope filter
 * @returns Total remaining amount for i_owe debts with status !== "paid"
 * 
 * Test scenario:
 * - Outgoing dluh 10 000, payment 3 000 => remaining 7 000
 * - selectTotalPayablesRemaining => 7 000
 */
export function selectTotalPayablesRemaining(
  state: AppState,
  scope?: Scope
): number {
  const debtsWithDerived = selectDebtsWithDerived(state, scope);

  // Sum remaining for i_owe debts with status !== "paid"
  return sum(
    debtsWithDerived
      .filter((debt) => debt.direction === 'i_owe' && debt.status !== 'paid')
      .map((debt) => debt.remaining)
  );
}
