import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "markd-line-numbers";

export function useLineNumbers() {
  const [lineNumbers, setLineNumbers] = useState(() => {
    return localStorage.getItem(STORAGE_KEY) === "1";
  });

  useEffect(() => {
    document.documentElement.dataset.lineNumbers = lineNumbers ? "true" : "false";
  }, [lineNumbers]);

  const toggleLineNumbers = useCallback(() => {
    setLineNumbers((prev) => {
      const next = !prev;
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }, []);

  return { lineNumbers, toggleLineNumbers };
}
