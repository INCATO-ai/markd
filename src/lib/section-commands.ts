import { Extension, type Editor } from "@tiptap/core";

export interface HeadingEntry {
  id: string;
  text: string;
  level: number;
  pos: number;
}

export function extractHeadings(editor: Editor): HeadingEntry[] {
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

export function getSectionEnd(
  headings: HeadingEntry[],
  index: number,
  docSize: number,
): number {
  const heading = headings[index]!;
  for (let i = index + 1; i < headings.length; i++) {
    if (headings[i]!.level <= heading.level) {
      return headings[i]!.pos;
    }
  }
  return docSize;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    sectionCommands: {
      moveSection: (fromIndex: number, toIndex: number) => ReturnType;
    };
  }
}

export const SectionCommands = Extension.create({
  name: "sectionCommands",

  addCommands() {
    return {
      moveSection:
        (fromIndex: number, toIndex: number) =>
        ({ editor }: { editor: Editor }) => {
          if (fromIndex === toIndex) return false;

          const headings = extractHeadings(editor);
          if (fromIndex < 0 || fromIndex >= headings.length) return false;
          if (toIndex < 0 || toIndex >= headings.length) return false;

          const docSize = editor.state.doc.content.size;
          const fromStart = headings[fromIndex]!.pos;
          const fromEnd = getSectionEnd(headings, fromIndex, docSize);
          const section = editor.state.doc.slice(fromStart, fromEnd);

          const { tr } = editor.state;
          tr.delete(fromStart, fromEnd);

          // NOTE: tr.mapping.map() adjusts positions for the prior delete — manual arithmetic breaks on nested sections
          const toStart = headings[toIndex]!.pos;
          const toEnd = getSectionEnd(headings, toIndex, docSize);
          const insertAt =
            toIndex > fromIndex
              ? tr.mapping.map(toEnd)
              : tr.mapping.map(toStart);

          tr.insert(insertAt, section.content);
          editor.view.dispatch(tr);
          return true;
        },
    };
  },
});
