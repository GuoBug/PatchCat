import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw } from 'lucide-react';

interface Props {
  children: ReactNode;
  nodeId?: string;
  fallbackTitle?: string;
  resetBtnLabel?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class NodeErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[NodeErrorBoundary] Caught render failure in node ${this.props.nodeId || 'unknown'}:`, error, errorInfo);
  }

  public handleReset = (): void => {
    this.setState({ hasError: false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  public render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-3 rounded-xl border border-rose-500/40 bg-rose-50/50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200 text-xs font-sans space-y-2">
          <div className="flex items-center gap-1.5 font-semibold text-rose-700 dark:text-rose-400">
            <AlertOctagon className="w-4 h-4 shrink-0 text-rose-500" />
            <span>{this.props.fallbackTitle || 'Node Rendering Error'}</span>
          </div>
          <p className="text-[11px] text-rose-600/90 dark:text-rose-300/80 font-mono line-clamp-2 break-all">
            {this.state.error?.message || 'An unexpected rendering error occurred in this node component.'}
          </p>
          <button
            onClick={this.handleReset}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 dark:bg-rose-900/40 dark:hover:bg-rose-900/60 text-rose-700 dark:text-rose-300 font-medium text-[11px] transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3 h-3" />
            <span>{this.props.resetBtnLabel || 'Reset Node'}</span>
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
