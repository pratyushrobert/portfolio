import { useEffect, useState, useCallback, useRef } from 'react';
import { vfs } from '../../lib/vfs';
import {
  Loader2,
  AlertCircle,
  FileText,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
  ExternalLink,
} from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import type { DesktopOpenRequest } from '../../types/desktop';
import './PDFViewer.css';

interface PDFViewerProps {
  windowId: string;
  filePath?: string;
  onOpenRequest?: (request: DesktopOpenRequest) => void;
}

export function PDFViewer({ windowId, filePath: propFilePath }: PDFViewerProps) {
  const { getWindow } = useWindowStore();
  const mimiWindow = getWindow(windowId);
  const windowFilePath = mimiWindow?.appParams?.path as string | undefined;
  const isRemote = Boolean(mimiWindow?.appParams?.isRemote);
  const htmlUrl = typeof mimiWindow?.appParams?.htmlUrl === 'string' ? mimiWindow.appParams.htmlUrl : null;

  const filePathToLoad = propFilePath || windowFilePath;

  const [pdfSrc, setPdfSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [scale, setScale] = useState(1);
  const [page, setPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Load PDF
  useEffect(() => {
    if (isRemote && mimiWindow?.appParams?.pdfSrc) {
      setPdfSrc(String(mimiWindow.appParams.pdfSrc));
      const p = String(filePathToLoad || mimiWindow.appParams.title || 'document.pdf');
      setFilePath(p);
      setFileName(p.split('/').pop() || p);
      setLoading(false);
    } else if (filePathToLoad) {
      loadPDF(filePathToLoad);
    } else {
      setError('No file specified');
      setLoading(false);
    }
  }, [filePathToLoad, isRemote, mimiWindow?.appParams]);

  const loadPDF = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setFilePath(path);
    setFileName(path.split('/').pop() || path);
    setPdfSrc(null);
    setPage(1);
    setNumPages(0);

    try {
      const result = vfs.stat(path);
      if (!result.success || !result.data) {
        setError(result.error || 'No such file or directory');
        setLoading(false);
        return;
      }

      if (result.data.type === 'directory') {
        setError('Cannot open directory as PDF');
        setLoading(false);
        return;
      }

      const stat = result.data;
      if (stat.isBinary) {
        // Built-in static asset - use assetPath directly
        if (stat.assetPath) {
          setPdfSrc(stat.assetPath);
        } else {
          // Visitor upload - use readBinaryFile from IndexedDB
          const binaryResult = await vfs.readBinaryFile(path);
          if (!binaryResult.success || !binaryResult.data) {
            setError(binaryResult.error || 'Failed to read binary file');
            setLoading(false);
            return;
          }
          const blobUrl = URL.createObjectURL(binaryResult.data);
          setPdfSrc(blobUrl);
        }
      } else {
        setError('PDF files must be binary files');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError('Failed to load PDF');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleIframeLoad = useCallback(() => {
    // Try to get page count from iframe (if same-origin)
    try {
      const iframe = iframeRef.current;
      if (iframe && iframe.contentWindow) {
        const pdfViewer = iframe.contentWindow.document.querySelector('embed, object');
        if (pdfViewer && 'page' in pdfViewer) {
          // Some browsers expose page count
        }
      }
    } catch (_error) {
      // Cross-origin or no access
    }
  }, []);

  const handleZoomIn = useCallback(() => setScale(s => Math.min(s * 1.2, 3)), []);
  const handleZoomOut = useCallback(() => setScale(s => Math.max(s / 1.2, 0.5)), []);
  const handleResetZoom = useCallback(() => setScale(1), []);
  const handleFitToWindow = useCallback(() => {
    if (!containerRef.current) return;
    const containerRect = containerRef.current.getBoundingClientRect();
    // Estimate: A4 is ~794x1123 at 1x, so scale to fit width with padding
    const scaleX = (containerRect.width - 40) / 794;
    const scaleY = (containerRect.height - 40) / 1123;
    setScale(Math.min(scaleX, scaleY, 2));
  }, []);

  const handlePageChange = useCallback((delta: number) => {
    setPage(p => Math.max(1, Math.min(numPages, p + delta)));
  }, [numPages]);

  const handleOpenInBrowser = useCallback(() => {
    if (pdfSrc) {
      window.open(pdfSrc, '_blank');
    }
  }, [pdfSrc]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (pdfSrc && pdfSrc.startsWith('blob:')) {
        URL.revokeObjectURL(pdfSrc);
      }
    };
  }, [pdfSrc]);

  if (loading) {
    return (
      <div className="pdf-viewer loading">
        <Loader2 className="spinning" size={24} />
        <span>Loading PDF...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-viewer error">
        <AlertCircle size={24} />
        <div className="error-message">{error}</div>
        <div className="error-path">{filePath}</div>
      </div>
    );
  }

  return (
    <div className="pdf-viewer">
      <div className="pdf-viewer-header">
        <div className="pdf-viewer-file-info">
          <FileText size={18} className="pdf-viewer-icon" />
          <div className="pdf-viewer-file-details">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span className="pdf-viewer-file-name">{fileName}</span>
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
            <div className="pdf-viewer-file-path">{filePath}</div>
          </div>
        </div>
        {htmlUrl && (
          <a
            href={htmlUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="pv-btn"
            style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 4, height: 28 }}
            title="Open on GitHub"
          >
            <ExternalLink size={14} />
            <span>GitHub ↗</span>
          </a>
        )}
      </div>

      <div className="pdf-viewer-toolbar">
        <div className="toolbar-group">
          <button className="pv-btn" onClick={handleZoomOut} title="Zoom Out" disabled={!pdfSrc}><ZoomOut size={16} /></button>
          <button className="pv-btn" onClick={handleResetZoom} title="Reset Zoom" disabled={!pdfSrc}><Minimize2 size={16} /></button>
          <button className="pv-btn" onClick={handleZoomIn} title="Zoom In" disabled={!pdfSrc}><ZoomIn size={16} /></button>
          <button className="pv-btn" onClick={handleFitToWindow} title="Fit to Window" disabled={!pdfSrc}><Maximize2 size={16} /></button>
        </div>
        <div className="toolbar-group">
          <button className="pv-btn" onClick={() => handlePageChange(-1)} title="Previous Page" disabled={!pdfSrc || page <= 1}>&laquo;</button>
          <span className="page-indicator" style={{ padding: '0 8px', fontFamily: 'var(--mono)', color: 'var(--text-h)' }}>
            Page {page} {numPages > 0 ? `of ${numPages}` : ''}
          </span>
          <button className="pv-btn" onClick={() => handlePageChange(1)} title="Next Page" disabled={!pdfSrc || page >= numPages}>&raquo;</button>
        </div>
        <div className="toolbar-group">
          <button className="pv-btn" onClick={handleOpenInBrowser} title="Open in New Tab" disabled={!pdfSrc}><FileText size={16} /></button>
        </div>
      </div>

      <div className="pdf-viewer-content" ref={containerRef}>
        {pdfSrc && (
          <div className="pdf-container" style={{ transform: `scale(${scale})`, transformOrigin: 'top center' }}>
            <iframe
              ref={iframeRef}
              src={pdfSrc}
              onLoad={handleIframeLoad}
              className="pdf-iframe"
              title={fileName}
              style={{ width: '100%', height: '100%', minHeight: '100%', border: 'none' }}
            />
          </div>
        )}
      </div>
    </div>
  );
}