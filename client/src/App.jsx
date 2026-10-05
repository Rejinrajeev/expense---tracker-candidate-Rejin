/* =========================================================
   App.jsx — the top-level component.

   Owns what is purely view state (filters, sort order, which row
   is being edited, which dialog is open) and leaves all data to
   useTransactions, which is the only thing that calls the API.
   ========================================================= */

import { useCallback, useEffect, useMemo, useState } from "react";

import AppHeader from "./components/AppHeader.jsx";
import BudgetCard from "./components/BudgetCard.jsx";
import ConfirmModal from "./components/ConfirmModal.jsx";
import DataMenu from "./components/DataMenu.jsx";
import Filters from "./components/Filters.jsx";
import Insights from "./components/Insights.jsx";
import SummaryCards from "./components/SummaryCards.jsx";
import TransactionForm from "./components/TransactionForm.jsx";
import TransactionList, { countLabel } from "./components/TransactionList.jsx";
import Toasts from "./components/Toasts.jsx";

import { useToasts } from "./hooks/useToasts.js";
import { useTheme } from "./hooks/useTheme.js";
import { useTransactions } from "./hooks/useTransactions.js";

import {
  availableMonths,
  DEFAULT_FILTERS,
  hasActiveFilters,
  reconcileFilters,
  visibleTransactions,
} from "@shared/filters.js";
import { formatCurrency } from "@shared/utils.js";

export default function App() {
  const toasts = useToasts();
  const { theme, toggle } = useTheme();
  const data = useTransactions(toasts);

  const [filters, setFilters] = useState({ ...DEFAULT_FILTERS });
  const [sort, setSort] = useState("date-desc");
  const [editing, setEditing] = useState(null);
  const [confirmRequest, setConfirmRequest] = useState(null);
  const [highlightId, setHighlightId] = useState(null);

  const { transactions, totals, budgetLimit, loading, loadError } = data;

  /* Derived view data. */
  const months = useMemo(() => availableMonths(transactions), [transactions]);
  const visible = useMemo(
    () => visibleTransactions(transactions, filters, sort),
    [transactions, filters, sort]
  );

  /* Drop a filter that can no longer match anything once the data changes. */
  useEffect(() => {
    setFilters((current) => {
      const corrected = reconcileFilters(current, transactions);
      const changed =
        corrected.category !== current.category || corrected.month !== current.month;
      return changed ? corrected : current;
    });
  }, [transactions]);

  /* The highlight flash is temporary. */
  useEffect(() => {
    if (!highlightId) return;
    const timer = setTimeout(() => setHighlightId(null), 2000);
    return () => clearTimeout(timer);
  }, [highlightId]);

  const changeFilters = useCallback((patch) => {
    setFilters((current) => {
      const next = { ...current, ...patch };
      // Switching type invalidates a category from the other type.
      if (patch.type && patch.type !== current.type) next.category = "all";
      return next;
    });
  }, []);

  const resetFilters = useCallback(() => setFilters({ ...DEFAULT_FILTERS }), []);

  /* ---------- Actions ---------- */

  const handleSubmit = useCallback(
    async (formData) => {
      const errors = editing
        ? await data.updateTransaction(editing.id, formData)
        : await data.addTransaction(formData);

      if (errors) return errors;

      setEditing(null);
      return null;
    },
    [data, editing]
  );

  const requestDelete = useCallback(
    (transaction) => {
      setConfirmRequest({
        icon: "🗑️",
        title: "Delete transaction?",
        body: `“${transaction.description}” of ${formatCurrency(transaction.amount)} will be permanently removed.`,
        confirmLabel: "Delete",
        onConfirm: async () => {
          setConfirmRequest(null);
          // Editing the row being deleted would leave the form stranded.
          if (editing?.id === transaction.id) setEditing(null);
          await data.deleteTransaction(transaction.id);
        },
      });
    },
    [data, editing]
  );

  const requestClear = useCallback(() => {
    if (!transactions.length) {
      toasts.info("There's no data to clear.");
      return;
    }

    setConfirmRequest({
      icon: "🧹",
      title: "Clear all data?",
      body: `All ${transactions.length} transactions and your budget will be deleted. Download a backup first if you may need them.`,
      confirmLabel: "Clear all",
      onConfirm: async () => {
        setConfirmRequest(null);
        setEditing(null);
        resetFilters();
        await data.clearAll();
      },
    });
  }, [data, resetFilters, toasts, transactions.length]);

  /* ---------- The server is unreachable ---------- */

  if (loadError && !transactions.length) {
    return (
      <>
        <AppHeader theme={theme} onToggleTheme={toggle} />
        <main className="container">
          <section className="card" style={{ marginTop: "2rem" }}>
            <div className="card-head">
              <div>
                <h2>Can't reach the API</h2>
                <p className="card-sub">{loadError}</p>
              </div>
            </div>
            <p style={{ lineHeight: 1.7 }}>
              Start the server in a second terminal, then reload this page:
            </p>
            <pre
              style={{
                background: "var(--surface-2)",
                padding: "14px 16px",
                borderRadius: "10px",
                overflowX: "auto",
              }}
            >
              cd server{"\n"}npm run dev
            </pre>
            <p style={{ lineHeight: 1.7 }}>
              If it still fails, MongoDB is probably not running — the server prints
              instructions when it cannot connect.
            </p>
            <div className="form-actions">
              <button type="button" className="btn btn-primary" onClick={() => data.refresh().catch(() => {})}>
                <span>Try again</span>
              </button>
            </div>
          </section>
        </main>
        <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />
      </>
    );
  }

  return (
    <>
      <AppHeader theme={theme} onToggleTheme={toggle} />

      <main className="container">
        <SummaryCards totals={totals} />

        <BudgetCard
          transactions={transactions}
          limit={budgetLimit}
          onSave={data.saveBudget}
          onRemove={data.removeBudget}
        />

        <div className="layout">
          <TransactionForm
            transactions={transactions}
            editing={editing}
            onSubmit={handleSubmit}
            onCancelEdit={() => setEditing(null)}
            onHighlight={setHighlightId}
            toasts={toasts}
          />

          <section className="card list-card" aria-labelledby="listTitle">
            <div className="card-head">
              <div>
                <h2 id="listTitle">Transactions</h2>
                <p className="card-sub">
                  {loading ? "Loading…" : countLabel(visible.length, transactions.length)}
                </p>
              </div>
              <div className="head-actions">
                {hasActiveFilters(filters) && (
                  <button type="button" className="btn btn-ghost btn-sm" onClick={resetFilters}>
                    Reset filters
                  </button>
                )}
                <DataMenu
                  visible={visible}
                  transactions={transactions}
                  budgetLimit={budgetLimit}
                  onImport={data.importTransactions}
                  onRequestClear={requestClear}
                  toasts={toasts}
                />
              </div>
            </div>

            <Filters
              filters={filters}
              sort={sort}
              months={months}
              onChange={changeFilters}
              onSortChange={setSort}
            />

            <TransactionList
              visible={visible}
              total={transactions.length}
              // Date headings only make sense while the list is ordered by date.
              groupByDate={sort.startsWith("date")}
              highlightId={highlightId}
              onEdit={setEditing}
              onDelete={requestDelete}
            />
          </section>
        </div>

        <Insights transactions={transactions} monthFilter={filters.month} />
      </main>

      <footer className="app-footer">
        <p>Built with React, Express and MongoDB · Data is stored in your MongoDB database</p>
      </footer>

      <ConfirmModal request={confirmRequest} onCancel={() => setConfirmRequest(null)} />
      <Toasts toasts={toasts.toasts} onDismiss={toasts.dismiss} />
    </>
  );
}
