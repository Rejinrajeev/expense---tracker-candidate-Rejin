/* =========================================================
   SpendWise — main application logic
   ========================================================= */

(function () {
  "use strict";

  /* ---------- State ---------- */
  const state = {
    transactions: Storage.load(),
    editingId: null,
    pendingDeleteId: null,
    filters: { type: "all", category: "all", month: "all", search: "" },
  };

  /* ---------- DOM references ---------- */
  const $ = (sel) => document.querySelector(sel);

  const els = {
    form: $("#transactionForm"),
    formCard: $(".form-card"),
    formTitle: $("#formTitle"),
    formSubtitle: $("#formSubtitle"),
    id: $("#transactionId"),
    typeInputs: document.querySelectorAll('input[name="type"]'),
    amount: $("#amount"),
    category: $("#category"),
    date: $("#date"),
    description: $("#description"),
    descCount: $("#descCount"),
    submitBtn: $("#submitBtn"),
    cancelEditBtn: $("#cancelEditBtn"),

    balance: $("#balanceValue"),
    balanceSub: $("#balanceSub"),
    balanceCard: $(".balance-card"),
    income: $("#incomeValue"),
    incomeSub: $("#incomeSub"),
    expense: $("#expenseValue"),
    expenseSub: $("#expenseSub"),

    list: $("#transactionList"),
    listCount: $("#listCount"),
    emptyState: $("#emptyState"),
    emptyTitle: $("#emptyTitle"),
    emptyText: $("#emptyText"),

    typeChips: document.querySelectorAll(".chip[data-type]"),
    categoryFilter: $("#categoryFilter"),
    monthFilter: $("#monthFilter"),
    searchInput: $("#searchInput"),
    clearFiltersBtn: $("#clearFiltersBtn"),

    modal: $("#confirmModal"),
    modalText: $("#modalText"),
    modalConfirm: $("#modalConfirm"),
    modalCancel: $("#modalCancel"),

    toasts: $("#toastContainer"),
    themeToggle: $("#themeToggle"),
    today: $("#todayLabel"),
  };

  /* ---------- Helpers ---------- */
  const getSelectedType = () =>
    [...els.typeInputs].find((input) => input.checked).value;

  const setSelectedType = (type) => {
    els.typeInputs.forEach((input) => (input.checked = input.value === type));
    populateCategorySelect(type);
  };

  function persist() {
    if (!Storage.save(state.transactions)) {
      showToast("Couldn't save data. Your browser storage may be full or disabled.", "error");
    }
  }

  function sortByDateDesc(list) {
    return [...list].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? 1 : -1;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
  }

  /* ---------- Theme ---------- */
  function initTheme() {
    const saved = Storage.getTheme();
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    applyTheme(saved || (prefersDark ? "dark" : "light"));

    els.themeToggle.addEventListener("click", () => {
      const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      applyTheme(next);
      Storage.setTheme(next);
    });
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      .setAttribute("content", theme === "dark" ? "#0b1020" : "#6366f1");
  }

  /* ---------- Form ---------- */
  function populateCategorySelect(type, selected = "") {
    const options = CATEGORIES[type]
      .map(
        (c) =>
          `<option value="${Utils.escapeHTML(c.name)}"${c.name === selected ? " selected" : ""}>${c.icon}  ${Utils.escapeHTML(c.name)}</option>`
      )
      .join("");
    els.category.innerHTML = `<option value="" disabled${selected ? "" : " selected"}>Select category</option>${options}`;
  }

  function readForm() {
    return {
      type: getSelectedType(),
      // Number inputs report "" for unparsable text, so flag it explicitly.
      amount: els.amount.validity.badInput ? "invalid" : els.amount.value.trim(),
      category: els.category.value,
      date: els.date.value,
      description: els.description.value.trim(),
    };
  }

  function validateForm(data) {
    return Validator.validate(data);
  }

  /** Validate a single field once the user leaves it, so errors appear early. */
  function validateField(field) {
    const data = readForm();
    const message =
      field === "category" ? Validator.category(data.category, data.type) : Validator[field](data[field]);
    const wrapper = els[field].closest(".field");
    $(`#${field}Error`).textContent = message;
    wrapper.classList.toggle("invalid", Boolean(message));
    els[field].setAttribute("aria-invalid", message ? "true" : "false");
  }

  function currentBalance(excludeId) {
    return state.transactions.reduce(
      (sum, t) => (t.id === excludeId ? sum : sum + (t.type === "income" ? t.amount : -t.amount)),
      0
    );
  }

  function showErrors(errors) {
    ["amount", "category", "date", "description"].forEach((field) => {
      const wrapper = els[field].closest(".field");
      const msg = $(`#${field}Error`);
      const message = errors[field] || "";
      msg.textContent = message;
      wrapper.classList.toggle("invalid", Boolean(message));
      els[field].setAttribute("aria-invalid", message ? "true" : "false");
    });
  }

  function clearFieldError(field) {
    const wrapper = els[field].closest(".field");
    wrapper.classList.remove("invalid");
    $(`#${field}Error`).textContent = "";
    els[field].setAttribute("aria-invalid", "false");
  }

  function handleSubmit(event) {
    event.preventDefault();
    const data = readForm();
    const errors = validateForm(data);
    showErrors(errors);

    const firstInvalid = Object.keys(errors)[0];
    if (firstInvalid) {
      els[firstInvalid].focus();
      showToast("Please fix the highlighted fields.", "error");
      return;
    }

    // Soft warning (not blocking): an expense larger than the available balance.
    const overspend =
      data.type === "expense" && Number(data.amount) > currentBalance(state.editingId) && state.transactions.length > 0;

    const transaction = {
      type: data.type,
      amount: Math.round(Number(data.amount) * 100) / 100,
      category: data.category,
      date: data.date,
      description: data.description,
    };

    let changedId;
    if (state.editingId) {
      const index = state.transactions.findIndex((t) => t.id === state.editingId);
      if (index !== -1) {
        state.transactions[index] = {
          ...state.transactions[index],
          ...transaction,
          updatedAt: Date.now(),
        };
        changedId = state.editingId;
        showToast("Transaction updated", "success");
      }
    } else {
      changedId = Utils.uid();
      state.transactions.push({ id: changedId, ...transaction, createdAt: Date.now() });
      showToast(`${data.type === "income" ? "Income" : "Expense"} added`, "success");
    }

    persist();
    resetForm();
    render();
    highlight(changedId);
    if (overspend) showToast("Heads up: this expense exceeds your available balance.", "error");
  }

  function resetForm() {
    const keepType = getSelectedType();
    els.form.reset();
    state.editingId = null;
    els.id.value = "";
    setSelectedType(keepType);
    els.date.value = Utils.todayISO();
    updateCharCount();
    showErrors({});

    els.formCard.classList.remove("editing");
    els.formTitle.textContent = "Add Transaction";
    els.formSubtitle.textContent = "Record a new income or expense";
    els.submitBtn.querySelector("span").textContent = "Add Transaction";
    els.cancelEditBtn.classList.add("hidden");
  }

  function startEdit(id) {
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;

    state.editingId = id;
    els.id.value = id;
    setSelectedType(tx.type);
    populateCategorySelect(tx.type, tx.category);
    els.amount.value = tx.amount;
    els.date.value = tx.date;
    els.description.value = tx.description;
    updateCharCount();
    showErrors({});

    els.formCard.classList.add("editing");
    els.formTitle.textContent = "Edit Transaction";
    els.formSubtitle.textContent = "Update the details and save your changes";
    els.submitBtn.querySelector("span").textContent = "Save Changes";
    els.cancelEditBtn.classList.remove("hidden");

    els.formCard.scrollIntoView({ behavior: "smooth", block: "start" });
    els.amount.focus({ preventScroll: true });
  }

  function updateCharCount() {
    const len = els.description.value.length;
    const max = els.description.maxLength;
    els.descCount.textContent = `${len}/${max}`;
  }

  /* ---------- Delete ---------- */
  function requestDelete(id) {
    const tx = state.transactions.find((t) => t.id === id);
    if (!tx) return;
    state.pendingDeleteId = id;
    els.modalText.innerHTML = `“<strong>${Utils.escapeHTML(tx.description)}</strong>” of ${Utils.formatCurrency(tx.amount)} will be permanently removed.`;
    els.modal.classList.remove("hidden");
    els.modalConfirm.focus();
  }

  function closeModal() {
    els.modal.classList.add("hidden");
    state.pendingDeleteId = null;
  }

  function confirmDelete() {
    const id = state.pendingDeleteId;
    if (!id) return;
    state.transactions = state.transactions.filter((t) => t.id !== id);
    if (state.editingId === id) resetForm();
    persist();
    closeModal();
    render();
    showToast("Transaction deleted", "info");
  }

  /* ---------- Filters ---------- */
  function getVisibleTransactions() {
    const { type, category, month, search } = state.filters;
    const query = search.toLowerCase();
    return sortByDateDesc(
      state.transactions.filter(
        (t) =>
          (type === "all" || t.type === type) &&
          (category === "all" || t.category === category) &&
          (month === "all" || Utils.monthKey(t.date) === month) &&
          (!query ||
            t.description.toLowerCase().includes(query) ||
            t.category.toLowerCase().includes(query))
      )
    );
  }

  /** Category options follow the selected type filter. */
  function renderCategoryFilter() {
    const { type } = state.filters;
    const groups = type === "all" ? ["income", "expense"] : [type];
    const option = (c) =>
      `<option value="${Utils.escapeHTML(c.name)}">${c.icon}  ${Utils.escapeHTML(c.name)}</option>`;

    let html = '<option value="all">All categories</option>';
    groups.forEach((g) => {
      const items = CATEGORIES[g].map(option).join("");
      html += type === "all" ? `<optgroup label="${g === "income" ? "Income" : "Expense"}">${items}</optgroup>` : items;
    });
    els.categoryFilter.innerHTML = html;

    const stillValid = groups.some((g) => CATEGORIES[g].some((c) => c.name === state.filters.category));
    if (!stillValid) state.filters.category = "all";
    els.categoryFilter.value = state.filters.category;
  }

  /** Month options are built from the months that have transactions. */
  function renderMonthFilter() {
    const months = [...new Set(state.transactions.map((t) => Utils.monthKey(t.date)))].sort().reverse();
    els.monthFilter.innerHTML =
      '<option value="all">All months</option>' +
      months.map((m) => `<option value="${m}">${Utils.monthLabel(m)}</option>`).join("");

    if (!months.includes(state.filters.month)) state.filters.month = "all";
    els.monthFilter.value = state.filters.month;
  }

  function setTypeFilter(type) {
    state.filters.type = type;
    els.typeChips.forEach((chip) => {
      const active = chip.dataset.type === type;
      chip.classList.toggle("active", active);
      chip.setAttribute("aria-selected", String(active));
    });
    renderCategoryFilter();
  }

  function hasActiveFilters() {
    const f = state.filters;
    return f.type !== "all" || f.category !== "all" || f.month !== "all" || f.search !== "";
  }

  function resetFilters() {
    state.filters = { type: "all", category: "all", month: "all", search: "" };
    els.searchInput.value = "";
    setTypeFilter("all");
    renderMonthFilter();
    renderList();
    renderInsights();
  }

  /* ---------- Rendering ---------- */

  function renderSummary() {
    let income = 0;
    let expense = 0;
    let incomeCount = 0;
    let expenseCount = 0;

    state.transactions.forEach((t) => {
      if (t.type === "income") {
        income += t.amount;
        incomeCount++;
      } else {
        expense += t.amount;
        expenseCount++;
      }
    });

    const balance = income - expense;
    els.income.textContent = Utils.formatCurrency(income);
    els.expense.textContent = Utils.formatCurrency(expense);
    els.balance.textContent = Utils.formatCurrency(balance);
    els.incomeSub.textContent = `${incomeCount} transaction${incomeCount === 1 ? "" : "s"}`;
    els.expenseSub.textContent = `${expenseCount} transaction${expenseCount === 1 ? "" : "s"}`;
    els.balanceCard.classList.toggle("negative", balance < 0);

    if (!state.transactions.length) {
      els.balanceSub.textContent = "Start by adding your first transaction";
    } else if (income === 0) {
      els.balanceSub.textContent = "Add an income to see your savings rate";
    } else {
      const rate = Math.round((balance / income) * 100);
      els.balanceSub.textContent =
        balance >= 0 ? `You saved ${rate}% of your income 🎉` : `Overspent by ${Math.abs(rate)}% of your income`;
    }
  }

  function transactionHTML(t) {
    const cat = Utils.getCategory(t.type, t.category);
    const sign = t.type === "income" ? "+" : "−";
    return `
      <li class="transaction ${t.type}" data-id="${t.id}">
        <span class="tx-icon" aria-hidden="true">${cat.icon}</span>
        <div class="tx-info">
          <p class="tx-desc" title="${Utils.escapeHTML(t.description)}">${Utils.escapeHTML(t.description)}</p>
          <div class="tx-meta">
            <span class="tx-tag">${Utils.escapeHTML(t.category)}</span>
            <span>${Utils.formatDate(t.date)}</span>
          </div>
        </div>
        <span class="tx-amount">${sign}${Utils.formatCurrency(t.amount)}</span>
        <div class="tx-actions">
          <button type="button" class="tx-btn edit" data-action="edit" aria-label="Edit ${Utils.escapeHTML(t.description)}" title="Edit">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>
          </button>
          <button type="button" class="tx-btn delete" data-action="delete" aria-label="Delete ${Utils.escapeHTML(t.description)}" title="Delete">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M10 11v6M14 11v6"/></svg>
          </button>
        </div>
      </li>`;
  }

  function renderList() {
    const visible = getVisibleTransactions();
    const total = state.transactions.length;

    if (!visible.length) {
      els.list.innerHTML = "";
      els.emptyState.classList.remove("hidden");
      if (total) {
        els.emptyTitle.textContent = "No matching transactions";
        els.emptyText.textContent = "Try changing or resetting the filters.";
      } else {
        els.emptyTitle.textContent = "No transactions yet";
        els.emptyText.textContent = "Add your first income or expense using the form.";
      }
    } else {
      els.emptyState.classList.add("hidden");
      let html = "";
      let lastDate = null;
      visible.forEach((t) => {
        if (t.date !== lastDate) {
          html += `<li class="date-group">${Utils.friendlyDate(t.date)}</li>`;
          lastDate = t.date;
        }
        html += transactionHTML(t);
      });
      els.list.innerHTML = html;
    }

    els.listCount.textContent = total
      ? visible.length === total
        ? `${total} transaction${total === 1 ? "" : "s"}`
        : `Showing ${visible.length} of ${total}`
      : "No transactions yet";

    els.clearFiltersBtn.classList.toggle("hidden", !hasActiveFilters());
  }

  function highlight(id) {
    if (!id) return;
    const row = els.list.querySelector(`[data-id="${CSS.escape(id)}"]`);
    if (row) {
      row.classList.add("highlight");
      row.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }

  function render() {
    renderSummary();
    renderMonthFilter();
    renderList();
    renderInsights();
  }

  function renderInsights() {
    Charts.renderMonthly($("#monthlyChart"), $("#monthStats"), state.transactions);
    Charts.renderCategory(
      $("#categoryChart"),
      $("#categoryLegend"),
      $("#categoryChartSub"),
      state.transactions,
      state.filters.month
    );
  }

  /* ---------- Toasts ---------- */
  const TOAST_ICONS = { success: "✅", error: "⚠️", info: "ℹ️" };

  function showToast(message, type = "info") {
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.setAttribute("role", type === "error" ? "alert" : "status");
    toast.innerHTML = `<span aria-hidden="true">${TOAST_ICONS[type] || ""}</span><span>${Utils.escapeHTML(message)}</span>`;
    els.toasts.appendChild(toast);

    setTimeout(() => {
      toast.classList.add("leaving");
      toast.addEventListener("animationend", () => toast.remove(), { once: true });
    }, 2800);
  }

  /* ---------- Events ---------- */
  function bindEvents() {
    els.form.addEventListener("submit", handleSubmit);
    els.cancelEditBtn.addEventListener("click", () => {
      resetForm();
      showToast("Edit cancelled", "info");
    });

    els.typeInputs.forEach((input) =>
      input.addEventListener("change", () => {
        populateCategorySelect(input.value);
        clearFieldError("category");
      })
    );

    ["amount", "category", "date", "description"].forEach((field) => {
      const evt = field === "category" || field === "date" ? "change" : "input";
      els[field].addEventListener(evt, () => clearFieldError(field));
      els[field].addEventListener("blur", () => {
        if (els[field].value !== "") validateField(field);
      });
    });

    // Block characters like "e", "+" and "-" that number inputs otherwise allow.
    els.amount.addEventListener("keydown", (event) => {
      if (["e", "E", "+", "-"].includes(event.key)) event.preventDefault();
    });
    els.description.addEventListener("input", updateCharCount);

    els.list.addEventListener("click", (event) => {
      const btn = event.target.closest("[data-action]");
      if (!btn) return;
      const id = btn.closest(".transaction").dataset.id;
      if (btn.dataset.action === "edit") startEdit(id);
      if (btn.dataset.action === "delete") requestDelete(id);
    });

    els.typeChips.forEach((chip) =>
      chip.addEventListener("click", () => {
        setTypeFilter(chip.dataset.type);
        renderList();
      })
    );
    els.categoryFilter.addEventListener("change", () => {
      state.filters.category = els.categoryFilter.value;
      renderList();
    });
    els.monthFilter.addEventListener("change", () => {
      state.filters.month = els.monthFilter.value;
      renderList();
      renderInsights();
    });
    els.searchInput.addEventListener("input", () => {
      state.filters.search = els.searchInput.value.trim();
      renderList();
    });
    els.clearFiltersBtn.addEventListener("click", resetFilters);

    els.modalCancel.addEventListener("click", closeModal);
    els.modalConfirm.addEventListener("click", confirmDelete);
    els.modal.addEventListener("click", (event) => {
      if (event.target === els.modal) closeModal();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      if (!els.modal.classList.contains("hidden")) closeModal();
      else if (state.editingId) resetForm();
    });
  }

  /* ---------- Init ---------- */
  function init() {
    initTheme();
    els.today.textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
    populateCategorySelect(getSelectedType());
    els.date.value = Utils.todayISO();
    els.date.max = Utils.todayISO();
    els.date.min = Validator.MIN_DATE;
    bindEvents();
    renderCategoryFilter();
    render();
  }

  init();
})();
