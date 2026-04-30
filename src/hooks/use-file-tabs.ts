import { useState, useCallback, useRef, useMemo } from "react";

export interface FileTab {
  id: string;
  fileName: string;
  filePath: string | null;
  content: string;
  isDirty: boolean;
  savedContent: string;
}

function createTab(overrides?: Partial<FileTab>): FileTab {
  return {
    id: crypto.randomUUID(),
    fileName: "Untitled",
    filePath: null,
    content: "",
    isDirty: false,
    savedContent: "",
    ...overrides,
  };
}

export function useFileTabs() {
  const [tabs, setTabs] = useState<FileTab[]>(() => [createTab()]);
  const [activeTabId, setActiveTabId] = useState(() => tabs[0]!.id);
  const getMarkdownRef = useRef<(() => string) | null>(null);
  const tabsRef = useRef(tabs);
  tabsRef.current = tabs;
  const activeTabIdRef = useRef(activeTabId);
  activeTabIdRef.current = activeTabId;

  const registerGetMarkdown = useCallback((fn: () => string) => {
    getMarkdownRef.current = fn;
  }, []);

  const activeTab: FileTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0]!,
    [tabs, activeTabId],
  );

  const snapshotActiveTab = useCallback(() => {
    const md = getMarkdownRef.current?.() ?? "";
    const id = activeTabIdRef.current;
    setTabs((prev) =>
      prev.map((t) => (t.id === id ? { ...t, content: md } : t)),
    );
    return md;
  }, []);

  const switchTab = useCallback(
    (tabId: string) => {
      if (tabId === activeTabIdRef.current) return null;
      const md = getMarkdownRef.current?.() ?? "";
      const prevId = activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) => (t.id === prevId ? { ...t, content: md } : t)),
      );
      setActiveTabId(tabId);
      const target = tabsRef.current.find((t) => t.id === tabId);
      return target ?? null;
    },
    [],
  );

  const openInTab = useCallback(
    (
      fileName: string,
      filePath: string | null,
      content: string,
    ): { tab: FileTab; isNew: boolean } => {
      snapshotActiveTab();
      const currentTabs = tabsRef.current;
      const currentId = activeTabIdRef.current;
      const existing = filePath
        ? currentTabs.find((t) => t.filePath === filePath)
        : null;
      if (existing) {
        setActiveTabId(existing.id);
        return { tab: existing, isNew: false };
      }
      const currentTab = currentTabs.find((t) => t.id === currentId);
      const isUntitledEmpty =
        currentTab &&
        currentTab.fileName === "Untitled" &&
        !currentTab.filePath &&
        !currentTab.isDirty &&
        currentTab.content === "";
      if (isUntitledEmpty) {
        const updated: FileTab = {
          ...currentTab,
          fileName,
          filePath,
          content,
          isDirty: false,
          savedContent: content,
        };
        setTabs((prev) =>
          prev.map((t) => (t.id === currentTab.id ? updated : t)),
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
    [snapshotActiveTab],
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
      const currentTabs = tabsRef.current;
      if (currentTabs.length <= 1) {
        const fresh = createTab();
        setTabs([fresh]);
        setActiveTabId(fresh.id);
        return { switchTo: fresh };
      }
      const idx = currentTabs.findIndex((t) => t.id === tabId);
      const remaining = currentTabs.filter((t) => t.id !== tabId);
      if (tabId === activeTabIdRef.current) {
        const nextIdx = Math.min(idx, remaining.length - 1);
        const next = remaining[nextIdx]!;
        setActiveTabId(next.id);
        setTabs(remaining);
        return { switchTo: next };
      }
      setTabs(remaining);
      return { switchTo: null };
    },
    [],
  );

  const markTabDirty = useCallback(
    (tabId?: string) => {
      const id = tabId ?? activeTabIdRef.current;
      setTabs((prev) =>
        prev.map((t) => (t.id === id ? { ...t, isDirty: true } : t)),
      );
    },
    [],
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
