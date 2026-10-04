/* =========================================================
   Utilities & constants shared across the app
   ========================================================= */

const CATEGORIES = {
  income: [
    { name: "Salary", icon: "💼", color: "#10b981" },
    { name: "Freelance", icon: "💻", color: "#06b6d4" },
    { name: "Business", icon: "🏢", color: "#3b82f6" },
    { name: "Investments", icon: "📈", color: "#8b5cf6" },
    { name: "Gifts", icon: "🎁", color: "#ec4899" },
    { name: "Other Income", icon: "💰", color: "#64748b" },
  ],
  expense: [
    { name: "Food & Dining", icon: "🍔", color: "#f97316" },
    { name: "Groceries", icon: "🛒", color: "#84cc16" },
    { name: "Transport", icon: "🚗", color: "#3b82f6" },
    { name: "Shopping", icon: "🛍️", color: "#ec4899" },
    { name: "Bills & Utilities", icon: "💡", color: "#eab308" },
    { name: "Rent", icon: "🏠", color: "#8b5cf6" },
    { name: "Health", icon: "💊", color: "#ef4444" },
    { name: "Education", icon: "📚", color: "#06b6d4" },
    { name: "Entertainment", icon: "🎬", color: "#a855f7" },
    { name: "Travel", icon: "✈️", color: "#14b8a6" },
    { name: "Other Expense", icon: "📦", color: "#64748b" },
  ],
};

const Utils = {
  currencyFormatter: new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }),

  formatCurrency(value) {
    return this.currencyFormatter.format(value || 0);
  },

  /** Compact currency for chart labels, e.g. ₹12.5K */
  formatCompact(value) {
    const abs = Math.abs(value);
    if (abs >= 1e7) return `₹${(value / 1e7).toFixed(1)}Cr`;
    if (abs >= 1e5) return `₹${(value / 1e5).toFixed(1)}L`;
    if (abs >= 1e3) return `₹${(value / 1e3).toFixed(1)}K`;
    return `₹${Math.round(value)}`;
  },

  /** Parse a YYYY-MM-DD string as a local date (avoids timezone shifts). */
  parseDate(iso) {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d);
  },

  /** Today's date as YYYY-MM-DD in local time. */
  todayISO() {
    const d = new Date();
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  },

  formatDate(iso, options = { day: "numeric", month: "short", year: "numeric" }) {
    return this.parseDate(iso).toLocaleDateString("en-IN", options);
  },

  /** Friendly label for grouping: Today, Yesterday or a full date. */
  friendlyDate(iso) {
    const today = this.todayISO();
    const y = new Date();
    y.setDate(y.getDate() - 1);
    const pad = (n) => String(n).padStart(2, "0");
    const yesterday = `${y.getFullYear()}-${pad(y.getMonth() + 1)}-${pad(y.getDate())}`;
    if (iso === today) return "Today";
    if (iso === yesterday) return "Yesterday";
    return this.formatDate(iso, { weekday: "short", day: "numeric", month: "short", year: "numeric" });
  },

  /** YYYY-MM key for a date string. */
  monthKey(iso) {
    return iso.slice(0, 7);
  },

  monthLabel(key, opts = { month: "long", year: "numeric" }) {
    const [y, m] = key.split("-").map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString("en-IN", opts);
  },

  uid() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  },

  escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  },

  getCategory(type, name) {
    const list = CATEGORIES[type] || [];
    return list.find((c) => c.name === name) || { name, icon: "🏷️", color: "#64748b" };
  },
};
