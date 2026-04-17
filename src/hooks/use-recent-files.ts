import { useState, useCallback } from "react";

export interface RecentFile {
  name: string;
  path: string;
  timestamp: number;
}

const STORAGE_KEY = "markd-recent-files";
const MAX_RECENT = 10;

function loadRecentFiles(): RecentFile[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as RecentFile[];
    return parsed.sort((a, b) => b.timestamp - a.timestamp).slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

function persistRecentFiles(files: RecentFile[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function useRecentFiles() {
  const [recentFiles, setRecentFiles] = useState<RecentFile[]>(loadRecentFiles);

  const addRecentFile = useCallback((name: string, path: string) => {
    setRecentFiles((prev) => {
      const filtered = prev.filter((f) => f.path !== path);
      const updated = [{ name, path, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENT);
      persistRecentFiles(updated);
      return updated;
    });
  }, []);

  const getRecentFiles = useCallback((): RecentFile[] => {
    return recentFiles;
  }, [recentFiles]);

  const clearRecentFiles = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setRecentFiles([]);
  }, []);

  return { recentFiles, addRecentFile, getRecentFiles, clearRecentFiles };
}
