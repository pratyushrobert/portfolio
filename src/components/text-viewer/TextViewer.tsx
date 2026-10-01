import React, { useEffect, useState, useCallback } from 'react';
import { vfs } from '../../lib/vfs';
import { Copy, Check, Loader2, AlertCircle, FileText } from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import './TextViewer.css';

interface TextViewerProps {
  windowId: string;
  filePath?: string; // Optional: passed directly from Desktop
  onOpenRequest?: (request: any) => void;
}

export function TextViewer({ windowId, filePath: propFilePath, onOpenRequest }: TextViewerProps) {
  const { getWindow } = useWindowStore();
  const window = getWindow(windowId);
  const windowFilePath = window?.appParams?.path as string | undefined;

  // Prefer prop path, fallback to window appParams
  const filePathToLoad = propFilePath || windowFilePath;

  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [copied, setCopied] = useState(false);

  // Load file from prop or window store
  useEffect(() => {
    if (filePathToLoad) {
      loadFile(filePathToLoad);
    } else {
      setError('No file specified');
      setLoading(false);
    }
  }, [filePathToLoad]);

  const loadFile = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setFilePath(path);
    setFileName(path.split('/').pop() || path);

    try {
      const result = vfs.stat(path);
      if (!result.success) {
        setError(result.error || 'No such file or directory');
        setLoading(false);
        return;
      }

      if (result.data!.type === 'directory') {
        setError('Cannot open directory as text');
        setLoading(false);
        return;
      }

      const readResult = vfs.readFile(path);
      if (!readResult.success) {
        setError(readResult.error || 'Failed to read file');
        setLoading(false);
        return;
      }

      setContent(readResult.data!);
    } catch (err) {
      setError('Failed to read file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API might not be available
    }
  };

  const isMarkdown = fileName.endsWith('.md');

  if (loading) {
    return (
      <div className="text-viewer loading">
        <Loader2 className="spinning" size={24} />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-viewer error">
        <AlertCircle size={24} />
        <div className="error-message">{error}</div>
        <div className="error-path">{filePath}</div>
      </div>
    );
  }

  return (
    <div className="text-viewer">
      <div className="tv-header">
        <div className="tv-file-info">
          <FileText size={18} className="tv-icon" />
          <div className="tv-file-details">
            <div className="tv-file-name">{fileName}</div>
            <div className="tv-file-path">{filePath}</div>
          </div>
        </div>
        <button className="tv-copy-btn" onClick={handleCopy} title="Copy to clipboard">
          {copied ? (
            <>
              <Check size={16} />
              <span>Copied!</span>
            </>
          ) : (
            <>
              <Copy size={16} />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      <div className="tv-content">
        {isMarkdown ? (
          <div className="tv-markdown" dangerouslySetInnerHTML={{ __html: simpleMarkdown(content) }} />
        ) : (
          <pre className="tv-code">
            {content.split('\n').map((line, i) => (
              <span key={i} className="tv-line">
                <span className="tv-line-number">{i + 1}</span>
                <span className="tv-line-content">{line}</span>
              </span>
            ))}
          </pre>
        )}
      </div>
    </div>
  );
}

// Simple markdown renderer for basic formatting without external dependency
function simpleMarkdown(text: string): string {
  return text
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`(.+?)`/g, '<code>$1</code>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\n/g, '<br/>');
}