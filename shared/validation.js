/* =========================================================
   shared/validation.js — field rules with helpful messages.

   The single source of truth for what counts as a valid
   transaction. The React form runs these for instant feedback,
   and the Express controller runs the SAME functions before
   touching MongoDB — so a crafted request cannot bypass a rule
   just because it skipped the UI.

   Every rule returns "" when valid, or the message to show.
   ========================================================= */

import { formatCurrency, parseDate, roundMoney, todayISO } from "./utils.js";
import { categoryExists } from "./categories.js";

export const LIMITS = {
  MAX_AMOUNT: 10000000, // ₹1 crore
  MIN_DATE: "2000-01-01",
  DESC_MIN: 3,
  DESC_MAX: 60,
};

export function validateAmount(value) {
  if (value === "" || value == null) return "Amount is required.";
  if (!/^\d*\.?\d*$/.test(value) || isNaN(Number(value))) return "Amount must be a valid number.";
  const n = Number(value);
  if (n <= 0) return "Amount must be greater than zero.";
  if (n > LIMITS.MAX_AMOUNT) return `Amount can't exceed ${formatCurrency(LIMITS.MAX_AMOUNT)}.`;
  if (!/^\d+(\.\d{1,2})?$/.test(String(value).replace(/^\./, "0."))) return "Use at most 2 decimal places.";
  return "";
}

export function validateCategory(value, type) {
  if (!value) return `Please choose ${type === "income" ? "an income" : "an expense"} category.`;
  if (!categoryExists(type, value)) return "Please choose a valid category.";
  return "";
}

export function validateDate(value) {
  if (!value) return "Date is required.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(parseDate(value))) return "Please enter a valid date.";
  if (value > todayISO()) return "Date can't be in the future.";
  if (value < LIMITS.MIN_DATE) return "Date must be on or after 1 Jan 2000.";
  return "";
}

export function validateDescription(value) {
  if (!value) return "Description is required.";
  if (value.length < LIMITS.DESC_MIN) return `Description must be at least ${LIMITS.DESC_MIN} characters.`;
  if (value.length > LIMITS.DESC_MAX) return `Description can't exceed ${LIMITS.DESC_MAX} characters.`;
  if (!/[\p{L}\p{N}]/u.test(value)) return "Description must contain letters or numbers.";
  return "";
}

export function validateBudget(value) {
  if (value === "" || value == null) return "Enter a budget amount.";
  const n = Number(value);
  if (isNaN(n)) return "Budget must be a valid number.";
  if (n <= 0) return "Budget must be greater than zero.";
  if (n > LIMITS.MAX_AMOUNT) return `Budget can't exceed ${formatCurrency(LIMITS.MAX_AMOUNT)}.`;
  if (!/^\d+(\.\d{1,2})?$/.test(String(value))) return "Use at most 2 decimal places.";
  return "";
}

/** Rule lookup used by the React form for per-field blur checks. */
export const FIELD_RULES = {
  amount: (data) => validateAmount(data.amount),
  category: (data) => validateCategory(data.category, data.type),
  date: (data) => validateDate(data.date),
  description: (data) => validateDescription(data.description),
};

export const FIELDS = Object.keys(FIELD_RULES);

/** Normalise free text: trim and collapse repeated whitespace. */
export function cleanText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

/** Validate a whole payload; returns { field: message } for invalid fields only. */
export function validateTransaction(data) {
  const errors = {};
  for (const field of FIELDS) {
    const message = FIELD_RULES[field](data);
    if (message) errors[field] = message;
  }
  return errors;
}

/** Turn a validated payload into the shape stored in MongoDB. */
export function normaliseTransaction(data) {
  return {
    type: data.type,
    amount: roundMoney(data.amount),
    category: data.category,
    date: data.date,
    description: cleanText(data.description),
  };
}

/** Find an existing transaction with identical details (ignoring the one being edited). */
export function findDuplicate(data, transactions, ignoreId = null) {
  const amount = roundMoney(data.amount);
  const desc = cleanText(data.description).toLowerCase();
  return transactions.find(
    (t) =>
      t.id !== ignoreId &&
      t.type === data.type &&
      t.amount === amount &&
      t.category === data.category &&
      t.date === data.date &&
      t.description.toLowerCase() === desc
  );
}
