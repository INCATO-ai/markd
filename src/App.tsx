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
import { exportAsHtml, exportAsPdf } from "@/lib/file-system";

function isTauri(): boolean {
  // Tauri v2 exposes the IPC bridge as __TAURI_INTERNALS__ by default;
  // __TAURI__ only exists when withGlobalTauri is enabled in tauri.conf.json.
  return "__TAURI_INTERNALS__" in window || "__TAURI__" in window;
}

export function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [findReplaceOpen, setFindReplaceOpen] = useState(false);
  const [findReplaceShowReplace, setFindReplaceShowReplace] = useState(false);
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

  // Load file passed as CLI arg / OS file association (Tauri only)
  useEffect(() => {
    if (!isTauri() || !editor) return;
    let cancelled = false;

    interface OpenedFile {
      path: string;
      name: string;
      content: string;
    }

    (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        const file = await invoke<OpenedFile | null>("get_opened_file");
        if (cancelled || !file) return;
        // handleOpenByPath routes through setContentRef which updates fileDir
        // before calling editor.setContent.
        fileState.handleOpenByPath(file.path, file.content);
      } catch {
        // Not in Tauri or no file argument
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editor, fileState.handleOpenByPath]);

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

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "s":
            e.preventDefault();
            if (e.shiftKey) {
              fileState.handleSaveAs();
            } else {
              fileState.handleSave();
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
          // Focus Mode (Ctrl+Shift+F) disabled in v0.1.0 — see TODO.md.
          // Re-enable by restoring this case.
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
  ]);

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

  // Sync tab state when fileState changes (after open/save/new operations)
  useEffect(() => {
    fileTabs.markTabSaved(fileTabs.activeTabId, {
      filePath: fileState.filePath,
      fileName: fileState.fileName,
      savedContent: fileState.savedContent,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileState.filePath, fileState.fileName, fileState.savedContent]);

  useEffect(() => {
    if (fileState.isDirty) fileTabs.markTabDirty();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileState.isDirty]);

  const handleSwitchTab = useCallback(
    (tabId: string) => {
      const target = fileTabs.switchTab(tabId);
      if (target) fileState.restoreState(target);
    },
    [fileTabs.switchTab, fileState.restoreState],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      const { switchTo } = fileTabs.closeTab(tabId);
      if (switchTo) fileState.restoreState(switchTo);
    },
    [fileTabs.closeTab, fileState.restoreState],
  );

  const handleNewTab = useCallback(() => {
    fileTabs.newTab();
    fileState.handleNew();
  }, [fileTabs.newTab, fileState.handleNew]);

  const handleFileSelectWithTabs = useCallback(
    async (entry: { kind: string; name: string; path: string }) => {
      if (entry.kind !== "file") return;
      const existing = fileTabs.tabs.find((t) => t.filePath === entry.path);
      if (existing) {
        handleSwitchTab(existing.id);
        return;
      }
      fileTabs.openInTab(entry.name, entry.path, "");
      await fileState.handleOpenByPath(entry.path);
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
    editor?.commands.clearSearch();
  }, [editor]);

  return (
    <div className="markd-app">
      <Sidebar
        tree={fileState.dirTree}
        activeFile={fileState.fileName}
        collapsed={sidebarCollapsed}
        editor={editor}
        recentFiles={recentFiles}
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
