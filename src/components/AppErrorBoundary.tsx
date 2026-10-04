import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  /** Human-readable region name used in logs and the fallback title. */
  region?: string;
  /** Full-screen fallback for the root boundary; compact fallback for inner regions. */
  fullscreen?: boolean;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

function isZh(): boolean {
  return typeof navigator !== 'undefined' && Boolean(navigator.language?.startsWith('zh'));
}

/**
 * Region-level error boundary. A render crash in the sidebar, canvas or property panel
 * is contained to that region instead of blanking the whole app.
 */
export class AppErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, error: null };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[AppErrorBoundary] Render failure in region "${this.props.region || 'root'}":`, error, errorInfo);
  }

  private handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    this.props.onReset?.();
  };

  public render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    const zh = isZh();
    const region = this.props.region || (zh ? '应用' : 'App');
    const title = zh ? `${region} 渲染出错` : `${region} failed to render`;
    const retry = zh ? '重试' : 'Retry';
    const reload = zh ? '重新加载页面' : 'Reload page';

    return (
      <div
        role="alert"
        className={`${
          this.props.fullscreen ? 'w-screen h-screen' : 'w-full h-full min-h-[120px]'
        } flex items-center justify-center p-6 bg-rose-50/50 dark:bg-rose-950/30 text-rose-800 dark:text-rose-200 font-sans`}
      >
        <div className="max-w-md space-y-3 text-sm">
          <div className="flex items-center gap-2 font-semibold text-rose-700 dark:text-rose-400">
            <AlertOctagon className="w-5 h-5 shrink-0" />
            <span>{title}</span>
          </div>
          <p className="text-xs font-mono break-all line-clamp-3 text-rose-600/90 dark:text-rose-300/80">
            {this.state.error?.message || 'Unexpected error'}
          </p>
          <div className="flex gap-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 text-xs font-medium cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {retry}
            </button>
            {this.props.fullscreen && (
              <button
                onClick={() => window.location.reload()}
                className="px-3 py-1.5 rounded-lg border border-rose-300 dark:border-rose-700 text-xs font-medium cursor-pointer"
              >
                {reload}
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }
}
