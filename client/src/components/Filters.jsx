/* =========================================================
   components/Filters.jsx — type chips, search, category and
   month dropdowns, and the sort select.
   ========================================================= */

import { monthLabel } from "@shared/utils.js";
import { CATEGORIES } from "@shared/categories.js";

const TYPE_CHIPS = [
  { value: "all", label: "All" },
  { value: "income", label: "Income" },
  { value: "expense", label: "Expense" },
];

export default function Filters({ filters, sort, months, onChange, onSortChange }) {
  // Category options follow the selected type, grouped when showing both.
  const groups = filters.type === "all" ? ["income", "expense"] : [filters.type];

  return (
    <div className="filters">
      <div className="filter-top">
        <div className="chip-group" role="tablist" aria-label="Filter by type">
          {TYPE_CHIPS.map((chip) => (
            <button
              key={chip.value}
              type="button"
              className={`chip${filters.type === chip.value ? " active" : ""}`}
              role="tab"
              aria-selected={filters.type === chip.value}
              onClick={() => onChange({ type: chip.value })}
            >
              {chip.label}
            </button>
          ))}
        </div>

        <div className="input-wrap select-wrap sort-wrap">
          <select
            aria-label="Sort transactions"
            value={sort}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="date-desc">Newest first</option>
            <option value="date-asc">Oldest first</option>
            <option value="amount-desc">Highest amount</option>
            <option value="amount-asc">Lowest amount</option>
          </select>
        </div>
      </div>

      <div className="filter-row">
        <div className="input-wrap search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <input
            type="search"
            placeholder="Search description…"
            aria-label="Search transactions"
            value={filters.search}
            onChange={(e) => onChange({ search: e.target.value })}
          />
        </div>

        <div className="input-wrap select-wrap">
          <select
            aria-label="Filter by category"
            value={filters.category}
            onChange={(e) => onChange({ category: e.target.value })}
          >
            <option value="all">All categories</option>
            {filters.type === "all"
              ? groups.map((group) => (
                  <optgroup key={group} label={group === "income" ? "Income" : "Expense"}>
                    {CATEGORIES[group].map((c) => (
                      <option key={c.name} value={c.name}>{c.icon}  {c.name}</option>
                    ))}
                  </optgroup>
                ))
              : CATEGORIES[filters.type].map((c) => (
                  <option key={c.name} value={c.name}>{c.icon}  {c.name}</option>
                ))}
          </select>
        </div>

        <div className="input-wrap select-wrap">
          <select
            aria-label="Filter by month"
            value={filters.month}
            onChange={(e) => onChange({ month: e.target.value })}
          >
            <option value="all">All months</option>
            {months.map((m) => (
              <option key={m} value={m}>{monthLabel(m)}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}
