import React, { useState } from 'react';
import {
  Github,
  BookOpen,
  ExternalLink,
  User,
} from 'lucide-react';
import { CatLogo } from '../icons/CatLogo.tsx';
import { HelpModal } from './HelpModal.tsx';
import { useTranslation } from '../../i18n/useTranslation.ts';
import { PROJECT_LINKS } from '../../config/project.ts';

export const Footer: React.FC = () => {
  const { t } = useTranslation();
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  return (
    <>
      <footer className="h-8 bg-white/95 dark:bg-slate-950/90 backdrop-blur-md border-t border-slate-200 dark:border-slate-800/80 px-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400 shrink-0 z-30 select-none transition-colors duration-200">
        {/* Left: Brand / System Info */}
        <div className="flex items-center gap-2 shrink-0 select-none">
          <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap">
            <CatLogo className="w-3.5 h-3.5 shrink-0" />
            <span className="tracking-tight">
              PATCH<span className="text-blue-600 dark:text-sky-400">CAT</span>
            </span>
          </div>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          <span className="hidden sm:inline text-[11px] text-slate-500 dark:text-slate-400 font-sans">
            {t.footer.tagline}
          </span>
        </div>

        {/* Center: Author Credit */}
        <div className="flex items-center gap-1.5 text-[11px]">
          <span className="text-slate-400 dark:text-slate-500 flex items-center gap-1">
            <span>{t.footer.author}</span>
            <span className="text-slate-300 dark:text-slate-700">:</span>
          </span>
          <a
            href={PROJECT_LINKS.owner}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 font-medium text-slate-700 hover:text-blue-600 dark:text-slate-300 dark:hover:text-sky-400 transition-colors group"
            title={`GitHub ${PROJECT_LINKS.authorHandle}`}
          >
            <User className="w-3 h-3 text-slate-400 group-hover:text-blue-600 dark:group-hover:text-sky-400 transition-colors" />
            <span className="font-semibold underline underline-offset-2 decoration-slate-300 dark:decoration-slate-700 group-hover:decoration-blue-500">
              {PROJECT_LINKS.authorName}
            </span>
          </a>
        </div>

        {/* Right: Help Documentation & GitHub Repository Links */}
        <div className="flex items-center gap-3">
          {/* Help Documentation Trigger */}
          <button
            onClick={() => setIsHelpOpen(true)}
            className="flex items-center gap-1 text-[11px] text-slate-600 hover:text-blue-600 dark:text-slate-400 dark:hover:text-sky-400 transition-colors group cursor-pointer"
            title={t.footer.helpDocs}
          >
            <BookOpen className="w-3.5 h-3.5 text-blue-500 dark:text-sky-400 group-hover:scale-110 transition-transform" />
            <span className="font-medium">{t.footer.helpDocs}</span>
          </button>

          <span className="text-slate-300 dark:text-slate-700">|</span>

          {/* GitHub Repository Link */}
          <a
            href={PROJECT_LINKS.repo}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-[11px] text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white transition-colors group"
            title="GitHub Repository"
          >
            <Github className="w-3.5 h-3.5 text-slate-700 dark:text-slate-300 group-hover:scale-110 transition-transform" />
            <span className="font-medium">{t.footer.github}</span>
            <ExternalLink className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
          </a>
        </div>
      </footer>

      {/* Help Modal */}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />
    </>
  );
};

export default Footer;
