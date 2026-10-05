/* =========================================================
   shared/insights.js — aggregation behind the charts.

   Turns a transaction list into the numbers the charts draw:
   monthly income/expense totals and an expense breakdown by
   category. Pure arithmetic — the React components only turn
   these numbers into SVG.
   ========================================================= */

import { monthKey, roundMoney, toISODate, todayISO } from "./utils.js";
import { getCategory } from "./categories.js";

export const MONTHS_SHOWN = 6;

/** The last N month keys (YYYY-MM), oldest first, ending with this month. */
export function lastMonths(n = MONTHS_SHOWN, now = new Date()) {
  const keys = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return keys;
}

/** { "2026-10": { income, expense }, … } */
export function totalsByMonth(transactions) {
  const map = {};
  for (const t of transactions) {
    const key = monthKey(t.date);
    map[key] = map[key] || { income: 0, expense: 0 };
    map[key][t.type] += t.amount;
  }
  for (const key of Object.keys(map)) {
    map[key].income = roundMoney(map[key].income);
    map[key].expense = roundMoney(map[key].expense);
  }
  return map;
}

/** Income, expense, balance and counts across every transaction. */
export function calculateTotals(transactions) {
  let income = 0;
  let expense = 0;
  let incomeCount = 0;
  let expenseCount = 0;

  for (const t of transactions) {
    if (t.type === "income") {
      income += t.amount;
      incomeCount++;
    } else {
      expense += t.amount;
      expenseCount++;
    }
  }

  return {
    income: roundMoney(income),
    expense: roundMoney(expense),
    balance: roundMoney(income - expense),
    incomeCount,
    expenseCount,
  };
}

/**
 * Bars for the monthly chart plus this month's stats and the
 * month-over-month spending trend.
 */
export function monthlySummary(transactions, months = lastMonths()) {
  const totals = totalsByMonth(transactions);
  const bars = months.map((key) => ({
    key,
    income: totals[key]?.income || 0,
    expense: totals[key]?.expense || 0,
  }));

  // Scale every bar against the single largest value, never against zero.
  const max = Math.max(1, ...bars.map((b) => Math.max(b.income, b.expense)));
  const current = bars[bars.length - 1];
  const previous = bars[bars.length - 2] || { income: 0, expense: 0 };

  let trend = null;
  if (previous.expense > 0) {
    const change = Math.round(((current.expense - previous.expense) / previous.expense) * 100);
    trend = { change, direction: change === 0 ? "flat" : change > 0 ? "up" : "down" };
  }

  return {
    bars: bars.map((b) => ({
      ...b,
      incomeHeight: (b.income / max) * 100,
      expenseHeight: (b.expense / max) * 100,
      isCurrent: b.key === current.key,
    })),
    current,
    previous,
    net: roundMoney(current.income - current.expense),
    trend,
  };
}

/**
 * Expense totals per category, largest first, with each slice's share.
 * @param monthKeyFilter a YYYY-MM key, or "all" for every month
 */
export function categoryBreakdown(transactions, monthKeyFilter = "all") {
  const expenses = transactions.filter(
    (t) => t.type === "expense" && (monthKeyFilter === "all" || monthKey(t.date) === monthKeyFilter)
  );

  if (!expenses.length) return { total: 0, slices: [] };

  const byCategory = {};
  for (const t of expenses) {
    byCategory[t.category] = (byCategory[t.category] || 0) + t.amount;
  }

  const total = roundMoney(expenses.reduce((sum, t) => sum + t.amount, 0));
  const slices = Object.entries(byCategory)
    .map(([name, amount]) => ({
      ...getCategory("expense", name),
      amount: roundMoney(amount),
      percent: (amount / total) * 100,
    }))
    .sort((a, b) => b.amount - a.amount);

  return { total, slices };
}

/* ---------- Budget ---------- */

/** Warn once spending reaches this share of the limit. */
export const WARN_AT = 0.8;

/**
 * Expenses in a given month (defaults to the current one).
 * Keys come from todayISO(), which is local time — toISOString() would be UTC
 * and would put a late-evening transaction in the wrong month.
 */
export function spentInMonth(transactions, key = monthKey(todayISO())) {
  return roundMoney(
    transactions
      .filter((t) => t.type === "expense" && monthKey(t.date) === key)
      .reduce((sum, t) => sum + t.amount, 0)
  );
}

/** "none" | "ok" | "warn" | "over" */
export function budgetStatus(spent, limit) {
  if (!limit) return "none";
  const ratio = spent / limit;
  if (ratio > 1) return "over";
  if (ratio >= WARN_AT) return "warn";
  return "ok";
}

/** Days remaining in the current month, counting today. */
export function daysLeftInMonth(now = new Date()) {
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return daysInMonth - now.getDate() + 1;
}

/** Everything the budget card needs to draw itself. */
export function budgetSnapshot(transactions, limit, now = new Date()) {
  const month = monthKey(toISODate(now));
  const spent = spentInMonth(transactions, month);
  const remaining = roundMoney(limit - spent);
  const daysLeft = daysLeftInMonth(now);

  return {
    month,
    limit,
    spent,
    remaining,
    daysLeft,
    percent: limit ? Math.round((spent / limit) * 100) : 0,
    perDay: remaining > 0 && daysLeft > 0 ? roundMoney(remaining / daysLeft) : 0,
    status: budgetStatus(spent, limit),
  };
}

/**
 * Message to show when an expense change pushed spending across a
 * threshold. Returns null when nothing newly crossed.
 */
export function thresholdAlert(spentBefore, spentAfter, limit) {
  if (!limit || spentAfter <= spentBefore) return null;
  if (spentBefore <= limit && spentAfter > limit) {
    return { type: "error", text: "You've gone over this month's budget." };
  }
  if (spentBefore < limit * WARN_AT && spentAfter >= limit * WARN_AT) {
    const pct = Math.round((spentAfter / limit) * 100);
    return { type: "error", text: `Heads up: you've used ${pct}% of this month's budget.` };
  }
  return null;
}
