import type { FileTab } from "@/hooks/use-file-tabs";

interface TabBarProps {
  tabs: FileTab[];
  activeTabId: string;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onNewTab: () => void;
}

export function TabBar({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onNewTab,
}: TabBarProps) {
  if (tabs.length <= 1 && !tabs[0]?.filePath) return null;

  return (
    <div className="markd-tab-bar">
      <div className="markd-tab-list">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={`markd-tab ${tab.id === activeTabId ? "active" : ""}`}
            onClick={() => onSwitchTab(tab.id)}
            title={tab.filePath ?? tab.fileName}
          >
            <span className="markd-tab-name">
              {tab.isDirty ? `${tab.fileName} •` : tab.fileName}
            </span>
            <button
              className="markd-tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
              title="Close"
            >
              ×
            </button>
          </div>
        ))}
      </div>
      <button
        className="markd-tab-new"
        onClick={onNewTab}
        title="New Tab"
      >
        +
      </button>
    </div>
  );
}
