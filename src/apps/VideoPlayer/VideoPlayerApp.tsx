import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Play, Pause, Volume2, VolumeX, Maximize2, Minimize2, SkipBack, SkipForward, Download, FileText } from 'lucide-react';
import { vfs } from '../../../lib/vfs';
import type { AnyVFSNode } from '../../../types/vfs';
import { useWindowStore } from '../../../hooks/useWindows';
import './VideoPlayerApp.css';

interface VideoPlayerAppProps {
  instance: any;
}

export const VideoPlayerApp: React.FC<VideoPlayerAppProps> = ({ instance }) => {
  const { openWindow } = useWindowStore();
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const fileRef = useRef<AnyVFSNode | null>(null);

  useEffect(() => {
    if (instance.props?.file) {
      fileRef.current = instance.props.file;
      loadVideo(instance.props.file);
    } else {
      setError('No video file specified');
      setLoading(false);
    }
  }, [instance.props]);

  const loadVideo = (file: AnyVFSNode) => {
    setLoading(true);
    setError(null);

    try {
      let src: string;

      if (file.isBinary) {
        src = `data:${file.mimeType};base64,${file.content}`;
      } else {
        src = `data:${file.mimeType};base64,${btoa(file.content)}`;
      }

      setVideoSrc(src);
      setLoading(false);
    } catch (err) {
      setError('Error loading video: ' + (err as Error).message);
      setLoading(false);
    }
  };

  const handleVideoLoad = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrentTime(videoRef.current.currentTime);
    }
  };

  const handleEnded = () => {
    setPlaying(false);
    if (videoRef.current) {
      videoRef.current.currentTime = 0;
    }
  };

  const togglePlay = () => {
    if (videoRef.current) {
      if (playing) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setPlaying(!playing);
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    setMuted(vol === 0);
    if (videoRef.current) {
      videoRef.current.volume = vol;
      videoRef.current.muted = vol === 0;
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      videoRef.current.muted = !muted;
      setMuted(!muted);
    }
  };

  const handleFullscreen = () => {
    setFullscreen(!fullscreen);
    if (containerRef.current) {
      if (!fullscreen) {
        containerRef.current.requestFullscreen?.();
      } else {
        document.exitFullscreen?.();
      }
    }
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

  const formatTime = (time: number) => {
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeout) clearTimeout(controlsTimeout);
    setControlsTimeout(setTimeout(() => setShowControls(false), 3000));
  };

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!videoRef.current) return;
      switch (e.key) {
        case ' ':
        case 'k':
          e.preventDefault();
          togglePlay();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10);
          break;
        case 'ArrowRight':
          e.preventDefault();
          videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setVolume(Math.min(1, volume + 0.1));
          break;
        case 'ArrowDown':
          e.preventDefault();
          setVolume(Math.max(0, volume - 0.1));
          break;
        case 'm':
          toggleMute();
          break;
        case 'f':
          handleFullscreen();
          break;
        case '0':
          videoRef.current.currentTime = 0;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [playing, volume, duration, togglePlay, toggleMute, handleFullscreen]);

  // Fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  if (loading) {
    return (
      <div className="video-player loading">
        <div className="vp-spinner" />
        <p>Loading video...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-player error">
        <FileText className="lucide-icon" size={48} />
        <p>{error}</p>
        <button className="vp-btn" onClick={() => openWindow('file-manager')}>
          <FileText size={16} />
          <span>Browse Files</span>
        </button>
      </div>
    );
  }

  return (
    <div className="video-player" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Toolbar */}
      <div className="vp-toolbar">
        <div className="vp-toolbar-left">
          <h2 className="vp-title">{fileRef.current?.name || 'Video'}</h2>
        </div>
        <div className="vp-toolbar-right">
          <button className="vp-btn" onClick={handleDownload} title="Download">
            <Download size={18} />
          </button>
          <button className="vp-btn" onClick={handleFullscreen} title={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}>
            {fullscreen ? <Minimize2 size={18} /> : <Maximize2 size={18} />}
          </button>
        </div>
      </div>

      {/* Video Container */}
      <div
        ref={containerRef}
        className={`vp-container ${fullscreen ? 'fullscreen' : ''}`}
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setShowControls(false)}
      >
        <video
          ref={videoRef}
          src={videoSrc}
          className="vp-video"
          onLoad={handleVideoLoad}
          onTimeUpdate={handleTimeUpdate}
          onEnded={handleEnded}
          onClick={togglePlay}
          onDoubleClick={handleFullscreen}
          playsInline
        />

        {/* Loading Overlay */}
        {loading && (
          <div className="vp-loading">
            <div className="vp-spinner" />
          </div>
        )}

        {/* Play/Pause Overlay */}
        {!loading && (
          <button
            className={`vp-overlay-play ${playing ? 'hidden' : ''}`}
            onClick={togglePlay}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={64} /> : <Play size={64} />}
          </button>
        )}

        {/* Controls */}
        <div className={`vp-controls ${showControls || playing ? 'visible' : ''}`}>
          <div className="vp-progress" onClick={(e) => {
            if (videoRef.current) {
              const rect = e.currentTarget.getBoundingClientRect();
              const percent = (e.clientX - rect.left) / rect.width;
              videoRef.current.currentTime = percent * duration;
            }
          }}>
            <div
              className="vp-progress-bar"
              style={{ width: `${duration > 0 ? (currentTime / duration) * 100 : 0}%` }}
            />
            <div className="vp-progress-handle" />
          </div>

          <div className="vp-controls-bottom">
            <div className="vp-controls-left">
              <button className="vp-btn" onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - 10); }} title="Rewind 10s">
                <SkipBack size={20} />
              </button>
              <button className="vp-btn" onClick={togglePlay} title={playing ? 'Pause' : 'Play'}>
                {playing ? <Pause size={20} /> : <Play size={20} />}
              </button>
              <button className="vp-btn" onClick={() => { if (videoRef.current) videoRef.current.currentTime = Math.min(duration, videoRef.current.currentTime + 10); }} title="Forward 10s">
                <SkipForward size={20} />
              </button>
              <div className="vp-time">
                <span>{formatTime(currentTime)}</span>
                <span>/</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>

            <div className="vp-controls-right">
              <button className="vp-btn" onClick={toggleMute} title={muted ? 'Unmute' : 'Mute'}>
                {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
              </button>
              <input
                type="range"
                className="vp-volume-slider"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};