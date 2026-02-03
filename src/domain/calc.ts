/**
 * Domain Calculations
 * 
 * Pure calculation functions that compute derived values from AppState.
 * All business calculations happen here, not in UI or Storage layers.
 */

import type { MonthKey, Money } from './models';

/**
 * Parse month key "YYYY-MM" into year and month
 */
export function parseMonthKey(monthKey: MonthKey): { year: number; month: number } {
  const [yearStr, monthStr] = monthKey.split('-');
  return {
    year: parseInt(yearStr, 10),
    month: parseInt(monthStr, 10),
  };
}

/**
 * Format year and month into "YYYY-MM" key
 */
export function formatMonthKey(year: number, month: number): MonthKey {
  return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Get current month key
 */
export function getCurrentMonthKey(): MonthKey {
  const now = new Date();
  return formatMonthKey(now.getFullYear(), now.getMonth() + 1);
}

/**
 * Sum array of numbers
 */
export function sum(numbers: number[]): number {
  return numbers.reduce((acc, n) => acc + n, 0);
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Clamp value to minimum (no maximum)
 */
export function clampMin(value: number, min: number): number {
  return Math.max(min, value);
}
