import { useState, useEffect, useRef, useCallback } from "react";

interface SourceEditorProps {
  markdown: string;
  onMarkdownChange: (md: string) => void;
}

export function SourceEditor({ markdown, onMarkdownChange }: SourceEditorProps) {
  const [value, setValue] = useState(markdown);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync incoming markdown when switching to source mode
  useEffect(() => {
    setValue(markdown);
  }, [markdown]);

  // Focus on mount
  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      setValue(e.target.value);
      onMarkdownChange(e.target.value);
    },
    [onMarkdownChange],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // Tab inserts 2 spaces instead of changing focus
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          value.substring(0, start) + "  " + value.substring(end);
        setValue(newValue);
        onMarkdownChange(newValue);
        // Restore cursor position after React re-render
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [value, onMarkdownChange],
  );

  return (
    <div className="markd-source-editor">
      <textarea
        ref={textareaRef}
        className="markd-source-textarea"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        spellCheck={false}
      />
    </div>
  );
}
