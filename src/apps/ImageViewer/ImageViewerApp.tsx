import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Download, RotateCcw, RotateCw, Minus, Plus, Maximize2, Minimize2, Image, FileText } from 'lucide-react';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';
import { useWindowStore } from '../../../hooks/useWindows';
import './ImageViewerApp.css';

interface ImageViewerAppProps {
  instance: any;
}

export const ImageViewerApp: React.FC<ImageViewerAppProps> = ({ instance }) => {
  const { openWindow } = useWindowStore();
  const [imageSrc, setImageSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [naturalSize, setNaturalSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<AnyVFSNode | null>(null);

  useEffect(() => {
    if (instance.props?.file) {
      fileRef.current = instance.props.file;
      loadImage(instance.props.file);
    } else {
      setError('No image file specified');
      setLoading(false);
    }
  }, [instance.props]);

  const loadImage = (file: AnyVFSNode) => {
    setLoading(true);
    setError(null);
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });

    try {
      let src: string;

      if (file.isBinary) {
        src = `data:${file.mimeType};base64,${file.content}`;
      } else {
        // Text file - try to create data URL
        src = `data:${file.mimeType};base64,${btoa(file.content)}`;
      }

      const img = new Image();
      img.onload = () => {
        setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
        setImageSrc(src);
        setLoading(false);
        // Auto-fit after load
        setTimeout(() => fitToContainer(), 0);
      };
      img.onerror = () => {
        setError('Failed to load image');
        setLoading(false);
      };
      img.src = src;
    } catch (err) {
      setError('Error loading image: ' + (err as Error).message);
      setLoading(false);
    }
  };

  const fitToContainer = useCallback(() => {
    if (!imgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const img = imgRef.current;
    const containerRect = container.getBoundingClientRect();
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const containerAspect = containerRect.width / containerRect.height;

    let newScale: number;
    if (imgAspect > containerAspect) {
      newScale = (containerRect.width * 0.95) / img.naturalWidth;
    } else {
      newScale = (containerRect.height * 0.95) / img.naturalHeight;
    }

    setScale(Math.min(newScale, 1));
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleZoom = (delta: number) => {
    const newScale = Math.max(0.1, Math.min(5, scale + delta));
    setScale(newScale);
  };

  const handleRotate = (degrees: number) => {
    setRotation((prev) => (prev + degrees) % 360);
  };

  const handleReset = () => {
    setScale(1);
    setRotation(0);
    setPosition({ x: 0, y: 0 });
    fitToContainer();
  };

  const handleDownload = () => {
    if (!fileRef.current) return;

    if (fileRef.current.isBinary) {
      const binaryString = atob(fileRef.current.content);
      const bytes = new Uint8Array(binaryString.length);
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: fileRef.current.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileRef.current.name;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    e.preventDefault();
  };

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y,
    });
  }, [isDragging, dragStart]);

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove]);

  // Wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    if (e.ctrlKey) {
      handleZoom(e.deltaY > 0 ? -0.1 : 0.1);
    }
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!imgRef.current) return;
      switch (e.key) {
        case '+':
        case '=':
          e.preventDefault();
          handleZoom(0.1);
          break;
        case '-':
          e.preventDefault();
          handleZoom(-0.1);
          break;
        case '0':
          e.preventDefault();
          handleReset();
          break;
        case 'r':
          e.preventDefault();
          handleRotate(90);
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'ArrowUp':
        case 'ArrowDown':
          if (scale > 1) {
            e.preventDefault();
            const step = 20;
            setPosition((prev) => ({
              x: prev.x + (e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0),
              y: prev.y + (e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0),
            }));
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [scale, handleZoom, handleReset, handleRotate]);

  if (loading) {
    return (
      <div className="image-viewer loading">
        <div className="iv-spinner" />
        <p>Loading image...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="image-viewer error">
        <Image className="lucide-icon" size={48} />
        <p>{error}</p>
        <button className="iv-btn" onClick={() => openWindow('file-manager')}>
          <FileText size={16} />
          <span>Browse Files</span>
        </button>
      </div>
    );
  }

  const transform = `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`;

  return (
    <div className="image-viewer" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="iv-toolbar">
        <div className="iv-toolbar-left">
          <h2 className="iv-title">{fileRef.current?.name || 'Image'}</h2>
          {naturalSize.width > 0 && (
            <span className="iv-dimensions">
              {naturalSize.width} × {naturalSize.height}
            </span>
          )}
        </div>
        <div className="iv-toolbar-center">
          <button className="iv-btn" onClick={() => handleRotate(-90)} title="Rotate left">
            <RotateCcw size={18} />
          </button>
          <button className="iv-btn" onClick={() => handleRotate(90)} title="Rotate right">
            <RotateCw size={18} />
          </button>
          <div className="iv-zoom">
            <button className="iv-btn" onClick={() => handleZoom(-0.1)} title="Zoom out">
              <Minus size={18} />
            </button>
            <span className="iv-zoom-level">{Math.round(scale * 100)}%</span>
            <button className="iv-btn" onClick={() => handleZoom(0.1)} title="Zoom in">
              <Plus size={18} />
            </button>
            <button className="iv-btn" onClick={handleReset} title="Reset view">
              <Minimize2 size={18} />
            </button>
            <button className="iv-btn" onClick={fitToContainer} title="Fit to window">
              <Maximize2 size={18} />
            </button>
          </div>
        </div>
        <div className="iv-toolbar-right">
          <button className="iv-btn" onClick={handleDownload} title="Download">
            <Download size={18} />
          </button>
        </div>
      </div>

      {/* Image Container */}
      <div
        ref={containerRef}
        className="iv-container"
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        style={{ cursor: scale > 1 ? 'grab' : isDragging ? 'grabbing' : 'default' }}
      >
        {imageSrc && (
          <img
            ref={imgRef}
            src={imageSrc}
            alt={fileRef.current?.name || 'Image'}
            className="iv-image"
            style={{ transform, transformOrigin: 'center center' }}
            draggable={false}
          />
        )}
      </div>
    </div>
  );
};