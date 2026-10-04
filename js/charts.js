/* =========================================================
   Insights: monthly summary bar chart + category donut chart
   Pure HTML/SVG — no external chart library.
   ========================================================= */

const Charts = {
  MONTHS_SHOWN: 6,

  /** Returns the last N month keys (YYYY-MM), oldest first, ending this month. */
  lastMonths(n) {
    const now = new Date();
    const keys = [];
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      keys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    }
    return keys;
  },

  totalsByMonth(transactions) {
    const map = {};
    transactions.forEach((t) => {
      const key = Utils.monthKey(t.date);
      map[key] = map[key] || { income: 0, expense: 0 };
      map[key][t.type] += t.amount;
    });
    return map;
  },

  /* ---------- Monthly summary ---------- */
  renderMonthly(chartEl, statsEl, transactions) {
    const months = this.lastMonths(this.MONTHS_SHOWN);
    const totals = this.totalsByMonth(transactions);
    const max = Math.max(1, ...months.map((m) => Math.max(totals[m]?.income || 0, totals[m]?.expense || 0)));
    const currentKey = months[months.length - 1];

    chartEl.innerHTML = months
      .map((m) => {
        const inc = totals[m]?.income || 0;
        const exp = totals[m]?.expense || 0;
        const label = Utils.monthLabel(m, { month: "short" });
        return `
          <div class="bar-group${m === currentKey ? " current" : ""}">
            <div class="bars">
              <div class="bar income" style="height:${(inc / max) * 100}%" data-tip="${label} income: ${Utils.formatCompact(inc)}" aria-label="${label} income ${Utils.formatCurrency(inc)}"></div>
              <div class="bar expense" style="height:${(exp / max) * 100}%" data-tip="${label} expense: ${Utils.formatCompact(exp)}" aria-label="${label} expense ${Utils.formatCurrency(exp)}"></div>
            </div>
            <span class="bar-label">${label}</span>
          </div>`;
      })
      .join("");

    // Stats for the current month, compared with the previous month.
    const cur = totals[currentKey] || { income: 0, expense: 0 };
    const prev = totals[months[months.length - 2]] || { income: 0, expense: 0 };
    const net = cur.income - cur.expense;

    let trend = "";
    if (prev.expense > 0) {
      const change = Math.round(((cur.expense - prev.expense) / prev.expense) * 100);
      trend =
        change === 0
          ? "Spending is the same as last month"
          : `Spending ${change > 0 ? "up ▲" : "down ▼"} ${Math.abs(change)}% vs last month`;
    }

    statsEl.innerHTML = `
      <div class="stat income"><span>This month's income</span><strong>${Utils.formatCurrency(cur.income)}</strong></div>
      <div class="stat expense"><span>This month's expenses</span><strong>${Utils.formatCurrency(cur.expense)}</strong></div>
      <div class="stat"><span>Net savings</span><strong style="color:${net < 0 ? "var(--expense)" : "var(--primary)"}">${Utils.formatCurrency(net)}</strong></div>
      ${trend ? `<p class="trend-note">${trend}</p>` : ""}`;
  },

  /* ---------- Category donut ---------- */
  renderCategory(chartEl, legendEl, subEl, transactions, monthKey) {
    const expenses = transactions.filter(
      (t) => t.type === "expense" && (monthKey === "all" || Utils.monthKey(t.date) === monthKey)
    );
    subEl.textContent =
      monthKey === "all" ? "Expense breakdown · all time" : `Expense breakdown · ${Utils.monthLabel(monthKey)}`;

    if (!expenses.length) {
      chartEl.innerHTML = `
        <svg viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="76" fill="none" stroke="var(--surface-2)" stroke-width="22"/></svg>
        <div class="donut-center"><span>No expenses</span><strong>${Utils.formatCurrency(0)}</strong></div>`;
      legendEl.innerHTML = `<li class="chart-empty">Add an expense to see where your money goes.</li>`;
      return;
    }

    const byCat = {};
    expenses.forEach((t) => (byCat[t.category] = (byCat[t.category] || 0) + t.amount));
    const total = expenses.reduce((s, t) => s + t.amount, 0);
    const entries = Object.entries(byCat)
      .map(([name, amount]) => ({ ...Utils.getCategory("expense", name), amount }))
      .sort((a, b) => b.amount - a.amount);

    const r = 76;
    const c = 2 * Math.PI * r;
    const gap = entries.length > 1 ? 2 : 0;
    let offset = 0;

    const segments = entries
      .map((e) => {
        const len = (e.amount / total) * c;
        const dash = Math.max(len - gap, 0.5);
        const seg = `<circle class="donut-segment" cx="100" cy="100" r="${r}" fill="none" stroke="${e.color}" stroke-width="22"
          stroke-dasharray="${dash} ${c - dash}" stroke-dashoffset="${-offset}">
          <title>${Utils.escapeHTML(e.name)}: ${Utils.formatCurrency(e.amount)} (${((e.amount / total) * 100).toFixed(1)}%)</title>
        </circle>`;
        offset += len;
        return seg;
      })
      .join("");

    chartEl.innerHTML = `
      <svg viewBox="0 0 200 200" role="img" aria-label="Expenses by category">${segments}</svg>
      <div class="donut-center"><span>Total spent</span><strong>${Utils.formatCompact(total)}</strong></div>`;

    legendEl.innerHTML = entries
      .slice(0, 6)
      .map((e) => {
        const pct = (e.amount / total) * 100;
        return `
          <li class="legend-item">
            <span aria-hidden="true">${e.icon}</span>
            <span class="legend-name">${Utils.escapeHTML(e.name)}</span>
            <span class="legend-value">${pct.toFixed(0)}%</span>
            <span class="legend-bar"><i style="width:${pct}%;background:${e.color}"></i></span>
          </li>`;
      })
      .join("");

    if (entries.length > 6) {
      const rest = entries.slice(6).reduce((s, e) => s + e.amount, 0);
      legendEl.innerHTML += `<li class="legend-item"><span aria-hidden="true">➕</span><span class="legend-name">${entries.length - 6} more</span><span class="legend-value">${((rest / total) * 100).toFixed(0)}%</span></li>`;
    }
  },
};
