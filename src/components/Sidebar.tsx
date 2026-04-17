import { useState, useCallback } from "react";
import type { Editor } from "@tiptap/react";
import type { FileEntry } from "@/lib/file-system";
import type { RecentFile } from "@/hooks/use-recent-files";
import { OutlinePanel } from "@/components/OutlinePanel";

type SidebarTab = "files" | "outline";

interface SidebarProps {
  tree: FileEntry[];
  activeFile: string;
  collapsed: boolean;
  editor: Editor | null;
  recentFiles: RecentFile[];
  onFileSelect: (entry: FileEntry) => void;
  onOpenFolder: () => void;
  onToggle: () => void;
  onRecentFileSelect: (file: RecentFile) => void;
}

export function Sidebar({
  tree,
  activeFile,
  collapsed,
  editor,
  recentFiles,
  onFileSelect,
  onOpenFolder,
  onToggle,
  onRecentFileSelect,
}: SidebarProps) {
  const [activeTab, setActiveTab] = useState<SidebarTab>("files");

  return (
    <aside className={`markd-sidebar ${collapsed ? "collapsed" : ""}`}>
      <div className="markd-sidebar-header">
        <div className="markd-sidebar-tabs">
          <button
            className={`markd-sidebar-tab ${activeTab === "files" ? "active" : ""}`}
            onClick={() => setActiveTab("files")}
          >
            Files
          </button>
          <button
            className={`markd-sidebar-tab ${activeTab === "outline" ? "active" : ""}`}
            onClick={() => setActiveTab("outline")}
          >
            Outline
          </button>
        </div>
        <div className="markd-sidebar-actions">
          {activeTab === "files" && (
            <button onClick={onOpenFolder} title="Open Folder">
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 4v9a1 1 0 0 0 1 1h10a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H8L6.5 3H3a1 1 0 0 0-1 1z" />
              </svg>
            </button>
          )}
          <button onClick={onToggle} title="Toggle Sidebar">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
              <path d="M10 3L5 8l5 5V3z" />
            </svg>
          </button>
        </div>
      </div>

      {activeTab === "files" ? (
        <div className="markd-file-tree">
          {tree.length === 0 ? (
            recentFiles.length > 0 ? (
              <RecentFilesList files={recentFiles} onSelect={onRecentFileSelect} />
            ) : (
              <div style={{ padding: "16px", opacity: 0.5, fontSize: 13 }}>
                Open a folder to browse files
              </div>
            )
          ) : (
            <FileTree
              entries={tree}
              activeFile={activeFile}
              onFileSelect={onFileSelect}
            />
          )}
        </div>
      ) : (
        <div className="markd-file-tree">
          <OutlinePanel editor={editor} />
        </div>
      )}
    </aside>
  );
}

/* ── Recent Files List ───────────────────────────────────────────── */

function RecentFilesList({
  files,
  onSelect,
}: {
  files: RecentFile[];
  onSelect: (file: RecentFile) => void;
}) {
  return (
    <div className="markd-recent-files">
      <div className="markd-recent-header">Recent Files</div>
      {files.map((file) => (
        <div
          key={file.path}
          className="markd-file-item"
          onClick={() => onSelect(file)}
          title={file.path}
          style={{ paddingLeft: 16 }}
        >
          <span className="icon">
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 1h7l3 3v11H3V1z" />
              <path d="M10 1v3h3" />
            </svg>
          </span>
          <span className="name">{file.name}</span>
        </div>
      ))}
    </div>
  );
}

/* ── File Tree ───────────────────────────────────────────────────── */

function FileTree({
  entries,
  activeFile,
  onFileSelect,
}: {
  entries: FileEntry[];
  activeFile: string;
  onFileSelect: (entry: FileEntry) => void;
}) {
  return (
    <>
      {entries.map((entry) => (
        <FileTreeItem
          key={entry.path}
          entry={entry}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
        />
      ))}
    </>
  );
}

function FileTreeItem({
  entry,
  activeFile,
  onFileSelect,
}: {
  entry: FileEntry;
  activeFile: string;
  onFileSelect: (entry: FileEntry) => void;
}) {
  const [expanded, setExpanded] = useState(true);

  const handleClick = useCallback(() => {
    if (entry.kind === "directory") {
      setExpanded((e) => !e);
    } else {
      onFileSelect(entry);
    }
  }, [entry, onFileSelect]);

  const isActive = entry.kind === "file" && entry.name === activeFile;

  return (
    <>
      <div
        className={`markd-file-item ${isActive ? "active" : ""}`}
        onClick={handleClick}
        style={{ paddingLeft: 16 + entry.depth * 16 }}
      >
        <span className="icon">
          {entry.kind === "directory" ? (expanded ? "\u25BE" : "\u25B8") : (
            <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M3 1h7l3 3v11H3V1z" />
              <path d="M10 1v3h3" />
            </svg>
          )}
        </span>
        <span className="name">{entry.name}</span>
      </div>
      {entry.kind === "directory" && expanded && entry.children && (
        <FileTree
          entries={entry.children}
          activeFile={activeFile}
          onFileSelect={onFileSelect}
        />
      )}
    </>
  );
}
