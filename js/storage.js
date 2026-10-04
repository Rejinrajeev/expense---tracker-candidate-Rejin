/* =========================================================
   Local Storage persistence layer
   ========================================================= */

const Storage = {
  KEY: "spendwise.transactions.v1",
  THEME_KEY: "spendwise.theme",

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
