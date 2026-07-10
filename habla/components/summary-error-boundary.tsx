import { SummaryFallbackScreen } from '@/components/summary-fallback-screen';
import type { SafeSummaryPayload } from '@/lib/summary-safe-data';
import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  payload: SafeSummaryPayload;
  onGoHome: () => void;
};

type State = {
  hasError: boolean;
  errorMessage?: string;
};

export class SummaryErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[Habla] Summary screen render crashed:', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SummaryFallbackScreen
          payload={this.props.payload}
          onGoHome={this.props.onGoHome}
          showLaterNote
        />
      );
    }
    return this.props.children;
  }
}
