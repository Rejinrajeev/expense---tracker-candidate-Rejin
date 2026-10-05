/* =========================================================
   shared/utils.js — pure formatting and date helpers.

   Imported by BOTH the Express server and the React client, so
   money is rounded and dates are keyed identically on each side.
   No DOM, no Node APIs: safe to unit test and safe to bundle.
   ========================================================= */

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatCurrency(value) {
  return currencyFormatter.format(value || 0);
}

/** Compact currency for chart labels, e.g. ₹12.5K */
export function formatCompact(value) {
  const abs = Math.abs(value);
  if (abs >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
  if (abs >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
  if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
  return `₹${Math.round(value)}`;
}

/** Parse a YYYY-MM-DD string as a local date (avoids timezone shifts). */
export function parseDate(iso) {
  const [y, m, d] = String(iso).split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Format a Date as YYYY-MM-DD in local time. */
export function toISODate(date) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Today's date as YYYY-MM-DD in local time. */
export function todayISO() {
  return toISODate(new Date());
}

export function formatDate(iso, options = { day: "numeric", month: "short", year: "numeric" }) {
  return parseDate(iso).toLocaleDateString("en-IN", options);
}

/** Friendly label for grouping: Today, Yesterday or a full date. */
export function friendlyDate(iso) {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (iso === todayISO()) return "Today";
  if (iso === toISODate(yesterday)) return "Yesterday";
  return formatDate(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
}

/** YYYY-MM key for a date string. */
export function monthKey(iso) {
  return String(iso).slice(0, 7);
}

export function monthLabel(key, opts = { month: "long", year: "numeric" }) {
  const [y, m] = String(key).split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", opts);
}

export function uid() {
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

/** Round to 2 decimal places — money must never carry float noise. */
export function roundMoney(value) {
  return Math.round(Number(value) * 100) / 100;
}

/**
 * Escape HTML entities. React escapes its own output, so this is only used
 * where we build markup by hand (none, currently) and by the unit tests.
 */
export function escapeHTML(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "1 transaction" / "2 transactions" */
export function plural(count, word, suffix = "s") {
  return `${count} ${word}${count === 1 ? "" : suffix}`;
}
