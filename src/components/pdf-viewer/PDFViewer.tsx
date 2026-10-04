import React, { useEffect, useState, useCallback, useRef } from 'react';
import { vfs } from '../../lib/vfs';
import { isFileNode } from '../../lib/vfs/nodes';
import {
  Loader2,
  AlertCircle,
  FileText,
  Maximize2,
  Minimize2,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import './PDFViewer.css';

interface PDFViewerProps {
  windowId: string;
  filePath?: string;
  onOpenRequest?: (request: any) => void;
}

export function PDFViewer({ windowId, filePath: propFilePath, onOpenRequest }: PDFViewerProps) {
  const { getWindow } = useWindowStore();
  const mimiWindow = getWindow(windowId);
  const windowFilePath = mimiWindow?.appParams?.path as string | undefined;

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
    if (filePathToLoad) {
      loadPDF(filePathToLoad);
    } else {
      setError('No file specified');
      setLoading(false);
    }
  }, [filePathToLoad]);

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
      if (!result.success) {
        setError(result.error || 'No such file or directory');
        setLoading(false);
        return;
      }

      if (result.data!.type === 'directory') {
        setError('Cannot open directory as PDF');
        setLoading(false);
        return;
      }

      const node = vfs.getNodeByPath(path);
      if (!node || !isFileNode(node)) {
        setError('File not found in VFS');
        setLoading(false);
        return;
      }

      if (node.isBinary) {
        // Built-in static asset - use assetPath directly
        if (node.assetPath) {
          setPdfSrc(node.assetPath);
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

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time)) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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
            <div className="pdf-viewer-file-name">{fileName}</div>
            <div className="pdf-viewer-file-path">{filePath}</div>
          </div>
        </div>
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