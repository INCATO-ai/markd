import { useEffect, useRef } from "react";
import { EditorContent } from "@tiptap/react";
import type { Editor as TiptapEditor } from "@tiptap/react";

interface EditorProps {
  editor: TiptapEditor | null;
  onUpdate: () => void;
  focusMode: boolean;
}

export function Editor({ editor, focusMode }: EditorProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Dispatch word/char stats on every transaction. `transaction` (not
  // `update`) is required because file loads use `setContent(md, false)`
  // which suppresses the `update` event — stats would stay at 0 after load.
  useEffect(() => {
    if (!editor) return;
    const handler = () => {
      const text = editor.state.doc.textContent;
      const words = text.split(/\s+/).filter(Boolean).length;
      window.dispatchEvent(
        new CustomEvent("markd:stats", {
          detail: { words, chars: text.length },
        }),
      );
    };
    editor.on("transaction", handler);
    handler();
    return () => {
      editor.off("transaction", handler);
    };
  }, [editor]);

  // Focus mode:
  //  - Dimming: listen to `transaction` so every PM re-render re-applies
  //    inline opacity (PM reconciles DOM per transaction and would wipe it).
  //  - Typewriter scroll: listen to `update` ONLY — fires on actual typing,
  //    not on passive re-renders or selection changes. Binding scroll to
  //    `transaction` made every click/arrow-key snap back, which felt like
  //    the scroll was locked to the cursor.
  useEffect(() => {
    if (!editor) return;
    if (!focusMode) {
      clearFocusClasses(editor);
      return;
    }

    const dim = () => applyFocusClasses(editor);
    const scroll = () => typewriterScroll(editor, scrollRef.current);

    editor.on("transaction", dim);
    editor.on("update", scroll);
    dim();

    return () => {
      editor.off("transaction", dim);
      editor.off("update", scroll);
      clearFocusClasses(editor);
    };
  }, [editor, focusMode]);

  if (!editor) return null;

  return (
    <div
      ref={scrollRef}
      className={`markd-editor-scroll ${focusMode ? "focus-mode" : ""}`}
    >
      <EditorContent editor={editor} />
    </div>
  );
}

/* ── Focus mode helpers ──────────────────────────────────────────── */

// Runs after the next paint so ProseMirror has finished any DOM reconciliation
// from the current transaction. Inline styles applied during the transaction
// could be overwritten by PM's reconciliation; rAF guarantees we run after.
function applyFocusClasses(editor: TiptapEditor): void {
  requestAnimationFrame(() => applyFocusClassesSync(editor));
}

function applyFocusClassesSync(editor: TiptapEditor): void {
  const { from } = editor.state.selection;
  const $pos = editor.state.doc.resolve(from);
  const activePos = $pos.depth > 0 ? $pos.before(1) : 0;
  const activeDom = editor.view.nodeDOM(activePos);

  const root = editor.view.dom;
  root.setAttribute("data-focus-mode", "on");

  // Find the "block container" — the element whose direct children are
  // top-level blocks. In most tiptap configs this IS `root`, but if tiptap
  // wraps content (happens when some extensions inject a wrapper node), the
  // container may be `root.firstElementChild` instead.
  let container: HTMLElement = root;
  if (
    root.children.length === 1 &&
    root.firstElementChild instanceof HTMLElement &&
    !["P", "H1", "H2", "H3", "H4", "H5", "H6", "PRE", "BLOCKQUOTE", "UL", "OL", "TABLE", "HR", "FIGURE"].includes(
      root.firstElementChild.tagName,
    )
  ) {
    container = root.firstElementChild;
  }

  const topBlocks = Array.from(container.children).filter(
    (el): el is HTMLElement => el instanceof HTMLElement,
  );

  for (const block of topBlocks) {
    const isActive =
      block === activeDom ||
      (activeDom instanceof Node && block.contains(activeDom));
    block.style.opacity = isActive ? "1" : "0.25";
    block.style.transition = "opacity 0.2s ease";
  }
}

function clearFocusClasses(editor: TiptapEditor): void {
  const root = editor.view.dom;
  root.removeAttribute("data-focus-mode");
  const all = root.querySelectorAll<HTMLElement>("*");
  for (const el of Array.from(all)) {
    if (el.style.opacity) el.style.opacity = "";
    if (el.style.transition === "opacity 0.2s ease") el.style.transition = "";
    if (el.style.outline) el.style.outline = "";
  }
  // Also clear opacity/transition on direct children of root and its wrapper.
  for (const child of Array.from(root.children)) {
    if (child instanceof HTMLElement) {
      child.style.opacity = "";
      child.style.transition = "";
      child.style.outline = "";
    }
  }
}

function typewriterScroll(
  editor: TiptapEditor,
  scrollContainer: HTMLElement | null,
): void {
  if (!scrollContainer) return;

  const { from } = editor.state.selection;
  const coords = editor.view.coordsAtPos(from);
  const containerRect = scrollContainer.getBoundingClientRect();
  const centerY = containerRect.top + containerRect.height / 2;
  const offset = coords.top - centerY;

  scrollContainer.scrollBy({ top: offset, behavior: "smooth" });
}
