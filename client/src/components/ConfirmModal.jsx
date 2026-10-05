/* =========================================================
   components/ConfirmModal.jsx — the shared confirmation dialog,
   used for deleting one transaction and for clearing all data.
   ========================================================= */

import { useEffect, useRef } from "react";

export default function ConfirmModal({ request, onCancel }) {
  const confirmRef = useRef(null);

  useEffect(() => {
    if (!request) return;

    confirmRef.current?.focus();

    const onKeyDown = (event) => event.key === "Escape" && onCancel();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [request, onCancel]);

  if (!request) return null;

  const { icon, title, body, confirmLabel, onConfirm } = request;

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modalTitle"
      // Only a click on the backdrop itself dismisses, not one inside the dialog.
      onClick={(event) => event.target === event.currentTarget && onCancel()}
    >
      <div className="modal">
        <div className="modal-icon" aria-hidden="true">{icon}</div>
        <h3 id="modalTitle">{title}</h3>
        <p>{body}</p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onCancel}>
            Cancel
          </button>
          <button ref={confirmRef} type="button" className="btn btn-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
