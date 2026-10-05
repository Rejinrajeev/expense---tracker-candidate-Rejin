/* =========================================================
   models/transaction.model.js — the Mongoose schema.

   Schema-level rules mirror shared/validation.js. The controller
   runs the shared validators first (so the client gets the same
   friendly messages), and these constraints are the backstop that
   also applies to anything written outside the API.
   ========================================================= */

import mongoose from "mongoose";
import { ALL_CATEGORY_NAMES, TYPES } from "../../../shared/categories.js";
import { LIMITS } from "../../../shared/validation.js";

const transactionSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      required: [true, "Type is required."],
      enum: { values: TYPES, message: "Type must be income or expense." },
    },
    amount: {
      type: Number,
      required: [true, "Amount is required."],
      min: [0.01, "Amount must be greater than zero."],
      max: [LIMITS.MAX_AMOUNT, "Amount is above the allowed maximum."],
    },
    category: {
      type: String,
      required: [true, "Category is required."],
      enum: { values: ALL_CATEGORY_NAMES, message: "Unknown category." },
    },
    /**
     * Stored as a YYYY-MM-DD string rather than a Date, deliberately: the
     * month-keying and chart aggregation in shared/insights.js work on these
     * strings, and a Date would introduce timezone drift between the server
     * and the browser for transactions entered late at night.
     */
    date: {
      type: String,
      required: [true, "Date is required."],
      match: [/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format."],
    },
    description: {
      type: String,
      required: [true, "Description is required."],
      trim: true,
      minlength: [LIMITS.DESC_MIN, `Description must be at least ${LIMITS.DESC_MIN} characters.`],
      maxlength: [LIMITS.DESC_MAX, `Description can't exceed ${LIMITS.DESC_MAX} characters.`],
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform(_doc, ret) {
        // The client and the shared code work with `id`, not `_id`.
        ret.id = String(ret._id);
        delete ret._id;
        delete ret.__v;
        // shared/transaction sorting compares createdAt numerically, so send
        // milliseconds rather than an ISO string (which would subtract to NaN).
        if (ret.createdAt) ret.createdAt = new Date(ret.createdAt).getTime();
        if (ret.updatedAt) ret.updatedAt = new Date(ret.updatedAt).getTime();
        return ret;
      },
    },
  }
);

// The list is always read newest-first by date; this backs that query.
transactionSchema.index({ date: -1, createdAt: -1 });

export const Transaction = mongoose.model("Transaction", transactionSchema);
