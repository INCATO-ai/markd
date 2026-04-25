import { useState, useEffect, useCallback } from "react";
import type { Editor } from "@tiptap/react";

interface OutlinePanelProps {
  editor: Editor | null;
}

interface HeadingEntry {
  id: string;
  text: string;
  level: number;
  pos: number;
}

function extractHeadings(editor: Editor): HeadingEntry[] {
  const headings: HeadingEntry[] = [];
  const doc = editor.state.doc;

  doc.descendants((node, pos) => {
    if (node.type.name === "heading") {
      const level = node.attrs.level as number;
      const text = node.textContent;
      if (text.trim()) {
        headings.push({
          id: `heading-${pos}`,
          text,
          level,
          pos,
        });
      }
    }
  });

  return headings;
}

export function OutlinePanel({ editor }: OutlinePanelProps) {
  const [headings, setHeadings] = useState<HeadingEntry[]>([]);

  useEffect(() => {
    if (!editor) return;

    const update = () => setHeadings(extractHeadings(editor));
    update();

    editor.on("update", update);
    return () => {
      editor.off("update", update);
    };
  }, [editor]);

  const handleClick = useCallback(
    (pos: number) => {
      if (!editor) return;

      const dom = editor.view.nodeDOM(pos);
      const element =
        dom instanceof HTMLElement ? dom : (dom as Node)?.parentElement;

      editor.chain().focus().setTextSelection(pos + 1).run();
      element?.scrollIntoView({ behavior: "smooth", block: "center" });
    },
    [editor],
  );

  if (headings.length === 0) {
    return (
      <div className="markd-outline-empty">
        No headings in this document
      </div>
    );
  }

  // Find min level for relative indentation
  const minLevel = Math.min(...headings.map((h) => h.level));

  return (
    <div className="markd-outline">
      {headings.map((heading) => (
        <div
          key={heading.id}
          className="markd-outline-item"
          style={{ paddingLeft: 16 + (heading.level - minLevel) * 16 }}
          onClick={() => handleClick(heading.pos)}
          title={heading.text}
        >
          <span className="markd-outline-level">H{heading.level}</span>
          <span className="markd-outline-text">{heading.text}</span>
        </div>
      ))}
    </div>
  );
}
