/* =========================================================
   controllers/transaction.controller.js

   Every write runs shared/validation.js before it reaches
   MongoDB, so a request made with curl is held to exactly the
   same rules as the React form.
   ========================================================= */

import { Transaction } from "../models/transaction.model.js";
import { ApiError, asyncHandler } from "../middleware/error-handler.js";
import { normaliseTransaction, validateTransaction } from "../../../shared/validation.js";
import { isValidType } from "../../../shared/categories.js";
import { calculateTotals } from "../../../shared/insights.js";
import { planImport } from "../../../shared/merge.js";

/** Throw a 400 carrying per-field messages if the payload is invalid. */
function assertValid(body) {
  if (!isValidType(body?.type)) {
    throw new ApiError(400, "Please fix the highlighted fields.", {
      type: "Type must be income or expense.",
    });
  }

  // The validators expect the amount as typed, i.e. a string.
  const candidate = { ...body, amount: String(body.amount ?? "") };
  const errors = validateTransaction(candidate);

  if (Object.keys(errors).length) {
    throw new ApiError(400, "Please fix the highlighted fields.", errors);
  }
  return normaliseTransaction(candidate);
}

/** GET /api/transactions — newest first, with the totals alongside. */
export const listTransactions = asyncHandler(async (req, res) => {
  const docs = await Transaction.find({}).sort({ date: -1, createdAt: -1 });
  const transactions = docs.map((doc) => doc.toJSON());

  res.json({ transactions, totals: calculateTotals(transactions) });
});

/** POST /api/transactions */
export const createTransaction = asyncHandler(async (req, res) => {
  const data = assertValid(req.body);
  const created = await Transaction.create(data);

  res.status(201).json(created.toJSON());
});

/** PUT /api/transactions/:id */
export const updateTransaction = asyncHandler(async (req, res) => {
  const data = assertValid(req.body);
  const updated = await Transaction.findByIdAndUpdate(req.params.id, data, {
    new: true,
    runValidators: true,
  });

  if (!updated) throw new ApiError(404, "That transaction no longer exists.");
  res.json(updated.toJSON());
});

/** DELETE /api/transactions/:id */
export const deleteTransaction = asyncHandler(async (req, res) => {
  const removed = await Transaction.findByIdAndDelete(req.params.id);
  if (!removed) throw new ApiError(404, "That transaction no longer exists.");

  // Return the deleted document so the client can offer Undo without re-fetching.
  res.json({ deleted: removed.toJSON() });
});

/**
 * POST /api/transactions/restore — re-create a transaction after an Undo.
 * Separate from create so the client's intent is explicit in the API.
 */
export const restoreTransaction = asyncHandler(async (req, res) => {
  const data = assertValid(req.body);
  const created = await Transaction.create(data);

  res.status(201).json(created.toJSON());
});

/**
 * POST /api/transactions/import — merge a parsed backup.
 * The client validates the file with shared/serializer.js; this re-checks
 * every row and skips anything already present.
 */
export const importTransactions = asyncHandler(async (req, res) => {
  const incoming = Array.isArray(req.body?.transactions) ? req.body.transactions : null;
  if (!incoming) throw new ApiError(400, "No transactions were sent.");

  const existingDocs = await Transaction.find({});
  const existing = existingDocs.map((doc) => doc.toJSON());

  // The decision of what to insert lives in shared/merge.js, where it is
  // unit tested without needing a database.
  const { toInsert, duplicates, skipped } = planImport(incoming, existing);

  if (toInsert.length) await Transaction.insertMany(toInsert);

  res.json({ added: toInsert.length, duplicates, skipped });
});

/** DELETE /api/transactions — clear everything. */
export const clearTransactions = asyncHandler(async (req, res) => {
  const result = await Transaction.deleteMany({});
  res.json({ deleted: result.deletedCount });
});
