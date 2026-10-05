/* =========================================================
   hooks/useToasts.js — the toast queue.
   ========================================================= */

import { useCallback, useMemo, useRef, useState } from "react";

const DEFAULT_DURATION = 2800;
const MAX_VISIBLE = 3;

export function useToasts() {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((current) => current.filter((t) => t.id !== id));
  }, []);

  /**
   * @param {"success"|"error"|"info"} type
   * @param {{label: string, onClick: Function, duration?: number}} [action]
   *   adds a button, e.g. "Undo" after a delete
   */
  const show = useCallback(
    (message, type = "info", action = null) => {
      const id = ++nextId.current;

      setToasts((current) => {
        // Keep the stack short so toasts never cover the page on small screens.
        const trimmed = current.slice(-(MAX_VISIBLE - 1));
        return [...trimmed, { id, message, type, action }];
      });

      setTimeout(() => dismiss(id), action?.duration || DEFAULT_DURATION);
      return id;
    },
    [dismiss]
  );

  const success = useCallback((message) => show(message, "success"), [show]);
  const error = useCallback((message) => show(message, "error"), [show]);
  const info = useCallback((message) => show(message, "info"), [show]);

  // Memoised so the object identity only changes when the queue does. Without
  // this, every consumer's useCallback would be rebuilt on every render.
  return useMemo(
    () => ({ toasts, show, success, error, info, dismiss }),
    [toasts, show, success, error, info, dismiss]
  );
}
