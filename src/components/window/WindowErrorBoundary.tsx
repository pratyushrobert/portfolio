import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RotateCcw, X } from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import './Window.css';

interface Props {
  windowId: string;
  windowTitle?: string;
  children: ReactNode;
}

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class WindowErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      errorMessage: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      errorMessage: error.message || 'An unexpected error occurred in this application.',
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`[MimiOS Window Error] in window "${this.props.windowTitle || this.props.windowId}":`, error, errorInfo);
  }

  handleRestart = () => {
    this.setState({ hasError: false, errorMessage: '' });
  };

  handleClose = () => {
    useWindowStore.getState().closeWindow(this.props.windowId);
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="window-error-boundary" role="alert">
          <div className="window-error-box">
            <div className="window-error-icon">
              <AlertTriangle size={36} />
            </div>
            <h3 className="window-error-title">Application Paused</h3>
            <p className="window-error-desc">
              This window encountered an unexpected issue. The rest of MimiOS is running normally.
            </p>
            <div className="window-error-actions">
              <button
                className="window-error-btn window-error-btn-primary"
                onClick={this.handleRestart}
              >
                <RotateCcw size={14} />
                <span>Restart App</span>
              </button>
              <button
                className="window-error-btn window-error-btn-secondary"
                onClick={this.handleClose}
              >
                <X size={14} />
                <span>Close Window</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
