import { useEffect, useState, useCallback } from 'react';
import { vfs } from '../../lib/vfs';
import { Copy, Check, Loader2, AlertCircle, FileText, ExternalLink, GitBranch } from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import { projectsApi } from '../../lib/api/projects';
import { githubApi } from '../../lib/api/github';
import type { DesktopOpenRequest } from '../../types/desktop';
import './TextViewer.css';

interface TextViewerProps {
  windowId: string;
  filePath?: string; // Optional: passed directly from Desktop
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

export function TextViewer({ windowId, filePath: propFilePath, onOpenRequest }: TextViewerProps) {
  const { getWindow } = useWindowStore();
  const window = getWindow(windowId);
  const windowParams = window?.appParams;
  const isRemote = Boolean(windowParams?.isRemote);
  const htmlUrl = typeof windowParams?.htmlUrl === 'string' ? windowParams.htmlUrl : null;
  const windowFilePath = windowParams?.path as string | undefined;

  // Prefer prop path, fallback to window appParams
  const filePathToLoad = propFilePath || windowFilePath;

  const [content, setContent] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [matchedLocalProject, setMatchedLocalProject] = useState<{ id: string; name: string; repo: string } | null>(null);

  const isOversized = Boolean(windowParams?.isOversized) || (error?.toLowerCase().includes('too large') ?? false) || (error?.toLowerCase().includes('exceeds 1 mb') ?? false);
  const isBinary = Boolean(windowParams?.isBinary);

  // Detect if local file belongs to a project with a GitHub repository
  useEffect(() => {
    if (!isRemote && filePathToLoad && filePathToLoad.startsWith('/home/pratyush/projects/')) {
      projectsApi.list().then(projects => {
        const clean = filePathToLoad.toLowerCase();
        const match = projects.find(p => {
          if (!p.github_repo) return false;
          const slug = p.name.toLowerCase().replace(/[^a-z0-9]/g, '');
          const repoEnd = (p.github_repo.toLowerCase().split('/').pop() || '').replace(/[^a-z0-9]/g, '');
          return clean.includes(`/${slug}/`) || clean.includes(`/${repoEnd}/`);
        });
        if (match && match.github_repo) {
          setMatchedLocalProject({ id: match.id, name: match.name, repo: match.github_repo });
        }
      }).catch(() => {});
    }
  }, [isRemote, filePathToLoad]);

  // Load file from prop or window store
  useEffect(() => {
    if (isRemote) {
      if (windowParams?.isOversized) {
        const path = String(filePathToLoad || windowParams.path || 'file');
        setFilePath(path);
        setFileName(path.split('/').pop() || path);
        setLoading(false);
        return;
      }
      if (windowParams?.isBinary) {
        const path = String(filePathToLoad || windowParams.path || 'file');
        setFilePath(path);
        setFileName(path.split('/').pop() || path);
        setLoading(false);
        return;
      }
      if (typeof windowParams?.remoteContent === 'string') {
        const path = String(filePathToLoad || windowParams.path || 'file');
        setFilePath(path);
        setFileName(path.split('/').pop() || path);
        setContent(windowParams.remoteContent);
        setLoading(false);
      } else if (typeof windowParams?.projectId === 'string' && filePathToLoad) {
        setLoading(true);
        setError(null);
        projectsApi
          .getRepositoryFile(windowParams.projectId, filePathToLoad)
          .then(res => {
            setFilePath(res.path);
            setFileName(res.name);
            setContent(res.content);
          })
          .catch(err => {
            setError(err instanceof Error ? err.message : 'Failed to fetch remote file');
          })
          .finally(() => setLoading(false));
      } else if (typeof windowParams?.repo === 'string' && filePathToLoad) {
        setLoading(true);
        setError(null);
        const repoName = (windowParams.repo as string).split('/').pop() || (windowParams.repo as string);
        githubApi
          .getRepoFile(repoName, filePathToLoad)
          .then(res => {
            setFilePath(res.path);
            setFileName(res.name);
            setContent(res.content);
          })
          .catch(err => {
            setError(err instanceof Error ? err.message : 'Failed to fetch remote file');
          })
          .finally(() => setLoading(false));
      } else {
        setError('Remote file parameters missing');
        setLoading(false);
      }
    } else if (filePathToLoad) {
      loadFile(filePathToLoad);
    } else {
      setError('No file specified');
      setLoading(false);
    }
  }, [filePathToLoad, isRemote, windowParams]);

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
    } catch {
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

  const handleBrowseRepo = () => {
    if (matchedLocalProject && onOpenRequest) {
      onOpenRequest({
        type: 'open',
        appId: 'files',
        title: `Files — ${matchedLocalProject.name} (${matchedLocalProject.repo})`,
        params: {
          mode: 'github',
          projectId: matchedLocalProject.id,
          repo: matchedLocalProject.repo,
          projectName: matchedLocalProject.name,
          path: '',
        },
      });
    }
  };

  const isMarkdown = fileName.endsWith('.md') || fileName.endsWith('.markdown');
  const lineCount = content ? content.split('\n').length : 0;
  const charCount = content ? content.length : 0;

  if (loading) {
    return (
      <div className="text-viewer loading">
        <Loader2 className="spinning" size={24} />
        <span>Loading...</span>
      </div>
    );
  }

  if (error && !isOversized) {
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="tv-file-name">{fileName}</span>
              {isRemote && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    padding: '1px 6px',
                    borderRadius: 3,
                    background: 'rgba(56, 189, 248, 0.15)',
                    color: '#38bdf8',
                    border: '1px solid rgba(56, 189, 248, 0.3)',
                    textTransform: 'uppercase',
                  }}
                >
                  GitHub (Read-Only)
                </span>
              )}
            </div>
            <div className="tv-file-path">
              {filePath}
              {!isOversized && !isBinary && content && (
                <span> &bull; {lineCount} {lineCount === 1 ? 'line' : 'lines'} ({charCount} chars)</span>
              )}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {matchedLocalProject && (
            <button
              className="tv-copy-btn"
              onClick={handleBrowseRepo}
              title={`Browse ${matchedLocalProject.repo} in MimiOS`}
            >
              <GitBranch size={14} />
              <span>Browse Repository</span>
            </button>
          )}
          {htmlUrl && (
            <a
              href={htmlUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="tv-copy-btn"
              style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4 }}
              title="Open on GitHub"
            >
              <ExternalLink size={14} />
              <span>GitHub ↗</span>
            </a>
          )}
          {!isOversized && !isBinary && (
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
          )}
        </div>
      </div>

      <div className="tv-content">
        {isOversized ? (
          <div className="tv-notice-card">
            <AlertCircle size={40} style={{ color: '#eab308' }} />
            <h3>File too large to preview</h3>
            <p>
              This file exceeds the 1 MB preview limit
              {typeof windowParams?.size === 'number' && ` (${(windowParams.size / 1024 / 1024).toFixed(1)} MB)`}.
              Open on GitHub to view its full content.
            </p>
            {htmlUrl && (
              <a href={htmlUrl} target="_blank" rel="noopener noreferrer" className="tv-action-btn">
                <ExternalLink size={14} />
                <span>Open on GitHub ↗</span>
              </a>
            )}
          </div>
        ) : isBinary ? (
          <div className="tv-notice-card">
            <FileText size={40} style={{ opacity: 0.6 }} />
            <h3>Preview unavailable</h3>
            <p>Binary files cannot be previewed in the text viewer.</p>
            {htmlUrl && (
              <a href={htmlUrl} target="_blank" rel="noopener noreferrer" className="tv-action-btn">
                <ExternalLink size={14} />
                <span>Open on GitHub ↗</span>
              </a>
            )}
          </div>
        ) : isMarkdown ? (
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

// HTML entity escaping to prevent DOM/Stored XSS
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Simple markdown renderer for basic formatting without external dependency
function simpleMarkdown(text: string): string {
  const safeText = escapeHtml(text);
  return safeText
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
    .replace(/`([^`\n]+?)`/g, '<code>$1</code>')
    .replace(/^\- (.*$)/gim, '<li>$1</li>')
    .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\n/g, '<br/>');
}