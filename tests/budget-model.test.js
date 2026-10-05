/* =========================================================
   The monthly budget — the budget functions in shared/insights.js.

   Consider renaming this file now that there is no BudgetModel:
       git mv tests/budget-model.test.js tests/budget.test.js
   ========================================================= */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  budgetSnapshot,
  budgetStatus,
  daysLeftInMonth,
  spentInMonth,
  thresholdAlert,
  WARN_AT,
} from "../shared/insights.js";
import { monthsAgo, TODAY, tx } from "./helpers.js";
import { monthKey } from "../shared/utils.js";

/* ---------- Spend calculation ---------- */

test("spentInMonth counts only expenses from the given month", () => {
  const lastMonth = monthsAgo(1);
  const rows = [
    tx({ type: "expense", amount: 1000, date: TODAY }),
    tx({ type: "expense", amount: 500, date: TODAY }),
    tx({ type: "income", amount: 90000, date: TODAY, category: "Salary" }),
    tx({ type: "expense", amount: 7777, date: lastMonth }),
  ];

  assert.equal(spentInMonth(rows), 1500, "income and other months are excluded");
  assert.equal(spentInMonth(rows, monthKey(lastMonth)), 7777);
  assert.equal(spentInMonth(rows, "1999-01"), 0);
});

test("spentInMonth returns zero rather than NaN for an empty list", () => {
  assert.equal(spentInMonth([]), 0);
});

/* ---------- Status thresholds ---------- */

test("budgetStatus reports none when no limit is set", () => {
  assert.equal(budgetStatus(5000, 0), "none");
  assert.equal(budgetStatus(0, 0), "none");
});

test("budgetStatus moves ok to warn at 80% and over past 100%", () => {
  assert.equal(budgetStatus(0, 1000), "ok");
  assert.equal(budgetStatus(799, 1000), "ok");
  assert.equal(budgetStatus(800, 1000), "warn", `warn begins exactly at ${WARN_AT * 100}%`);
  assert.equal(budgetStatus(1000, 1000), "warn", "spending the whole budget is not yet over");
  assert.equal(budgetStatus(1000.01, 1000), "over");
});

/* ---------- Days remaining ---------- */

test("daysLeftInMonth counts today as remaining", () => {
  assert.equal(daysLeftInMonth(new Date(2026, 0, 31)), 1, "the last day of January");
  assert.equal(daysLeftInMonth(new Date(2026, 0, 1)), 31);
  assert.equal(daysLeftInMonth(new Date(2024, 1, 1)), 29, "February in a leap year");
});

/* ---------- Snapshot for the budget card ---------- */

test("budgetSnapshot describes progress, remaining amount and daily allowance", () => {
  // The 1st of a 31-day month, so all 31 days remain.
  const snap = budgetSnapshot(
    [tx({ type: "expense", amount: 2500, date: "2026-01-10" })],
    10000,
    new Date(2026, 0, 1)
  );

  assert.equal(snap.month, "2026-01");
  assert.equal(snap.limit, 10000);
  assert.equal(snap.spent, 2500);
  assert.equal(snap.remaining, 7500);
  assert.equal(snap.percent, 25);
  assert.equal(snap.daysLeft, 31);
  assert.equal(snap.perDay, 241.94);
  assert.equal(snap.status, "ok");
});

test("budgetSnapshot goes negative and reports over once the limit is passed", () => {
  const snap = budgetSnapshot(
    [tx({ type: "expense", amount: 12000, date: "2026-01-05" })],
    10000,
    new Date(2026, 0, 15)
  );

  assert.equal(snap.remaining, -2000);
  assert.equal(snap.percent, 120);
  assert.equal(snap.status, "over");
  assert.equal(snap.perDay, 0, "no daily allowance is suggested once overspent");
});

test("budgetSnapshot with no limit still reports what has been spent", () => {
  const snap = budgetSnapshot(
    [tx({ type: "expense", amount: 400, date: "2026-01-02" })],
    0,
    new Date(2026, 0, 2)
  );

  assert.equal(snap.limit, 0);
  assert.equal(snap.spent, 400);
  assert.equal(snap.percent, 0);
  assert.equal(snap.status, "none");
});

test("budgetSnapshot ignores spending from other months", () => {
  const snap = budgetSnapshot(
    [
      tx({ type: "expense", amount: 500, date: "2026-01-10" }),
      tx({ type: "expense", amount: 9999, date: "2025-12-10" }),
    ],
    10000,
    new Date(2026, 0, 20)
  );
  assert.equal(snap.spent, 500);
});

/* ---------- Threshold alerts ---------- */

test("thresholdAlert fires once when spending first crosses the limit", () => {
  const crossing = thresholdAlert(900, 1100, 1000);
  assert.equal(crossing.type, "error");
  assert.match(crossing.text, /over this month's budget/i);

  assert.equal(thresholdAlert(1100, 1200, 1000), null, "already over, so no repeat alert");
});

test("thresholdAlert warns when spending first reaches 80%", () => {
  const warning = thresholdAlert(700, 850, 1000);
  assert.match(warning.text, /85% of this month's budget/i);

  assert.equal(thresholdAlert(850, 900, 1000), null, "the warning is not repeated");
});

test("thresholdAlert stays silent without a limit or when spending falls", () => {
  assert.equal(thresholdAlert(0, 99999, 0), null, "no limit set");
  assert.equal(thresholdAlert(1200, 800, 1000), null, "deleting an expense is not an alert");
  assert.equal(thresholdAlert(100, 100, 1000), null, "an unchanged total is not an alert");
});
