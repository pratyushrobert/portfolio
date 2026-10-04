import React, { useEffect, useState, useCallback, useRef } from 'react';
import { vfs } from '../../lib/vfs';
import { isFileNode } from '../../lib/vfs/nodes';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  RotateCw,
  Maximize2,
  Minimize2,
  Loader2,
  AlertCircle,
  Image,
  FileText,
} from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import './ImageViewer.css';

interface ImageViewerProps {
  windowId: string;
  filePath?: string;
  onOpenRequest?: (request: any) => void;
}

export function ImageViewer({ windowId, filePath: propFilePath, onOpenRequest }: ImageViewerProps) {
  const { getWindow } = useWindowStore();
  const mimiWindow = getWindow(windowId);
  const windowFilePath = mimiWindow?.appParams?.path as string | undefined;

  const filePathToLoad = propFilePath || windowFilePath;

  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [zoom, setZoom] = useState<number | 'fit'>('fit');
  const [rotation, setRotation] = useState(0);
  const [naturalDimensions, setNaturalDimensions] = useState({ width: 0, height: 0 });
  const [imageLoaded, setImageLoaded] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const imgRef = useRef<HTMLImageElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Update container size on resize
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Load image
  useEffect(() => {
    if (filePathToLoad) {
      loadImage(filePathToLoad);
    } else {
      setError('No file specified');
      setLoading(false);
    }
  }, [filePathToLoad]);

  const loadImage = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setFilePath(path);
    setFileName(path.split('/').pop() || path);
    setImageSrc(null);
    setImageLoaded(false);
    setZoom('fit');

    try {
      const result = vfs.stat(path);
      if (!result.success) {
        setError(result.error || 'No such file or directory');
        setLoading(false);
        return;
      }

      const statData = result.data!;
      if (statData.type === 'directory') {
        setError('Cannot open directory as image');
        setLoading(false);
        return;
      }

      // Use stat data instead of private getNodeByPath
      const mimeType = statData.mimeType || getMimeTypeFromExtension(path);
      const isBinary = statData.isBinary;
      const assetPath = statData.assetPath;
      const storageKey = statData.storageKey;
      let blobUrl: string;

      if (isBinary) {
        // Built-in static asset - use assetPath directly
        if (assetPath) {
          blobUrl = assetPath;
        } else if (storageKey) {
          // Visitor upload - use readBinaryFile from IndexedDB
          const binaryResult = await vfs.readBinaryFile(path);
          if (!binaryResult.success || !binaryResult.data) {
            setError(binaryResult.error || 'Failed to read binary file');
            setLoading(false);
            return;
          }
          blobUrl = URL.createObjectURL(binaryResult.data);
        } else {
          setError('Binary file missing assetPath and storageKey');
          setLoading(false);
          return;
        }
      } else {
        // Text file - use readFile
        const readResult = vfs.readFile(path);
        if (!readResult.success) {
          setError(readResult.error || 'Failed to read file');
          setLoading(false);
          return;
        }
        const imageData = readResult.data!;
        // Text data - might be base64 or data URL
        if (imageData.startsWith('data:')) {
          blobUrl = imageData;
        } else {
          // Assume base64
          blobUrl = `data:${mimeType};base64,${imageData}`;
        }
      }

      setImageSrc(blobUrl);
    } catch (err) {
      setError('Failed to load image');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleImageLoad = useCallback((e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    setNaturalDimensions({ width: img.naturalWidth, height: img.naturalHeight });
    setImageLoaded(true);
    // Set initial zoom to fit
    setZoom('fit');
  }, []);

  const handleImageError = useCallback(() => {
    setError('Failed to load image data. The file may be corrupted or not a valid image format.');
    setLoading(false);
  }, []);

  const handleZoomIn = useCallback(() => setZoom(z => {
    if (z === 'fit') return 1;
    return Math.min(z * 1.2, 5);
  }), []);

  const handleZoomOut = useCallback(() => setZoom(z => {
    if (z === 'fit') return 1;
    return Math.max(z / 1.2, 0.1);
  }), []);

  const handleResetZoom = useCallback(() => setZoom(1), []);

  const handleFitToWindow = useCallback(() => {
    setZoom('fit');
  }, []);

  const handleRotateLeft = useCallback(() => setRotation(r => (r - 90 + 360) % 360), []);
  const handleRotateRight = useCallback(() => setRotation(r => (r + 90) % 360), []);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case '=':
      case '+':
        e.preventDefault();
        handleZoomIn();
        break;
      case '-':
        e.preventDefault();
        handleZoomOut();
        break;
      case '0':
        e.preventDefault();
        handleResetZoom();
        break;
      case 'r':
      case 'R':
        e.preventDefault();
        handleRotateRight();
        break;
    }
  }, [handleZoomIn, handleZoomOut, handleResetZoom, handleRotateRight]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (imageSrc && imageSrc.startsWith('blob:')) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [imageSrc]);

  const computeFitZoom = useCallback((): number => {
    if (!containerRef.current || naturalDimensions.width === 0) return 1;
    const containerRect = containerRef.current.getBoundingClientRect();
    const scaleX = (containerRect.width - 40) / naturalDimensions.width;
    const scaleY = (containerRect.height - 40) / naturalDimensions.height;
    return Math.min(scaleX, scaleY, 1);
  }, [naturalDimensions.width, naturalDimensions.height]);

  // Auto-fit when image loads or container resizes
  useEffect(() => {
    if (zoom === 'fit' && naturalDimensions.width > 0) {
      setZoom(computeFitZoom());
    }
  }, [containerSize, naturalDimensions, zoom, computeFitZoom]);

  // Helper to compute displayed dimensions
  const getDisplayedDimensions = () => {
    const effectiveZoom = zoom === 'fit' ? computeFitZoom() : (typeof zoom === 'number' ? zoom : 1);
    return {
      width: naturalDimensions.width * effectiveZoom,
      height: naturalDimensions.height * effectiveZoom,
    };
  };

  const displayedDimensions = getDisplayedDimensions();

  if (loading) {
    return (
      <div className="image-viewer loading">
        <Loader2 className="spinning" size={24} />
        <span>Loading image...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="image-viewer error">
        <AlertCircle size={24} />
        <div className="error-message">{error}</div>
        <div className="error-path">{filePath}</div>
      </div>
    );
  }

  const effectiveZoom = zoom === 'fit' ? computeFitZoom() : (typeof zoom === 'number' ? zoom : 1);
  const displayedWidth = naturalDimensions.width * effectiveZoom;
  const displayedHeight = naturalDimensions.height * effectiveZoom;

  return (
    <div className="image-viewer" onKeyDown={handleKeyDown} tabIndex={0} ref={containerRef}>
      <div className="image-viewer-header">
        <div className="image-viewer-file-info">
          <Image size={18} className="image-viewer-icon" />
          <div className="image-viewer-file-details">
            <div className="image-viewer-file-name">{fileName}</div>
            <div className="image-viewer-file-path">{filePath}</div>
          </div>
        </div>
        <div className="image-viewer-dimensions">
          {imageLoaded && (
            <>
              <span>{naturalDimensions.width} × {naturalDimensions.height}</span>
              <span className="zoom-level">{Math.round(effectiveZoom * 100)}%</span>
            </>
          )}
        </div>
      </div>

      <div className="image-viewer-toolbar">
        <div className="toolbar-group">
          <button className="iv-btn" onClick={handleZoomOut} title="Zoom Out" disabled={!imageLoaded}><ZoomOut size={16} /></button>
          <button className="iv-btn" onClick={handleResetZoom} title="Reset Zoom (0)" disabled={!imageLoaded}><Minimize2 size={16} /></button>
          <button className="iv-btn" onClick={handleZoomIn} title="Zoom In (+)" disabled={!imageLoaded}><ZoomIn size={16} /></button>
          <button className="iv-btn" onClick={handleFitToWindow} title="Fit to Window" disabled={!imageLoaded}><Maximize2 size={16} /></button>
        </div>
        <div className="toolbar-group">
          <button className="iv-btn" onClick={handleRotateLeft} title="Rotate Left" disabled={!imageLoaded}><RotateCcw size={16} /></button>
          <button className="iv-btn" onClick={handleRotateRight} title="Rotate Right (R)" disabled={!imageLoaded}><RotateCw size={16} /></button>
        </div>
        <div className="toolbar-hint">
          <kbd>+</kbd> zoom in | <kbd>-</kbd> zoom out | <kbd>0</kbd> reset | <kbd>R</kbd> rotate
        </div>
      </div>

      <div className="image-viewer-content" ref={containerRef}>
        {imageSrc && (
          <div className="image-container" style={{
            transform: `rotate(${rotation}deg) scale(${effectiveZoom})`,
            transformOrigin: 'center center',
            width: displayedWidth,
            height: displayedHeight,
          }}>
            <img
              ref={imgRef}
              src={imageSrc}
              alt={fileName}
              onLoad={handleImageLoad}
              onError={handleImageError}
              style={{
                maxWidth: 'none',
                maxHeight: 'none',
              }}
            />
          </div>
        )}
        {!imageLoaded && !error && !loading && (
          <div className="image-viewer-placeholder">
            <FileText size={48} />
            <span>No image data available</span>
          </div>
        )}
      </div>
    </div>
  );
}

function getMimeTypeFromExtension(path: string): string {
  const ext = path.split('.').pop()?.toLowerCase() || '';
  switch (ext) {
    case 'jpg':
    case 'jpeg':
      return 'image/jpeg';
    case 'png':
      return 'image/png';
    case 'gif':
      return 'image/gif';
    case 'webp':
      return 'image/webp';
    case 'svg':
      return 'image/svg+xml';
    default:
      return 'application/octet-stream';
  }
}