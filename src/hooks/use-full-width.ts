import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "markd-full-width";

function getInitial(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === "0") return false;
  if (stored === "1") return true;
  return true;
}

// Full-width mode swaps #write's 860px reading column for 100% of the editor
// area. Stored as a data-full-width attribute on <html> so CSS can pick it up
// and transition max-width smoothly.
export function useFullWidth() {
  const [fullWidth, setFullWidth] = useState<boolean>(getInitial);

  useEffect(() => {
    document.documentElement.dataset.fullWidth = fullWidth ? "true" : "false";
  }, [fullWidth]);

  const toggleFullWidth = useCallback(() => {
    setFullWidth((v) => {
      const next = !v;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { fullWidth, toggleFullWidth };
}
