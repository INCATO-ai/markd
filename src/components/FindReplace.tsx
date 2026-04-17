import { useState, useEffect, useRef, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { SearchState } from "@/lib/search-and-replace";

interface FindReplaceProps {
  editor: Editor | null;
  showReplace: boolean;
  onClose: () => void;
}

export function FindReplace({ editor, showReplace, onClose }: FindReplaceProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [replaceTerm, setReplaceTerm] = useState("");
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [replaceVisible, setReplaceVisible] = useState(showReplace);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync showReplace prop
  useEffect(() => {
    setReplaceVisible(showReplace);
  }, [showReplace]);

  // Focus search input on mount
  useEffect(() => {
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, []);

  // Update search on term or case sensitivity change
  useEffect(() => {
    if (!editor) return;
    editor.commands.setSearchTerm(searchTerm);
  }, [editor, searchTerm]);

  useEffect(() => {
    if (!editor) return;
    editor.commands.setCaseSensitive(caseSensitive);
  }, [editor, caseSensitive]);

  // Clear search on unmount
  useEffect(() => {
    return () => {
      editor?.commands.clearSearch();
    };
  }, [editor]);

  const storage = editor?.storage.searchAndReplace as SearchState | undefined;
  const matchCount = storage?.results.length ?? 0;
  const currentIndex = storage?.currentIndex ?? -1;

  const handleNext = useCallback(() => {
    editor?.commands.nextMatch();
  }, [editor]);

  const handlePrevious = useCallback(() => {
    editor?.commands.previousMatch();
  }, [editor]);

  const handleReplace = useCallback(() => {
    editor?.commands.replaceCurrentMatch(replaceTerm);
  }, [editor, replaceTerm]);

  const handleReplaceAll = useCallback(() => {
    editor?.commands.replaceAllMatches(replaceTerm);
  }, [editor, replaceTerm]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handlePrevious();
        } else {
          handleNext();
        }
      }
    },
    [onClose, handleNext, handlePrevious],
  );

  if (!editor) return null;

  return (
    <div className="markd-find-replace" onKeyDown={handleKeyDown}>
      <div className="markd-find-row">
        <input
          ref={searchInputRef}
          type="text"
          placeholder="Find..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="markd-find-input"
        />
        <span className="markd-find-count">
          {matchCount > 0
            ? `${currentIndex + 1} of ${matchCount}`
            : searchTerm
              ? "No results"
              : ""}
        </span>
        <button
          onClick={() => setCaseSensitive((c) => !c)}
          className={`markd-find-btn ${caseSensitive ? "active" : ""}`}
          title="Case Sensitive"
        >
          Aa
        </button>
        <button onClick={handlePrevious} className="markd-find-btn" title="Previous (Shift+Enter)">
          &#x25B2;
        </button>
        <button onClick={handleNext} className="markd-find-btn" title="Next (Enter)">
          &#x25BC;
        </button>
        <button
          onClick={() => setReplaceVisible((v) => !v)}
          className={`markd-find-btn ${replaceVisible ? "active" : ""}`}
          title="Toggle Replace"
        >
          &#x21C4;
        </button>
        <button onClick={onClose} className="markd-find-btn" title="Close (Escape)">
          &#x2715;
        </button>
      </div>
      {replaceVisible && (
        <div className="markd-find-row">
          <input
            type="text"
            placeholder="Replace..."
            value={replaceTerm}
            onChange={(e) => setReplaceTerm(e.target.value)}
            className="markd-find-input"
          />
          <button onClick={handleReplace} className="markd-find-btn" title="Replace">
            Replace
          </button>
          <button onClick={handleReplaceAll} className="markd-find-btn" title="Replace All">
            All
          </button>
        </div>
      )}
    </div>
  );
}
