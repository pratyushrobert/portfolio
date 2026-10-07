import { AlertTriangle, RotateCcw, ArrowRight } from 'lucide-react';
import './Boot.css';

interface BootErrorProps {
  message: string | null;
  onRetry: () => void;
  onBypass: () => void;
}

export function BootError({ message, onRetry, onBypass }: BootErrorProps) {
  return (
    <div
      className="boot-error-screen"
      role="alertdialog"
      aria-modal="true"
      aria-label="System Initialization Notice"
    >
      <div />

      <main className="boot-error-card">
        <AlertTriangle size={48} className="boot-error-icon" />

        <h1 className="boot-error-title" style={{ fontSize: 20 }}>
          Startup Notice
        </h1>

        <p className="boot-error-subtitle" style={{ margin: 0 }}>
          {message || 'An error occurred during system startup. Fallback defaults are ready.'}
        </p>

        <div className="boot-error-actions">
          <button
            type="button"
            className="settings-btn settings-btn-secondary"
            onClick={onRetry}
            style={{ padding: '10px 18px', color: '#fff', border: '1px solid rgba(255,255,255,0.2)' }}
          >
            <RotateCcw size={15} />
            <span>Retry Boot</span>
          </button>

          <button
            type="button"
            className="settings-btn settings-btn-primary"
            onClick={onBypass}
            style={{ padding: '10px 18px' }}
          >
            <span>Continue to Desktop</span>
            <ArrowRight size={15} />
          </button>
        </div>
      </main>

      <footer className="boot-error-footer">
        MimiOS Recovery Environment
      </footer>
    </div>
  );
}
