import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    try {
      if (this.state.hasError) {
        let errorMessage = "Something went wrong.";
        const rawMessage = this.state.error?.message;

        if (typeof rawMessage === 'string' && rawMessage.trim().startsWith('{')) {
          try {
            // Only try parsing if it's not the string "undefined"
            if (rawMessage.trim() !== "undefined") {
              const parsed = JSON.parse(rawMessage);
              if (parsed && typeof parsed === 'object') {
                const innerError = parsed.error || '';
                if (typeof innerError === 'string' && innerError.toLowerCase().includes("permission")) {
                  errorMessage = "You do not have permission to perform this action. Please contact your coordinator.";
                } else if (parsed.message) {
                  errorMessage = parsed.message;
                } else if (typeof innerError === 'string' && innerError.length > 0) {
                  errorMessage = innerError;
                }
              }
            }
          } catch (e) {
            // If parsing fails, use the raw message if valid
            if (rawMessage !== "undefined") {
              errorMessage = rawMessage;
            }
          }
        } else if (rawMessage) {
          // Plain string error checks
          if (typeof rawMessage === 'string' && rawMessage.toLowerCase().includes("permission")) {
            errorMessage = "You do not have permission to perform this action. Please contact your coordinator.";
          } else if (rawMessage !== "undefined") {
            errorMessage = String(rawMessage);
          }
        }

      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Oops!</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-dltt-green text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
    } catch (e) {
      console.error("Critical error in ErrorBoundary render:", e);
      return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
          <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8 text-center">
            <h2 className="text-2xl font-bold text-red-600 mb-4">Critical Error</h2>
            <p className="text-gray-600 mb-6">A critical error occurred in the application. Please try refreshing the page.</p>
            <button
              onClick={() => window.location.reload()}
              className="bg-dltt-green text-white px-6 py-2 rounded-lg font-medium hover:opacity-90 transition-opacity"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }
  }
}
