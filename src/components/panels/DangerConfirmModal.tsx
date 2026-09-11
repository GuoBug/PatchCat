import React, { useState, useEffect } from 'react';
import { AlertTriangle, X, Loader2 } from 'lucide-react';
import { useTranslation } from '../../i18n/useTranslation.ts';

export interface DangerConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmPhrase: string;
  altConfirmPhrase?: string;
  confirmButtonText?: string;
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
}

export const DangerConfirmModal: React.FC<DangerConfirmModalProps> = ({
  isOpen,
  title,
  description,
  confirmPhrase,
  altConfirmPhrase,
  confirmButtonText,
  onConfirm,
  onClose,
}) => {
  const { t } = useTranslation();
  const [inputVal, setInputVal] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputVal('');
      setIsExecuting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const trimmed = inputVal.trim();
  const isMatch =
    trimmed.toUpperCase() === confirmPhrase.toUpperCase() ||
    (altConfirmPhrase && trimmed === altConfirmPhrase.trim());

  const handleConfirm = async () => {
    if (!isMatch || isExecuting) return;
    try {
      setIsExecuting(true);
      await onConfirm();
      onClose();
    } catch (err) {
      console.error('[DangerConfirmModal] Execution error:', err);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    } else if (e.key === 'Enter' && isMatch) {
      handleConfirm();
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150"
      onKeyDown={handleKeyDown}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-white dark:bg-slate-900 border border-rose-300 dark:border-rose-900/60 rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-150 font-sans select-none"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-rose-100 dark:border-rose-950/60 bg-rose-50/60 dark:bg-rose-950/20 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-rose-100 dark:bg-rose-900/50 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {title || t.settings.dangerModalTitle}
              </h3>
              <p className="text-[11px] font-semibold text-rose-600 dark:text-rose-400">
                {t.settings.dangerModalWarning}
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

        {/* Body */}
        <div className="p-5 space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
            {description}
          </p>

          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800/80 space-y-2">
            <label className="block text-[11px] font-medium text-slate-500 dark:text-slate-400">
              {t.settings.dangerModalPrompt}
            </label>
            <div className="flex items-center gap-2">
              <code className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono font-bold tracking-wider text-xs select-all">
                {confirmPhrase}
              </code>
              {altConfirmPhrase && (
                <>
                  <span className="text-slate-400 text-[11px]">or</span>
                  <code className="px-2.5 py-1 rounded-lg bg-rose-100 dark:bg-rose-950/80 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-mono font-bold text-xs select-all">
                    {altConfirmPhrase}
                  </code>
                </>
              )}
            </div>
            <input
              type="text"
              autoFocus
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={confirmPhrase}
              className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 text-xs font-mono font-bold text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-rose-500 transition-colors"
            />
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-950/50 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isExecuting}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {t.common.cancel}
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!isMatch || isExecuting}
            className={`px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              isMatch && !isExecuting
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/25 cursor-pointer hover:scale-[1.01] active:scale-[0.99]'
                : 'bg-slate-200 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed border border-slate-200 dark:border-slate-800'
            }`}
          >
            {isExecuting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>{t.common.loading}</span>
              </>
            ) : (
              <span>{confirmButtonText || t.settings.dangerModalConfirmBtn}</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default DangerConfirmModal;
