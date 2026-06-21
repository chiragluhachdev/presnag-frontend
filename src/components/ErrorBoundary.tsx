import { Component, ReactNode } from "react";

interface Props { children: ReactNode }
interface State { hasError: boolean }

/** Catches render-time errors so a single broken component can't blank the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error("[ErrorBoundary]", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-slate-50 px-6 text-center">
          <div className="text-3xl">😕</div>
          <h1 className="text-lg font-bold text-slate-900">Something went wrong</h1>
          <p className="max-w-xs text-sm text-slate-500">
            An unexpected error occurred. Please refresh the page — your order and data are safe.
          </p>
          <button
            onClick={() => window.location.assign("/")}
            className="mt-2 rounded-xl bg-brand-500 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-brand-600"
          >
            Back to home
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
