import React, { useEffect, useState, useCallback, useRef } from 'react';
import { vfs } from '../../lib/vfs';
import { isFileNode } from '../../lib/vfs/nodes';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  Loader2,
  AlertCircle,
  FileText,
} from 'lucide-react';
import { useWindowStore } from '../../stores/useWindowStore';
import './VideoPlayer.css';

interface VideoPlayerProps {
  windowId: string;
  filePath?: string;
  onOpenRequest?: (request: any) => void;
}

export function VideoPlayer({ windowId, filePath: propFilePath }: VideoPlayerProps) {
  const { getWindow } = useWindowStore();
  const mimiWindow = getWindow(windowId);
  const windowFilePath = mimiWindow?.appParams?.path as string | undefined;

  const filePathToLoad = propFilePath || windowFilePath;

  const [videoSrc, setVideoSrc] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filePath, setFilePath] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const durationRef = useRef(0);

  // Load video
  useEffect(() => {
    if (filePathToLoad) {
      loadVideo(filePathToLoad);
    } else {
      setError('No file specified');
      setLoading(false);
    }
  }, [filePathToLoad]);

  const loadVideo = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setFilePath(path);
    setFileName(path.split('/').pop() || path);
    setVideoSrc(null);
    durationRef.current = 0;
    setDuration(0);
    setCurrentTime(0);
    setPlaying(false);

    try {
      const result = vfs.stat(path);
      if (!result.success) {
        setError(result.error || 'No such file or directory');
        setLoading(false);
        return;
      }

      const statData = result.data!;
      if (statData.type === 'directory') {
        setError('Cannot open directory as video');
        setLoading(false);
        return;
      }

      // Use stat data instead of private getNodeByPath
      const isBinary = statData.isBinary;
      const assetPath = statData.assetPath;
      const storageKey = statData.storageKey;

      if (isBinary) {
        // Built-in static asset - use assetPath directly
        if (assetPath) {
          setVideoSrc(assetPath);
        } else if (storageKey) {
          // Visitor upload - use readBinaryFile from IndexedDB
          const binaryResult = await vfs.readBinaryFile(path);
          if (!binaryResult.success || !binaryResult.data) {
            setError(binaryResult.error || 'Failed to read binary file');
            setLoading(false);
            return;
          }
          const blobUrl = URL.createObjectURL(binaryResult.data);
          setVideoSrc(blobUrl);
        } else {
          setError('Binary file missing assetPath and storageKey');
          setLoading(false);
          return;
        }
      } else {
        setError('Video files must be binary files');
        setLoading(false);
        return;
      }
    } catch (err) {
      setError('Failed to load video');
    } finally {
      setLoading(false);
    }
  }, []);

  const handleVideoLoad = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration && isFinite(video.duration) && video.duration > 0) {
      durationRef.current = video.duration;
      setDuration(video.duration);
    }
  }, []);

  const handleDurationChange = useCallback(() => {
    const video = videoRef.current;
    if (video && video.duration && isFinite(video.duration) && video.duration > 0) {
      durationRef.current = video.duration;
      setDuration(video.duration);
    }
  }, []);

  const handleVideoError = useCallback((e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    setError(`Unable to play this video in your browser. (Error code: ${video.error?.code || 'unknown'})`);
    setLoading(false);
  }, []);

  const handleTimeUpdate = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      setCurrentTime(video.currentTime);
    }
  }, []);

  const handlePlayPause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
    } else {
      video.play().catch(() => {
        setPlaying(false);
      });
    }
    setPlaying(!playing);
  }, [playing]);

  const handleSeek = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const time = parseFloat(e.target.value);
    if (isFinite(time) && time >= 0 && time <= durationRef.current) {
      video.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const handleVolumeChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const vol = parseFloat(e.target.value);
    video.volume = vol;
    setVolume(vol);
    setMuted(vol === 0);
  }, []);

  const handleMuteToggle = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !muted;
    setMuted(!muted);
  }, [muted]);

  const handleEnded = useCallback(() => {
    setPlaying(false);
    setCurrentTime(durationRef.current);
  }, []);

  const handleFullscreen = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;
    const container = video.parentElement;
    if (!container) return;

    if (!fullscreen) {
      if (container.requestFullscreen) {
        container.requestFullscreen();
      }
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
      }
    }
    setFullscreen(!fullscreen);
  }, [fullscreen]);

  // Handle fullscreen change
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    return () => document.removeEventListener('fullscreenchange', handleFullscreenChange);
  }, []);

  // Cleanup blob URL on unmount
  useEffect(() => {
    return () => {
      if (videoSrc && videoSrc.startsWith('blob:')) {
        URL.revokeObjectURL(videoSrc);
      }
    };
  }, [videoSrc]);

  const formatTime = (time: number) => {
    if (isNaN(time) || !isFinite(time) || time <= 0) return '0:00';
    const mins = Math.floor(time / 60);
    const secs = Math.floor(time % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="video-player loading">
        <Loader2 className="spinning" size={24} />
        <span>Loading video...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="video-player error">
        <AlertCircle size={24} />
        <div className="error-message">{error}</div>
        <div className="error-path">{filePath}</div>
      </div>
    );
  }

  return (
    <div className="video-player">
      <div className="video-player-header">
        <div className="video-player-file-info">
          <FileText size={18} className="video-player-icon" />
          <div className="video-player-file-details">
            <div className="video-player-file-name">{fileName}</div>
            <div className="video-player-file-path">{filePath}</div>
          </div>
        </div>
      </div>

      <div className="video-player-content">
        {videoSrc && (
          <div className="video-container">
            <video
              ref={videoRef}
              src={videoSrc}
              onLoad={handleVideoLoad}
              onDurationChange={handleDurationChange}
              onError={handleVideoError}
              onTimeUpdate={handleTimeUpdate}
              onPlay={() => setPlaying(true)}
              onPause={() => setPlaying(false)}
              onEnded={handleEnded}
              playsInline
            />
          </div>
        )}
      </div>

      <div className="video-player-controls">
        <div className="video-progress">
          <input
            type="range"
            min="0"
            max={durationRef.current > 0 && isFinite(durationRef.current) ? durationRef.current : 100}
            value={isFinite(currentTime) && currentTime >= 0 ? currentTime : 0}
            onChange={handleSeek}
            className="seek-bar"
            aria-label="Seek"
          />
          <div className="time-display">
            <span>{formatTime(isFinite(currentTime) && currentTime >= 0 ? currentTime : 0)}</span>
            <span>/</span>
            <span>{formatTime(isFinite(durationRef.current) && durationRef.current > 0 ? durationRef.current : 0)}</span>
          </div>
        </div>

        <div className="video-controls-row">
          <button
            className="vp-btn"
            onClick={handlePlayPause}
            aria-label={playing ? 'Pause' : 'Play'}
          >
            {playing ? <Pause size={20} /> : <Play size={20} />}
          </button>

          <button
            className="vp-btn"
            onClick={handleMuteToggle}
            aria-label={muted ? 'Unmute' : 'Mute'}
          >
            {muted || volume === 0 ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>

          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={muted ? 0 : volume}
            onChange={handleVolumeChange}
            className="volume-slider"
            aria-label="Volume"
          />

          <button
            className="vp-btn"
            onClick={handleFullscreen}
            aria-label={fullscreen ? 'Exit fullscreen' : 'Fullscreen'}
          >
            <Maximize2 size={20} />
          </button>
        </div>
      </div>
    </div>
  );
}

const formatTime = (time: number) => {
  if (isNaN(time) || !isFinite(time) || time <= 0) return '0:00';
  const mins = Math.floor(time / 60);
  const secs = Math.floor(time % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};