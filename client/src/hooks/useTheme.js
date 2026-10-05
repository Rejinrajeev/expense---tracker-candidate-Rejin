/* =========================================================
   hooks/useTheme.js — light / dark theme.

   The chosen theme is the one thing still kept in Local Storage:
   it is a per-browser display preference, not account data, so it
   does not belong in MongoDB.
   ========================================================= */

import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "spendwise.theme";

function readSaved() {
  try {
    return localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function systemPrefersDark() {
  return globalThis.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

export function useTheme() {
  const [theme, setTheme] = useState(() => readSaved() || (systemPrefersDark() ? "dark" : "light"));

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    // Keep the mobile browser chrome in step with the page.
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#0b1020" : "#6366f1");

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* ignore — the theme is a convenience only */
    }
  }, [theme]);

  const toggle = useCallback(() => {
    setTheme((current) => (current === "dark" ? "light" : "dark"));
  }, []);

  return { theme, toggle };
}
