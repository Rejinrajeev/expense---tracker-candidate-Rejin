/* =========================================================
   Filtering, sorting and totals — shared/filters.js and
   calculateTotals() from shared/insights.js.

   Consider renaming this file now that there is no store:
       git mv tests/transaction-store.test.js tests/filters.test.js
   ========================================================= */

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  availableMonths,
  DEFAULT_FILTERS,
  hasActiveFilters,
  matchesFilters,
  reconcileFilters,
  sortTransactions,
  visibleTransactions,
} from "../shared/filters.js";
import { calculateTotals } from "../shared/insights.js";
import { daysAgo, monthsAgo, TODAY, tx } from "./helpers.js";
import { monthKey } from "../shared/utils.js";

/* ---------- Totals ---------- */

test("calculateTotals sums income, expenses, balance and counts", () => {
  const rows = [
    tx({ type: "income", amount: 50000, category: "Salary" }),
    tx({ type: "income", amount: 5000, category: "Freelance" }),
    tx({ type: "expense", amount: 1200.5 }),
    tx({ type: "expense", amount: 300.25 }),
  ];

  assert.deepEqual(calculateTotals(rows), {
    income: 55000,
    expense: 1500.75,
    balance: 53499.25,
    incomeCount: 2,
    expenseCount: 2,
  });
});

test("calculateTotals is zeroed for an empty list", () => {
  assert.deepEqual(calculateTotals([]), {
    income: 0,
    expense: 0,
    balance: 0,
    incomeCount: 0,
    expenseCount: 0,
  });
});

test("calculateTotals avoids floating point drift across many small amounts", () => {
  const rows = Array.from({ length: 10 }, () => tx({ type: "expense", amount: 0.1 }));
  assert.equal(calculateTotals(rows).expense, 1);
  assert.equal(calculateTotals(rows).balance, -1);
});

test("balance goes negative when expenses outrun income", () => {
  const rows = [
    tx({ type: "income", amount: 100, category: "Salary" }),
    tx({ type: "expense", amount: 400 }),
  ];
  assert.equal(calculateTotals(rows).balance, -300);
});

/* ---------- Filtering ---------- */

test("matchesFilters narrows by type, category and month", () => {
  const row = tx({ type: "expense", category: "Groceries", date: "2026-04-10" });
  const base = { ...DEFAULT_FILTERS };

  assert.equal(matchesFilters(row, base), true);
  assert.equal(matchesFilters(row, { ...base, type: "expense" }), true);
  assert.equal(matchesFilters(row, { ...base, type: "income" }), false);
  assert.equal(matchesFilters(row, { ...base, category: "Groceries" }), true);
  assert.equal(matchesFilters(row, { ...base, category: "Rent" }), false);
  assert.equal(matchesFilters(row, { ...base, month: "2026-04" }), true);
  assert.equal(matchesFilters(row, { ...base, month: "2026-05" }), false);
});

test("search matches description and category, case-insensitively", () => {
  const row = tx({ description: "Weekly groceries", category: "Groceries" });
  const base = { ...DEFAULT_FILTERS };

  assert.equal(matchesFilters(row, { ...base, search: "weekly" }), true);
  assert.equal(matchesFilters(row, { ...base, search: "GROCER" }), true);
  assert.equal(matchesFilters(row, { ...base, search: "rent" }), false);
});

test("filters combine rather than override one another", () => {
  const rows = [
    tx({ id: "a", type: "expense", category: "Groceries", description: "Market run" }),
    tx({ id: "b", type: "expense", category: "Rent", description: "Market rent" }),
    tx({ id: "c", type: "income", category: "Salary", description: "Market bonus" }),
  ];

  const visible = visibleTransactions(
    rows,
    { ...DEFAULT_FILTERS, type: "expense", category: "Groceries", search: "market" },
    "date-desc"
  );
  assert.deepEqual(visible.map((t) => t.id), ["a"]);
});

test("visibleTransactions leaves the source array untouched", () => {
  const rows = [tx({ id: "a", type: "income", category: "Salary" }), tx({ id: "b" })];
  const before = rows.map((t) => t.id);

  visibleTransactions(rows, { ...DEFAULT_FILTERS, type: "expense" }, "amount-desc");
  assert.deepEqual(rows.map((t) => t.id), before, "filtering never mutates or deletes");
});

test("hasActiveFilters tracks whether anything is narrowed", () => {
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS }), false);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, search: "tea" }), true);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, type: "income" }), true);
  assert.equal(hasActiveFilters({ ...DEFAULT_FILTERS, month: "2026-01" }), true);
});

test("availableMonths lists only months with transactions, newest first", () => {
  const rows = [
    tx({ date: "2026-01-05" }),
    tx({ date: "2026-03-20" }),
    tx({ date: "2026-03-02" }),
  ];
  assert.deepEqual(availableMonths(rows), ["2026-03", "2026-01"]);
});

/* ---------- Reconciling filters after the data changes ---------- */

test("switching type drops a category belonging to the other type", () => {
  const rows = [tx()];
  const corrected = reconcileFilters(
    { ...DEFAULT_FILTERS, type: "income", category: "Groceries" },
    rows
  );
  assert.equal(corrected.category, "all", "an expense category cannot survive an income filter");
});

test("a category valid for the selected type is kept", () => {
  const corrected = reconcileFilters(
    { ...DEFAULT_FILTERS, type: "expense", category: "Groceries" },
    [tx()]
  );
  assert.equal(corrected.category, "Groceries");
});

test("a month filter is dropped once its last transaction is gone", () => {
  const old = monthsAgo(2);
  const filters = { ...DEFAULT_FILTERS, month: monthKey(old) };

  assert.equal(reconcileFilters(filters, [tx({ date: old })]).month, monthKey(old));
  assert.equal(reconcileFilters(filters, [tx({ date: TODAY })]).month, "all");
});

/* ---------- Sorting ---------- */

test("sortTransactions orders by date, newest first by default", () => {
  const rows = [
    tx({ id: "mid", date: daysAgo(5) }),
    tx({ id: "new", date: TODAY }),
    tx({ id: "old", date: daysAgo(30) }),
  ];
  assert.deepEqual(sortTransactions(rows, "date-desc").map((t) => t.id), ["new", "mid", "old"]);
  assert.deepEqual(sortTransactions(rows, "date-asc").map((t) => t.id), ["old", "mid", "new"]);
});

test("same-day transactions fall back to newest created first", () => {
  const rows = [
    tx({ id: "first", date: TODAY, createdAt: 1000 }),
    tx({ id: "second", date: TODAY, createdAt: 2000 }),
  ];
  assert.deepEqual(sortTransactions(rows, "date-desc").map((t) => t.id), ["second", "first"]);
});

test("amount sorts order by value in both directions", () => {
  const rows = [
    tx({ id: "mid", amount: 500 }),
    tx({ id: "big", amount: 9000 }),
    tx({ id: "small", amount: 50 }),
  ];
  assert.deepEqual(sortTransactions(rows, "amount-desc").map((t) => t.id), ["big", "mid", "small"]);
  assert.deepEqual(sortTransactions(rows, "amount-asc").map((t) => t.id), ["small", "mid", "big"]);
});

test("sortTransactions does not mutate the array it is given", () => {
  const rows = [tx({ id: "a", date: daysAgo(10) }), tx({ id: "b", date: TODAY })];
  const before = rows.map((t) => t.id);

  sortTransactions(rows, "date-desc");
  assert.deepEqual(rows.map((t) => t.id), before);
});

test("an unknown sort mode falls back to newest first", () => {
  const rows = [tx({ id: "a", date: daysAgo(3) }), tx({ id: "b", date: TODAY })];
  const visible = visibleTransactions(rows, { ...DEFAULT_FILTERS }, "nonsense");
  assert.deepEqual(visible.map((t) => t.id), ["b", "a"]);
});
