import { useState, useEffect } from "react";

interface StatusBarProps {
  fileName: string;
  isDirty: boolean;
  theme: string;
  lastSaved: number | null;
  sourceMode: boolean;
  focusMode: boolean;
  onThemeChange: () => void;
  onExportHtml: () => void;
  onExportPdf: () => void;
  onToggleSource: () => void;
  onToggleFocusMode: () => void;
}

export function StatusBar({
  fileName,
  isDirty,
  theme,
  lastSaved,
  sourceMode,
  focusMode,
  onThemeChange,
  onExportHtml,
  onExportPdf,
  onToggleSource,
  onToggleFocusMode,
}: StatusBarProps) {
  const [stats, setStats] = useState({ words: 0, chars: 0 });
  const [showSaved, setShowSaved] = useState(false);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      setStats(detail);
    };
    window.addEventListener("markd:stats", handler);
    return () => window.removeEventListener("markd:stats", handler);
  }, []);

  // Flash "Saved" for 2 seconds after each save
  useEffect(() => {
    if (!lastSaved) return;
    setShowSaved(true);
    const timer = setTimeout(() => setShowSaved(false), 2000);
    return () => clearTimeout(timer);
  }, [lastSaved]);

  return (
    <div className="markd-status-bar">
      <div className="left">
        <span>
          {fileName}
          {isDirty ? " \u2022" : ""}
        </span>
        {showSaved && <span className="markd-saved-indicator">Saved</span>}
      </div>
      <div className="right">
        <span>{stats.words} words</span>
        <span>{stats.chars} chars</span>
        <button
          onClick={onToggleFocusMode}
          style={btnStyle}
          title="Focus Mode (Ctrl+Shift+F)"
          className={focusMode ? "status-btn-active" : ""}
        >
          Focus
        </button>
        <button onClick={onToggleSource} style={btnStyle} title="Toggle Source (Ctrl+/)">
          {sourceMode ? "WYSIWYG" : "Source"}
        </button>
        <button onClick={onExportHtml} style={btnStyle}>
          HTML
        </button>
        <button onClick={onExportPdf} style={btnStyle}>
          PDF
        </button>
        <button onClick={onThemeChange} style={btnStyle}>
          {theme}
        </button>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: "none",
  border: "none",
  color: "inherit",
  cursor: "pointer",
  fontSize: "inherit",
  padding: "2px 6px",
  borderRadius: 3,
};
