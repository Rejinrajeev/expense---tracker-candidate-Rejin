/* =========================================================
   controllers/budget.controller.js — the monthly spending limit.
   ========================================================= */

import { getBudgetLimit, setBudgetLimit } from "../models/budget.model.js";
import { ApiError, asyncHandler } from "../middleware/error-handler.js";
import { validateBudget } from "../../../shared/validation.js";
import { roundMoney } from "../../../shared/utils.js";

/** GET /api/budget */
export const getBudget = asyncHandler(async (req, res) => {
  res.json({ limit: await getBudgetLimit() });
});

/** PUT /api/budget */
export const updateBudget = asyncHandler(async (req, res) => {
  const raw = String(req.body?.limit ?? "");
  const message = validateBudget(raw);

  if (message) throw new ApiError(400, message, { limit: message });

  res.json({ limit: await setBudgetLimit(roundMoney(raw)) });
});

/** DELETE /api/budget */
export const clearBudget = asyncHandler(async (req, res) => {
  res.json({ limit: await setBudgetLimit(0) });
});
