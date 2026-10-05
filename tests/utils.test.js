import { test } from "node:test";
import assert from "node:assert/strict";

import {
  escapeHTML,
  formatCompact,
  formatCurrency,
  friendlyDate,
  monthKey,
  monthLabel,
  parseDate,
  plural,
  roundMoney,
  toISODate,
  todayISO,
  uid,
} from "../shared/utils.js";

import { daysAgo, TODAY } from "./helpers.js";

test("formatCurrency renders Indian rupees with two decimals", () => {
  assert.match(formatCurrency(1234.5), /1,234\.50/);
  assert.match(formatCurrency(0), /0\.00/);
  // Indian digit grouping: 1,25,000 rather than 125,000.
  assert.match(formatCurrency(125000), /1,25,000\.00/);
});

test("formatCurrency treats null and undefined as zero", () => {
  assert.equal(formatCurrency(null), formatCurrency(0));
  assert.equal(formatCurrency(undefined), formatCurrency(0));
});

test("formatCompact abbreviates using Indian units", () => {
  assert.equal(formatCompact(500), "₹500");
  assert.equal(formatCompact(1500), "₹1.5K");
  assert.equal(formatCompact(250000), "₹2.5L");
  assert.equal(formatCompact(12000000), "₹1.2Cr");
});

test("formatCompact keeps the sign of negative values", () => {
  assert.equal(formatCompact(-1500), "₹-1.5K");
});

test("parseDate builds a local date, so the day never shifts", () => {
  const d = parseDate("2026-03-15");
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 2); // zero-based March
  assert.equal(d.getDate(), 15);
});

test("toISODate and todayISO round-trip through parseDate", () => {
  assert.equal(toISODate(parseDate("2026-01-09")), "2026-01-09");
  assert.match(todayISO(), /^\d{4}-\d{2}-\d{2}$/);
});

test("friendlyDate labels today and yesterday by name", () => {
  assert.equal(friendlyDate(TODAY), "Today");
  assert.equal(friendlyDate(daysAgo(1)), "Yesterday");
  assert.notEqual(friendlyDate(daysAgo(10)), "Today");
});

test("monthKey slices the year-month and monthLabel reads it back", () => {
  assert.equal(monthKey("2026-07-21"), "2026-07");
  assert.match(monthLabel("2026-07"), /July/);
  assert.match(monthLabel("2026-07", { month: "short" }), /Jul/);
});

test("roundMoney removes floating point noise", () => {
  assert.equal(roundMoney(0.1 + 0.2), 0.3);
  assert.equal(roundMoney("1200.555"), 1200.56);
  assert.equal(roundMoney(19.999), 20);
});

test("escapeHTML neutralises every injection character", () => {
  assert.equal(
    escapeHTML(`<img src=x onerror="alert('x')">`),
    "&lt;img src=x onerror=&quot;alert(&#39;x&#39;)&quot;&gt;"
  );
  assert.equal(escapeHTML("a & b"), "a &amp; b");
});

test("escapeHTML escapes ampersands before anything else", () => {
  // A naive order would turn "&lt;" into "&amp;lt;" twice over.
  assert.equal(escapeHTML("&lt;"), "&amp;lt;");
});

test("plural only adds the suffix beyond one", () => {
  assert.equal(plural(1, "transaction"), "1 transaction");
  assert.equal(plural(0, "transaction"), "0 transactions");
  assert.equal(plural(5, "day"), "5 days");
});

test("uid returns unique non-empty ids", () => {
  const ids = new Set(Array.from({ length: 500 }, uid));
  assert.equal(ids.size, 500);
  assert.ok([...ids].every((id) => typeof id === "string" && id.length > 0));
});
