/* =========================================================
   components/SummaryCards.jsx — balance, income and expenses.
   ========================================================= */

import { formatCurrency, plural } from "@shared/utils.js";

/** A one-line read on how things are going, shown under the balance. */
function balanceCaption({ income, balance, incomeCount, expenseCount }) {
  if (!incomeCount && !expenseCount) return "Start by adding your first transaction";
  if (income === 0) return "Add an income to see your savings rate";

  const rate = Math.round((balance / income) * 100);
  return balance >= 0
    ? `You saved ${rate}% of your income 🎉`
    : `Overspent by ${Math.abs(rate)}% of your income`;
}

export default function SummaryCards({ totals }) {
  const { income, expense, balance, incomeCount, expenseCount } = totals;

  return (
    <section className="summary" aria-label="Account summary">
      <article className={`summary-card balance-card${balance < 0 ? " negative" : ""}`}>
        <div className="summary-top">
          <span className="summary-label">Current Balance</span>
          <span className="summary-icon" aria-hidden="true">💼</span>
        </div>
        <p className="summary-value">{formatCurrency(balance)}</p>
        <p className="summary-sub">{balanceCaption(totals)}</p>
      </article>

      <article className="summary-card income-card">
        <div className="summary-top">
          <span className="summary-label">Total Income</span>
          <span className="summary-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M7 17 17 7M8 7h9v9" />
            </svg>
          </span>
        </div>
        <p className="summary-value">{formatCurrency(income)}</p>
        <p className="summary-sub">{plural(incomeCount, "transaction")}</p>
      </article>

      <article className="summary-card expense-card">
        <div className="summary-top">
          <span className="summary-label">Total Expenses</span>
          <span className="summary-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17 7 7 17M16 17H7V8" />
            </svg>
          </span>
        </div>
        <p className="summary-value">{formatCurrency(expense)}</p>
        <p className="summary-sub">{plural(expenseCount, "transaction")}</p>
      </article>
    </section>
  );
}
