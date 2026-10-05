/* =========================================================
   shared/merge.js — planning a backup import.

   Decides which rows of an uploaded backup should actually be
   inserted. Kept out of the Express controller so the rules are
   unit testable without a database: the controller just calls
   planImport() and inserts what it returns.
   ========================================================= */

import { findDuplicate, normaliseTransaction, validateTransaction } from "./validation.js";
import { isValidType } from "./categories.js";

/**
 * @param {object[]} incoming rows from the uploaded backup
 * @param {object[]} existing transactions already stored
 * @returns {{toInsert: object[], duplicates: number, skipped: number}}
 *   `skipped` counts rows that broke a validation rule, `duplicates` counts
 *   rows that match something already stored or already queued.
 */
export function planImport(incoming, existing = []) {
  const toInsert = [];
  let duplicates = 0;
  let skipped = 0;

  for (const item of Array.isArray(incoming) ? incoming : []) {
    if (!item || typeof item !== "object") {
      skipped++;
      continue;
    }

    // The validators expect the amount as typed, i.e. a string.
    const candidate = { ...item, amount: String(item.amount ?? "") };

    if (!isValidType(candidate.type) || Object.keys(validateTransaction(candidate)).length) {
      skipped++;
      continue;
    }

    const normalised = normaliseTransaction(candidate);

    // Compare against what is already stored AND what this same file has
    // already queued, so a backup listing one row twice inserts it once.
    if (isDuplicateOf(normalised, existing) || isDuplicateOf(normalised, toInsert)) {
      duplicates++;
      continue;
    }

    toInsert.push(normalised);
  }

  return { toInsert, duplicates, skipped };
}

/**
 * findDuplicate skips rows whose id matches `ignoreId` (null here), so give
 * every candidate a distinct placeholder id to compare purely on content.
 */
function isDuplicateOf(candidate, list) {
  const withIds = list.map((t, index) => ({ ...t, id: t.id ?? `pending-${index}` }));
  return Boolean(findDuplicate(candidate, withIds));
}
