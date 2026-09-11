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
  Database,
  Sliders,
  Brain,
} from 'lucide-react';
import { useProjectStore, type SavedWorkflow, type Folder } from '../../stores/project-store.ts';
import { useSettingsStore } from '../../stores/settings-store.ts';
import { useKnowledgeStore } from '../../stores/knowledge-store.ts';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { PRESETS_DATA } from '../../presets/index.ts';

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

interface WorkflowSettingsModalProps {
  workflow: SavedWorkflow;
  folders: Folder[];
  onClose: () => void;
  onSave: (
    workflowId: string,
    name: string,
    folderId: string,
    memoryConfig: { maxHistoryRounds: number; maxTokenBudget: number },
  ) => void;
}

const WorkflowSettingsModal: React.FC<WorkflowSettingsModalProps> = ({
  workflow,
  folders,
  onClose,
  onSave,
}) => {
  const { t, language } = useTranslation();
  const globalMemoryDefaults = useSettingsStore((s) => s.memoryDefaults);
  const [name, setName] = useState(workflow.name);
  const [folderId, setFolderId] = useState(workflow.folderId);
  const [maxHistoryRounds, setMaxHistoryRounds] = useState<number>(() => {
    return workflow.memoryConfig?.maxHistoryRounds ?? globalMemoryDefaults.maxHistoryRounds ?? 5;
  });
  const [maxTokenBudget, setMaxTokenBudget] = useState<number>(() => {
    return workflow.memoryConfig?.maxTokenBudget ?? globalMemoryDefaults.maxTokenBudget ?? 3000;
  });

  const handleSave = () => {
    const cleanName = name.trim() || workflow.name;
    onSave(workflow.id, cleanName, folderId, {
      maxHistoryRounds: Math.max(1, maxHistoryRounds),
      maxTokenBudget: Math.max(100, maxTokenBudget),
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div
        className="w-full max-w-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between shrink-0 bg-slate-50/50 dark:bg-slate-950/40">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-sky-400">
              <Sliders className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {t.sidebar.projectSettings}
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate max-w-xs">
                {workflow.name}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 space-y-5 overflow-y-auto min-h-0 flex-1">
          {/* Project Name */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.sidebar.workflowNamePlaceholder}
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500"
              placeholder={t.sidebar.workflowNamePlaceholder}
            />
          </div>

          {/* Belongs to Folder */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              {t.sidebar.workflowFolder}
            </label>
            <select
              value={folderId}
              onChange={(e) => setFolderId(e.target.value)}
              className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-semibold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 cursor-pointer"
            >
              {folders.map((f) => (
                <option key={f.id} value={f.id} className="bg-white dark:bg-slate-900">
                  {f.id === 'default'
                    ? t.sidebar.defaultFolder
                    : f.id === 'presets'
                      ? t.sidebar.presetsFolder
                      : f.name}
                </option>
              ))}
            </select>
          </div>

          {/* Project Memory Limits */}
          <div className="space-y-4 pt-3 border-t border-slate-100 dark:border-slate-800/80">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400">
                <Brain className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                  {t.sidebar.workflowMemorySettings}
                </h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                  {t.sidebar.workflowMemoryDesc}
                </p>
              </div>
            </div>

            <div className="space-y-4 pt-1">
              {/* Sliding Window Rounds (Numeric Input) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.settings.memoryRoundsLabel}
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    {t.sidebar.globalDefaultHint}
                    {globalMemoryDefaults.maxHistoryRounds}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.settings.memoryRoundsDesc}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    step={1}
                    value={maxHistoryRounds}
                    onChange={(e) =>
                      setMaxHistoryRounds(Math.max(1, parseInt(e.target.value, 10) || 1))
                    }
                    className="w-32 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    {language === 'zh' ? '轮 (Rounds)' : 'Rounds'}
                  </span>
                </div>
              </div>

              {/* Token Budget (Numeric Input) */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    {t.settings.memoryBudgetLabel}
                  </label>
                  <span className="text-[10px] font-mono text-slate-400 dark:text-slate-500">
                    {t.sidebar.globalDefaultHint}
                    {globalMemoryDefaults.maxTokenBudget}
                  </span>
                </div>
                <p className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t.settings.memoryBudgetDesc}
                </p>
                <div className="flex items-center gap-2 pt-0.5">
                  <input
                    type="number"
                    min={100}
                    max={128000}
                    step={100}
                    value={maxTokenBudget}
                    onChange={(e) =>
                      setMaxTokenBudget(Math.max(100, parseInt(e.target.value, 10) || 100))
                    }
                    className="w-32 px-3 py-1.5 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 focus:outline-none focus:border-indigo-500"
                  />
                  <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                    Tokens
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/60 flex items-center justify-end gap-2 shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="px-4 py-1.5 rounded-xl text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white shadow-xs transition-colors"
          >
            {t.sidebar.saveSettings}
          </button>
        </div>
      </div>
    </div>
  );
};

interface FolderRowProps {
  folder: Folder;
  count: number;
  isEditing: boolean;
  editingName: string;
  setEditingName: (name: string) => void;
  onToggle: () => void;
  onStartRename: () => void;
  onSaveRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
  onCreateWorkflowInFolder: () => void;
}

const FolderRow: React.FC<FolderRowProps> = ({
  folder,
  count,
  isEditing,
  editingName,
  setEditingName,
  onToggle,
  onStartRename,
  onSaveRename,
  onCancelRename,
  onDelete,
  onCreateWorkflowInFolder,
}) => {
  const { t } = useTranslation();
  const [showFolderMenu, setShowFolderMenu] = useState(false);
  const folderMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (folderMenuRef.current && !folderMenuRef.current.contains(e.target as Node)) {
        setShowFolderMenu(false);
      }
    };
    if (showFolderMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showFolderMenu]);

  return (
    <div
      onClick={onToggle}
      className="group flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-slate-200/50 dark:hover:bg-slate-800/40 text-xs text-slate-700 dark:text-slate-300 transition-colors cursor-pointer"
    >
      <div className="flex items-center gap-1.5 min-w-0 pr-1">
        {folder.isExpanded ? (
          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        ) : (
          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
        )}

        {folder.isExpanded ? (
          <FolderOpen className="w-4 h-4 text-blue-500 dark:text-sky-400 shrink-0" />
        ) : (
          <FolderIcon className="w-4 h-4 text-slate-400 dark:text-slate-500 shrink-0" />
        )}

        {isEditing ? (
          <input
            type="text"
            value={editingName}
            onChange={(e) => setEditingName(e.target.value)}
            onBlur={onSaveRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSaveRename();
              if (e.key === 'Escape') onCancelRename();
            }}
            autoFocus
            onClick={(e) => e.stopPropagation()}
            className="px-1.5 py-0.5 text-xs bg-white dark:bg-slate-900 border border-blue-500 rounded text-slate-900 dark:text-slate-100 focus:outline-none"
          />
        ) : (
          <span className="font-semibold truncate text-[12px]">
            {folder.id === 'default'
              ? t.sidebar.defaultFolder
              : folder.id === 'presets'
                ? t.sidebar.presetsFolder
                : folder.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-1 shrink-0">
        <span className="text-[11px] text-slate-400 font-mono">
          ({count})
        </span>

        {/* 3-dots folder actions menu */}
        <div
          ref={folderMenuRef}
          className={`relative ${showFolderMenu ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'} transition-opacity`}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowFolderMenu(!showFolderMenu);
            }}
            className="p-1 rounded hover:bg-slate-300/60 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
            title="Folder Options"
          >
            <MoreHorizontal className="w-3.5 h-3.5" />
          </button>

          {showFolderMenu && (
            <div
              className="absolute right-0 top-full mt-1 w-44 p-1 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 animate-in fade-in zoom-in-95 duration-100 font-sans"
              onClick={(e) => e.stopPropagation()}
            >
              {/* New Workflow in Folder */}
              <button
                onClick={() => {
                  setShowFolderMenu(false);
                  onCreateWorkflowInFolder();
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-left text-slate-700 dark:text-slate-300 text-xs transition-colors font-medium"
              >
                <Plus className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
                <span>{t.sidebar.newWorkflowInFolder}</span>
              </button>

              {!folder.isPreset && (
                <>
                  <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />
                  {/* Rename Folder */}
                  <button
                    onClick={() => {
                      setShowFolderMenu(false);
                      onStartRename();
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-left text-slate-700 dark:text-slate-300 text-xs transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                    <span>{t.sidebar.rename}</span>
                  </button>

                  {/* Delete Folder */}
                  <button
                    onClick={() => {
                      setShowFolderMenu(false);
                      if (window.confirm(t.sidebar.deleteFolderConfirm)) {
                        onDelete();
                      }
                    }}
                    className="w-full px-2.5 py-1.5 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-2 text-left text-xs transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>{t.sidebar.delete}</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface WorkflowItemProps {
  workflow: SavedWorkflow;
  isActive: boolean;
  folders: Folder[];
  onSelect: () => void;
  onRename: (newName: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onMove: (targetFolderId: string) => void;
  onOpenSettings: (workflow: SavedWorkflow) => void;
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
  onOpenSettings,
}) => {
  const { t, language } = useTranslation();
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(workflow.name);
  const [showMenu, setShowMenu] = useState(false);
  const [showMoveSubmenu, setShowMoveSubmenu] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const isPresetWf = Boolean(workflow.isPreset && workflow.id.startsWith('wf-'));
  const presetKey = isPresetWf ? workflow.id.replace('wf-', '') : '';
  const displayTitle =
    isPresetWf && PRESETS_DATA[language]?.[presetKey]?.name
      ? PRESETS_DATA[language][presetKey].name
      : workflow.name;

  useEffect(() => {
    setEditName(displayTitle);
  }, [displayTitle]);

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
    if (trimmed && trimmed !== displayTitle) {
      onRename(trimmed);
    } else {
      setEditName(displayTitle);
    }
    setIsEditing(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSaveRename();
    } else if (e.key === 'Escape') {
      setEditName(displayTitle);
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
            title={displayTitle}
            onDoubleClick={(e) => {
              e.stopPropagation();
              setIsEditing(true);
            }}
          >
            {displayTitle}
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
            showMenu ? 'opacity-100' : 'opacity-60 group-hover:opacity-100'
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
              {/* Project Settings */}
              <button
                onClick={() => {
                  setShowMenu(false);
                  onOpenSettings(workflow);
                }}
                className="w-full px-2.5 py-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-2 text-left text-slate-700 dark:text-slate-300 text-xs transition-colors font-medium"
              >
                <Sliders className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
                <span>{t.sidebar.projectSettings}</span>
              </button>

              <div className="h-[1px] bg-slate-100 dark:bg-slate-800 my-1" />

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
                    {folders.map((f) => {
                      const fDisplayName =
                        f.id === 'default'
                          ? t.sidebar.defaultFolder
                          : f.id === 'presets'
                            ? t.sidebar.presetsFolder
                            : f.name;
                      return (
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
                          <span className="truncate">{fDisplayName}</span>
                          {f.id === workflow.folderId && <Check className="w-3 h-3" />}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {!workflow.isPreset && (
                <>
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
                </>
              )}
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
  const updateWorkflow = useProjectStore((s) => s.updateWorkflow);

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
  const [settingsWorkflow, setSettingsWorkflow] = useState<SavedWorkflow | null>(null);

  // Knowledge base tab state
  const [activeTab, setActiveTab] = useState<'workflows' | 'knowledge'>('workflows');
  const [isCreatingKb, setIsCreatingKb] = useState(false);
  const [newKbName, setNewKbName] = useState('');
  const [newKbDesc, setNewKbDesc] = useState('');

  const knowledgeBases = useKnowledgeStore((s) => s.knowledgeBases);
  const createKnowledgeBase = useKnowledgeStore((s) => s.createKnowledgeBase);
  const deleteKnowledgeBase = useKnowledgeStore((s) => s.deleteKnowledgeBase);
  const openDetail = useKnowledgeStore((s) => s.openDetail);

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

  const handleSaveWorkflowSettings = (
    workflowId: string,
    newName: string,
    targetFolderId: string,
    memoryConfig: { maxHistoryRounds: number; maxTokenBudget: number },
  ) => {
    const currentWf = workflows.find((w) => w.id === workflowId);
    if (!currentWf) return;

    if (newName !== currentWf.name) {
      renameWorkflow(workflowId, newName);
    }
    if (targetFolderId !== currentWf.folderId) {
      moveWorkflow(workflowId, targetFolderId);
    }
    updateWorkflow(workflowId, { memoryConfig });
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

      {/* ── TOP NAVIGATION TABS: Workflows | Knowledge ── */}
      <div className="p-2 border-b border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 grid grid-cols-2 gap-1 text-xs font-semibold shrink-0">
        <button
          onClick={() => setActiveTab('workflows')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'workflows'
              ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-sky-400 shadow-xs border border-slate-200/80 dark:border-slate-700/80 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <FolderIcon className="w-3.5 h-3.5" />
          <span>{t.knowledge.workflowsTab}</span>
        </button>

        <button
          onClick={() => setActiveTab('knowledge')}
          className={`flex items-center justify-center gap-1.5 py-1.5 rounded-lg transition-all cursor-pointer ${
            activeTab === 'knowledge'
              ? 'bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs border border-slate-200/80 dark:border-slate-700/80 font-bold'
              : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
          }`}
        >
          <Database className="w-3.5 h-3.5" />
          <span>{t.knowledge.knowledgeTab}</span>
          {knowledgeBases.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[9px] bg-cyan-100 dark:bg-cyan-900/60 text-cyan-700 dark:text-cyan-300 font-mono">
              {knowledgeBases.length}
            </span>
          )}
        </button>
      </div>

      {activeTab === 'workflows' ? (
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* ── TOP SECTION: New Workflow Button & Quick Views ── */}
          <div className="p-3 pb-2 space-y-2.5 shrink-0">
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

          <div className="h-[1px] bg-slate-200 dark:bg-slate-800/80 mx-3 shrink-0" />

          {/* ── SEARCH BAR (Collapsible or Triggered) ── */}
          {showSearchInput && (
            <div className="p-3 pb-0 animate-in fade-in duration-150 shrink-0">
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
          <div className="px-3 pt-3 pb-1 flex items-center justify-between text-slate-600 dark:text-slate-400 shrink-0">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-500">
              {t.sidebar.projects}
            </span>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setShowSearchInput(!showSearchInput)}
                className={`p-1 rounded-md transition-colors ${
                  showSearchInput
                    ? 'bg-blue-100 dark:bg-sky-900/40 text-blue-600 dark:text-sky-400'
                    : 'hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                }`}
                title={t.sidebar.searchPlaceholder}
              >
                <Search className="w-3.5 h-3.5" />
              </button>

              <button
                onClick={() => setIsCreatingFolder(true)}
                className="p-1 rounded-md hover:bg-slate-200 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors"
                title={t.sidebar.newFolder}
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* New Folder Creation Input Box */}
          {isCreatingFolder && (
            <div className="p-3 pt-1 animate-in fade-in duration-150 shrink-0">
              <div className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-blue-400 dark:border-sky-500 shadow-sm space-y-2">
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
                  className="w-full px-2 py-1 text-xs bg-slate-50 dark:bg-slate-950 rounded border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none"
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
                    className="px-2.5 py-0.5 rounded text-[11px] bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs"
                  >
                    {t.common.save}
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ── FOLDERS & WORKFLOWS TREE (SCROLLABLE) ── */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {folders.map((folder) => {
              const folderWorkflows = filteredWorkflows.filter((w) => w.folderId === folder.id);

              return (
                <div key={folder.id} className="space-y-0.5">
                  <FolderRow
                    folder={folder}
                    count={folderWorkflows.length}
                    isEditing={editingFolderId === folder.id}
                    editingName={editingFolderName}
                    setEditingName={setEditingFolderName}
                    onToggle={() => toggleFolder(folder.id)}
                    onStartRename={() => {
                      setEditingFolderId(folder.id);
                      setEditingFolderName(folder.name);
                    }}
                    onSaveRename={() => handleSaveRenameFolder(folder.id)}
                    onCancelRename={() => setEditingFolderId(null)}
                    onDelete={() => deleteFolder(folder.id)}
                    onCreateWorkflowInFolder={() => {
                      createWorkflow(t.sidebar.untitledWorkflow, folder.id);
                      if (!folder.isExpanded) {
                        toggleFolder(folder.id);
                      }
                    }}
                  />

                  {folder.isExpanded && (
                    <div className="pl-3 space-y-0.5 border-l border-slate-200/80 dark:border-slate-800/80 ml-3.5 my-0.5">
                      {folderWorkflows.length === 0 ? (
                        <div className="px-2 py-1 text-[11px] text-slate-400 dark:text-slate-500 italic">
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
                            onOpenSettings={(w) => setSettingsWorkflow(w)}
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
          <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <Sparkles className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400" />
              <span>
                {workflows.length} {t.sidebar.workflowsCount}
              </span>
            </div>
          </div>
        </div>
      ) : (
        /* ── KNOWLEDGE TAB CONTENT ── */
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
          {/* Top Action: + New Knowledge Base */}
          <div className="p-3 pb-2 space-y-2.5 shrink-0">
            <button
              onClick={() => setIsCreatingKb(true)}
              className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700/80 shadow-xs text-xs font-semibold text-slate-800 dark:text-slate-100 transition-all hover:scale-[1.01] active:scale-[0.99] cursor-pointer"
            >
              <Plus className="w-4 h-4 text-cyan-600 dark:text-cyan-400 stroke-[2.5]" />
              <span>{t.knowledge.newKnowledgeBase}</span>
            </button>
          </div>

          {/* Inline form for creating KB */}
          {isCreatingKb && (
            <div className="p-3 mx-3 mb-2 rounded-xl bg-white dark:bg-slate-900 border border-cyan-300 dark:border-cyan-700 shadow-md space-y-2.5 animate-in fade-in duration-150 shrink-0">
              <span className="text-xs font-bold text-slate-800 dark:text-slate-200 block">
                {t.knowledge.newKnowledgeBase}
              </span>
              <input
                type="text"
                value={newKbName}
                onChange={(e) => setNewKbName(e.target.value)}
                placeholder={t.knowledge.kbNamePlaceholder}
                autoFocus
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <input
                type="text"
                value={newKbDesc}
                onChange={(e) => setNewKbDesc(e.target.value)}
                placeholder={t.knowledge.kbDescPlaceholder}
                className="w-full px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-slate-100 focus:outline-none focus:border-cyan-500"
              />
              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  onClick={() => {
                    setIsCreatingKb(false);
                    setNewKbName('');
                    setNewKbDesc('');
                  }}
                  className="px-2.5 py-1 rounded-lg text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 cursor-pointer"
                >
                  {t.common.cancel}
                </button>
                <button
                  onClick={async () => {
                    if (newKbName.trim()) {
                      await createKnowledgeBase({
                        name: newKbName.trim(),
                        description: newKbDesc.trim(),
                      });
                      setIsCreatingKb(false);
                      setNewKbName('');
                      setNewKbDesc('');
                    }
                  }}
                  disabled={!newKbName.trim()}
                  className="px-3 py-1 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                >
                  {t.common.save}
                </button>
              </div>
            </div>
          )}

          <div className="h-[1px] bg-slate-200 dark:bg-slate-800/80 mx-3 shrink-0" />

          {/* Knowledge Bases Cards List */}
          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {knowledgeBases.length === 0 ? (
              <div className="text-center py-10 text-xs text-slate-400 dark:text-slate-500">
                <Database className="w-8 h-8 mx-auto mb-2 opacity-40 text-cyan-500" />
                <p>{t.knowledge.noKnowledgeBases}</p>
                <p className="text-[10px] mt-1 text-slate-400">{t.knowledge.createFirstKb}</p>
              </div>
            ) : (
              knowledgeBases.map((kb) => (
                <div
                  key={kb.id}
                  onClick={() => openDetail(kb.id)}
                  className="p-3 rounded-xl border bg-white dark:bg-slate-900/70 border-slate-200 dark:border-slate-800 hover:border-cyan-400 dark:hover:border-cyan-600/80 hover:shadow-xs transition-all cursor-pointer group space-y-2"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="p-1 rounded-md bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shrink-0">
                        <Database className="w-3.5 h-3.5" />
                      </div>
                      <span className="font-semibold text-xs text-slate-800 dark:text-slate-200 truncate group-hover:text-cyan-600 dark:group-hover:text-cyan-400 transition-colors">
                        {kb.name}
                      </span>
                    </div>

                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (window.confirm(t.knowledge.deleteKbConfirm)) {
                          deleteKnowledgeBase(kb.id);
                        }
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-50 dark:hover:bg-rose-500/20 text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 transition-all cursor-pointer"
                      title={t.common.delete}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>

                  {kb.description && (
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 line-clamp-2 leading-relaxed">
                      {kb.description}
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-800/60 text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                    <span>
                      {kb.document_count} {t.knowledge.documentsCount}
                    </span>
                    <span>•</span>
                    <span>
                      {kb.total_chunks} {t.knowledge.chunksCount}
                    </span>
                    <span className="px-1.5 py-0.2 rounded bg-slate-100 dark:bg-slate-800 text-[9px] uppercase font-bold text-slate-500">
                      {kb.embedding_provider}
                    </span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Bottom Drawer Stats */}
          <div className="p-3 border-t border-slate-200 dark:border-slate-800/80 bg-slate-100/60 dark:bg-slate-950/40 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0">
            <div className="flex items-center gap-1.5 text-[11px] font-mono">
              <Database className="w-3.5 h-3.5 text-cyan-500 dark:text-cyan-400" />
              <span>
                {knowledgeBases.length} {t.knowledge.knowledgeBasesCount}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Workflow / Project Settings Modal */}
      {settingsWorkflow && (
        <WorkflowSettingsModal
          workflow={settingsWorkflow}
          folders={folders}
          onClose={() => setSettingsWorkflow(null)}
          onSave={handleSaveWorkflowSettings}
        />
      )}
    </aside>
  );
};

export default WorkflowSidebar;
