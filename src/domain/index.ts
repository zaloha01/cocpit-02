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

// Export new selectors from subdirectories
export { selectDebtsWithDerived, selectTotalPayablesRemaining } from './selectors/debts';
export { selectPaidThisMonthOutgoing } from './selectors/cashflow';

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
  getVariableExpenseTotal,
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
  cashflow: {
    moneyReceived: number;
    mustPay: number;
    mustSave: number;
    variableSpend: number;
    balance: number;
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
  const debtObligations = buildMonthlyObligationsFromDebtPlans(appState, targetMonth, scopeFilter);
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

  // Compute variable spend (use first scope from filter, or default to 'rodina')
  const activeScope = scopeFilter && scopeFilter.length > 0 ? scopeFilter[0] : 'rodina';
  const variableSpend = getVariableExpenseTotal(appState, targetMonth, activeScope);

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

  // Compute cashflow
  const safeNumber = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  };

  // MONEY_RECEIVED = received incomes + Karin actual/average
  // Check if Karin has a received entry for this month
  const karinReceivedEntry = (appState.incomeEntries || []).find((entry) => {
    if (entry.person !== 'Karin' || entry.status !== 'received') return false;
    if (!entry.receivedDate) return false;
    const dateParts = entry.receivedDate.split('-');
    if (dateParts.length < 2) return false;
    const entryMonth = `${dateParts[0]}-${dateParts[1]}`;
    return entryMonth === targetMonth;
  });
  
  // If Karin has a received entry, it's already in incomeReceivedTotal
  // Otherwise, add Karin's average/actual income
  const karinIncomeToAdd = karinReceivedEntry ? 0 : safeNumber(karinActualOrAverage);
  const moneyReceived = safeNumber(incomeReceivedTotal) + karinIncomeToAdd;

  // MUST_PAY = remainingTotal for non-catchup obligations only
  // (catchup obligations are counted in MUST_SAVE, not MUST_PAY)
  const nonCatchupObligations = allObligations.filter((o) => {
    if (o.sourceType !== 'recurring') return true; // debt obligations are always included
    const rule = appState.recurringRules?.find((r) => r.id === o.sourceId);
    return !(rule?.spreadEnabled && rule?.spreadMode === 'catchup');
  });
  const remainingTotalNonCatchup = computeRemainingTotal(nonCatchupObligations);
  const mustPay = safeNumber(remainingTotalNonCatchup);

  // MUST_SAVE = reserve catch-up targets
  const mustSave = safeNumber(reserveTargetTotal);

  // VARIABLE_SPEND = variable expenses for rodina scope
  const variableSpendCashflow = safeNumber(variableSpend);

  // CASHFLOW_BALANCE = MONEY_RECEIVED - MUST_PAY - MUST_SAVE - VARIABLE_SPEND
  const cashflowBalance = moneyReceived - mustPay - mustSave - variableSpendCashflow;

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
    cashflow: {
      moneyReceived,
      mustPay,
      mustSave,
      variableSpend: variableSpendCashflow,
      balance: cashflowBalance,
    },
    goalsSummary,
    giftsSummary,
    borrowedSummary,
  };
}
