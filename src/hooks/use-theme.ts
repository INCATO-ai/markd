import { useState, useCallback, useEffect } from "react";

export const THEMES = [
  { id: "day", name: "Day" },
  { id: "night", name: "Night" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const STORAGE_KEY = "markd-theme";

function getInitialTheme(): ThemeId {
  const stored = localStorage.getItem(STORAGE_KEY);
  const migrated = stored === "markd" ? "day" : stored;
  if (migrated !== stored && stored !== null) localStorage.setItem(STORAGE_KEY, migrated!);
  if (migrated && THEMES.some((t) => t.id === migrated)) return migrated as ThemeId;
  return "day";
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
