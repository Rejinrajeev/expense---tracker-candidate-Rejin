/* =========================================================
   components/TransactionForm.jsx — add and edit a transaction.

   Runs the shared validators for instant feedback. The server
   runs the same ones again, and any errors it returns are merged
   into the same `errors` state, so a field looks identical
   whether the complaint came from the browser or the API.
   ========================================================= */

import { useEffect, useMemo, useRef, useState } from "react";

import { CATEGORIES } from "@shared/categories.js";
import { formatCurrency, formatDate, todayISO } from "@shared/utils.js";
import {
  cleanText,
  FIELD_RULES,
  findDuplicate,
  LIMITS,
  validateAmount,
  validateTransaction,
} from "@shared/validation.js";

const LARGE_AMOUNT = 100000;

const blankForm = () => ({
  type: "expense",
  amount: "",
  category: "",
  date: todayISO(),
  description: "",
});

export default function TransactionForm({
  transactions,
  editing,
  onSubmit,
  onCancelEdit,
  onHighlight,
  toasts,
}) {
  const [form, setForm] = useState(blankForm);
  const [errors, setErrors] = useState({});
  const [notice, setNotice] = useState("");
  const [acceptedDuplicate, setAcceptedDuplicate] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const amountRef = useRef(null);
  const cardRef = useRef(null);

  const isEditing = Boolean(editing);

  /* Load the row being edited into the fields. */
  useEffect(() => {
    if (!editing) return;

    setForm({
      type: editing.type,
      amount: String(editing.amount),
      category: editing.category,
      date: editing.date,
      description: editing.description,
    });
    setErrors({});
    setNotice("");
    setAcceptedDuplicate(null);

    cardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    amountRef.current?.focus({ preventScroll: true });
  }, [editing]);

  /* Escape cancels an edit in progress. */
  useEffect(() => {
    if (!isEditing) return;

    const onKeyDown = (event) => event.key === "Escape" && onCancelEdit();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isEditing, onCancelEdit]);

  const amountHint = useMemo(() => {
    const { amount } = form;
    if (amount === "" || Number(amount) <= 0 || validateAmount(amount)) return "";

    const value = Number(amount);
    return `${formatCurrency(value)}${value >= LARGE_AMOUNT ? " · large amount, please double-check" : ""}`;
  }, [form]);

  function setField(name, value) {
    setForm((current) => {
      // Switching type invalidates a category belonging to the other type.
      if (name === "type") return { ...current, type: value, category: "" };
      return { ...current, [name]: value };
    });

    // Once a field shows an error, re-check it as the user types.
    setErrors((current) => (current[name] ? { ...current, [name]: "" } : current));

    if (acceptedDuplicate) {
      setAcceptedDuplicate(null);
      setNotice("");
    }
  }

  function validateField(name) {
    const message = FIELD_RULES[name]({ ...form, description: cleanText(form.description) });
    setErrors((current) => ({ ...current, [name]: message }));
  }

  function reset() {
    // Keep the selected type, so adding several expenses in a row is quick.
    setForm({ ...blankForm(), type: form.type });
    setErrors({});
    setNotice("");
    setAcceptedDuplicate(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitting) return;

    const data = { ...form, description: cleanText(form.description) };
    const found = validateTransaction(data);

    if (Object.keys(found).length) {
      setErrors(found);
      toasts.error("Please fix the highlighted fields.");
      return;
    }

    // The first submit of an identical transaction warns; submitting the same
    // details again goes through.
    const duplicate = findDuplicate(data, transactions, editing?.id ?? null);
    const key = JSON.stringify(data);

    if (duplicate && acceptedDuplicate !== key) {
      setAcceptedDuplicate(key);
      setNotice(
        `An identical transaction already exists on ${formatDate(duplicate.date)}. ` +
          `Press the button again to add it anyway.`
      );
      onHighlight(duplicate.id);
      toasts.error("Possible duplicate. Submit again to confirm.");
      return;
    }

    setSubmitting(true);
    const serverErrors = await onSubmit(data);
    setSubmitting(false);

    if (serverErrors) {
      setErrors(serverErrors);
      return;
    }
    reset();
  }

  const submitLabel = acceptedDuplicate
    ? "Add Anyway"
    : isEditing
      ? "Save Changes"
      : "Add Transaction";

  return (
    <section ref={cardRef} className={`card form-card${isEditing ? " editing" : ""}`} aria-labelledby="formTitle">
      <div className="card-head">
        <div>
          <h2 id="formTitle">{isEditing ? "Edit Transaction" : "Add Transaction"}</h2>
          <p className="card-sub">
            {isEditing ? "Update the details and save your changes" : "Record a new income or expense"}
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} noValidate>
        <div className="type-toggle" role="radiogroup" aria-label="Transaction type">
          <input
            type="radio"
            name="type"
            id="typeExpense"
            value="expense"
            checked={form.type === "expense"}
            onChange={() => setField("type", "expense")}
          />
          <label htmlFor="typeExpense" className="toggle-option expense">
            <span aria-hidden="true">↘</span> Expense
          </label>
          <input
            type="radio"
            name="type"
            id="typeIncome"
            value="income"
            checked={form.type === "income"}
            onChange={() => setField("type", "income")}
          />
          <label htmlFor="typeIncome" className="toggle-option income">
            <span aria-hidden="true">↗</span> Income
          </label>
          <span className="toggle-slider" aria-hidden="true" />
        </div>

        {/* Written out rather than wrapped in <Field>, because the amount is
            the one field with a hint line below its error message. */}
        <div className={`field${errors.amount ? " invalid" : ""}`}>
          <label htmlFor="amount">
            Amount <span className="req">*</span>
          </label>
          <div className="input-wrap with-prefix">
            <span className="prefix" aria-hidden="true">₹</span>
            <input
              ref={amountRef}
              type="number"
              id="amount"
              placeholder="0.00"
              step="0.01"
              min="0"
              inputMode="decimal"
              aria-describedby="amountError"
              aria-invalid={Boolean(errors.amount)}
              value={form.amount}
              onChange={(e) => setField("amount", e.target.value)}
              onBlur={() => form.amount !== "" && validateField("amount")}
              // Number inputs otherwise accept these, and they are not amounts.
              onKeyDown={(e) => ["e", "E", "+", "-"].includes(e.key) && e.preventDefault()}
            />
          </div>
          <p className="error-msg" id="amountError" role="alert">{errors.amount || ""}</p>
          <p className="field-hint" id="amountHint" aria-live="polite">{amountHint}</p>
        </div>

        <div className="field-row">
          <Field name="category" label="Category" error={errors.category}>
            <div className="input-wrap select-wrap">
              <select
                id="category"
                aria-describedby="categoryError"
                aria-invalid={Boolean(errors.category)}
                value={form.category}
                onChange={(e) => setField("category", e.target.value)}
                onBlur={() => form.category !== "" && validateField("category")}
              >
                <option value="" disabled>Select category</option>
                {CATEGORIES[form.type].map((c) => (
                  <option key={c.name} value={c.name}>{c.icon}  {c.name}</option>
                ))}
              </select>
            </div>
          </Field>

          <Field name="date" label="Date" error={errors.date}>
            <div className="input-wrap">
              <input
                type="date"
                id="date"
                max={todayISO()}
                min={LIMITS.MIN_DATE}
                aria-describedby="dateError"
                aria-invalid={Boolean(errors.date)}
                value={form.date}
                onChange={(e) => setField("date", e.target.value)}
                onBlur={() => form.date !== "" && validateField("date")}
              />
            </div>
          </Field>
        </div>

        <div className={`field${errors.description ? " invalid" : ""}`}>
          <label htmlFor="description">
            Description <span className="req">*</span>
          </label>
          <div className="input-wrap">
            <input
              type="text"
              id="description"
              placeholder="e.g. Groceries from supermarket"
              maxLength={LIMITS.DESC_MAX}
              autoComplete="off"
              aria-describedby="descriptionError"
              aria-invalid={Boolean(errors.description)}
              value={form.description}
              onChange={(e) => setField("description", e.target.value)}
              onBlur={() => form.description !== "" && validateField("description")}
            />
          </div>
          <div className="field-meta">
            <p className="error-msg" id="descriptionError" role="alert">{errors.description || ""}</p>
            <span className="char-count">
              {form.description.length}/{LIMITS.DESC_MAX}
            </span>
          </div>
          <p className="field-notice" role="status">{notice}</p>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
              <path d="M12 5v14M5 12h14" />
            </svg>
            <span>{submitting ? "Saving…" : submitLabel}</span>
          </button>
          {isEditing && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                reset();
                onCancelEdit();
              }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

/** Label + control + error message, with the wrapper classes the CSS expects. */
function Field({ name, label, error, children }) {
  return (
    <div className={`field${error ? " invalid" : ""}`}>
      <label htmlFor={name}>
        {label} <span className="req">*</span>
      </label>
      {children}
      <p className="error-msg" id={`${name}Error`} role="alert">{error || ""}</p>
    </div>
  );
}
