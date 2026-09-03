import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Folder as FolderIcon,
  FolderOpen,
  FolderPlus,
  ChevronRight,
  ChevronDown,
  MoreHorizontal,
  Edit2,
  Copy,
  Trash2,
  FolderInput,
  Search,
  X,
  History,
  Sparkles,
  ChevronsLeft,
  ChevronsRight,
  Check,
} from 'lucide-react';
import { useProjectStore, type SavedWorkflow, type Folder } from '../../stores/project-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';

function formatRelativeTime(timestamp: number): string {
  const diffMs = Date.now() - timestamp;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHour = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHour / 24);

  if (diffSec < 60) return 'now';
  if (diffMin < 60) return `${diffMin}m`;
  if (diffHour < 24) return `${diffHour}h`;
  if (diffDay < 30) return `${diffDay}d`;
  return `${Math.floor(diffDay / 30)}mo`;
}

interface WorkflowItemProps {
  workflow: SavedWorkflow;
  isActive: boolean;
  folders: Folder[];
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (targetFolderId: string) => void;
}

const WorkflowItem: React.FC<WorkflowItemProps> = ({
  workflow,
  isActive,
  folders,
  onSelect,
  onRename,
  onDuplicate,
  onDelete,
  onMove,
}) => {
  const { t } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workflow.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setEditName(workflow.name);
  }, [workflow.name]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false);
        setShowMoveSubmenu(false);
      }
    };
    if (showMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showMenu]);

  const handleSaveRename = () => {
    const trimmed = editName.trim();
    if (trimmed && trimmed !== workflow.name) {
      onRename(trimmed);
    } else {
      setEditName(workflow.name);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditName(workflow.name);
      setIsEditing(false);
    }
  };

  return (
    <div
      className={`group relative flex items-center justify-between px-3 py-1.5 mx-1 rounded-lg text-xs transition-all cursor-pointer select-none ${
        isActive
          ? 'bg-slate-200/90 dark:bg-slate-800 text-slate-900 dark:text-white font-medium shadow-xs'
          : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-200'
      }`}
      onClick={() => {
        if (!isEditing) {
          onSelect();
        }
      }}
    >
      {/* Title / Inline Rename Input */}
      <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
        {isEditing ? (
          <input
            type="text"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            onBlur={handleSaveRename}
            onKeyDown={handleKeyDown}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="w-full px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-blue-500 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
          />
        ) : (
          <span
            className="truncate text-[12px] leading-relaxed"
            title={workflow.name}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {workflow.name}
          </span>
        )}
      </div>

      {/* Right timestamp & action triggers */}
      <div className="flex items-center gap-1 shrink-0">
        {/* Relative time badge (hidden when hovering for actions) */}
        <span
          className={`text-[10px] font-mono text-slate-400 dark:text-slate-500 transition-opacity ${
            showMenu ? 'hidden' : 'group-hover:hidden'
          }`}
        >
          {formatRelativeTime(workflow.updatedAt || workflow.createdAt)}
        </span>

        {/* More Actions button (shown on hover or when menu active) */}
        <div
          ref={menuRef}
          className={`relative ${
            showMenu ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
          } transition-opacity`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu(!showMenu);
              setShowMoveSubmenu(false);
            }}
            className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {/* Context Dropdown Menu */}
          {showMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-44 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Rename */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  setIsEditing(true);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-left text-slate-700 dark:text-slate-300 text-xs transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                <span>{t.sidebar.rename}</span>
              </button>

              {/* Duplicate */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onDuplicate();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-left text-slate-700 dark:text-slate-300 text-xs transition-colors"
              >
                <Copy className="w-3.5 h-3.5 text-slate-400" />
                <span>{t.sidebar.duplicate}</span>
              </button>

              {/* Move to Folder */}
              <div className="relative">
                <button
                  onClick={() => setShowMoveSubmenu(!showMoveSubmenu)}
                  className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-between text-left text-slate-700 dark:text-slate-300 text-xs transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <FolderInput className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.sidebar.moveTo}</span>
                  </div>
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </button>

                {showMoveSubmenu && (
                  <div className="p-1 mt-1 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-0.5">
                    {folders.map((f) => (
                      <button
                        key={f.id}
                        disabled={f.id === workflow.folderId}
                        onClick={() => {
                          onMove(f.id);
                          setShowMenu(false);
                        }}
                        className={`w-full px-2 py-1 rounded text-left text-[11px] flex items-center justify-between transition-colors ${
                          f.id === workflow.folderId
                            ? 'text-blue-600 dark:text-sky-400 font-semibold'
                            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-200'
                        }`}
                      >
                        <span className="truncate">{f.name}</span>
                        {f.id === workflow.folderId && <Check className="w-3 h-3" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

              {/* Delete */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  if (window.confirm(t.sidebar.deleteWorkflowConfirm)) {
                    onDelete();
                  }
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-left text-xs transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{t.sidebar.delete}</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const WorkflowSidebar: React.FC = () => {
  const { t } = useTranslation();

  const isSidebarOpen = useProjectStore((s) => s.isSidebarOpen);
  const toggleSidebar = useProjectStore((s) => s.toggleSidebar);
  const folders = useProjectStore((s) => s.folders);
  const workflows = useProjectStore((s) => s.workflows);
  const activeWorkflowId = useProjectStore((s) => s.activeWorkflowId);
  const searchQuery = useProjectStore((s) => s.searchQuery);
  const setSearchQuery = useProjectStore((s) => s.setSearchQuery);

  const createWorkflow = useProjectStore((s) => s.createWorkflow);
  const loadWorkflow = useProjectStore((s) => s.loadWorkflow);
  const renameWorkflow = useProjectStore((s) => s.renameWorkflow);
  const duplicateWorkflow = useProjectStore((s) => s.duplicateWorkflow);
  const deleteWorkflow = useProjectStore((s) => s.deleteWorkflow);
  const moveWorkflow = useProjectStore((s) => s.moveWorkflow);

  const createFolder = useProjectStore((s) => s.createFolder);
  const renameFolder = useProjectStore((s) => s.renameFolder);
  const deleteFolder = useProjectStore((s) => s.deleteFolder);
  const toggleFolder = useProjectStore((s) => s.toggleFolder);

  // Local state for folder creation & search bar
  const [isCreatingFolder, setIsCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showSearchInput, setShowSearchInput] = useState(false);
  const [editingFolderId, setEditingFolderId] = useState<string | null>(null);
  const [editingFolderName, setEditingFolderName] = useState('');

  const handleCreateFolder = () => {
    const trimmed = newFolderName.trim();
    if (trimmed) {
      createFolder(trimmed);
      setNewFolderName('');
      setIsCreatingFolder(false);
    }
  };

  const handleSaveRenameFolder = (folderId: string) => {
    const trimmed = editingFolderName.trim();
    if (trimmed) {
      renameFolder(folderId, trimmed);
    }
    setEditingFolderId(null);
  };

  // Filter workflows by search query
  const filteredWorkflows = workflows.filter((w) => {
    if (!searchQuery.trim()) return true;
    return w.name.toLowerCase().includes(searchQuery.toLowerCase());
  });

  if (!isSidebarOpen) {
    return (
      <button
        onClick={toggleSidebar}
        className="absolute left-0 top-3 z-30 w-6 h-9 rounded-r-lg bg-white/95 dark:bg-slate-900/95 backdrop-blur-md border-y border-r border-slate-200 dark:border-slate-800 shadow-md flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        title={t.sidebar.expandSidebar}
      >
        <ChevronsRight className="w-3.5 h-3.5 text-blue-600 dark:text-sky-400 group-hover:translate-x-0.5 transition-transform" />
      </button>
    );
  }

  return (
    <aside className="w-64 md:w-72 shrink-0 border-r border-slate-200 dark:border-slate-800/80 bg-slate-50/70 dark:bg-[#0A0E17]/95 backdrop-blur-md flex flex-col h-full relative overflow-visible text-slate-800 dark:text-slate-200 font-sans select-none transition-all duration-200 z-20 shadow-xs">
      {/* Protruding drawer close tab (<<) beside New Workflow */}
      <button
        onClick={toggleSidebar}
        className="absolute -right-6 top-3 z-30 w-6 h-9 rounded-r-lg bg-white dark:bg-slate-900 border-y border-r border-slate-200 dark:border-slate-800 shadow-sm flex items-center justify-center text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer group"
        title={t.sidebar.collapseSidebar}
      >
        <ChevronsLeft className="w-3.5 h-3.5 group-hover:-translate-x-0.5 transition-transform" />
      </button>

      {/* ── TOP SECTION: New Workflow Button & Quick Views ── */}
      <div className="p-3 pb-2 space-y-2.5">
        {/* + New Workflow Action Button */}
        <button
          onClick={() => createWorkflow(t.sidebar.untitledWorkflow)}
          className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
        >
          <Plus className="w-4 h-4 text-blue-600 dark:text-sky-400 stroke-[2.5]" />
          <span>{t.sidebar.newWorkflow}</span>
        </button>

        {/* Quick Nav Links (History / All) */}
        <div className="space-y-0.5 text-xs">
          <button
            onClick={() => {
              setSearchQuery('');
              setShowSearchInput(false);
            }}
            className="w-full flex items-center gap-2.5 px-3 py-1.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 hover:text-slate-900 dark:hover:text-slate-100 transition-colors"
          >
            <History className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-[12px]">{t.sidebar.workflowHistory}</span>
          </button>
        </div>
      </div>

      <div className="h-[1px] bg-slate-200 dark:bg-slate-800/80 mx-3" />

      {/* ── SEARCH BAR (Collapsible or Triggered) ── */}
      {showSearchInput && (
        <div className="p-3 pb-0 animate-in fade-in duration-150">
          <div className="relative flex items-center">
            <Search className="w-3.5 h-3.5 absolute left-2.5 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.sidebar.searchPlaceholder}
              autoFocus
              className="w-full pl-8 pr-7 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── PROJECTS & FOLDERS HEADER ── */}
      <div className="px-3 pt-3 pb-1 flex items-center justify-between">
        <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 font-sans tracking-tight">
          {t.sidebar.projects}
        </span>

        <div className="flex items-center gap-1">
          {/* Search Toggle */}
          <button
            onClick={() => setShowSearchInput(!showSearchInput)}
            className={`p-1 rounded-md transition-colors ${
              showSearchInput
                ? 'bg-slate-200 dark:bg-slate-800 text-blue-600 dark:text-sky-400'
                : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60'
            }`}
            title="Search"
          >
            <Search className="w-3.5 h-3.5" />
          </button>

          {/* New Folder Action Button */}
          <button
            onClick={() => setIsCreatingFolder(true)}
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-slate-800/60 transition-colors"
            title={t.sidebar.newFolder}
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* ── INLINE NEW FOLDER CREATOR ── */}
      {isCreatingFolder && (
        <div className="p-2 mx-3 my-1 rounded-xl bg-white dark:bg-slate-900 border border-blue-500/40 shadow-xs space-y-2 animate-in fade-in duration-150">
          <input
            type="text"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreateFolder();
              if (e.key === 'Escape') setIsCreatingFolder(false);
            }}
            placeholder={t.sidebar.folderNamePlaceholder}
            autoFocus
            className="w-full px-2 py-1 rounded bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
          />
          <div className="flex items-center justify-end gap-1.5">
            <button
              onClick={() => setIsCreatingFolder(false)}
              className="px-2 py-0.5 rounded text-[11px] text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              {t.common.cancel}
            </button>
            <button
              onClick={handleCreateFolder}
              className="px-2 py-0.5 rounded text-[11px] bg-blue-600 hover:bg-blue-700 text-white font-medium"
            >
              {t.common.save}
            </button>
          </div>
        </div>
      )}

      {/* ── SCROLLABLE FOLDERS & WORKFLOWS TREE ── */}
      <div className="flex-1 overflow-y-auto px-1 py-1 space-y-3" style={{ scrollbarWidth: 'thin' }}>
        {folders.map((folder) => {
          const folderWorkflows = filteredWorkflows.filter((w) => w.folderId === folder.id);
          const isExpanded = folder.isExpanded !== false;
          const isEditingThisFolder = editingFolderId === folder.id;

          return (
            <div key={folder.id} className="space-y-0.5">
              {/* Folder Header Row */}
              <div
                className="group flex items-center justify-between px-2.5 py-1 mx-1 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/40 text-slate-700 dark:text-slate-300 text-xs cursor-pointer transition-colors"
                onClick={() => toggleFolder(folder.id)}
              >
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  {isExpanded ? (
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  ) : (
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}

                  {isExpanded ? (
                    <FolderOpen className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400 shrink-0" />
                  ) : (
                    <FolderIcon className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                  )}

                  {isEditingThisFolder ? (
                    <input
                      type="text"
                      value={editingFolderName}
                      onChange={(e) => setEditingFolderName(e.target.value)}
                      onBlur={() => handleSaveRenameFolder(folder.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveRenameFolder(folder.id);
                        if (e.key === 'Escape') setEditingFolderId(null);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      className="w-full px-1.5 py-0.5 rounded bg-white dark:bg-slate-900 border border-blue-500 text-xs text-slate-900 dark:text-slate-100 focus:outline-none"
                    />
                  ) : (
                    <span
                      className="truncate font-semibold text-[12px] text-slate-800 dark:text-slate-200"
                      onDoubleClick={(e) => {
                        e.stopPropagation();
                        setEditingFolderId(folder.id);
                        setEditingFolderName(folder.name);
                      }}
                    >
                      {folder.name}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    ({folderWorkflows.length})
                  </span>

                  {/* Folder Options dropdown on hover */}
                  {!folder.isPreset && (
                    <div
                      className="opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => {
                          setEditingFolderId(folder.id);
                          setEditingFolderName(folder.name);
                        }}
                        className="p-0.5 rounded hover:bg-slate-300/50 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                        title={t.sidebar.rename}
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>

                      <button
                        onClick={() => {
                          if (window.confirm(t.sidebar.deleteFolderConfirm)) {
                            deleteFolder(folder.id);
                          }
                        }}
                        className="p-0.5 rounded hover:bg-rose-100 dark:hover:bg-rose-950/50 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 ml-0.5"
                        title={t.sidebar.delete}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Child Workflows in Folder */}
              {isExpanded && (
                <div className="pl-3 space-y-0.5">
                  {folderWorkflows.length === 0 ? (
                    <div className="px-3 py-1.5 text-[11px] text-slate-400 dark:text-slate-500 italic">
                      {t.sidebar.noWorkflowsInFolder}
                    </div>
                  ) : (
                    folderWorkflows.map((wf) => (
                      <WorkflowItem
                        key={wf.id}
                        workflow={wf}
                        isActive={activeWorkflowId === wf.id}
                        folders={folders}
                        onSelect={() => loadWorkflow(wf.id)}
                        onRename={(name) => renameWorkflow(wf.id, name)}
                        onDuplicate={() => duplicateWorkflow(wf.id)}
                        onDelete={() => deleteWorkflow(wf.id)}
                        onMove={(targetFolderId) => moveWorkflow(wf.id, targetFolderId)}
                      />
                    ))
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── BOTTOM DRAWER CONTROLS & STATS ── */}
      <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-1.5 text-[11px] font-mono">
          <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
          <span>
            {workflows.length} {t.sidebar.workflowsCount}
          </span>
        </div>
      </div>
    </aside>
  );
};

export default WorkflowSidebar;
