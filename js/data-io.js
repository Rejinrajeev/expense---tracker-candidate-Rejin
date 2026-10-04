/* =========================================================
   Data export (CSV / JSON backup) and validated JSON import
   ========================================================= */

const DataIO = {
  MAX_FILE_SIZE: 2 * 1024 * 1024, // 2 MB
  MAX_ITEMS: 5000,

  /** CSV with a header row; values are quoted so commas/quotes are safe. */
  toCSV(transactions) {
    const quote = (v) => `"${String(v).replace(/"/g, '""')}"`;
    // Prefix cells that spreadsheet apps could interpret as formulas.
    const safe = (v) => (/^[=+\-@]/.test(v) ? `'${v}` : v);
    const header = ["Date", "Type", "Category", "Description", "Amount"];
    const rows = transactions.map((t) =>
      [t.date, t.type, t.category, safe(t.description), (t.type === "expense" ? -t.amount : t.amount).toFixed(2)]
        .map(quote)
        .join(",")
    );
    return "﻿" + [header.map(quote).join(","), ...rows].join("\r\n");
  },

  toBackup(transactions, budget) {
    return JSON.stringify(
      { app: "SpendWise", version: 1, exportedAt: new Date().toISOString(), budget: budget || 0, transactions },
      null,
      2
    );
  },

  download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  },

  /** Check the file itself before reading it. Returns an error message or "". */
  checkFile(file) {
    if (!file) return "No file selected.";
    if (!/\.json$/i.test(file.name)) return "Please choose a .json backup file exported from this app.";
    if (file.size === 0) return "The selected file is empty.";
    if (file.size > this.MAX_FILE_SIZE) return "The file is too large (max 2 MB).";
    return "";
  },

  /**
   * Parse and validate a backup. Every transaction is checked with the same
   * rules as the form; invalid ones are skipped and counted.
   * Returns { transactions, budget, skipped } or { error }.
   */
  parseBackup(text) {
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      return { error: "This file isn't valid JSON." };
    }

    const list = Array.isArray(data) ? data : data && Array.isArray(data.transactions) ? data.transactions : null;
    if (!list) return { error: "No transactions found in this file." };
    if (list.length > this.MAX_ITEMS) return { error: `Too many transactions (max ${this.MAX_ITEMS}).` };

    const transactions = [];
    let skipped = 0;

    list.forEach((item) => {
      if (!item || typeof item !== "object") return skipped++;
      const candidate = {
        type: item.type,
        amount: String(item.amount ?? ""),
        category: item.category,
        date: item.date,
        description: Validator.cleanText(item.description),
      };
      const typeOk = candidate.type === "income" || candidate.type === "expense";
      if (!typeOk || Object.keys(Validator.validate(candidate)).length) return skipped++;

      transactions.push({
        id: typeof item.id === "string" && item.id ? item.id : Utils.uid(),
        type: candidate.type,
        amount: Math.round(Number(candidate.amount) * 100) / 100,
        category: candidate.category,
        date: candidate.date,
        description: candidate.description,
        createdAt: Number(item.createdAt) || Date.now(),
      });
    });

    const budget = data && !Array.isArray(data) && !Budget.validate(String(data.budget ?? "")) ? Number(data.budget) : 0;
    return { transactions, budget, skipped };
  },
};
