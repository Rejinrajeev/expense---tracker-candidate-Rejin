/* =========================================================
   shared/filters.js — filtering and sorting the transaction list.

   Pure functions over an array, so the React components can derive
   the visible rows with useMemo and the logic stays unit testable.
   ========================================================= */

import { monthKey } from "./utils.js";
import { CATEGORIES } from "./categories.js";

export const DEFAULT_FILTERS = Object.freeze({
  type: "all",
  category: "all",
  month: "all",
  search: "",
});

const FILTER_KEYS = Object.keys(DEFAULT_FILTERS);

export const SORT_MODES = ["date-desc", "date-asc", "amount-desc", "amount-asc"];

/** Newest first, using createdAt to break ties within the same day. */
export function sortByDateDesc(list) {
  return [...list].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1;
    return (b.createdAt || 0) - (a.createdAt || 0);
  });
}

/** Amount sorts keep date-desc as the tie-breaker, so equal amounts stay stable. */
export function sortTransactions(list, mode) {
  const byDate = sortByDateDesc(list);
  switch (mode) {
    case "date-asc":
      return byDate.reverse();
    case "amount-desc":
      return byDate.sort((a, b) => b.amount - a.amount);
    case "amount-asc":
      return byDate.sort((a, b) => a.amount - b.amount);
    default:
      return byDate;
  }
}

export function matchesFilters(t, filters) {
  const query = filters.search.toLowerCase();
  return (
    (filters.type === "all" || t.type === filters.type) &&
    (filters.category === "all" || t.category === filters.category) &&
    (filters.month === "all" || monthKey(t.date) === filters.month) &&
    (!query ||
      t.description.toLowerCase().includes(query) ||
      t.category.toLowerCase().includes(query))
  );
}

/** Filter then sort, in one call. */
export function visibleTransactions(transactions, filters, sort) {
  return sortTransactions(
    transactions.filter((t) => matchesFilters(t, filters)),
    SORT_MODES.includes(sort) ? sort : "date-desc"
  );
}

/** Month keys that actually have transactions, newest first. */
export function availableMonths(transactions) {
  return [...new Set(transactions.map((t) => monthKey(t.date)))].sort().reverse();
}

export function hasActiveFilters(filters) {
  return FILTER_KEYS.some((key) => filters[key] !== DEFAULT_FILTERS[key]);
}

/**
 * Drop filter values that can no longer match: a category that does not
 * belong to the selected type, or a month with no transactions left.
 * Returns a corrected copy.
 */
export function reconcileFilters(filters, transactions) {
  const groups = filters.type === "all" ? ["income", "expense"] : [filters.type];

  const categoryValid =
    filters.category === "all" ||
    groups.some((g) => CATEGORIES[g].some((c) => c.name === filters.category));

  const monthValid = filters.month === "all" || availableMonths(transactions).includes(filters.month);

  return {
    ...filters,
    category: categoryValid ? filters.category : "all",
    month: monthValid ? filters.month : "all",
  };
}
