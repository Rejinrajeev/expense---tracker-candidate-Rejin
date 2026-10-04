/* =========================================================
   Form validation with helpful, field-specific messages
   ========================================================= */

const Validator = {
  MAX_AMOUNT: 10000000, // ₹1 crore
  MIN_DATE: "2000-01-01",
  DESC_MIN: 3,
  DESC_MAX: 60,

  amount(value) {
    if (value === "" || value == null) return "Amount is required.";
    if (!/^\d*\.?\d*$/.test(value) || isNaN(Number(value))) return "Amount must be a valid number.";
    const n = Number(value);
    if (n <= 0) return "Amount must be greater than zero.";
    if (n > this.MAX_AMOUNT) return `Amount can't exceed ${Utils.formatCurrency(this.MAX_AMOUNT)}.`;
    if (!/^\d+(\.\d{1,2})?$/.test(String(value).replace(/^\./, "0."))) return "Use at most 2 decimal places.";
    return "";
  },

  category(value, type) {
    if (!value) return `Please choose ${type === "income" ? "an income" : "an expense"} category.`;
    if (!CATEGORIES[type].some((c) => c.name === value)) return "Please choose a valid category.";
    return "";
  },

  date(value) {
    if (!value) return "Date is required.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || isNaN(Utils.parseDate(value))) return "Please enter a valid date.";
    if (value > Utils.todayISO()) return "Date can't be in the future.";
    if (value < this.MIN_DATE) return "Date must be on or after 1 Jan 2000.";
    return "";
  },

  description(value) {
    if (!value) return "Description is required.";
    if (value.length < this.DESC_MIN) return `Description must be at least ${this.DESC_MIN} characters.`;
    if (value.length > this.DESC_MAX) return `Description can't exceed ${this.DESC_MAX} characters.`;
    if (!/[\p{L}\p{N}]/u.test(value)) return "Description must contain letters or numbers.";
    return "";
  },

  /** Validate a whole form payload; returns { field: message } for invalid fields only. */
  validate(data) {
    const errors = {
      amount: this.amount(data.amount),
      category: this.category(data.category, data.type),
      date: this.date(data.date),
      description: this.description(data.description),
    };
    Object.keys(errors).forEach((k) => !errors[k] && delete errors[k]);
    return errors;
  },
};
