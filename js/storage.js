/* =========================================================
   Local Storage persistence layer
   ========================================================= */

const Storage = {
  KEY: "spendwise.transactions.v1",
  THEME_KEY: "spendwise.theme",
  BUDGET_KEY: "spendwise.budget",

  /** Monthly budget limit, or 0 when none is set. */
  getBudget() {
    try {
      const value = Number(localStorage.getItem(this.BUDGET_KEY));
      return value > 0 ? value : 0;
    } catch {
      return 0;
    }
  },

  setBudget(value) {
    try {
      if (value) localStorage.setItem(this.BUDGET_KEY, String(value));
      else localStorage.removeItem(this.BUDGET_KEY);
    } catch {
      /* ignore */
    }
  },

  /** Load transactions; returns [] if nothing saved or data is corrupt. */
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (!raw) return [];
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) return [];
      return data.filter(
        (t) =>
          t &&
          typeof t.id === "string" &&
          (t.type === "income" || t.type === "expense") &&
          typeof t.amount === "number" &&
          typeof t.date === "string"
      );
    } catch (err) {
      console.warn("Could not read saved transactions:", err);
      return [];
    }
  },

  /** Save transactions; returns false if storage is unavailable or full. */
  save(transactions) {
    try {
      localStorage.setItem(this.KEY, JSON.stringify(transactions));
      return true;
    } catch (err) {
      console.error("Could not save transactions:", err);
      return false;
    }
  },

  getTheme() {
    try {
      return localStorage.getItem(this.THEME_KEY);
    } catch {
      return null;
    }
  },

  setTheme(theme) {
    try {
      localStorage.setItem(this.THEME_KEY, theme);
    } catch {
      /* ignore — theme is a convenience only */
    }
  },
};
