import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Download, Printer, RotateCcw, RotateCw, Minus, Plus, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';
import { useWindowStore } from '../../../hooks/useWindows';
import './ResumeViewerApp.css';

// Configure PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.js`;

interface ResumeViewerAppProps {
  instance: any;
}

export const ResumeViewerApp: React.FC<ResumeViewerAppProps> = ({ instance }) => {
  const { openWindow } = useWindowStore();
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [scale, setScale] = useState(1.2);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<AnyVFSNode | null>(null);

  // Load PDF from props or default
  useEffect(() => {
    if (instance.props?.file) {
      fileRef.current = instance.props.file;
      loadPDF(instance.props.file);
    } else {
      // Try to load default resume
      loadDefaultResume();
    }
  }, [instance.props]);

  const loadDefaultResume = async () => {
    try {
      const result = vfs.list('/home/user/Documents');
      if (result.success) {
        const resume = result.data!.find((n) => n.type === 'file' && n.name.toLowerCase().includes('resume'));
        if (resume) {
          fileRef.current = resume;
          loadPDF(resume);
          return;
        }
      }
      // Create a default resume
      createDefaultResume();
    } catch {
      createDefaultResume();
    }
  };

  const createDefaultResume = () => {
    // Create a simple text-based resume as PDF would be complex
    // For now, show a message
    setError('No resume found. Add a resume.pdf to /home/user/Documents/');
    setLoading(false);
  };

  const loadPDF = async (file: AnyVFSNode) => {
    setLoading(true);
    setError(null);

    try {
      let data: Uint8Array;

      if (file.isBinary) {
        // Base64 decode
        const binaryString = atob(file.content);
        data = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          data[i] = binaryString.charCodeAt(i);
        }
      } else {
        // Text content - create a simple PDF-like view
        // For demo, we'll render text content on canvas
        setError('Text-based resume preview. For full PDF support, upload a PDF file.');
        setLoading(false);
        return;
      }

      const loadingTask = pdfjsLib.getDocument({ data });
      const pdf = await loadingTask.promise;
      setPdfDoc(pdf);
      setNumPages(pdf.numPages);
      setCurrentPage(1);
      renderPage(1);
    } catch (err) {
      setError('Failed to load PDF: ' + (err as Error).message);
      setLoading(false);
    }
  };

  const renderPage = async (pageNum: number) => {
    if (!pdfDoc || !canvasRef.current) return;

    try {
      const page = await pdfDoc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      const canvas = canvasRef.current;
      const context = canvas.getContext('2d');
      if (!context) return;

      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderContext = {
        canvasContext: context,
        viewport,
      };

      await page.render(renderContext).promise;
      setLoading(false);
    } catch (err) {
      setError('Failed to render page: ' + (err as Error).message);
      setLoading(false);
    }
  };

  const handlePageChange = (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage >= 1 && newPage <= numPages) {
      setCurrentPage(newPage);
      renderPage(newPage);
    }
  };

  const handleScaleChange = (newScale: number) => {
    const clampedScale = Math.max(0.5, Math.min(3, newScale));
    setScale(clampedScale);
    renderPage(currentPage);
  };

  const handleDownload = () => {
    if (!fileRef.current) return;

    if (fileRef.current.isBinary) {
      const binaryString = atob(fileRef.current.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileRef.current.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  if (loading && !error) {
    return (
      <div className="resume-viewer loading">
        <div className="resume-spinner" />
        <p>Loading resume...</p>
      </div>
    );
  }

  if (error && !pdfDoc) {
    return (
      <div className="resume-viewer error">
        <FileText className="lucide-icon" size={48} />
        <p>{error}</p>
        <button className="resume-btn" onClick={() => openWindow('file-manager')}>
          <ChevronLeft size={16} />
          <span>Browse Files</span>
        </button>
      </div>
    );
  }

  return (
    <div className="resume-viewer" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="rv-toolbar">
        <div className="rv-toolbar-left">
          <h2 className="rv-title">{fileRef.current?.name || 'Resume'}</h2>
        </div>
        <div className="rv-toolbar-center">
          <button className="rv-btn" onClick={handlePageChange.bind(null, -1)} disabled={currentPage <= 1} title="Previous page">
            <ChevronLeft size={18} />
          </button>
          <span className="rv-page-info">
            Page {currentPage} of {numPages}
          </span>
          <button className="rv-btn" onClick={handlePageChange.bind(null, 1)} disabled={currentPage >= numPages} title="Next page">
            <ChevronRight size={18} />
          </button>
        </div>
        <div className="rv-toolbar-right">
          <div className="rv-zoom">
            <button className="rv-btn" onClick={() => handleScaleChange(scale - 0.1)} title="Zoom out">
              <Minus size={18} />
            </button>
            <span className="rv-zoom-level">{Math.round(scale * 100)}%</span>
            <button className="rv-btn" onClick={() => handleScaleChange(scale + 0.1)} title="Zoom in">
              <Plus size={18} />
            </button>
            <button className="rv-btn" onClick={() => handleScaleChange(1)} title="Reset zoom">
              <RotateCcw size={18} />
            </button>
          </div>
          <button className="rv-btn" onClick={handleDownload} title="Download">
            <Download size={18} />
          </button>
          <button className="rv-btn" onClick={handlePrint} title="Print">
            <Printer size={18} />
          </button>
        </div>
      </div>

      {/* PDF Canvas */}
      <div className="rv-canvas-container" ref={containerRef}>
        {pdfDoc && (
          <canvas
            ref={canvasRef}
            className="rv-canvas"
            style={{ transform: `scale(${1 / scale})`, transformOrigin: 'top center' }}
          />
        )}
      </div>
    </div>
  );
};