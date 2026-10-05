/* =========================================================
   components/Insights.jsx — the two charts.

   Drawn with plain divs and inline SVG, no charting library.
   All the arithmetic is in shared/insights.js; these components
   only turn numbers into shapes.
   ========================================================= */

import { useMemo } from "react";

import { formatCompact, formatCurrency, monthLabel } from "@shared/utils.js";
import { categoryBreakdown, monthlySummary } from "@shared/insights.js";

const LEGEND_LIMIT = 6;
const DONUT_RADIUS = 76;
const DONUT_STROKE = 22;

export default function Insights({ transactions, monthFilter }) {
  const summary = useMemo(() => monthlySummary(transactions), [transactions]);
  const breakdown = useMemo(
    () => categoryBreakdown(transactions, monthFilter),
    [transactions, monthFilter]
  );

  return (
    <section className="insights" aria-label="Insights">
      <article className="card">
        <div className="card-head">
          <div>
            <h2>Monthly Summary</h2>
            <p className="card-sub">Income vs. expenses for the last 6 months</p>
          </div>
        </div>
        <div className="chart-legend">
          <span><i className="dot dot-income" />Income</span>
          <span><i className="dot dot-expense" />Expense</span>
        </div>
        <MonthlyChart summary={summary} />
        <MonthStats summary={summary} />
      </article>

      <article className="card">
        <div className="card-head">
          <div>
            <h2>Spending by Category</h2>
            <p className="card-sub">
              {monthFilter === "all"
                ? "Expense breakdown · all time"
                : `Expense breakdown · ${monthLabel(monthFilter)}`}
            </p>
          </div>
        </div>
        <div className="donut-layout">
          <CategoryDonut breakdown={breakdown} />
          <CategoryLegend breakdown={breakdown} />
        </div>
      </article>
    </section>
  );
}

function MonthlyChart({ summary }) {
  return (
    <div className="bar-chart">
      {summary.bars.map((bar) => {
        const label = monthLabel(bar.key, { month: "short" });
        return (
          <div key={bar.key} className={`bar-group${bar.isCurrent ? " current" : ""}`}>
            <div className="bars">
              <div
                className="bar income"
                style={{ height: `${bar.incomeHeight}%` }}
                data-tip={`${label} income: ${formatCompact(bar.income)}`}
                aria-label={`${label} income ${formatCurrency(bar.income)}`}
              />
              <div
                className="bar expense"
                style={{ height: `${bar.expenseHeight}%` }}
                data-tip={`${label} expense: ${formatCompact(bar.expense)}`}
                aria-label={`${label} expense ${formatCurrency(bar.expense)}`}
              />
            </div>
            <span className="bar-label">{label}</span>
          </div>
        );
      })}
    </div>
  );
}

function MonthStats({ summary }) {
  const { current, net, trend } = summary;

  return (
    <div className="month-stats">
      <div className="stat income">
        <span>This month's income</span>
        <strong>{formatCurrency(current.income)}</strong>
      </div>
      <div className="stat expense">
        <span>This month's expenses</span>
        <strong>{formatCurrency(current.expense)}</strong>
      </div>
      <div className="stat">
        <span>Net savings</span>
        <strong style={{ color: net < 0 ? "var(--expense)" : "var(--primary)" }}>
          {formatCurrency(net)}
        </strong>
      </div>
      {trend && <p className="trend-note">{trendText(trend)}</p>}
    </div>
  );
}

function trendText({ change, direction }) {
  if (direction === "flat") return "Spending is the same as last month";
  return `Spending ${direction === "up" ? "up ▲" : "down ▼"} ${Math.abs(change)}% vs last month`;
}

/** Each slice is one dashed circle, rotated past the slices before it. */
function CategoryDonut({ breakdown }) {
  if (!breakdown.slices.length) {
    return (
      <div className="donut-wrap">
        <svg viewBox="0 0 200 200" aria-hidden="true">
          <circle
            cx="100"
            cy="100"
            r={DONUT_RADIUS}
            fill="none"
            stroke="var(--surface-2)"
            strokeWidth={DONUT_STROKE}
          />
        </svg>
        <div className="donut-center">
          <span>No expenses</span>
          <strong>{formatCurrency(0)}</strong>
        </div>
      </div>
    );
  }

  const circumference = 2 * Math.PI * DONUT_RADIUS;
  const gap = breakdown.slices.length > 1 ? 2 : 0;
  let offset = 0;

  const segments = breakdown.slices.map((slice) => {
    const length = (slice.percent / 100) * circumference;
    const dash = Math.max(length - gap, 0.5);
    const element = (
      <circle
        key={slice.name}
        className="donut-segment"
        cx="100"
        cy="100"
        r={DONUT_RADIUS}
        fill="none"
        stroke={slice.color}
        strokeWidth={DONUT_STROKE}
        strokeDasharray={`${dash} ${circumference - dash}`}
        strokeDashoffset={-offset}
      >
        <title>
          {slice.name}: {formatCurrency(slice.amount)} ({slice.percent.toFixed(1)}%)
        </title>
      </circle>
    );

    offset += length;
    return element;
  });

  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 200 200" role="img" aria-label="Expenses by category">
        {segments}
      </svg>
      <div className="donut-center">
        <span>Total spent</span>
        <strong>{formatCompact(breakdown.total)}</strong>
      </div>
    </div>
  );
}

function CategoryLegend({ breakdown }) {
  if (!breakdown.slices.length) {
    return (
      <ul className="category-legend">
        <li className="chart-empty">Add an expense to see where your money goes.</li>
      </ul>
    );
  }

  const shown = breakdown.slices.slice(0, LEGEND_LIMIT);
  const rest = breakdown.slices.slice(LEGEND_LIMIT);
  const restPercent = rest.reduce((sum, s) => sum + s.percent, 0);

  return (
    <ul className="category-legend">
      {shown.map((slice) => (
        <li key={slice.name} className="legend-item">
          <span aria-hidden="true">{slice.icon}</span>
          <span className="legend-name">{slice.name}</span>
          <span className="legend-value">{slice.percent.toFixed(0)}%</span>
          <span className="legend-bar">
            <i style={{ width: `${slice.percent}%`, background: slice.color }} />
          </span>
        </li>
      ))}

      {/* Everything past the sixth category rolls into one row. */}
      {rest.length > 0 && (
        <li className="legend-item">
          <span aria-hidden="true">➕</span>
          <span className="legend-name">{rest.length} more</span>
          <span className="legend-value">{restPercent.toFixed(0)}%</span>
        </li>
      )}
    </ul>
  );
}
