import React from 'react';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { useProjectStore } from '../../stores/project-store.ts';

export interface SaveStatusBadgeProps {
  className?: string;
}

export const SaveStatusBadge: React.FC<SaveStatusBadgeProps> = ({ className = '' }) => {
  const { t } = useTranslation();
  const saveStatus = useProjectStore((s) => s.saveStatus) ?? 'saved';
  const lastSaveError = useProjectStore((s) => s.lastSaveError);

  if (saveStatus === 'error') {
    const handleRetry = () => {
      useProjectStore.getState().saveCurrentWorkflow();
    };
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/30 text-red-700 dark:text-red-400 text-xs font-medium shadow-xs select-none transition-all duration-200 cursor-pointer hover:bg-red-100 dark:hover:bg-red-500/20 ${className}`}
        title={lastSaveError || 'Save failed — click to retry'}
        aria-live="assertive"
        role="button"
        onClick={handleRetry}
      >
        <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
        <span className="font-sans whitespace-nowrap">
          {t.saveStatus?.error || 'Save Failed'}
        </span>
      </div>
    );
  }

  if (saveStatus === 'saving') {
    return (
      <div
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-medium shadow-xs select-none transition-all duration-200 ${className}`}
        title={t.saveStatus.saving}
        aria-live="polite"
      >
        <span className="relative flex h-2 w-2 shrink-0">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-amber-500" />
        </span>
        <span className="font-sans whitespace-nowrap">{t.saveStatus.saving}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-medium shadow-xs select-none transition-all duration-200 ${className}`}
      title={`${t.saveStatus.saved} (${t.saveStatus.justNow})`}
      aria-live="polite"
    >
      <span className="h-2 w-2 rounded-full bg-emerald-500 shrink-0" />
      <span className="font-sans whitespace-nowrap">
        {t.saveStatus.saved} ({t.saveStatus.justNow})
      </span>
    </div>
  );
};
