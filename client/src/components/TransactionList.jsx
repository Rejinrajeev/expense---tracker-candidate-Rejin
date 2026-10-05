/* =========================================================
   components/TransactionList.jsx — the list, its date headings
   and the empty state.
   ========================================================= */

import { formatCurrency, formatDate, friendlyDate, plural } from "@shared/utils.js";
import { getCategory } from "@shared/categories.js";

export default function TransactionList({
  visible,
  total,
  groupByDate,
  highlightId,
  onEdit,
  onDelete,
}) {
  const isEmpty = visible.length === 0;

  return (
    <>
      <ul className="transaction-list" aria-live="polite">
        {!isEmpty &&
          withDateHeadings(visible, groupByDate).map((row) =>
            row.heading ? (
              <li key={`heading-${row.date}`} className="date-group">
                {friendlyDate(row.date)}
              </li>
            ) : (
              <TransactionRow
                key={row.transaction.id}
                transaction={row.transaction}
                highlighted={row.transaction.id === highlightId}
                onEdit={onEdit}
                onDelete={onDelete}
              />
            )
          )}
      </ul>

      {isEmpty && (
        <div className="empty-state">
          <div className="empty-illustration" aria-hidden="true">🧾</div>
          <h3>{total ? "No matching transactions" : "No transactions yet"}</h3>
          <p>
            {total
              ? "Try changing or resetting the filters."
              : "Add your first income or expense using the form."}
          </p>
        </div>
      )}
    </>
  );
}

/** The "N transactions" / "Showing N of M" line in the card header. */
export function countLabel(shown, total) {
  if (!total) return "No transactions yet";
  return shown === total ? plural(total, "transaction") : `Showing ${shown} of ${total}`;
}

/**
 * Interleave date heading rows into the list. Headings only make sense while
 * the list is ordered by date, so they are skipped for the amount sorts.
 */
function withDateHeadings(visible, groupByDate) {
  const rows = [];
  let lastDate = null;

  for (const transaction of visible) {
    if (groupByDate && transaction.date !== lastDate) {
      rows.push({ heading: true, date: transaction.date });
      lastDate = transaction.date;
    }
    rows.push({ heading: false, transaction });
  }
  return rows;
}

function TransactionRow({ transaction: t, highlighted, onEdit, onDelete }) {
  const category = getCategory(t.type, t.category);
  const sign = t.type === "income" ? "+" : "−";

  return (
    <li className={`transaction ${t.type}${highlighted ? " highlight" : ""}`} data-id={t.id}>
      <span className="tx-icon" aria-hidden="true">{category.icon}</span>

      <div className="tx-info">
        <p className="tx-desc" title={t.description}>{t.description}</p>
        <div className="tx-meta">
          <span className="tx-tag">{t.category}</span>
          <span>{formatDate(t.date)}</span>
        </div>
      </div>

      <span className="tx-amount">
        {sign}
        {formatCurrency(t.amount)}
      </span>

      <div className="tx-actions">
        <button
          type="button"
          className="tx-btn edit"
          onClick={() => onEdit(t)}
          aria-label={`Edit ${t.description}`}
          title="Edit"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9" />
            <path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z" />
          </svg>
        </button>
        <button
          type="button"
          className="tx-btn delete"
          onClick={() => onDelete(t)}
          aria-label={`Delete ${t.description}`}
          title="Delete"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button>
      </div>
    </li>
  );
}
