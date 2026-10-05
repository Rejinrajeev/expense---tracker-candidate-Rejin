import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cleanText,
  findDuplicate,
  LIMITS,
  validateAmount,
  validateBudget,
  validateCategory,
  validateDate,
  validateDescription,
  validateTransaction,
} from "../shared/validation.js";

import { daysAgo, payload, TODAY, tx } from "./helpers.js";
import { toISODate } from "../shared/utils.js";

/* ---------- Amount ---------- */

test("validateAmount accepts positive amounts with up to two decimals", () => {
  for (const value of ["1", "100", "0.01", "1200.55", "9999999"]) {
    assert.equal(validateAmount(value), "", `expected ${value} to be valid`);
  }
});

test("validateAmount rejects empty, zero and negative amounts", () => {
  assert.match(validateAmount(""), /required/i);
  assert.match(validateAmount(null), /required/i);
  assert.match(validateAmount("0"), /greater than zero/i);
  assert.match(validateAmount("-50"), /valid number|greater than zero/i);
});

test("validateAmount rejects non-numeric and scientific notation", () => {
  assert.match(validateAmount("abc"), /valid number/i);
  assert.match(validateAmount("1e5"), /valid number/i);
  assert.match(validateAmount("12.3.4"), /valid number/i);
});

test("validateAmount enforces the two-decimal and ceiling limits", () => {
  assert.match(validateAmount("10.999"), /2 decimal places/i);
  assert.match(validateAmount(String(LIMITS.MAX_AMOUNT + 1)), /can't exceed/i);
  assert.equal(validateAmount(String(LIMITS.MAX_AMOUNT)), "");
});

/* ---------- Category ---------- */

test("validateCategory requires a category from the matching type", () => {
  assert.equal(validateCategory("Groceries", "expense"), "");
  assert.equal(validateCategory("Salary", "income"), "");
  assert.match(validateCategory("", "expense"), /choose an expense category/i);
  assert.match(validateCategory("", "income"), /choose an income category/i);
  // Salary is an income category, so it is invalid for an expense.
  assert.match(validateCategory("Salary", "expense"), /valid category/i);
  assert.match(validateCategory("Made Up", "expense"), /valid category/i);
});

/* ---------- Date ---------- */

test("validateDate accepts today and past dates", () => {
  assert.equal(validateDate(TODAY), "");
  assert.equal(validateDate(daysAgo(365)), "");
  assert.equal(validateDate(LIMITS.MIN_DATE), "");
});

test("validateDate rejects future dates", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  assert.match(validateDate(toISODate(tomorrow)), /future/i);
});

test("validateDate rejects malformed and out-of-range dates", () => {
  assert.match(validateDate(""), /required/i);
  assert.match(validateDate("15-03-2026"), /valid date/i);
  assert.match(validateDate("1999-12-31"), /on or after/i);
});

/* ---------- Description ---------- */

test("validateDescription enforces length bounds", () => {
  assert.equal(validateDescription("Tea"), "");
  assert.match(validateDescription(""), /required/i);
  assert.match(validateDescription("ab"), /at least 3/i);
  assert.match(validateDescription("x".repeat(LIMITS.DESC_MAX + 1)), /can't exceed/i);
});

test("validateDescription requires at least one letter or number", () => {
  assert.match(validateDescription("---"), /letters or numbers/i);
  assert.match(validateDescription("!!!"), /letters or numbers/i);
  // Non-Latin scripts count as letters.
  assert.equal(validateDescription("मुद्रा"), "");
});

/* ---------- Budget ---------- */

test("validateBudget mirrors the amount rules", () => {
  assert.equal(validateBudget("25000"), "");
  assert.match(validateBudget(""), /enter a budget/i);
  assert.match(validateBudget("0"), /greater than zero/i);
  assert.match(validateBudget("abc"), /valid number/i);
  assert.match(validateBudget("10.001"), /2 decimal places/i);
});

/* ---------- cleanText ---------- */

test("cleanText trims and collapses whitespace", () => {
  assert.equal(cleanText("  weekly   groceries \n run "), "weekly groceries run");
  assert.equal(cleanText(null), "");
  assert.equal(cleanText(undefined), "");
});

/* ---------- Whole-form validation ---------- */

test("validateTransaction returns no keys for a valid payload", () => {
  assert.deepEqual(validateTransaction(payload()), {});
});

test("validateTransaction reports every invalid field at once", () => {
  const errors = validateTransaction({
    type: "expense",
    amount: "-1",
    category: "",
    date: "not-a-date",
    description: "x",
  });
  assert.deepEqual(Object.keys(errors).sort(), ["amount", "category", "date", "description"]);
});

/* ---------- Duplicate detection ---------- */

test("findDuplicate matches on every field, ignoring case and spacing", () => {
  const existing = [tx({ id: "a", description: "Weekly groceries", amount: 100 })];
  const hit = findDuplicate(payload({ description: "  weekly   GROCERIES " }), existing);
  assert.equal(hit?.id, "a");
});

test("findDuplicate ignores the transaction currently being edited", () => {
  const existing = [tx({ id: "a" })];
  assert.equal(findDuplicate(payload(), existing, "a"), undefined);
});

test("findDuplicate does not match when any field differs", () => {
  const existing = [tx({ id: "a", amount: 100, category: "Groceries" })];
  assert.equal(findDuplicate(payload({ amount: "101" }), existing), undefined);
  assert.equal(findDuplicate(payload({ category: "Transport" }), existing), undefined);
  assert.equal(findDuplicate(payload({ type: "income" }), existing), undefined);
  assert.equal(findDuplicate(payload({ date: daysAgo(3) }), existing), undefined);
});

test("findDuplicate compares amounts after rounding", () => {
  const existing = [tx({ id: "a", amount: 100.5 })];
  assert.equal(findDuplicate(payload({ amount: "100.504" }), existing)?.id, "a");
});
