/* =========================================================
   components/BudgetCard.jsx — the monthly budget and its editor.
   ========================================================= */

import { useEffect, useRef, useState } from "react";

import { formatCurrency, monthLabel, plural } from "@shared/utils.js";
import { budgetSnapshot } from "@shared/insights.js";
import { validateBudget } from "@shared/validation.js";

export default function BudgetCard({ transactions, limit, onSave, onRemove }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");
  const inputRef = useRef(null);

  const snapshot = budgetSnapshot(transactions, limit);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function open() {
    setValue(limit || "");
    setError("");
    setEditing(true);
  }

  function close() {
    setEditing(false);
    setError("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    // Check locally for instant feedback; the server re-checks the same rule.
    const message = validateBudget(value.toString().trim());
    if (message) {
      setError(message);
      inputRef.current?.focus();
      return;
    }

    const serverError = await onSave(value.toString().trim());
    if (serverError) {
      setError(serverError);
      return;
    }
    close();
  }

  return (
    <section
      className={`budget-card${editing ? " editing" : ""}`}
      data-status={snapshot.status}
      aria-labelledby="budgetTitle"
    >
      <div className="budget-view">
        <div className="budget-head">
          <span className="budget-icon" aria-hidden="true">🎯</span>
          <div>
            <h2 id="budgetTitle">Monthly Budget · {monthLabel(snapshot.month)}</h2>
            <p className="budget-summary">
              {snapshot.limit ? (
                <>
                  <strong>{formatCurrency(snapshot.spent)}</strong> of{" "}
                  {formatCurrency(snapshot.limit)} spent{" "}
                  <span className="budget-pct">{snapshot.percent}%</span>
                </>
              ) : (
                "Set a monthly spending limit to keep your expenses on track."
              )}
            </p>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={open}>
            {snapshot.limit ? "Edit" : "Set budget"}
          </button>
        </div>

        <div className="budget-track" role="presentation">
          <div className="budget-bar" style={{ width: `${Math.min(snapshot.percent, 100)}%` }} />
        </div>

        <p className="budget-details">{detailsText(snapshot)}</p>
      </div>

      <form className="budget-form" onSubmit={handleSubmit} noValidate>
        <label htmlFor="budgetInput">Spending limit for this month</label>
        <div className="budget-form-row">
          <div className={`input-wrap with-prefix budget-input${error ? " invalid" : ""}`}>
            <span className="prefix" aria-hidden="true">₹</span>
            <input
              ref={inputRef}
              type="number"
              id="budgetInput"
              min="0"
              step="0.01"
              inputMode="decimal"
              placeholder="e.g. 25000"
              aria-describedby="budgetError"
              value={value}
              onChange={(e) => {
                setValue(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Escape" && close()}
            />
          </div>
          <button type="submit" className="btn btn-primary btn-sm">Save</button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={close}>Cancel</button>
          <button
            type="button"
            className="btn btn-ghost btn-sm budget-remove"
            onClick={() => {
              onRemove();
              close();
            }}
          >
            Remove
          </button>
        </div>
        <p className="error-msg" id="budgetError" role="alert">{error}</p>
      </form>
    </section>
  );
}

function detailsText({ limit, spent, remaining, daysLeft, perDay }) {
  if (!limit) return `Spent so far this month: ${formatCurrency(spent)}`;

  return remaining >= 0
    ? `${formatCurrency(remaining)} left · ${plural(daysLeft, "day")} to go · about ${formatCurrency(perDay)}/day`
    : `Over budget by ${formatCurrency(-remaining)}. Try to cut back for the rest of the month.`;
}
