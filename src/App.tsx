import { useState, useEffect, useCallback, useRef } from "react";
import { useEditor } from "@tiptap/react";
import { Markdown } from "tiptap-markdown";
import { getExtensions } from "@/lib/editor-extensions";
import { useFileState } from "@/hooks/use-file-state";
import { useTheme } from "@/hooks/use-theme";
import { Editor } from "@/components/Editor";
import { Toolbar } from "@/components/Toolbar";
import { Menubar } from "@/components/Menubar";
import { Sidebar } from "@/components/Sidebar";
import { StatusBar } from "@/components/StatusBar";
import { FindReplace } from "@/components/FindReplace";
import { SourceEditor } from "@/components/SourceEditor";
import { ContextMenu } from "@/components/ContextMenu";
import { useRecentFiles } from "@/hooks/use-recent-files";
import { useFullWidth } from "@/hooks/use-full-width";
import { useFileTabs } from "@/hooks/use-file-tabs";
import { TabBar } from "@/components/TabBar";
import { exportAsHtml, exportAsPdf, readFileByPath, saveToFile } from "@/lib/file-system";

function isTauri(): boolean {
  // Tauri v2 exposes the IPC bridge as __TAURI_INTERNALS__ by default;
  // __TAURI__ only exists when withGlobalTauri is enabled in tauri.conf.json.
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarTab, setSidebarTab] = useState<"files" | "outline">("outline");
  const [showHotkeyHints, setShowHotkeyHints] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findReplaceShowReplace, setFindReplaceShowReplace] = useState(false);
  const lastSearchTermRef = useRef("");
  const [sourceMode, setSourceMode] = useState(false);
  const [sourceMarkdown, setSourceMarkdown] = useState("");
  const [focusMode, setFocusMode] = useState(false);
  const { activeTheme, switchTheme, themes } = useTheme();
  const { fullWidth, toggleFullWidth } = useFullWidth();
  const fileState = useFileState();
  const { recentFiles, addRecentFile } = useRecentFiles();
  const fileTabs = useFileTabs();

  // Directory of the currently-open file. Read by ResolvedImage at renderHTML
  // time, so it must be updated BEFORE setContent runs — do it synchronously
  // inside the registerSetContent callback.
  const fileDirRef = useRef<string>("");

  const editor = useEditor({
    extensions: [
      ...getExtensions({ getFileDir: () => fileDirRef.current }),
      Markdown.configure({
        html: true,
        tightLists: true,
        bulletListMarker: "-",
        transformPastedText: true,
        transformCopiedText: true,
      }),
    ],
    content: "",
    onUpdate: () => {
      fileState.markDirty();
    },
    editorProps: {
      attributes: {
        id: "write",
      },
    },
  });

  // Register editor methods with file state
  useEffect(() => {
    if (!editor) return;
    fileState.registerGetMarkdown(() => {
      return editor.storage.markdown.getMarkdown();
    });
    fileState.registerSetContent((md: string, fileDir: string) => {
      fileDirRef.current = fileDir;
      editor.commands.setContent(md, false);
    });
    fileTabs.registerGetMarkdown(() => {
      return editor.storage.markdown.getMarkdown();
    });
  }, [editor, fileState.registerGetMarkdown, fileState.registerSetContent, fileTabs.registerGetMarkdown]);

  // Track recent files when files are opened/saved
  useEffect(() => {
    if (fileState.filePath && fileState.fileName !== "Untitled") {
      addRecentFile(fileState.fileName, fileState.filePath);
    }
  }, [fileState.filePath, fileState.fileName, addRecentFile]);

  // Stable refs — used by event listeners and one-shot effects to avoid
  // stale closures and dependency-driven re-registration loops.
  const fileTabsRef = useRef(fileTabs);
  fileTabsRef.current = fileTabs;
  const fileStateRef = useRef(fileState);
  fileStateRef.current = fileState;

  // Load file passed as CLI arg / OS file association (Tauri only).
  // Skipped when tabs were restored from persistence (refresh case).
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!isTauri() || !editor || initialLoadDone.current) return;
    initialLoadDone.current = true;

    // If tabs were restored from localStorage, hydration handles content loading
    const hasPersistedTabs = fileTabsRef.current.tabs.some((t) => t.filePath);
    if (hasPersistedTabs) return;

    interface OpenedFile {
      path: string;
      name: string;
      content: string;
    }

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const file = await invoke<OpenedFile | null>("get_opened_file");
        if (!file) return;
        fileTabsRef.current.openInTab(file.name, file.path, file.content);
        fileStateRef.current.handleOpenByPath(file.path, file.content);
      } catch {
        // Not in Tauri or no file argument
      }
    })();
  }, [editor]);

  // Hydrate persisted tabs from disk — runs once after editor mounts.
  // Tabs restored from localStorage have filePath but empty content.
  const hydrationDone = useRef(false);
  useEffect(() => {
    if (!isTauri() || !editor || hydrationDone.current) return;
    hydrationDone.current = true;

    (async () => {
      const ft = fileTabsRef.current;
      const fs = fileStateRef.current;
      const tabs = ft.tabs;
      const activeId = ft.activeTabId;

      const needsHydration = tabs.filter((t) => t.filePath && t.content === "");
      if (needsHydration.length === 0) return;

      // Hydrate active tab first — sets editor content directly
      const activeTab = needsHydration.find((t) => t.id === activeId);
      if (activeTab && activeTab.filePath) {
        try {
          const content = await readFileByPath(activeTab.filePath);
          ft.hydrateTab(activeTab.id, content);
          fs.handleOpenByPath(activeTab.filePath, content);
          requestAnimationFrame(() => {
            const el = document.querySelector(".markd-editor-scroll") as HTMLElement | null;
            if (el) el.scrollTop = activeTab.scrollTop;
          });
        } catch {
          ft.closeTab(activeTab.id);
        }
      }

      // Hydrate background tabs — update content in state without switching
      for (const tab of needsHydration) {
        if (tab.id === activeId) continue;
        if (!tab.filePath) continue;
        try {
          const content = await readFileByPath(tab.filePath);
          ft.hydrateTab(tab.id, content);
        } catch {
          ft.closeTab(tab.id);
        }
      }
    })();
  }, [editor]);

  // Single-instance listener — registers once, uses refs for current state.
  useEffect(() => {
    if (!isTauri() || !editor) return;
    let unlisten: (() => void) | null = null;
    let cancelled = false;

    (async () => {
      const { listen } = await import("@tauri-apps/api/event");
      if (cancelled) return;
      unlisten = await listen<string>("open-file-in-tab", async (event) => {
        const ft = fileTabsRef.current;
        const fs = fileStateRef.current;
        const filePath = event.payload;
        const existing = ft.tabs.find((t) => t.filePath === filePath);
        if (existing) {
          const target = ft.switchTab(existing.id);
          if (target) fs.restoreState(target);
          return;
        }
        ft.openInTab(
          filePath.split(/[/\\]/).pop() ?? "untitled.md",
          filePath,
          "",
        );
        await fs.handleOpenByPath(filePath);
      });
    })();

    return () => { cancelled = true; unlisten?.(); };
  }, [editor]);

  // Toggle source mode
  const handleToggleSource = useCallback(() => {
    if (!editor) return;

    if (!sourceMode) {
      // Switching TO source: serialize current editor content
      const md = editor.storage.markdown.getMarkdown() as string;
      setSourceMarkdown(md);
      setSourceMode(true);
    } else {
      // Switching FROM source: parse markdown back into editor
      editor.commands.setContent(sourceMarkdown);
      setSourceMode(false);
    }
  }, [editor, sourceMode, sourceMarkdown]);

  // Handle source markdown changes — mark dirty
  const handleSourceMarkdownChange = useCallback(
    (md: string) => {
      setSourceMarkdown(md);
      fileState.markDirty();
    },
    [fileState.markDirty],
  );

  // Window title
  useEffect(() => {
    document.title = `${fileState.fileName}${fileState.isDirty ? " \u2022" : ""} \u2014 Markd`;
  }, [fileState.fileName, fileState.isDirty]);

  // Browser beforeunload (no-op in Tauri windows). Tauri's onCloseRequested
  // was removed: window.confirm can be suppressed inside a close-requested
  // handler on WebView2, returning falsy and blocking the close. Auto-save
  // (30s) covers named files; untitled docs rely on the user saving manually.
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (fileState.isDirty) e.preventDefault();
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [fileState.isDirty]);

  const handleThemeToggle = useCallback(() => {
    const currentIdx = themes.findIndex((t) => t.id === activeTheme);
    const next = themes[(currentIdx + 1) % themes.length];
    if (next) switchTheme(next.id);
  }, [activeTheme, themes, switchTheme]);

  const handleExportHtml = useCallback(async () => {
    if (!editor) return;
    await exportAsHtml(editor.getHTML(), fileState.fileName);
  }, [editor, fileState.fileName]);

  // Sync tab state when fileState changes (after open/save/new operations).
  // Uses refs so the effect always reads the current activeTabId.
  useEffect(() => {
    const ft = fileTabsRef.current;
    ft.markTabSaved(ft.activeTabId, {
      filePath: fileState.filePath,
      fileName: fileState.fileName,
      savedContent: fileState.savedContent,
    });
  }, [fileState.filePath, fileState.fileName, fileState.savedContent]);

  useEffect(() => {
    if (fileState.isDirty) fileTabsRef.current.markTabDirty();
  }, [fileState.isDirty]);

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      const scrollEl = document.querySelector(".markd-editor-scroll") as HTMLElement | null;
      const departingScroll = scrollEl?.scrollTop ?? 0;
      const target = fileTabs.switchTab(tabId, departingScroll);
      if (target) {
        fileState.restoreState(target);
        requestAnimationFrame(() => {
          const el = document.querySelector(".markd-editor-scroll") as HTMLElement | null;
          if (el) el.scrollTop = target.scrollTop;
        });
      }
    },
    [fileTabs.switchTab, fileState.restoreState],
  );

  const handleCloseTab = useCallback(
    async (tabId: string) => {
      const tab = fileTabs.tabs.find((t) => t.id === tabId);
      if (tab && tab.isDirty) {
        const shouldSave = window.confirm(
          `"${tab.fileName}" has unsaved changes. Save before closing?`,
        );
        if (shouldSave) {
          const saved = await fileState.handleSave();
          if (!saved) return;
        }
      }
      const { switchTo } = fileTabs.closeTab(tabId);
      if (switchTo) {
        fileState.restoreState(switchTo);
        requestAnimationFrame(() => {
          const el = document.querySelector(".markd-editor-scroll") as HTMLElement | null;
          if (el) el.scrollTop = switchTo.scrollTop;
        });
      }
    },
    [fileTabs.tabs, fileTabs.closeTab, fileState.handleSave, fileState.restoreState],
  );

  const handleNewTab = useCallback(() => {
    fileTabs.newTab();
    fileState.handleNew();
    requestAnimationFrame(() => {
      const el = document.querySelector(".markd-editor-scroll") as HTMLElement | null;
      if (el) el.scrollTop = 0;
    });
  }, [fileTabs.newTab, fileState.handleNew]);

  const cycleTab = useCallback(
    (direction: 1 | -1) => {
      const t = fileTabs.tabs;
      if (t.length <= 1) return;
      const idx = t.findIndex((tab) => tab.id === fileTabs.activeTabId);
      const nextIdx = (idx + direction + t.length) % t.length;
      const next = t[nextIdx];
      if (next) handleSwitchTab(next.id);
    },
    [fileTabs.tabs, fileTabs.activeTabId, handleSwitchTab],
  );

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === "F3" && editor) {
          e.preventDefault();
          const { from, to } = editor.state.selection;
          let term = "";
          if (from !== to) {
            term = editor.state.doc.textBetween(from, to);
          } else {
            const $pos = editor.state.doc.resolve(from);
            const text = $pos.parent.textContent;
            const offset = $pos.parentOffset;
            let start = offset;
            let end = offset;
            while (start > 0 && /\w/.test(text[start - 1]!)) start--;
            while (end < text.length && /\w/.test(text[end]!)) end++;
            if (start !== end) {
              term = text.slice(start, end);
            }
          }
          if (term) {
            editor.commands.setSearchTerm(term);
            setFindReplaceOpen(true);
            setFindReplaceShowReplace(false);
            window.dispatchEvent(new Event("markd:find-focus"));
          }
          return;
        }

        switch (e.key) {
          case "s":
            e.preventDefault();
            if (e.shiftKey) {
              // Ctrl+Shift+S: save all dirty tabs
              const allTabs = fileTabsRef.current.tabs;
              const active = fileTabsRef.current.activeTabId;
              (async () => {
                for (const tab of allTabs) {
                  if (!tab.isDirty || !tab.filePath) continue;
                  if (tab.id === active) {
                    await fileState.handleSave();
                  } else {
                    const ok = await saveToFile(tab.filePath, tab.content);
                    if (ok) fileTabsRef.current.markTabSaved(tab.id, { savedContent: tab.content });
                  }
                }
              })();
            } else {
              fileState.handleSave();
            }
            break;
          case "r":
            e.preventDefault();
            if (e.shiftKey) {
              // Ctrl+Shift+R: reload all tabs from disk
              (async () => {
                const ft = fileTabsRef.current;
                const fs = fileStateRef.current;
                for (const tab of ft.tabs) {
                  if (!tab.filePath) continue;
                  try {
                    const content = await readFileByPath(tab.filePath);
                    ft.hydrateTab(tab.id, content);
                    if (tab.id === ft.activeTabId) {
                      fs.handleOpenByPath(tab.filePath, content);
                    }
                  } catch { /* file gone */ }
                }
              })();
            } else {
              // Ctrl+R: reload active tab from disk
              const active = fileTabsRef.current.tabs.find(
                (t) => t.id === fileTabsRef.current.activeTabId,
              );
              if (active?.filePath) {
                (async () => {
                  try {
                    const content = await readFileByPath(active.filePath!);
                    fileTabsRef.current.hydrateTab(active.id, content);
                    fileStateRef.current.handleOpenByPath(active.filePath!, content);
                  } catch { /* file gone */ }
                })();
              }
            }
            break;
          case "o":
            e.preventDefault();
            fileState.handleOpen();
            break;
          case "n":
            e.preventDefault();
            fileState.handleNew();
            break;
          case "\\":
            e.preventDefault();
            setSidebarCollapsed((c) => !c);
            break;
          case "f":
            e.preventDefault();
            setFindReplaceShowReplace(false);
            setFindReplaceOpen(true);
            window.dispatchEvent(new Event("markd:find-focus"));
            break;
          case "h":
            e.preventDefault();
            setFindReplaceShowReplace(true);
            setFindReplaceOpen(true);
            break;
          case "/":
            e.preventDefault();
            handleToggleSource();
            break;
          case "w":
            e.preventDefault();
            handleCloseTab(fileTabs.activeTabId);
            break;
          case "Tab":
            e.preventDefault();
            cycleTab(e.shiftKey ? -1 : 1);
            break;
          case "t":
            if (e.shiftKey) break;
            e.preventDefault();
            handleNewTab();
            break;
        }
      }

      if (e.altKey && !e.ctrlKey) {
        if (e.key === "1") {
          e.preventDefault();
          setSidebarTab("files");
          setSidebarCollapsed(false);
        } else if (e.key === "2") {
          e.preventDefault();
          setSidebarTab("outline");
          setSidebarCollapsed(false);
        }
      }

      if (e.key === "F3") {
        e.preventDefault();
        if (!editor) return;
        const storage = editor.storage.searchAndReplace;
        if (!storage.searchTerm && lastSearchTermRef.current) {
          editor.commands.setSearchTerm(lastSearchTermRef.current);
        }
        if (e.shiftKey) {
          editor.commands.findPrevious();
        } else {
          editor.commands.findNext();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    fileState.handleSave,
    fileState.handleSaveAs,
    fileState.handleOpen,
    fileState.handleNew,
    handleToggleSource,
    handleCloseTab,
    handleNewTab,
    cycleTab,
    fileTabs.activeTabId,
  ]);

  // Show hotkey hints while Ctrl or Alt is held
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.key === "Control" || e.key === "Alt") && !e.repeat) {
        setShowHotkeyHints(true);
      }
    };
    const up = (e: KeyboardEvent) => {
      if (e.key === "Control" || e.key === "Alt") {
        setShowHotkeyHints(false);
      }
    };
    const blur = () => setShowHotkeyHints(false);
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      lastSearchTermRef.current = (e as CustomEvent).detail;
    };
    window.addEventListener("markd:search-term", handler);
    return () => window.removeEventListener("markd:search-term", handler);
  }, []);

  const handleFileSelectWithTabs = useCallback(
    async (entry: { kind: string; name: string; path: string }) => {
      if (entry.kind !== "file") return;
      const existing = fileTabs.tabs.find((t) => t.filePath === entry.path);
      if (existing) {
        handleSwitchTab(existing.id);
        return;
      }
      const { tab, isNew } = fileTabs.openInTab(entry.name, entry.path, "");
      try {
        await fileState.handleOpenByPath(entry.path);
      } catch {
        if (isNew) fileTabs.closeTab(tab.id);
      }
    },
    [fileTabs.tabs, fileTabs.openInTab, handleSwitchTab, fileState.handleOpenByPath],
  );

  const handleRecentFileSelect = useCallback(
    async (file: { name: string; path: string }) => {
      try {
        const existing = fileTabs.tabs.find((t) => t.filePath === file.path);
        if (existing) {
          handleSwitchTab(existing.id);
          return;
        }
        fileTabs.openInTab(file.name, file.path, "");
        await fileState.handleOpenByPath(file.path);
      } catch (err) {
        console.error("Failed to open recent file:", err);
      }
    },
    [fileState.handleOpenByPath, fileTabs.tabs, fileTabs.openInTab, handleSwitchTab],
  );

  const handleCloseFindReplace = useCallback(() => {
    setFindReplaceOpen(false);
    editor?.commands.clearDecorations();
  }, [editor]);

  return (
    <div className="markd-app">
      <Sidebar
        tree={fileState.dirTree}
        activeFile={fileState.fileName}
        activeFilePath={fileState.filePath}
        collapsed={sidebarCollapsed}
        editor={editor}
        recentFiles={recentFiles}
        activeTab={sidebarTab}
        onTabChange={setSidebarTab}
        showHotkeyHints={showHotkeyHints}
        onFileSelect={handleFileSelectWithTabs}
        onOpenFolder={fileState.handleOpenFolder}
        onToggle={() => setSidebarCollapsed((c) => !c)}
        onRecentFileSelect={handleRecentFileSelect}
      />
      <div className="markd-editor-area">
        <TabBar
          tabs={fileTabs.tabs}
          activeTabId={fileTabs.activeTabId}
          onSwitchTab={handleSwitchTab}
          onCloseTab={handleCloseTab}
          onNewTab={handleNewTab}
        />
        <Menubar
          editor={editor}
          sidebarCollapsed={sidebarCollapsed}
          sourceMode={sourceMode}
          focusMode={focusMode}
          fullWidth={fullWidth}
          activeTheme={activeTheme}
          themes={themes}
          onNew={fileState.handleNew}
          onOpen={fileState.handleOpen}
          onOpenFolder={fileState.handleOpenFolder}
          onSave={fileState.handleSave}
          onSaveAs={fileState.handleSaveAs}
          onExportHtml={handleExportHtml}
          onExportPdf={exportAsPdf}
          onFind={() => {
            setFindReplaceShowReplace(false);
            setFindReplaceOpen(true);
          }}
          onReplace={() => {
            setFindReplaceShowReplace(true);
            setFindReplaceOpen(true);
          }}
          onToggleSidebar={() => setSidebarCollapsed((c) => !c)}
          onToggleSource={handleToggleSource}
          onToggleFocusMode={() => setFocusMode((f) => !f)}
          onToggleFullWidth={toggleFullWidth}
          onThemeSelect={(id) => switchTheme(id as typeof activeTheme)}
          onNewTab={handleNewTab}
          onCloseTab={() => handleCloseTab(fileTabs.activeTabId)}
          onNextTab={() => cycleTab(1)}
          onPrevTab={() => cycleTab(-1)}
        />
        <div className="markd-topbar">
          {sidebarCollapsed && (
            <button
              className="markd-sidebar-toggle"
              onClick={() => setSidebarCollapsed(false)}
              title="Show Sidebar (Ctrl+\)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                <rect x="1" y="2" width="4" height="12" rx="1" opacity="0.3" />
                <rect x="6" y="2" width="9" height="12" rx="1" opacity="0.6" />
              </svg>
            </button>
          )}
          <Toolbar editor={editor} />
        </div>
        <div className="markd-editor-content">
          {findReplaceOpen && (
            <FindReplace
              editor={editor}
              showReplace={findReplaceShowReplace}
              onClose={handleCloseFindReplace}
            />
          )}
          {sourceMode ? (
            <SourceEditor
              markdown={sourceMarkdown}
              onMarkdownChange={handleSourceMarkdownChange}
            />
          ) : (
            <Editor
              editor={editor}
              onUpdate={fileState.markDirty}
              focusMode={focusMode}
            />
          )}
        </div>
        <StatusBar
          fileName={fileState.fileName}
          isDirty={fileState.isDirty}
          theme={activeTheme}
          lastSaved={fileState.lastSaved}
          sourceMode={sourceMode}
          focusMode={focusMode}
          fullWidth={fullWidth}
          onThemeChange={handleThemeToggle}
          onExportHtml={handleExportHtml}
          onExportPdf={exportAsPdf}
          onToggleSource={handleToggleSource}
          onToggleFocusMode={() => setFocusMode((f) => !f)}
          onToggleFullWidth={toggleFullWidth}
        />
      </div>
      <ContextMenu editor={editor} />
    </div>
  );
}
