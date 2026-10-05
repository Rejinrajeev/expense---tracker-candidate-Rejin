/* =========================================================
   shared/categories.js — the category catalogue.

   Shared so the server can reject an unknown category and the
   client can render the same icons and chart colours without
   the two lists ever drifting apart.
   ========================================================= */

export const CATEGORIES = {
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

export const TYPES = ["income", "expense"];

/** Every category name, used by the Mongoose schema's enum. */
export const ALL_CATEGORY_NAMES = [
  ...CATEGORIES.income.map((c) => c.name),
  ...CATEGORIES.expense.map((c) => c.name),
];

export function isValidType(type) {
  return TYPES.includes(type);
}

/** Look up a category, falling back to a neutral placeholder for unknown names. */
export function getCategory(type, name) {
  const list = CATEGORIES[type] || [];
  return list.find((c) => c.name === name) || { name, icon: "🏷️", color: "#64748b" };
}

export function categoryExists(type, name) {
  return (CATEGORIES[type] || []).some((c) => c.name === name);
}
