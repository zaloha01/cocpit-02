/**
 * Domain layer exports
 * 
 * This module exports all domain-related functionality:
 * - Models (data types)
 * - Selectors (data queries)
 * - Rules (business rules)
 * - Calculations (domain logic)
 */

export * from './models';
export * from './selectors';
export * from './rules';
export * from './calc';

import type { AppState } from '../storage/schema';
import type { MonthKey, Scope, MonthlyLedgerEntry, GoalState, DebtState } from './models';
import { getCurrentMonthKey } from './calc';
import {
  getEffectiveIncome,
  getIncomePlannedTotal,
  getIncomeReceivedTotal,
  getKarinIncome,
  getGoalSavedTotal,
  buildMonthlyObligationsFromRecurring,
  buildMonthlyObligationsFromDebtPlans,
  buildMonthlyGoalPayments,
  computeMustPayTotal,
  computePaidTotal,
  computeRemainingTotal,
  computeVariableSpend,
  computeKarelDeficit,
} from './selectors';
import { sum } from './calc';

/**
 * Monthly context result
 */
export type MonthlyContext = {
  month: MonthKey;
  scopeFilter?: Scope[];
  obligations: MonthlyLedgerEntry[];
  totals: {
    mustPayTotal: number;
    paidTotal: number;
    remainingTotal: number;
    variableSpend: number;
    karelDeficit: number;
    incomeReceivedTotal: number;
    incomePlannedTotal: number;
    karelRemainingToEarn: number;
  };
  goalsSummary: {
    totalSaved: number;
    perGoal: Array<{ id: string; name: string; savedTotal: number }>;
  };
  giftsSummary: {
    totalGifts: number;
    list: Array<{ id: string; sourceId: string; amount: number; paidByName?: string }>;
  };
  borrowedSummary: {
    totalBorrowedIncome: number;
    list: Array<{ id: string; month: MonthKey; amount: number; from?: string }>;
  };
};

/**
 * Get monthly context for dashboard
 * Computes all totals and summaries for a given month
 */
export function getMonthlyContext(
  appState: AppState,
  month?: MonthKey,
  scopeFilter?: Scope[]
): MonthlyContext {
  const targetMonth = month || getCurrentMonthKey();

  // Build obligations
  const recurringObligations = buildMonthlyObligationsFromRecurring(appState, targetMonth, scopeFilter);
  const debtObligations = buildMonthlyObligationsFromDebtPlans(appState, targetMonth);
  const allObligations = [...recurringObligations, ...debtObligations];

  // Get goal payments
  const goalsPaidThisMonth = buildMonthlyGoalPayments(appState, targetMonth);

  // Compute totals
  const mustPayTotal = computeMustPayTotal(allObligations);
  const paidTotal = computePaidTotal(allObligations, goalsPaidThisMonth);
  const remainingTotal = computeRemainingTotal(allObligations);

  // Get income
  const income = getEffectiveIncome(appState, targetMonth);
  const incomePlannedTotal = getIncomePlannedTotal(appState, targetMonth);
  const incomeReceivedTotal = getIncomeReceivedTotal(appState, targetMonth);

  // Compute variable spend
  const variableSpend = computeVariableSpend(appState, targetMonth, paidTotal);

  // Compute Karel deficit (old calculation)
  const karelDeficit = computeKarelDeficit(appState, targetMonth, mustPayTotal, appState.wallet.currentBalance);

  // Compute reserve target total (for catchup entries)
  const catchupObligations = recurringObligations.filter((o) => {
    const rule = appState.recurringRules?.find((r) => r.id === o.sourceId);
    return rule?.spreadEnabled && rule?.spreadMode === 'catchup';
  });
  const reserveTargetTotal = computeMustPayTotal(catchupObligations);

  // Compute Karel remaining to earn
  const karinActualOrAverage = getKarinIncome(appState, targetMonth);
  const karelReceived = income.breakdown.karel;
  const otherReceived = income.breakdown.other;
  const karelRemainingToEarn = Math.max(
    0,
    mustPayTotal + reserveTargetTotal - (karinActualOrAverage + otherReceived + karelReceived)
  );

  // Goals summary
  const goals = (appState.goals || {}) as Record<string, GoalState>;
  const goalsList = Object.values(goals);
  const goalsSummary = {
    totalSaved: sum(goalsList.map((g) => getGoalSavedTotal(g))),
    perGoal: goalsList.map((g) => ({
      id: g.id,
      name: g.name,
      savedTotal: getGoalSavedTotal(g),
    })),
  };

  // Gifts summary (from obligations with paidBy="gift")
  const giftObligations = allObligations.filter((o) => o.paidBy === 'gift');
  const giftsSummary = {
    totalGifts: sum(giftObligations.map((o) => o.paidAmount)),
    list: giftObligations.map((o) => ({
      id: o.id,
      sourceId: o.sourceId,
      amount: o.paidAmount,
      paidByName: o.paidByName,
    })),
  };

  // Borrowed income summary
  const incomes = appState.incomes;
  const borrowedIncomeList = (incomes?.borrowedIncome || []).filter((item: any) => item.month === targetMonth);
  const borrowedSummary = {
    totalBorrowedIncome: sum(borrowedIncomeList.map((item: any) => item.amount)),
    list: borrowedIncomeList.map((item: any) => ({
      id: item.id,
      month: item.month,
      amount: item.amount,
      from: item.from,
    })),
  };

  return {
    month: targetMonth,
    scopeFilter,
    obligations: allObligations,
    totals: {
      mustPayTotal,
      paidTotal,
      remainingTotal,
      variableSpend,
      karelDeficit,
      incomeReceivedTotal,
      incomePlannedTotal,
      karelRemainingToEarn,
    },
    goalsSummary,
    giftsSummary,
    borrowedSummary,
  };
}
