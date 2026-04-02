import type { ReactNode } from 'react';
import clsx from 'clsx';
import { Files, GitCompare, RefreshCw } from 'lucide-react';

import type {
  WorkspaceChange,
  WorkspaceCommitLogEntry,
  WorkspacePublishStatus
} from '@shared/domain/workspace-inspection';

import { WorkspaceChangesPanel } from './workspace-changes-panel';
import { WorkspaceFileExplorer } from './workspace-file-explorer';

interface WorkspaceInspectorSidebarProps {
  activeSidebarTab: 'changes' | 'files';
  changes: WorkspaceChange[];
  changesLoadErrorMessage: string | null;
  commitErrorMessage: string | null;
  commitMessage: string;
  commitNotice: string | null;
  commits: WorkspaceCommitLogEntry[];
  expandedDirectories: string[];
  isCommitting: boolean;
  isLoadingChanges: boolean;
  isLoadingCommits: boolean;
  isLoadingPublishStatus: boolean;
  isPushing: boolean;
  commitsLoadErrorMessage: string | null;
  onCommit: () => Promise<void>;
  onCommitMessageChange: (message: string) => void;
  onPush: () => Promise<void>;
  onRefresh: () => Promise<void>;
  onSelectChange: (path: string) => void;
  onSelectFile: (path: string) => void;
  onSelectSidebarTab: (tab: 'changes' | 'files') => void;
  onToggleDirectory: (directoryPath: string) => void;
  publishStatus: WorkspacePublishStatus | null;
  publishStatusErrorMessage: string | null;
  selectedPath: string | null;
  taskId: number;
}

export function WorkspaceInspectorSidebar({
  activeSidebarTab,
  changes,
  changesLoadErrorMessage,
  commitErrorMessage,
  commitMessage,
  commitNotice,
  commits,
  commitsLoadErrorMessage,
  expandedDirectories,
  isCommitting,
  isLoadingChanges,
  isLoadingCommits,
  isLoadingPublishStatus,
  isPushing,
  onCommit,
  onCommitMessageChange,
  onPush,
  onRefresh,
  onSelectChange,
  onSelectFile,
  onSelectSidebarTab,
  onToggleDirectory,
  publishStatus,
  publishStatusErrorMessage,
  selectedPath,
  taskId
}: WorkspaceInspectorSidebarProps) {
  return (
    <aside className="relative z-10 flex min-h-0 w-full flex-col overflow-hidden border-l border-white/[0.06] bg-[#1c1c1c]">
      <div className="flex items-center gap-1 border-b border-white/[0.06] bg-[#141414] px-3 py-1.5">
        <SidebarTab
          icon={<Files className="h-3.5 w-3.5" />}
          isActive={activeSidebarTab === 'files'}
          label="Files"
          onPress={() => onSelectSidebarTab('files')}
        />
        <SidebarTab
          icon={<GitCompare className="h-3.5 w-3.5" />}
          isActive={activeSidebarTab === 'changes'}
          label="Changes"
          onPress={() => onSelectSidebarTab('changes')}
        />
        <div className="ml-auto flex items-center gap-1">
          <button
            className="grid h-7 w-7 place-items-center rounded-md text-white/40 transition hover:bg-white/[0.08] hover:text-white/70"
            onMouseDown={(event) => {
              event.preventDefault();
              void onRefresh();
            }}
            title="Refresh"
            type="button"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-hidden">
        {activeSidebarTab === 'files' ? (
          <WorkspaceFileExplorer
            expandedDirectories={expandedDirectories}
            onToggleDirectory={onToggleDirectory}
            onSelectPath={onSelectFile}
            selectedPath={selectedPath}
            taskId={taskId}
          />
        ) : (
          <WorkspaceChangesPanel
            changes={changes}
            commitErrorMessage={commitErrorMessage}
            commitMessage={commitMessage}
            commitNotice={commitNotice}
            commits={commits}
            commitsLoadErrorMessage={commitsLoadErrorMessage}
            isCommitting={isCommitting}
            isLoading={isLoadingChanges}
            isLoadingCommits={isLoadingCommits}
            isLoadingPublishStatus={isLoadingPublishStatus}
            isPushing={isPushing}
            loadErrorMessage={changesLoadErrorMessage}
            onCommit={onCommit}
            onCommitMessageChange={onCommitMessageChange}
            onPush={onPush}
            onRefresh={onRefresh}
            onSelectChange={onSelectChange}
            publishStatus={publishStatus}
            publishStatusErrorMessage={publishStatusErrorMessage}
            selectedPath={selectedPath}
          />
        )}
      </div>
    </aside>
  );
}

function SidebarTab({
  icon,
  isActive,
  label,
  onPress
}: {
  icon: ReactNode;
  isActive: boolean;
  label: string;
  onPress: () => void;
}) {
  return (
    <button
      className={clsx(
        'flex items-center gap-1.5 rounded-md px-2.5 py-1 font-geist text-[12px] font-medium transition',
        isActive
          ? 'bg-white/[0.10] text-white'
          : 'text-white/50 hover:bg-white/[0.06] hover:text-white/80'
      )}
      onMouseDown={(event) => {
        event.preventDefault();
        onPress();
      }}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}
