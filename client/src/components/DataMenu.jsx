/* =========================================================
   components/DataMenu.jsx — the "⋯" menu holding CSV export,
   JSON backup, restore and clear-all.
   ========================================================= */

import { useEffect, useRef, useState } from "react";

import { checkFile, parseBackup, toBackup, toCSV } from "@shared/serializer.js";
import { plural, todayISO } from "@shared/utils.js";
import { downloadFile, readTextFile } from "../lib/download.js";

export default function DataMenu({
  visible,
  transactions,
  budgetLimit,
  onImport,
  onRequestClear,
  toasts,
}) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);
  const fileRef = useRef(null);

  /* Any click outside the menu closes it. */
  useEffect(() => {
    if (!open) return;

    const onDocumentClick = (event) => {
      // contains(), not ===: a click lands on the <svg> inside the button,
      // so an identity check would miss it and close the menu twice.
      const insideMenu = menuRef.current?.contains(event.target);
      const onButton = buttonRef.current?.contains(event.target);
      if (!insideMenu && !onButton) setOpen(false);
    };

    document.addEventListener("click", onDocumentClick);
    return () => document.removeEventListener("click", onDocumentClick);
  }, [open]);

  /** Exports what the filters are currently showing, not the whole database. */
  function exportCSV() {
    if (!visible.length) {
      toasts.error("Nothing to export. Add or show some transactions first.");
      return;
    }

    downloadFile(
      `spendwise-transactions-${todayISO()}.csv`,
      toCSV(visible),
      "text/csv;charset=utf-8"
    );
    toasts.success(`Exported ${plural(visible.length, "transaction")} to CSV`);
  }

  function downloadBackup() {
    if (!transactions.length) {
      toasts.error("Nothing to back up yet.");
      return;
    }

    downloadFile(
      `spendwise-backup-${todayISO()}.json`,
      toBackup(transactions, budgetLimit),
      "application/json"
    );
    toasts.success("Backup downloaded");
  }

  async function handleFile(file) {
    const fileError = checkFile(file);
    if (fileError) {
      toasts.error(fileError);
      return;
    }

    try {
      const parsed = parseBackup(await readTextFile(file));
      if (parsed.error) {
        toasts.error(parsed.error);
        return;
      }
      await onImport(parsed);
    } catch (err) {
      toasts.error(err.message);
    }
  }

  function run(action) {
    setOpen(false);

    switch (action) {
      case "csv":
        return exportCSV();
      case "backup":
        return downloadBackup();
      case "import":
        // Clear first so re-picking the same file still fires change.
        if (fileRef.current) fileRef.current.value = "";
        return fileRef.current?.click();
      case "clear":
        return onRequestClear();
    }
  }

  return (
    <div className="menu">
      <button
        ref={buttonRef}
        type="button"
        className="icon-btn icon-btn-sm"
        aria-haspopup="true"
        aria-expanded={open}
        aria-label="Export, import and data options"
        title="Export / Import"
        onClick={() => setOpen((current) => !current)}
      >
        <svg viewBox="0 0 24 24" fill="currentColor">
          <circle cx="5" cy="12" r="2" />
          <circle cx="12" cy="12" r="2" />
          <circle cx="19" cy="12" r="2" />
        </svg>
      </button>

      {open && (
        <div
          ref={menuRef}
          className="menu-list"
          role="menu"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            setOpen(false);
            buttonRef.current?.focus();
          }}
        >
          <button type="button" role="menuitem" onClick={() => run("csv")}>
            📄 Export visible as CSV
          </button>
          <button type="button" role="menuitem" onClick={() => run("backup")}>
            💾 Download backup (JSON)
          </button>
          <button type="button" role="menuitem" onClick={() => run("import")}>
            📥 Restore from backup…
          </button>
          <hr />
          <button type="button" role="menuitem" className="danger" onClick={() => run("clear")}>
            🧹 Clear all data
          </button>
        </div>
      )}

      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        hidden
        onChange={(event) => handleFile(event.target.files[0])}
      />
    </div>
  );
}
