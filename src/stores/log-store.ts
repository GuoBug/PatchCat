/**
 * @file    src/stores/log-store.ts
 * @version 1.0.0
 * @description
 *   Zustand store for managing the execution log console state, filters,
 *   active log level, and synchronization with the LoggerEngine singleton.
 */

import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';
import { logger, type LogEntry, type LogLevel, type LogType } from '../engine/logger.ts';

const LOG_LEVEL_KEY = 'patchcat-log-level-v1';

function getInitialLogLevel(): LogLevel {
  if (typeof window !== 'undefined') {
    const saved = localStorage.getItem(LOG_LEVEL_KEY) as LogLevel | null;
    if (saved && (saved === 'summary' || saved === 'detailed' || saved === 'dev')) {
      return saved;
    }
  }
  return 'detailed';
}

export interface LogStoreState {
  logLevel: LogLevel;
  isConsoleOpen: boolean;
  isMinimized: boolean;
  consoleHeight: number;
  autoScroll: boolean;
  selectedTypeFilter: LogType | 'all';
  searchQuery: string;
  logs: LogEntry[];

  // Actions
  setLogLevel: (level: LogLevel) => void;
  setConsoleOpen: (open: boolean) => void;
  toggleConsole: () => void;
  setIsMinimized: (minimized: boolean) => void;
  setConsoleHeight: (height: number) => void;
  setAutoScroll: (auto: boolean) => void;
  setSelectedTypeFilter: (filter: LogType | 'all') => void;
  setSearchQuery: (query: string) => void;
  clearLogs: () => void;
  exportLogs: (format: 'json' | 'txt') => void;
}

export const useLogStore = create<LogStoreState>()(
  immer((set) => {
    const initialLevel = getInitialLogLevel();
    logger.setLogLevel(initialLevel);

    return {
      logLevel: initialLevel,
      isConsoleOpen: false,
      isMinimized: false,
      consoleHeight: 280,
      autoScroll: true,
      selectedTypeFilter: 'all',
      searchQuery: '',
      logs: logger.getLogs(),

      setLogLevel: (level) => {
        logger.setLogLevel(level);
        if (typeof window !== 'undefined') {
          localStorage.setItem(LOG_LEVEL_KEY, level);
        }
        set((state) => {
          state.logLevel = level;
        });
      },

      setConsoleOpen: (open) => {
        set((state) => {
          state.isConsoleOpen = open;
          if (open) {
            state.isMinimized = false;
          }
        });
      },

      toggleConsole: () => {
        set((state) => {
          state.isConsoleOpen = !state.isConsoleOpen;
          if (state.isConsoleOpen) {
            state.isMinimized = false;
          }
        });
      },

      setIsMinimized: (minimized) => {
        set((state) => {
          state.isMinimized = minimized;
        });
      },

      setConsoleHeight: (height) => {
        set((state) => {
          state.consoleHeight = Math.max(160, Math.min(600, height));
        });
      },

      setAutoScroll: (auto) => {
        set((state) => {
          state.autoScroll = auto;
        });
      },

      setSelectedTypeFilter: (filter) => {
        set((state) => {
          state.selectedTypeFilter = filter;
        });
      },

      setSearchQuery: (query) => {
        set((state) => {
          state.searchQuery = query;
        });
      },

      clearLogs: () => {
        logger.clear();
        set((state) => {
          state.logs = [];
        });
      },

      exportLogs: (format) => {
        const content = format === 'json' ? logger.exportAsJson() : logger.exportAsText();
        const mimeType = format === 'json' ? 'application/json' : 'text/plain;charset=utf-8';
        const fileName = `patchcat-workflow-logs-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.${format}`;

        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      },
    };
  })
);

// Hook logger subscriber to update Zustand store state in real-time
logger.subscribe((entry) => {
  useLogStore.setState((state) => {
    state.logs = [...state.logs, entry].slice(-500);
  });
});
