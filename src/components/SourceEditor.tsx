import { useState, useEffect, useRef, useCallback } from "react";

interface SourceEditorProps {
  markdown: string;
  onMarkdownChange: (md: string) => void;
  lineNumbers: boolean;
}

export function SourceEditor({ markdown, onMarkdownChange, lineNumbers }: SourceEditorProps) {
  const [value, setValue] = useState(markdown);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const gutterRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setValue(markdown);
  }, [markdown]);

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
      if (e.key === "Tab") {
        e.preventDefault();
        const textarea = e.currentTarget;
        const start = textarea.selectionStart;
        const end = textarea.selectionEnd;
        const newValue =
          value.substring(0, start) + "  " + value.substring(end);
        setValue(newValue);
        onMarkdownChange(newValue);
        requestAnimationFrame(() => {
          textarea.selectionStart = textarea.selectionEnd = start + 2;
        });
      }
    },
    [value, onMarkdownChange],
  );

  const handleScroll = useCallback(() => {
    if (gutterRef.current && textareaRef.current) {
      gutterRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  }, []);

  const lineCount = value.split("\n").length;

  return (
    <div className={`markd-source-editor ${lineNumbers ? "with-line-numbers" : ""}`}>
      {lineNumbers && (
        <div className="markd-line-gutter" ref={gutterRef}>
          {Array.from({ length: lineCount }, (_, i) => (
            <div key={i} className="markd-line-number">
              {i + 1}
            </div>
          ))}
        </div>
      )}
      <textarea
        ref={textareaRef}
        className="markd-source-textarea"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onScroll={handleScroll}
        spellCheck={false}
      />
    </div>
  );
}
