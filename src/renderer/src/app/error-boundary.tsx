import { Component, type ErrorInfo, type PropsWithChildren } from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface ErrorBoundaryState {
  error: Error | null;
}

export class AppErrorBoundary extends Component<PropsWithChildren, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary] Uncaught rendering error:', error, info.componentStack);
  }

  override render() {
    if (this.state.error) {
      return (
        <div className="flex h-full w-full items-center justify-center bg-surface-0 p-8">
          <div className="max-w-lg text-center">
            <AlertTriangle className="mx-auto mb-4 h-8 w-8 text-rose-400" />
            <h1 className="mb-2 font-geist text-[16px] font-semibold text-white/90">
              Something went wrong
            </h1>
            <p className="mb-4 font-geist text-[13px] text-white/50">
              Autocode hit an unexpected error. You can try reloading the window.
            </p>
            <pre className="mb-6 max-h-[200px] overflow-auto rounded-lg border border-white/[0.08] bg-black/30 p-4 text-left font-mono text-[11px] text-rose-300/80">
              {this.state.error.message}
              {this.state.error.stack ? `\n\n${this.state.error.stack}` : ''}
            </pre>
            <button
              className="inline-flex items-center gap-2 rounded-lg border border-white/[0.12] bg-white/[0.06] px-4 py-2 font-geist text-[13px] font-medium text-white/80 transition hover:bg-white/[0.10] hover:text-white"
              onClick={() => window.location.reload()}
              type="button"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reload window
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
