import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Trash2, Home } from 'lucide-react';

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
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught error:', error, errorInfo);
  }

  private handleReload = () => {
    window.location.reload();
  };

  private handleResetLocalShares = () => {
    try {
      localStorage.removeItem('jjcloud_shares_store');
    } catch {}
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen w-screen flex flex-col items-center justify-center p-4 bg-gray-950 text-gray-100 font-sans select-none">
          <div className="w-full max-w-md p-8 rounded-3xl bg-gray-900 border border-gray-800 shadow-2xl text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-amber-950/60 border border-amber-800/60 flex items-center justify-center text-amber-400">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-bold mb-2 text-white">
              Anzeigefehler abgefangen
            </h2>

            <p className="text-xs text-gray-400 leading-relaxed mb-4">
              Es ist ein Fehler bei der Verarbeitung von Daten aufgetreten. Die Oberfläche wurde stabil gehalten.
            </p>

            {this.state.error?.message && (
              <div className="p-3 mb-6 rounded-xl bg-gray-950/80 border border-gray-800 text-left text-xs font-mono text-red-400 break-all max-h-24 overflow-y-auto">
                {this.state.error.message}
              </div>
            )}

            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={this.handleReload}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs transition-all shadow-md cursor-pointer"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Seite neu laden</span>
              </button>

              <button
                type="button"
                onClick={this.handleResetLocalShares}
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 font-medium text-xs transition-all border border-gray-700 cursor-pointer"
                title="Bereinigt lokale Freigaben-Zwischenspeicher und lädt neu"
              >
                <Trash2 className="w-3.5 h-3.5 text-amber-400" />
                <span>Freigabe-Cache bereinigen & neu laden</span>
              </button>

              <a
                href="/"
                className="w-full inline-flex items-center justify-center gap-2 px-5 py-2 text-gray-400 hover:text-gray-200 font-medium text-xs transition-colors"
              >
                <Home className="w-3.5 h-3.5" />
                <span>Zur Startseite</span>
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
