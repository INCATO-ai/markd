import { useState, useCallback, useRef, useEffect } from "react";
import {
  FileEntry,
  openFile,
  openDirectory,
  saveToFile,
  saveFileAs,
  readFileByPath,
} from "@/lib/file-system";

function dirname(filePath: string): string {
  const lastSep = Math.max(filePath.lastIndexOf("/"), filePath.lastIndexOf("\\"));
  return lastSep >= 0 ? filePath.slice(0, lastSep) : "";
}

const AUTO_SAVE_DELAY_MS = 30_000;

export interface FileState {
  fileName: string;
  filePath: string | null;
  isDirty: boolean;
  dirTree: FileEntry[];
  savedContent: string;
  lastSaved: number | null;
}

export function useFileState() {
  const [state, setState] = useState<FileState>({
    fileName: "Untitled",
    filePath: null,
    isDirty: false,
    dirTree: [],
    savedContent: "",
    lastSaved: null,
  });

  const getMarkdownRef = useRef<(() => string) | null>(null);
  const setContentRef = useRef<((md: string, fileDir: string) => void) | null>(null);

  const registerGetMarkdown = useCallback((fn: () => string) => {
    getMarkdownRef.current = fn;
  }, []);

  const registerSetContent = useCallback(
    (fn: (md: string, fileDir: string) => void) => {
      setContentRef.current = fn;
    },
    [],
  );

  const markDirty = useCallback(() => {
    setState((prev) => (prev.isDirty ? prev : { ...prev, isDirty: true }));
  }, []);

  const handleOpen = useCallback(async () => {
    const result = await openFile();
    if (!result) return;

    setContentRef.current?.(result.content, dirname(result.path));
    setState((prev) => ({
      ...prev,
      fileName: result.name,
      filePath: result.path,
      isDirty: false,
      savedContent: result.content,
    }));
  }, []);

  const handleOpenFolder = useCallback(async () => {
    const result = await openDirectory();
    if (!result) return;
    setState((prev) => ({
      ...prev,
      dirTree: result.tree,
    }));
  }, []);

  const handleSave = useCallback(async () => {
    const md = getMarkdownRef.current?.() ?? "";

    if (state.filePath) {
      const ok = await saveToFile(state.filePath, md);
      if (ok) setState((prev) => ({ ...prev, isDirty: false, savedContent: md, lastSaved: Date.now() }));
      return ok;
    }

    // No path yet — save as
    const result = await saveFileAs(md, state.fileName);
    if (result) {
      setState((prev) => ({
        ...prev,
        filePath: result.path,
        fileName: result.name,
        isDirty: false,
        savedContent: md,
        lastSaved: Date.now(),
      }));
      return true;
    }
    return false;
  }, [state.filePath, state.fileName]);

  const handleSaveAs = useCallback(async () => {
    const md = getMarkdownRef.current?.() ?? "";
    const result = await saveFileAs(md, state.fileName);
    if (result) {
      setState((prev) => ({
        ...prev,
        filePath: result.path,
        fileName: result.name,
        isDirty: false,
        savedContent: md,
        lastSaved: Date.now(),
      }));
    }
  }, [state.fileName]);

  const handleFileSelect = useCallback(async (entry: FileEntry) => {
    if (entry.kind !== "file") return;
    const content = await readFileByPath(entry.path);

    setContentRef.current?.(content, dirname(entry.path));
    setState((prev) => ({
      ...prev,
      fileName: entry.name,
      filePath: entry.path,
      isDirty: false,
      savedContent: content,
    }));
  }, []);

  const handleNew = useCallback(() => {
    setContentRef.current?.("", "");
    setState((prev) => ({
      fileName: "Untitled",
      filePath: null,
      isDirty: false,
      dirTree: prev.dirTree,
      savedContent: "",
      lastSaved: null,
    }));
  }, []);

  const handleOpenByPath = useCallback(async (filePath: string, preloadedContent?: string) => {
    const content = preloadedContent ?? await readFileByPath(filePath);
    const name = filePath.split(/[/\\]/).pop() ?? "untitled.md";

    setContentRef.current?.(content, dirname(filePath));
    setState((prev) => ({
      ...prev,
      fileName: name,
      filePath,
      isDirty: false,
      savedContent: content,
    }));
  }, []);

  // Auto-save: debounce 30s after last edit, only if file has a path
  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    if (state.isDirty && state.filePath) {
      autoSaveTimerRef.current = setTimeout(async () => {
        const md = getMarkdownRef.current?.() ?? "";
        const ok = await saveToFile(state.filePath!, md);
        if (ok) {
          setState((prev) => ({
            ...prev,
            isDirty: false,
            savedContent: md,
            lastSaved: Date.now(),
          }));
        }
      }, AUTO_SAVE_DELAY_MS);
    }

    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [state.isDirty, state.filePath]);

  return {
    ...state,
    markDirty,
    handleOpen,
    handleOpenFolder,
    handleSave,
    handleSaveAs,
    handleFileSelect,
    handleNew,
    handleOpenByPath,
    registerGetMarkdown,
    registerSetContent,
  };
}
