/* =========================================================
   The backup import plan — shared/merge.js.

   This is the logic behind POST /api/transactions/import. It is
   tested here without MongoDB, which is the reason planImport()
   lives in shared/ rather than inside the Express controller.

   Consider renaming this file now that Local Storage is gone:
       git mv tests/storage.test.js tests/merge.test.js
   ========================================================= */

import { test } from "node:test";
import assert from "node:assert/strict";

import { planImport } from "../shared/merge.js";
import { daysAgo, TODAY, tx } from "./helpers.js";
import { toISODate } from "../shared/utils.js";

test("planImport queues valid rows that are not already stored", () => {
  const plan = planImport([tx({ description: "Brand new row" })], []);

  assert.equal(plan.toInsert.length, 1);
  assert.equal(plan.duplicates, 0);
  assert.equal(plan.skipped, 0);
  assert.equal(plan.toInsert[0].description, "Brand new row");
});

test("planImport skips a row that already exists in the database", () => {
  const existing = [tx({ id: "a", description: "Weekly groceries", amount: 100 })];
  const plan = planImport([tx({ id: "a", description: "Weekly groceries", amount: 100 })], existing);

  assert.deepEqual(plan.toInsert, []);
  assert.equal(plan.duplicates, 1);
});

test("planImport matches on content, so a changed id is still a duplicate", () => {
  const existing = [tx({ id: "stored", description: "Weekly groceries", amount: 100 })];
  const plan = planImport(
    [tx({ id: "a-completely-different-id", description: "Weekly groceries", amount: 100 })],
    existing
  );

  assert.deepEqual(plan.toInsert, []);
  assert.equal(plan.duplicates, 1);
});

test("planImport inserts a row listed twice in the same file only once", () => {
  const row = { type: "expense", amount: 250, category: "Rent", date: TODAY, description: "Monthly rent" };
  const plan = planImport([row, { ...row }], []);

  assert.equal(plan.toInsert.length, 1, "the second copy is caught against the queue");
  assert.equal(plan.duplicates, 1);
});

test("planImport keeps rows that differ in any single field", () => {
  const existing = [tx({ id: "a", amount: 100, category: "Groceries", date: TODAY })];
  const plan = planImport(
    [
      tx({ amount: 101, category: "Groceries", date: TODAY }),
      tx({ amount: 100, category: "Transport", date: TODAY }),
      tx({ amount: 100, category: "Groceries", date: daysAgo(3) }),
    ],
    existing
  );

  assert.equal(plan.toInsert.length, 3);
  assert.equal(plan.duplicates, 0);
});

test("planImport skips every kind of invalid row and counts them", () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const plan = planImport(
    [
      tx({ description: "The one good row" }),
      tx({ type: "transfer" }),
      tx({ amount: -5 }),
      tx({ amount: 10.999 }),
      tx({ category: "Nonexistent" }),
      tx({ date: toISODate(tomorrow) }),
      tx({ date: "not-a-date" }),
      tx({ description: "x" }),
      null,
      "garbage",
      {},
    ],
    []
  );

  assert.equal(plan.toInsert.length, 1);
  assert.equal(plan.toInsert[0].description, "The one good row");
  assert.equal(plan.skipped, 10);
  assert.equal(plan.duplicates, 0);
});

test("planImport normalises what it queues", () => {
  const plan = planImport(
    [{ type: "expense", amount: "99.5", category: "Groceries", date: TODAY, description: "  messy   text  " }],
    []
  );

  assert.equal(plan.toInsert[0].amount, 99.5, "the amount becomes a number");
  assert.equal(plan.toInsert[0].description, "messy text", "whitespace is collapsed");
});

test("planImport drops the client-supplied id, letting MongoDB assign one", () => {
  const plan = planImport([tx({ id: "client-chosen-id" })], []);
  assert.equal(plan.toInsert[0].id, undefined);
});

test("planImport handles an empty or non-array payload without throwing", () => {
  assert.deepEqual(planImport([], []), { toInsert: [], duplicates: 0, skipped: 0 });
  assert.deepEqual(planImport(null, []), { toInsert: [], duplicates: 0, skipped: 0 });
  assert.deepEqual(planImport(undefined), { toInsert: [], duplicates: 0, skipped: 0 });
});
