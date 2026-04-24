import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Node as PmNode } from "@tiptap/pm/model";
import { Decoration, DecorationSet } from "@tiptap/pm/view";

export interface SearchResult {
  from: number;
  to: number;
}

export interface SearchState {
  results: SearchResult[];
  currentIndex: number;
  searchTerm: string;
  caseSensitive: boolean;
}

const searchPluginKey = new PluginKey("searchAndReplace");

function scrollToMatch(editor: { view: { domAtPos: (pos: number) => { node: Node; offset: number } } }, match: SearchResult) {
  const dom = editor.view.domAtPos(match.from);
  const el = dom.node instanceof HTMLElement ? dom.node : dom.node.parentElement;
  el?.scrollIntoView({ block: "center", behavior: "smooth" });
}

function findMatches(
  doc: PmNode,
  searchTerm: string,
  caseSensitive: boolean,
): SearchResult[] {
  if (!searchTerm) return [];

  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  // Build flat text with a map from flat index → doc position
  const chars: string[] = [];
  const posMap: number[] = [];
  let prevEnd = -1;

  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      const t = node.text;
      if (prevEnd >= 0 && pos > prevEnd) {
        chars.push("\n");
        posMap.push(-1);
      }
      for (let i = 0; i < t.length; i++) {
        chars.push(t.charAt(i));
        posMap.push(pos + i);
      }
      prevEnd = pos + t.length;
    }
  });

  const haystack = caseSensitive ? chars.join("") : chars.join("").toLowerCase();
  const results: SearchResult[] = [];
  let searchPos = 0;

  while (searchPos < haystack.length) {
    const idx = haystack.indexOf(term, searchPos);
    if (idx === -1) break;
    const from = posMap[idx]!;
    const to = posMap[idx + term.length - 1]!;
    if (from >= 0 && to >= 0) {
      results.push({ from, to: to + 1 });
    }
    searchPos = idx + 1;
  }

  return results;
}

function createDecorations(
  doc: PmNode,
  results: SearchResult[],
  currentIndex: number,
): DecorationSet {
  const decorations: Decoration[] = [];

  results.forEach((result, i) => {
    const className =
      i === currentIndex
        ? "markd-search-highlight markd-search-current"
        : "markd-search-highlight";

    decorations.push(
      Decoration.inline(result.from, result.to, { class: className }),
    );
  });

  return DecorationSet.create(doc, decorations);
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    searchAndReplace: {
      setSearchTerm: (term: string) => ReturnType;
      setCaseSensitive: (caseSensitive: boolean) => ReturnType;
      nextMatch: () => ReturnType;
      previousMatch: () => ReturnType;
      replaceCurrentMatch: (replacement: string) => ReturnType;
      replaceAllMatches: (replacement: string) => ReturnType;
      clearSearch: () => ReturnType;
    };
  }
}

export const SearchAndReplace = Extension.create({
  name: "searchAndReplace",

  addStorage() {
    return {
      results: [] as SearchResult[],
      currentIndex: 0,
      searchTerm: "",
      caseSensitive: false,
    } satisfies SearchState;
  },

  addCommands() {
    return {
      setSearchTerm:
        (term: string) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.searchTerm = term;
          const results = findMatches(
            editor.state.doc,
            term,
            editor.storage.searchAndReplace.caseSensitive,
          );
          editor.storage.searchAndReplace.results = results;
          editor.storage.searchAndReplace.currentIndex =
            results.length > 0 ? 0 : -1;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          const first = results[0];
          if (first) {
            scrollToMatch(editor, first);
          }
          return true;
        },

      setCaseSensitive:
        (caseSensitive: boolean) =>
        ({ editor }) => {
          editor.storage.searchAndReplace.caseSensitive = caseSensitive;
          const results = findMatches(
            editor.state.doc,
            editor.storage.searchAndReplace.searchTerm,
            caseSensitive,
          );
          editor.storage.searchAndReplace.results = results;
          editor.storage.searchAndReplace.currentIndex =
            results.length > 0 ? 0 : -1;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          const first = results[0];
          if (first) {
            scrollToMatch(editor, first);
          }
          return true;
        },

      nextMatch:
        () =>
        ({ editor }) => {
          const storage = editor.storage.searchAndReplace as SearchState;
          if (storage.results.length === 0) return false;
          storage.currentIndex =
            (storage.currentIndex + 1) % storage.results.length;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          const match = storage.results[storage.currentIndex];
          if (match) {
            editor.commands.setTextSelection(match.from);
            scrollToMatch(editor, match);
          }
          return true;
        },

      previousMatch:
        () =>
        ({ editor }) => {
          const storage = editor.storage.searchAndReplace as SearchState;
          if (storage.results.length === 0) return false;
          storage.currentIndex =
            (storage.currentIndex - 1 + storage.results.length) %
            storage.results.length;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          const match = storage.results[storage.currentIndex];
          if (match) {
            editor.commands.setTextSelection(match.from);
            scrollToMatch(editor, match);
          }
          return true;
        },

      replaceCurrentMatch:
        (replacement: string) =>
        ({ editor }) => {
          const storage = editor.storage.searchAndReplace as SearchState;
          if (storage.results.length === 0 || storage.currentIndex < 0)
            return false;
          const match = storage.results[storage.currentIndex];
          if (!match) return false;

          editor
            .chain()
            .focus()
            .insertContentAt({ from: match.from, to: match.to }, replacement)
            .run();

          // Re-search after replacement
          const newResults = findMatches(
            editor.state.doc,
            storage.searchTerm,
            storage.caseSensitive,
          );
          storage.results = newResults;
          storage.currentIndex =
            newResults.length > 0
              ? Math.min(storage.currentIndex, newResults.length - 1)
              : -1;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          return true;
        },

      replaceAllMatches:
        (replacement: string) =>
        ({ editor }) => {
          const storage = editor.storage.searchAndReplace as SearchState;
          if (storage.results.length === 0) return false;

          // Replace from end to start so positions stay valid
          const sorted = [...storage.results].sort(
            (a, b) => b.from - a.from,
          );
          const { tr } = editor.state;
          for (const match of sorted) {
            tr.insertText(replacement, match.from, match.to);
          }
          editor.view.dispatch(tr);

          // Clear results
          storage.results = [];
          storage.currentIndex = -1;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          return true;
        },

      clearSearch:
        () =>
        ({ editor }) => {
          const storage = editor.storage.searchAndReplace as SearchState;
          storage.searchTerm = "";
          storage.results = [];
          storage.currentIndex = -1;
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
          return true;
        },
    };
  },

  addProseMirrorPlugins() {
    const extensionThis = this;

    return [
      new Plugin({
        key: searchPluginKey,
        state: {
          init() {
            return DecorationSet.empty;
          },
          apply(tr, _oldState) {
            if (tr.getMeta(searchPluginKey)) {
              const storage = extensionThis.storage as SearchState;
              return createDecorations(
                tr.doc,
                storage.results,
                storage.currentIndex,
              );
            }
            // If the document changed, recompute
            if (tr.docChanged) {
              const storage = extensionThis.storage as SearchState;
              if (storage.searchTerm) {
                const results = findMatches(
                  tr.doc,
                  storage.searchTerm,
                  storage.caseSensitive,
                );
                storage.results = results;
                if (
                  storage.currentIndex >= results.length
                ) {
                  storage.currentIndex = results.length > 0 ? 0 : -1;
                }
                return createDecorations(
                  tr.doc,
                  results,
                  storage.currentIndex,
                );
              }
            }
            return _oldState;
          },
        },
        props: {
          decorations(state) {
            return this.getState(state);
          },
        },
      }),
    ];
  },
});
