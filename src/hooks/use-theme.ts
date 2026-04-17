import { useState, useCallback, useEffect } from "react";

export const THEMES = [
  { id: "markd", name: "Markd" },
  { id: "night", name: "Night" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "markd-theme";

function getInitialTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && THEMES.some((t) => t.id === stored)) return stored as ThemeId;
  return "markd";
}

export function useTheme() {
  const [activeTheme, setActiveTheme] = useState<ThemeId>(getInitialTheme);

  // Apply data-theme attribute on mount and when theme changes
  useEffect(() => {
    document.documentElement.dataset.theme = activeTheme;
  }, [activeTheme]);

  const switchTheme = useCallback((id: ThemeId) => {
    setActiveTheme(id);
    localStorage.setItem(STORAGE_KEY, id);
  }, []);

  return { activeTheme, switchTheme, themes: THEMES };
}
