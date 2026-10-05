/* =========================================================
   models/budget.model.js — the monthly spending limit.

   There is exactly one budget, so this collection holds a single
   document identified by a fixed key. `getBudget` upserts it, which
   means the API never has to special-case "no budget row yet".
   ========================================================= */

import mongoose from "mongoose";
import { LIMITS } from "../../../shared/validation.js";

const SINGLETON_KEY = "global";

const budgetSchema = new mongoose.Schema(
  {
    key: { type: String, default: SINGLETON_KEY, unique: true, index: true },
    limit: {
      type: Number,
      default: 0,
      min: [0, "Budget cannot be negative."],
      max: [LIMITS.MAX_AMOUNT, "Budget is above the allowed maximum."],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform(_doc, ret) {
        return { limit: ret.limit || 0 };
      },
    },
  }
);

const BudgetDoc = mongoose.model("Budget", budgetSchema);

/** The budget document, created on first access. */
export async function getBudgetDoc() {
  return BudgetDoc.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $setOnInsert: { key: SINGLETON_KEY, limit: 0 } },
    { new: true, upsert: true, runValidators: true }
  );
}

/** The current limit as a number, 0 when none is set. */
export async function getBudgetLimit() {
  const doc = await getBudgetDoc();
  return doc.limit || 0;
}

export async function setBudgetLimit(limit) {
  const doc = await BudgetDoc.findOneAndUpdate(
    { key: SINGLETON_KEY },
    { $set: { limit: limit || 0 } },
    { new: true, upsert: true, runValidators: true }
  );
  return doc.limit || 0;
}

export { BudgetDoc };
