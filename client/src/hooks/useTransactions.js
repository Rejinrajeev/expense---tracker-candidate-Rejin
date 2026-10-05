/* =========================================================
   hooks/useTransactions.js — the client-side controller.

   Owns the transaction list and the budget, and is the only
   thing that calls the API. Components get data plus the
   actions they may take, and never touch fetch themselves.
   ========================================================= */

import { useCallback, useEffect, useState } from "react";

import { api, ApiError } from "../api/client.js";
import { calculateTotals, spentInMonth, thresholdAlert } from "@shared/insights.js";

const EMPTY_TOTALS = { income: 0, expense: 0, balance: 0, incomeCount: 0, expenseCount: 0 };

export function useTransactions(toasts) {
  const [transactions, setTransactions] = useState([]);
  const [totals, setTotals] = useState(EMPTY_TOTALS);
  const [budgetLimit, setBudgetLimit] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);

  /* ---------- Loading ---------- */

  /**
   * Reload everything. Returns the fresh list and limit, because callers need
   * the new values immediately — reading the `transactions` state straight
   * after this would still give the pre-refresh array (React has not
   * re-rendered yet), which would make any before/after comparison a no-op.
   */
  const refresh = useCallback(async () => {
    try {
      const [list, budget] = await Promise.all([api.listTransactions(), api.getBudget()]);
      setTransactions(list.transactions);
      setTotals(list.totals ?? calculateTotals(list.transactions));
      setBudgetLimit(budget.limit);
      setLoadError(null);
      return { transactions: list.transactions, limit: budget.limit };
    } catch (err) {
      setLoadError(err.message);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // The initial load reports through loadError, so swallow the rejection.
    refresh().catch(() => {});
  }, [refresh]);

  /**
   * Run an API write, then reload. Returns the per-field errors on a 400 so
   * the form can highlight them, or null when the write succeeded.
   */
  const run = useCallback(
    async (action, { onSuccess } = {}) => {
      const spentBefore = spentInMonth(transactions);

      try {
        const result = await action();
        const fresh = await refresh();
        onSuccess?.(result);

        // Warn only when this change newly crossed a budget threshold. Both
        // figures come from the reloaded list, not from stale state.
        const alert = thresholdAlert(
          spentBefore,
          spentInMonth(fresh.transactions),
          fresh.limit
        );
        if (alert) toasts.show(alert.text, alert.type);

        return null;
      } catch (err) {
        if (err instanceof ApiError && err.errors) return err.errors;
        toasts.error(err.message);
        return {};
      }
    },
    [refresh, toasts, transactions]
  );

  /* ---------- Transactions ---------- */

  const addTransaction = useCallback(
    (data) =>
      run(() => api.createTransaction(data), {
        onSuccess: () => toasts.success(`${data.type === "income" ? "Income" : "Expense"} added`),
      }),
    [run, toasts]
  );

  const updateTransaction = useCallback(
    (id, data) =>
      run(() => api.updateTransaction(id, data), {
        onSuccess: () => toasts.success("Transaction updated"),
      }),
    [run, toasts]
  );

  const deleteTransaction = useCallback(
    async (id) => {
      try {
        const { deleted } = await api.deleteTransaction(id);
        await refresh();

        toasts.show("Transaction deleted", "info", {
          label: "Undo",
          duration: 6000,
          onClick: async () => {
            try {
              await api.restoreTransaction(deleted);
              await refresh();
              toasts.success("Transaction restored");
            } catch (err) {
              toasts.error(err.message);
            }
          },
        });
      } catch (err) {
        toasts.error(err.message);
      }
    },
    [refresh, toasts]
  );

  const importTransactions = useCallback(
    async (parsed) => {
      try {
        const result = await api.importTransactions(parsed.transactions);
        if (parsed.budget && !budgetLimit) await api.setBudget(parsed.budget);
        await refresh();

        const parts = [`Imported ${result.added} transaction${result.added === 1 ? "" : "s"}`];
        if (result.duplicates) parts.push(`${result.duplicates} already existed`);
        if (result.skipped + (parsed.skipped || 0)) {
          parts.push(`${result.skipped + (parsed.skipped || 0)} invalid skipped`);
        }
        toasts.show(parts.join(" · "), result.added ? "success" : "info");
      } catch (err) {
        toasts.error(err.message);
      }
    },
    [budgetLimit, refresh, toasts]
  );

  const clearAll = useCallback(async () => {
    try {
      await api.clearTransactions();
      await api.clearBudget();
      await refresh();
      toasts.info("All data cleared");
    } catch (err) {
      toasts.error(err.message);
    }
  }, [refresh, toasts]);

  /* ---------- Budget ---------- */

  const saveBudget = useCallback(
    async (limit) => {
      try {
        const { limit: saved } = await api.setBudget(limit);
        setBudgetLimit(saved);
        toasts.success("Monthly budget saved");
        return null;
      } catch (err) {
        if (err instanceof ApiError && err.errors) return err.errors.limit || err.message;
        toasts.error(err.message);
        return err.message;
      }
    },
    [toasts]
  );

  const removeBudget = useCallback(async () => {
    try {
      await api.clearBudget();
      setBudgetLimit(0);
      toasts.info("Budget removed");
    } catch (err) {
      toasts.error(err.message);
    }
  }, [toasts]);

  return {
    transactions,
    totals,
    budgetLimit,
    loading,
    loadError,
    refresh,
    addTransaction,
    updateTransaction,
    deleteTransaction,
    importTransactions,
    clearAll,
    saveBudget,
    removeBudget,
  };
}
