/* =========================================================
   shared/serializer.js — CSV export, JSON backup and import parsing.

   Pure string in, string or object out. The browser-specific
   download and file-reading bits live in the client's
   lib/download.js, so everything here is unit tested in Node.
   ========================================================= */

import { roundMoney, uid } from "./utils.js";
import { cleanText, validateBudget, validateTransaction } from "./validation.js";
import { isValidType } from "./categories.js";

export const IMPORT_LIMITS = {
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2 MB
  MAX_ITEMS: 5000,
};

const CSV_HEADER = ["Date", "Type", "Category", "Description", "Amount"];

/** CSV with a header row; values are quoted so commas and quotes are safe. */
export function toCSV(transactions) {
  const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
  // Prefix cells a spreadsheet could otherwise execute as a formula.
  const neutralise = (v) => (/^[=+\-@]/.test(v) ? `'${v}` : v);

  const rows = transactions.map((t) =>
    [
      t.date,
      t.type,
      t.category,
      neutralise(t.description),
      (t.type === "expense" ? -t.amount : t.amount).toFixed(2),
    ]
      .map(quote)
      .join(",")
  );

  // Leading BOM so Excel reads the ₹ sign and other UTF-8 text correctly.
  return "﻿" + [CSV_HEADER.map(quote).join(","), ...rows].join("\r\n");
}

export function toBackup(transactions, budget, now = new Date()) {
  return JSON.stringify(
    {
      app: "SpendWise",
      version: 2,
      exportedAt: now.toISOString(),
      budget: budget || 0,
      transactions,
    },
    null,
    2
  );
}

/** Check the file itself before reading it. Returns an error message or "". */
export function checkFile(file) {
  if (!file) return "No file selected.";
  if (!/\.json$/i.test(file.name)) return "Please choose a .json backup file exported from this app.";
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > IMPORT_LIMITS.MAX_FILE_SIZE) return "The file is too large (max 2 MB).";
  return "";
}

/**
 * Parse and validate a backup. Every transaction is checked with the same
 * rules as the form; invalid ones are skipped and counted.
 * @returns {{transactions: object[], budget: number, skipped: number} | {error: string}}
 */
export function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    return { error: "This file isn't valid JSON." };
  }

  const list = Array.isArray(data)
    ? data
    : data && Array.isArray(data.transactions)
      ? data.transactions
      : null;

  if (!list) return { error: "No transactions found in this file." };
  if (list.length > IMPORT_LIMITS.MAX_ITEMS) {
    return { error: `Too many transactions (max ${IMPORT_LIMITS.MAX_ITEMS}).` };
  }

  const transactions = [];
  let skipped = 0;

  for (const item of list) {
    if (!item || typeof item !== "object") {
      skipped++;
      continue;
    }

    const candidate = {
      type: item.type,
      amount: String(item.amount ?? ""),
      category: item.category,
      date: item.date,
      description: cleanText(item.description),
    };

    if (!isValidType(candidate.type) || Object.keys(validateTransaction(candidate)).length) {
      skipped++;
      continue;
    }

    transactions.push({
      id: typeof item.id === "string" && item.id ? item.id : uid(),
      type: candidate.type,
      amount: roundMoney(candidate.amount),
      category: candidate.category,
      date: candidate.date,
      description: candidate.description,
      createdAt: Number(item.createdAt) || Date.now(),
    });
  }

  const budget =
    data && !Array.isArray(data) && !validateBudget(String(data.budget ?? "")) ? Number(data.budget) : 0;

  return { transactions, budget, skipped };
}
