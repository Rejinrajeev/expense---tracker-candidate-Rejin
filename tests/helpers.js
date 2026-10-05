/* =========================================================
   tests/helpers.js — shared fixtures for the unit tests.

   The tests cover shared/, the domain layer used by BOTH the
   Express server and the React client. Nothing here needs a
   database, a browser or a running server.
   ========================================================= */

import { toISODate, todayISO } from "../shared/utils.js";

/** A date N days before today, as YYYY-MM-DD. Keeps fixtures out of the future. */
export function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return toISODate(d);
}

/** First day of the month N months before this one. */
export function monthsAgo(n) {
  const now = new Date();
  return toISODate(new Date(now.getFullYear(), now.getMonth() - n, 1));
}

export const TODAY = todayISO();

/** A valid request payload; override any field. */
export function payload(overrides = {}) {
  return {
    type: "expense",
    amount: "100",
    category: "Groceries",
    date: TODAY,
    description: "Test transaction",
    ...overrides,
  };
}

/** A stored transaction as the API returns it; override any field. */
export function tx(overrides = {}) {
  return {
    id: overrides.id || `id-${Math.random().toString(36).slice(2, 9)}`,
    type: "expense",
    amount: 100,
    category: "Groceries",
    date: TODAY,
    description: "Test transaction",
    createdAt: 1_700_000_000_000,
    ...overrides,
  };
}

/** A list of transactions, for the filter and sort tests. */
export function txList(...overrides) {
  return overrides.map((o) => tx(o));
}
