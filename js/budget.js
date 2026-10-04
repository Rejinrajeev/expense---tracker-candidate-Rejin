/* =========================================================
   Monthly budget: set a spending limit for the current month
   and track progress against it.
   ========================================================= */

const Budget = {
  WARN_AT: 0.8,

  validate(value) {
    if (value === "" || value == null) return "Enter a budget amount.";
    const n = Number(value);
    if (isNaN(n)) return "Budget must be a valid number.";
    if (n <= 0) return "Budget must be greater than zero.";
    if (n > Validator.MAX_AMOUNT) return `Budget can't exceed ${Utils.formatCurrency(Validator.MAX_AMOUNT)}.`;
    if (!/^\d+(\.\d{1,2})?$/.test(String(value))) return "Use at most 2 decimal places.";
    return "";
  },

  /** Expenses for the current calendar month. */
  spentThisMonth(transactions) {
    const key = Utils.monthKey(Utils.todayISO());
    return transactions
      .filter((t) => t.type === "expense" && Utils.monthKey(t.date) === key)
      .reduce((sum, t) => sum + t.amount, 0);
  },

  status(spent, limit) {
    if (!limit) return "none";
    const ratio = spent / limit;
    if (ratio > 1) return "over";
    if (ratio >= this.WARN_AT) return "warn";
    return "ok";
  },

  render(transactions) {
    const limit = Storage.getBudget();
    const card = document.getElementById("budgetCard");
    const spent = this.spentThisMonth(transactions);
    const status = this.status(spent, limit);
    const month = Utils.monthLabel(Utils.monthKey(Utils.todayISO()));

    card.dataset.status = status;
    document.getElementById("budgetMonth").textContent = month;

    const summary = document.getElementById("budgetSummary");
    const bar = document.getElementById("budgetBar");
    const details = document.getElementById("budgetDetails");
    const editBtn = document.getElementById("budgetEditBtn");

    if (!limit) {
      summary.innerHTML = `Set a monthly spending limit to keep your expenses on track.`;
      bar.style.width = "0%";
      details.textContent = `Spent so far this month: ${Utils.formatCurrency(spent)}`;
      editBtn.textContent = "Set budget";
      return;
    }

    const pct = Math.round((spent / limit) * 100);
    const left = limit - spent;
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - now.getDate() + 1;

    summary.innerHTML = `<strong>${Utils.formatCurrency(spent)}</strong> of ${Utils.formatCurrency(limit)} spent <span class="budget-pct">${pct}%</span>`;
    bar.style.width = `${Math.min(pct, 100)}%`;
    details.textContent =
      left >= 0
        ? `${Utils.formatCurrency(left)} left · ${daysLeft} day${daysLeft === 1 ? "" : "s"} to go · about ${Utils.formatCurrency(left / daysLeft)}/day`
        : `Over budget by ${Utils.formatCurrency(-left)}. Try to cut back for the rest of the month.`;
    editBtn.textContent = "Edit";
  },

  /** Returns a message if an expense change pushed spending across a threshold. */
  thresholdAlert(before, after) {
    const limit = Storage.getBudget();
    if (!limit || after <= before) return null;
    if (before <= limit && after > limit) return { type: "error", text: "You've gone over this month's budget." };
    if (before < limit * this.WARN_AT && after >= limit * this.WARN_AT)
      return { type: "error", text: `Heads up: you've used ${Math.round((after / limit) * 100)}% of this month's budget.` };
    return null;
  },

  init({ getTransactions, notify }) {
    const card = document.getElementById("budgetCard");
    const form = document.getElementById("budgetForm");
    const input = document.getElementById("budgetInput");
    const error = document.getElementById("budgetError");

    const open = () => {
      card.classList.add("editing");
      input.value = Storage.getBudget() || "";
      error.textContent = "";
      input.focus();
    };
    const close = () => card.classList.remove("editing");

    document.getElementById("budgetEditBtn").addEventListener("click", open);
    document.getElementById("budgetCancelBtn").addEventListener("click", close);
    input.addEventListener("keydown", (e) => e.key === "Escape" && close());
    input.addEventListener("input", () => {
      error.textContent = "";
      input.closest(".budget-input").classList.remove("invalid");
    });

    document.getElementById("budgetRemoveBtn").addEventListener("click", () => {
      Storage.setBudget(null);
      close();
      this.render(getTransactions());
      notify("Budget removed", "info");
    });

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const value = input.value.trim();
      const message = this.validate(value);
      if (message) {
        error.textContent = message;
        input.closest(".budget-input").classList.add("invalid");
        input.focus();
        return;
      }
      Storage.setBudget(Math.round(Number(value) * 100) / 100);
      close();
      this.render(getTransactions());
      notify("Monthly budget saved", "success");
    });
  },
};
