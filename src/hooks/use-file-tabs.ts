import { useState, useCallback, useRef } from "react";

export interface FileTab {
  id: string;
  fileName: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
  savedContent: string;
  lastSaved: number | null;
}

let nextTabId = 1;

function createTab(overrides?: Partial<FileTab>): FileTab {
  return {
    id: String(nextTabId++),
    fileName: "Untitled",
    filePath: null,
    content: "",
    isDirty: false,
    savedContent: "",
    lastSaved: null,
    ...overrides,
  };
}

export function useFileTabs() {
  const [tabs, setTabs] = useState<FileTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]!.id);
  const getMarkdownRef = useRef<(() => string) | null>(null);

  const registerGetMarkdown = useCallback((fn: () => string) => {
    getMarkdownRef.current = fn;
  }, []);

  const activeTab: FileTab = tabs.find((t) => t.id === activeTabId) ?? tabs[0]!;

  const snapshotActiveTab = useCallback(() => {
    const md = getMarkdownRef.current?.() ?? "";
    setTabs((prev) =>
      prev.map((t) => (t.id === activeTabId ? { ...t, content: md } : t)),
    );
    return md;
  }, [activeTabId]);

  const switchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabId) return null;
      const md = getMarkdownRef.current?.() ?? "";
      setTabs((prev) =>
        prev.map((t) => (t.id === activeTabId ? { ...t, content: md } : t)),
      );
      setActiveTabId(tabId);
      const target = tabs.find((t) => t.id === tabId);
      return target ?? null;
    },
    [activeTabId, tabs],
  );

  const openInTab = useCallback(
    (
      fileName: string,
      filePath: string | null,
      content: string,
    ): { tab: FileTab; isNew: boolean } => {
      snapshotActiveTab();
      const existing = filePath
        ? tabs.find((t) => t.filePath === filePath)
        : null;
      if (existing) {
        setActiveTabId(existing.id);
        return { tab: existing, isNew: false };
      }
      const isUntitledEmpty =
        activeTab.fileName === "Untitled" &&
        !activeTab.filePath &&
        !activeTab.isDirty &&
        activeTab.content === "";
      if (isUntitledEmpty) {
        const updated: FileTab = {
          ...activeTab,
          fileName,
          filePath,
          content,
          isDirty: false,
          savedContent: content,
        };
        setTabs((prev) =>
          prev.map((t) => (t.id === activeTab.id ? updated : t)),
        );
        return { tab: updated, isNew: false };
      }
      const tab = createTab({
        fileName,
        filePath,
        content,
        savedContent: content,
      });
      setTabs((prev) => [...prev, tab]);
      setActiveTabId(tab.id);
      return { tab, isNew: true };
    },
    [tabs, activeTab, snapshotActiveTab],
  );

  const newTab = useCallback((): FileTab => {
    snapshotActiveTab();
    const tab = createTab();
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    return tab;
  }, [snapshotActiveTab]);

  const closeTab = useCallback(
    (tabId: string): { switchTo: FileTab | null } => {
      if (tabs.length <= 1) {
        const fresh = createTab();
        setTabs([fresh]);
        setActiveTabId(fresh.id);
        return { switchTo: fresh };
      }
      const idx = tabs.findIndex((t) => t.id === tabId);
      const remaining = tabs.filter((t) => t.id !== tabId);
      if (tabId === activeTabId) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        const next = remaining[nextIdx]!;
        setActiveTabId(next.id);
        setTabs(remaining);
        return { switchTo: next };
      }
      setTabs(remaining);
      return { switchTo: null };
    },
    [tabs, activeTabId],
  );

  const markTabDirty = useCallback(
    (tabId?: string) => {
      const id = tabId ?? activeTabId;
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isDirty: true } : t)),
      );
    },
    [activeTabId],
  );

  const markTabSaved = useCallback(
    (
      tabId: string,
      updates: {
        filePath?: string | null;
        fileName?: string;
        savedContent: string;
      },
    ) => {
      setTabs((prev) =>
        prev.map((t) =>
          t.id === tabId
            ? {
                ...t,
                isDirty: false,
                savedContent: updates.savedContent,
                lastSaved: Date.now(),
                ...(updates.filePath !== undefined
                  ? { filePath: updates.filePath }
                  : {}),
                ...(updates.fileName !== undefined
                  ? { fileName: updates.fileName }
                  : {}),
              }
            : t,
        ),
      );
    },
    [],
  );

  return {
    tabs,
    activeTab,
    activeTabId,
    switchTab,
    openInTab,
    newTab,
    closeTab,
    markTabDirty,
    markTabSaved,
    registerGetMarkdown,
  };
}
