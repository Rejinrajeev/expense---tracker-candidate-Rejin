/* =========================================================
   components/Toasts.jsx — the notification stack.
   ========================================================= */

const ICONS = { success: "✅", error: "⚠️", info: "ℹ️" };

export default function Toasts({ toasts, onDismiss }) {
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`toast ${toast.type}`}
          // Errors interrupt a screen reader; everything else waits its turn.
          role={toast.type === "error" ? "alert" : "status"}
        >
          <span aria-hidden="true">{ICONS[toast.type] || ""}</span>
          <span className="toast-msg">{toast.message}</span>

          {toast.action && (
            <button
              type="button"
              className="toast-action"
              onClick={() => {
                toast.action.onClick();
                onDismiss(toast.id);
              }}
            >
              {toast.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
