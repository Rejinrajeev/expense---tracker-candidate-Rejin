import { test } from "node:test";
import assert from "node:assert/strict";

import {
  categoryBreakdown,
  lastMonths,
  monthlySummary,
  MONTHS_SHOWN,
  totalsByMonth,
} from "../shared/insights.js";
import { tx } from "./helpers.js";

/* ---------- Month windows ---------- */

test("lastMonths returns six keys ending with the current month", () => {
  const keys = lastMonths(MONTHS_SHOWN, new Date(2026, 9, 5)); // October 2026
  assert.deepEqual(keys, ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09", "2026-10"]);
});

test("lastMonths crosses the year boundary correctly", () => {
  assert.deepEqual(lastMonths(3, new Date(2026, 1, 10)), ["2025-12", "2026-01", "2026-02"]);
});

/* ---------- Monthly totals ---------- */

test("totalsByMonth groups income and expenses per month", () => {
  const totals = totalsByMonth([
    tx({ type: "income", amount: 5000, category: "Salary", date: "2026-03-01" }),
    tx({ type: "expense", amount: 1200, date: "2026-03-15" }),
    tx({ type: "expense", amount: 800, date: "2026-03-20" }),
    tx({ type: "expense", amount: 300, date: "2026-04-02" }),
  ]);

  assert.deepEqual(totals["2026-03"], { income: 5000, expense: 2000 });
  assert.deepEqual(totals["2026-04"], { income: 0, expense: 300 });
  assert.equal(totals["2026-05"], undefined, "months with no activity are absent");
});

test("totalsByMonth rounds away floating point drift", () => {
  const totals = totalsByMonth([
    tx({ type: "expense", amount: 0.1, date: "2026-03-01" }),
    tx({ type: "expense", amount: 0.2, date: "2026-03-02" }),
  ]);
  assert.equal(totals["2026-03"].expense, 0.3);
});

/* ---------- Monthly summary for the bar chart ---------- */

test("monthlySummary scales bar heights against the largest value", () => {
  const months = ["2026-09", "2026-10"];
  const summary = monthlySummary(
    [
      tx({ type: "income", amount: 1000, category: "Salary", date: "2026-10-01" }),
      tx({ type: "expense", amount: 500, date: "2026-10-02" }),
    ],
    months
  );

  const october = summary.bars.at(-1);
  assert.equal(october.incomeHeight, 100, "the largest value fills the chart");
  assert.equal(october.expenseHeight, 50);
  assert.equal(october.isCurrent, true, "the last month is marked current");
  assert.equal(summary.bars[0].incomeHeight, 0, "an empty month draws nothing");
});

test("monthlySummary never divides by zero on an empty store", () => {
  const summary = monthlySummary([], ["2026-09", "2026-10"]);
  assert.equal(summary.bars.length, 2);
  assert.ok(summary.bars.every((b) => b.incomeHeight === 0 && b.expenseHeight === 0));
  assert.equal(summary.net, 0);
  assert.equal(summary.trend, null);
});

test("monthlySummary reports net savings for the current month", () => {
  const summary = monthlySummary(
    [
      tx({ type: "income", amount: 5000, category: "Salary", date: "2026-10-01" }),
      tx({ type: "expense", amount: 1250.5, date: "2026-10-02" }),
    ],
    ["2026-09", "2026-10"]
  );
  assert.equal(summary.net, 3749.5);
});

test("monthlySummary works out the month-over-month spending trend", () => {
  const rows = [
    tx({ type: "expense", amount: 1000, date: "2026-09-10" }),
    tx({ type: "expense", amount: 1500, date: "2026-10-10" }),
  ];
  const up = monthlySummary(rows, ["2026-09", "2026-10"]);
  assert.deepEqual(up.trend, { change: 50, direction: "up" });

  const down = monthlySummary(
    [
      tx({ type: "expense", amount: 1000, date: "2026-09-10" }),
      tx({ type: "expense", amount: 400, date: "2026-10-10" }),
    ],
    ["2026-09", "2026-10"]
  );
  assert.deepEqual(down.trend, { change: -60, direction: "down" });
});

test("monthlySummary reports a flat trend for identical spending", () => {
  const rows = [
    tx({ type: "expense", amount: 900, date: "2026-09-10" }),
    tx({ type: "expense", amount: 900, date: "2026-10-10" }),
  ];
  assert.deepEqual(monthlySummary(rows, ["2026-09", "2026-10"]).trend, { change: 0, direction: "flat" });
});

test("monthlySummary omits the trend when last month had no spending", () => {
  const rows = [tx({ type: "expense", amount: 900, date: "2026-10-10" })];
  assert.equal(monthlySummary(rows, ["2026-09", "2026-10"]).trend, null);
});

/* ---------- Category breakdown for the donut ---------- */

test("categoryBreakdown totals expenses per category, largest first", () => {
  const { total, slices } = categoryBreakdown([
    tx({ type: "expense", amount: 300, category: "Groceries" }),
    tx({ type: "expense", amount: 200, category: "Groceries" }),
    tx({ type: "expense", amount: 1500, category: "Rent" }),
  ]);

  assert.equal(total, 2000);
  assert.deepEqual(
    slices.map((s) => [s.name, s.amount, s.percent]),
    [
      ["Rent", 1500, 75],
      ["Groceries", 500, 25],
    ]
  );
  assert.equal(slices.length, 2, "repeated categories are merged");
});

test("categoryBreakdown excludes income entirely", () => {
  const { total, slices } = categoryBreakdown([
    tx({ type: "income", amount: 90000, category: "Salary" }),
    tx({ type: "expense", amount: 100, category: "Groceries" }),
  ]);

  assert.equal(total, 100);
  assert.deepEqual(slices.map((s) => s.name), ["Groceries"]);
});

test("categoryBreakdown can be narrowed to one month", () => {
  const rows = [
    tx({ type: "expense", amount: 100, category: "Groceries", date: "2026-09-10" }),
    tx({ type: "expense", amount: 400, category: "Rent", date: "2026-10-01" }),
  ];

  assert.equal(categoryBreakdown(rows, "all").total, 500);
  assert.equal(categoryBreakdown(rows, "2026-10").total, 400);
  assert.deepEqual(categoryBreakdown(rows, "2026-10").slices.map((s) => s.name), ["Rent"]);
});

test("categoryBreakdown returns an empty result rather than NaN", () => {
  assert.deepEqual(categoryBreakdown([]), { total: 0, slices: [] });
  assert.deepEqual(categoryBreakdown([tx({ type: "income", category: "Salary" })]), {
    total: 0,
    slices: [],
  });
});

test("categoryBreakdown percentages add up to 100", () => {
  const { slices } = categoryBreakdown([
    tx({ type: "expense", amount: 333, category: "Groceries" }),
    tx({ type: "expense", amount: 333, category: "Rent" }),
    tx({ type: "expense", amount: 334, category: "Transport" }),
  ]);
  const sum = slices.reduce((s, x) => s + x.percent, 0);
  assert.ok(Math.abs(sum - 100) < 1e-9, `percentages summed to ${sum}`);
});

test("categoryBreakdown carries the icon and colour the chart needs", () => {
  const { slices } = categoryBreakdown([tx({ type: "expense", amount: 10, category: "Groceries" })]);
  assert.equal(slices[0].icon, "🛒");
  assert.match(slices[0].color, /^#[0-9a-f]{6}$/i);
});

test("categoryBreakdown falls back gracefully for an unknown category", () => {
  const { slices } = categoryBreakdown([tx({ type: "expense", amount: 10, category: "Legacy Name" })]);
  assert.equal(slices[0].name, "Legacy Name");
  assert.equal(slices[0].icon, "🏷️", "unknown categories still render");
});
