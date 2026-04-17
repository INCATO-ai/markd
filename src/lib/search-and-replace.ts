import { Extension } from "@tiptap/core";
import { Plugin, PluginKey } from "@tiptap/pm/state";
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

function findMatches(
  doc: { textBetween: (from: number, to: number, blockSeparator?: string, leafText?: string) => string; content: { size: number } },
  searchTerm: string,
  caseSensitive: boolean,
): SearchResult[] {
  if (!searchTerm) return [];

  const results: SearchResult[] = [];
  const text = doc.textBetween(0, doc.content.size, "\n", "\0");
  const term = caseSensitive ? searchTerm : searchTerm.toLowerCase();
  const haystack = caseSensitive ? text : text.toLowerCase();

  let pos = 0;
  while (pos < haystack.length) {
    const idx = haystack.indexOf(term, pos);
    if (idx === -1) break;
    // +1 because textBetween starts from position 0 but doc positions start at 1
    results.push({ from: idx + 1, to: idx + term.length + 1 });
    pos = idx + 1;
  }

  return results;
}

function createDecorations(
  doc: Parameters<typeof findMatches>[0],
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

  return DecorationSet.create(doc as Parameters<typeof DecorationSet.create>[0], decorations);
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
          // Force plugin state update via a transaction
          editor.view.dispatch(editor.state.tr.setMeta(searchPluginKey, true));
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
          // Scroll to match
          const match = storage.results[storage.currentIndex];
          if (match) {
            editor.commands.setTextSelection(match.from);
            const dom = editor.view.domAtPos(match.from);
            if (dom.node instanceof HTMLElement) {
              dom.node.scrollIntoView({ block: "center" });
            } else if (dom.node.parentElement) {
              dom.node.parentElement.scrollIntoView({ block: "center" });
            }
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
            const dom = editor.view.domAtPos(match.from);
            if (dom.node instanceof HTMLElement) {
              dom.node.scrollIntoView({ block: "center" });
            } else if (dom.node.parentElement) {
              dom.node.parentElement.scrollIntoView({ block: "center" });
            }
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
