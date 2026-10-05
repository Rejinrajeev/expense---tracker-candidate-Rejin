/* =========================================================
   routes/index.js — the API surface, in one readable list.
   ========================================================= */

import { Router } from "express";

import {
  clearTransactions,
  createTransaction,
  deleteTransaction,
  importTransactions,
  listTransactions,
  restoreTransaction,
  updateTransaction,
} from "../controllers/transaction.controller.js";

import { clearBudget, getBudget, updateBudget } from "../controllers/budget.controller.js";

import { CATEGORIES } from "../../../shared/categories.js";

export const router = Router();

/* Transactions */
router.get("/transactions", listTransactions);
router.post("/transactions", createTransaction);
router.delete("/transactions", clearTransactions);
// Declared before "/transactions/:id" so these words are not read as ids.
router.post("/transactions/import", importTransactions);
router.post("/transactions/restore", restoreTransaction);
router.put("/transactions/:id", updateTransaction);
router.delete("/transactions/:id", deleteTransaction);

/* Budget */
router.get("/budget", getBudget);
router.put("/budget", updateBudget);
router.delete("/budget", clearBudget);

/* Reference data, so the client never hard-codes the category list */
router.get("/categories", (req, res) => res.json(CATEGORIES));

/* Liveness check */
router.get("/health", (req, res) => res.json({ status: "ok", time: new Date().toISOString() }));
