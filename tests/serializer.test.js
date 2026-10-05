import { test } from "node:test";
import assert from "node:assert/strict";

import {
  checkFile,
  IMPORT_LIMITS,
  parseBackup,
  toBackup,
  toCSV,
} from "../shared/serializer.js";
import { daysAgo, TODAY, tx } from "./helpers.js";
import { toISODate } from "../shared/utils.js";

/* ---------- CSV export ---------- */

test("toCSV writes a header row and one row per transaction", () => {
  const csv = toCSV([tx({ date: "2026-10-01", category: "Groceries", description: "Market", amount: 250 })]);
  const lines = csv.split("\r\n");

  assert.equal(lines.length, 2);
  assert.equal(lines[0].replace("﻿", ""), `"Date","Type","Category","Description","Amount"`);
  assert.equal(lines[1], `"2026-10-01","expense","Groceries","Market","-250.00"`);
});

test("toCSV starts with a BOM so Excel reads UTF-8 correctly", () => {
  assert.ok(toCSV([]).startsWith("﻿"));
});

test("toCSV signs expenses negative and income positive", () => {
  const csv = toCSV([
    tx({ type: "income", amount: 5000, category: "Salary", description: "Pay" }),
    tx({ type: "expense", amount: 5000, description: "Rent" }),
  ]);
  assert.match(csv, /"5000\.00"/);
  assert.match(csv, /"-5000\.00"/);
});

test("toCSV escapes embedded quotes and keeps commas inside one cell", () => {
  const csv = toCSV([tx({ description: `Dinner, "the usual" place` })]);
  assert.match(csv, /"Dinner, ""the usual"" place"/);
});

test("toCSV neutralises spreadsheet formula injection", () => {
  // A description beginning with = + - or @ must not execute when opened in Excel.
  for (const dangerous of ["=1+1", "+1", "-1", "@SUM(A1)"]) {
    const csv = toCSV([tx({ description: dangerous })]);
    assert.match(csv, new RegExp(`"'\\${dangerous[0]}`), `${dangerous} was not neutralised`);
  }
});

test("toCSV of an empty list is just the header", () => {
  assert.equal(toCSV([]).split("\r\n").length, 1);
});

/* ---------- JSON backup ---------- */

test("toBackup records the app, version, budget and transactions", () => {
  const data = JSON.parse(toBackup([tx({ id: "a" })], 25000, new Date("2026-10-05T10:00:00Z")));

  assert.equal(data.app, "SpendWise");
  // Bumped to 2 when storage moved from Local Storage to MongoDB.
  // parseBackup still accepts a version 1 file, which the next test covers.
  assert.equal(data.version, 2);
  assert.equal(data.budget, 25000);
  assert.equal(data.exportedAt, "2026-10-05T10:00:00.000Z");
  assert.equal(data.transactions.length, 1);
});

test("a version 1 backup from the old Local Storage app still imports", () => {
  const legacy = JSON.stringify({
    app: "SpendWise",
    version: 1,
    exportedAt: "2026-01-01T00:00:00.000Z",
    budget: 25000,
    transactions: [tx({ id: "legacy", description: "Old row", amount: 150 })],
  });

  const result = parseBackup(legacy);
  assert.equal(result.error, undefined);
  assert.equal(result.transactions.length, 1);
  assert.equal(result.transactions[0].description, "Old row");
  assert.equal(result.budget, 25000);
});

test("toBackup writes zero when no budget is set", () => {
  assert.equal(JSON.parse(toBackup([], 0)).budget, 0);
  assert.equal(JSON.parse(toBackup([], null)).budget, 0);
});

test("a backup survives a full export-import round trip", () => {
  const original = [
    tx({ id: "a", type: "income", amount: 50000, category: "Salary", description: "Salary" }),
    tx({ id: "b", type: "expense", amount: 1200.55, category: "Groceries", description: "Market" }),
  ];
  const result = parseBackup(toBackup(original, 25000));

  assert.equal(result.skipped, 0);
  assert.equal(result.budget, 25000);
  assert.deepEqual(
    result.transactions.map((t) => [t.id, t.type, t.amount, t.category, t.description]),
    original.map((t) => [t.id, t.type, t.amount, t.category, t.description])
  );
});

/* ---------- Import validation ---------- */

test("parseBackup rejects text that is not JSON", () => {
  assert.match(parseBackup("not json at all").error, /isn't valid JSON/i);
  assert.match(parseBackup("").error, /isn't valid JSON/i);
});

test("parseBackup rejects JSON with no transaction list", () => {
  assert.match(parseBackup(`{"hello":"world"}`).error, /No transactions found/i);
  assert.match(parseBackup(`"a string"`).error, /No transactions found/i);
});

test("parseBackup also accepts a bare array of transactions", () => {
  const result = parseBackup(JSON.stringify([tx({ id: "a" })]));
  assert.equal(result.transactions.length, 1);
  assert.equal(result.budget, 0);
});

test("parseBackup refuses a file with too many transactions", () => {
  const huge = JSON.stringify(Array.from({ length: IMPORT_LIMITS.MAX_ITEMS + 1 }, () => tx()));
  assert.match(parseBackup(huge).error, /Too many transactions/i);
});

test("parseBackup skips invalid rows and keeps the good ones", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const result = parseBackup(
    JSON.stringify([
      tx({ id: "good", date: TODAY }),
      tx({ id: "bad-type", type: "transfer" }),
      tx({ id: "bad-amount", amount: -5 }),
      tx({ id: "bad-category", category: "Nonexistent" }),
      tx({ id: "bad-date", date: toISODate(tomorrow) }),
      tx({ id: "bad-desc", description: "x" }),
      null,
      "garbage",
      { id: "empty" },
    ])
  );

  assert.deepEqual(result.transactions.map((t) => t.id), ["good"]);
  assert.equal(result.skipped, 8);
});

test("parseBackup generates an id for a row that has none", () => {
  const { id, ...withoutId } = tx();
  const result = parseBackup(JSON.stringify([withoutId]));

  assert.equal(result.transactions.length, 1);
  assert.ok(result.transactions[0].id.length > 0);
});

test("parseBackup cleans up messy descriptions on the way in", () => {
  const result = parseBackup(
    JSON.stringify([tx({ amount: 99.5, description: "  messy   text  ", date: daysAgo(2) })])
  );

  assert.equal(result.transactions[0].amount, 99.5);
  assert.equal(result.transactions[0].description, "messy text");
});

test("parseBackup skips amounts carrying more than two decimals", () => {
  // The importer applies the form's own rules, so sub-paise amounts are
  // rejected rather than silently rounded into the user's data.
  const result = parseBackup(JSON.stringify([tx({ amount: 99.999 })]));

  assert.deepEqual(result.transactions, []);
  assert.equal(result.skipped, 1);
});

test("parseBackup ignores an invalid budget rather than importing it", () => {
  assert.equal(parseBackup(JSON.stringify({ budget: -5, transactions: [] })).budget, 0);
  assert.equal(parseBackup(JSON.stringify({ budget: "abc", transactions: [] })).budget, 0);
  assert.equal(parseBackup(JSON.stringify({ budget: 1000, transactions: [] })).budget, 1000);
});

/* ---------- File pre-checks ---------- */

test("checkFile accepts a reasonable .json file", () => {
  assert.equal(checkFile({ name: "backup.json", size: 2048 }), "");
  assert.equal(checkFile({ name: "BACKUP.JSON", size: 10 }), "", "the extension check is case-insensitive");
});

test("checkFile rejects a missing, wrong, empty or oversized file", () => {
  assert.match(checkFile(null), /No file selected/i);
  assert.match(checkFile({ name: "data.csv", size: 10 }), /\.json backup file/i);
  assert.match(checkFile({ name: "backup.json", size: 0 }), /empty/i);
  assert.match(
    checkFile({ name: "backup.json", size: IMPORT_LIMITS.MAX_FILE_SIZE + 1 }),
    /too large/i
  );
});
