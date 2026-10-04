import React, { useEffect, useState, useCallback, useRef } from 'react';
import { vfs } from '../../lib/vfs';
import { Save, Check, AlertCircle, FileText, Loader2 } from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import './Editor.css';

interface EditorProps {
  windowId: string;
  filePath?: string;
  onOpenRequest?: (request: any) => void;
}

export function Editor({ windowId, filePath: propFilePath, onOpenRequest }: EditorProps) {
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
  const [isDirty, setIsDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [cursorPosition, setCursorPosition] = useState({ line: 1, column: 1 });
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load file
  useEffect(() => {
    if (filePathToLoad) {
      loadFile(filePathToLoad);
    } else {
      // Create new empty document
      setContent('');
      setFilePath('');
      setFileName('untitled.txt');
      setIsDirty(false);
      setSaved(true);
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
      setIsDirty(false);
      setSaved(true);
    } catch (err) {
      setError('Failed to read file');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!filePath) {
      // For new files, save to current working directory with fileName
      const cwd = vfs.getCwd();
      const newPath = cwd === '/' ? `/${fileName}` : `${cwd}/${fileName}`;
      const result = vfs.writeFile(newPath, content);
      if (result.success) {
        setFilePath(newPath);
        setIsDirty(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      } else {
        setError(result.error || 'Failed to save file');
      }
      return;
    }

    const result = vfs.writeFile(filePath, content);
    if (result.success) {
      setIsDirty(false);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } else {
      setError(result.error || 'Failed to save file');
    }
  }, [filePath, content, fileName]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newContent = e.target.value;
    setContent(newContent);
    setIsDirty(true);
    setSaved(false);

    // Update cursor position
    const text = e.target.value.substring(0, e.target.selectionStart);
    const lines = text.split('\n');
    setCursorPosition({
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    });
  }, []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 's') {
      e.preventDefault();
      handleSave();
    }
  }, [handleSave]);

  const handleSelect = useCallback((e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    const target = e.currentTarget;
    const text = target.value.substring(0, target.selectionStart);
    const lines = text.split('\n');
    setCursorPosition({
      line: lines.length,
      column: lines[lines.length - 1].length + 1,
    });
  }, []);

  const stats = {
    lines: content.split('\n').length,
    characters: content.length,
  };

  if (loading) {
    return (
      <div className="editor loading">
        <Loader2 className="spinning" size={24} />
        <span>Loading...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor error">
        <AlertCircle size={24} />
        <div className="error-message">{error}</div>
        <div className="error-path">{filePath}</div>
      </div>
    );
  }

  return (
    <div className="editor">
      <div className="editor-header">
        <div className="editor-file-info">
          <FileText size={18} className="editor-icon" />
          <div className="editor-file-details">
            <div className="editor-file-name">
              {fileName}
              {isDirty && <span className="dirty-indicator" title="Unsaved changes">●</span>}
              {saved && <span className="saved-indicator" title="Saved">✓</span>}
            </div>
            <div className="editor-file-path">{filePath}</div>
          </div>
        </div>
        <div className="editor-actions">
          <button
            className="editor-btn save-btn"
            onClick={handleSave}
            disabled={!isDirty}
            title="Save (Ctrl+S)"
          >
            <Save size={16} />
            <span>Save</span>
          </button>
        </div>
      </div>

      <div className="editor-toolbar">
        <div className="editor-stats">
          <span>Ln {cursorPosition.line}</span>
          <span>Col {cursorPosition.column}</span>
          <span>{stats.lines} lines</span>
          <span>{stats.characters} chars</span>
        </div>
        <div className="editor-hint">Ctrl+S to save</div>
      </div>

      <div className="editor-content">
        <textarea
          ref={textareaRef}
          className="editor-textarea"
          value={content}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onSelect={handleSelect}
          spellCheck={false}
          placeholder={filePath ? "Loading..." : "New document - start typing..."}
          disabled={loading}
        />
      </div>
    </div>
  );
}