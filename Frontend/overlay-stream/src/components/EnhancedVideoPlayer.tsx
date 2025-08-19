'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize,
  Minimize,
  RotateCcw,
  AlertCircle,
  Loader2,
  Radio,
  Clock,
  Settings
} from 'lucide-react';
import Hls from 'hls.js';
import { toast } from 'sonner';
import OverlayCanvas from './OverlayCanvas';
import OverlayManager from './OverlayManager';
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from './ui/drawer';
import { useIsMobile } from '@/hooks/use-mobile';
import type { Overlay } from '@/lib/types';

interface EnhancedVideoPlayerProps {
  rtspUrl: string;
  onPlay?: () => void;
  onPause?: () => void;
  className?: string;
  overlays?: Overlay[];
  onOverlayUpdate?: (id: string, updates: Partial<Overlay>) => void;
  onCreateOverlay?: (overlay: Omit<Overlay, '_id'>) => void;
  onDeleteOverlay?: (id: string) => void;
}

export default function EnhancedVideoPlayer({
  rtspUrl,
  onPlay,
  onPause,
  className = '',
  overlays = [],
  onOverlayUpdate,
  onCreateOverlay,
  onDeleteOverlay
}: EnhancedVideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showFullscreenOverlayManager, setShowFullscreenOverlayManager] = useState(false);
  const isMobile = useIsMobile();
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

  // Live stream specific states
  const [isLiveStream, setIsLiveStream] = useState(false);
  const [isLive, setIsLive] = useState(true); // Whether we're at the live edge
  const [liveEdgeTime, setLiveEdgeTime] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const [maxRetries] = useState(5);
  const [retryTimeout, setRetryTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isStreamReady, setIsStreamReady] = useState(false);
  const [canPlay, setCanPlay] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const lastErrorTime = useRef<number>(0);
  const lastErrorType = useRef<string>('');

  // Helper function to determine if an HLS error should be ignored
  const shouldIgnoreHLSError = (data: any): boolean => {
    // Ignore completely empty objects
    if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
      return true;
    }

    // Ignore errors without meaningful information
    if (!data.details && !data.type && data.fatal === undefined) {
      return true;
    }

    // Ignore common startup errors that don't affect playback
    const ignorableErrors = [
      'fragLoadError',
      'fragLoadTimeOut',
      'levelLoadError',
      'audioTrackLoadError',
      'fragParsingError',
      'remuxAllocError'
    ];

    // Always ignore non-fatal fragment loading errors during startup
    if (!data.fatal && (ignorableErrors.includes(data.details) ||
        (data.details && data.details.includes('frag')) ||
        (data.details && data.details.includes('Load')))) {
      return true;
    }

    // Ignore errors that are just empty objects or have no useful information
    if (!data.fatal && !data.details && !data.error && !data.reason) {
      return true;
    }

    return false;
  };

  // Control functions
  const togglePlay = async () => {
    const video = videoRef.current;
    if (!video) return;

    // Prevent play attempts if stream is not ready
    if (!canPlay && !isStreamReady && !isPlaying) {
      console.warn('Stream not ready for playback yet');
      toast.info('Stream is still loading, please wait...');
      return;
    }

    try {
      if (isPlaying) {
        await video.pause();
      } else {
        await video.play();
      }
    } catch (error) {
      console.error('Play/pause error:', error);
      toast.error('Failed to play/pause video');
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;

    const newMuted = !isMuted;
    video.muted = newMuted;
    setIsMuted(newMuted);
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (!video) return;

    const newVolume = value[0];
    video.volume = newVolume;
    setVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (!video || !duration) return;

    const newTime = (value[0] / 100) * duration;
    video.currentTime = newTime;
    setCurrentTime(newTime);

    // Check if we're seeking away from live edge
    if (isLiveStream) {
      const timeDiff = liveEdgeTime - newTime;
      setIsLive(timeDiff < 10); // Consider "live" if within 10 seconds of edge
    }
  };

  const goToLive = useCallback(() => {
    const video = videoRef.current;
    if (!video || !isLiveStream) return;

    // For live streams, seek to the end
    if (duration > 0) {
      video.currentTime = duration;
      setCurrentTime(duration);
      setIsLive(true);
    }
  }, [duration, isLiveStream]);

  const retryStream = useCallback(() => {
    if (retryCount >= maxRetries) {
      toast.error('Maximum retry attempts reached. Please check your connection.');
      return;
    }

    setRetryCount(prev => prev + 1);
    setError(null);
    setIsLoading(true);

    // Clear any existing retry timeout
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      setRetryTimeout(null);
    }

    // Retry after a delay
    const delay = Math.min(1000 * Math.pow(2, retryCount), 10000); // Exponential backoff, max 10s
    const timeout = setTimeout(() => {
      // Trigger re-initialization by updating a dependency
      const video = videoRef.current;
      if (video && hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
      // The useEffect will handle re-initialization
    }, delay);

    setRetryTimeout(timeout);
    toast.info(`Retrying connection... (${retryCount + 1}/${maxRetries})`);
  }, [retryCount, maxRetries, retryTimeout]);

  const toggleFullscreen = async () => {
    const container = containerRef.current;
    if (!container) return;

    try {
      if (!isFullscreen) {
        if (container.requestFullscreen) {
          await container.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (error) {
      console.error('Fullscreen error:', error);
      toast.error('Failed to toggle fullscreen');
    }
  };

  const resetStream = useCallback(() => {
    setError(null);
    setIsLoading(true);
    setRetryCount(0);

    // Clear retry timeout
    if (retryTimeout) {
      clearTimeout(retryTimeout);
      setRetryTimeout(null);
    }

    // Clean up existing HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    // Reset video element
    const video = videoRef.current;
    if (video) {
      video.src = '';
      video.load();
    }

    // Reset states
    setCurrentTime(0);
    setDuration(0);
    setIsPlaying(false);
    setIsLive(true);

    toast.info('Reconnecting to stream...');
  }, [retryTimeout]);

  const resetControls = () => {
    setShowControls(true);
    if (controlsTimeout) {
      clearTimeout(controlsTimeout);
    }
    const timeout = setTimeout(() => {
      if (isPlaying) {
        setShowControls(false);
      }
    }, 3000);
    setControlsTimeout(timeout);
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  // Event handlers
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const handlePlay = () => {
      setIsPlaying(true);
      onPlay?.();
    };

    const handlePause = () => {
      setIsPlaying(false);
      onPause?.();
    };

    const handleTimeUpdate = () => {
      const currentTime = video.currentTime;
      const duration = video.duration;

      setCurrentTime(currentTime);

      // Update live edge time and check if we're still live
      if (isLiveStream && duration > 0) {
        setLiveEdgeTime(duration);
        const timeDiff = duration - currentTime;
        setIsLive(timeDiff < 10); // Consider "live" if within 10 seconds of edge
      }
    };

    const handleDurationChange = () => {
      const duration = video.duration;
      setDuration(duration);

      // Detect if this is a live stream (infinite or very large duration)
      if (duration === Infinity || duration > 86400) { // More than 24 hours suggests live
        setIsLiveStream(true);
        setIsLive(true);
      }
    };

    const handleVolumeChange = () => {
      setVolume(video.volume);
      setIsMuted(video.muted);
    };

    const handleError = (e: Event) => {
      console.error('Video error:', e);
      setIsPlaying(false);

      const now = Date.now();
      const timeSinceLastError = now - lastErrorTime.current;

      // Avoid rapid error retries
      if (timeSinceLastError < 5000) {
        setError('Connection unstable. Please wait before retrying.');
        return;
      }

      lastErrorTime.current = now;
      setError('Connection lost. Attempting to reconnect...');

      // Auto-retry for network errors
      if (retryCount < maxRetries) {
        setTimeout(() => {
          retryStream();
        }, 2000);
      } else {
        toast.error('Stream connection failed. Please check your network.');
      }
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleLoadedData = () => {
      setIsLoading(false);
      toast.success('Video loaded successfully');
    };

    const handleEnded = () => {
      console.log('Video ended');
      setIsPlaying(false);
      setError('Stream has ended');
      toast.info('Stream has ended');
    };

    const handleCanPlay = () => {
      console.log('Video can start playing');
      setCanPlay(true);
      setIsLoading(false);
    };

    const handleCanPlayThrough = () => {
      console.log('Video can play through without buffering');
      setCanPlay(true);
      setIsStreamReady(true);
    };

    const handleFullscreenChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    video.addEventListener('volumechange', handleVolumeChange);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);
    video.addEventListener('ended', handleEnded);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('canplaythrough', handleCanPlayThrough);
    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
      video.removeEventListener('volumechange', handleVolumeChange);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
      video.removeEventListener('ended', handleEnded);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('canplaythrough', handleCanPlayThrough);
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, [onPlay, onPause]);

  // Handle stream loading
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !rtspUrl) return;

    console.log('Loading stream URL:', rtspUrl);

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setError(null);
    setIsStreamReady(false);
    setCanPlay(false);

    // Determine stream type and handle accordingly
    if (rtspUrl.includes('/api/stream/hls/') || rtspUrl.endsWith('.m3u8')) {
      // HLS stream
      setStreamType('HLS Stream');

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: false, // Disable low latency mode for better stability
          backBufferLength: 30, // Reduce back buffer for faster startup
          maxBufferLength: 30, // Limit forward buffer
          maxMaxBufferLength: 60, // Maximum buffer length
          maxBufferSize: 60 * 1000 * 1000, // 60MB buffer size
          maxBufferHole: 0.5, // Allow small buffer holes
          highBufferWatchdogPeriod: 2, // Check buffer health every 2 seconds
          nudgeOffset: 0.1, // Small nudge for playback issues
          nudgeMaxRetry: 3, // Retry nudging 3 times
          // maxSeekHole: 2, // Allow seeking over 2 second holes (removed, not in HlsConfig)
          maxFragLookUpTolerance: 0.25, // Fragment lookup tolerance
          liveSyncDurationCount: 3, // Keep 3 segments for live sync
          liveMaxLatencyDurationCount: 10, // Maximum latency segments
          liveDurationInfinity: false, // Don't treat as infinite duration
          enableSoftwareAES: true, // Enable software AES decryption
          manifestLoadingTimeOut: 10000, // 10 second manifest timeout
          manifestLoadingMaxRetry: 4, // Retry manifest loading 4 times
          manifestLoadingRetryDelay: 1000, // 1 second retry delay
          levelLoadingTimeOut: 10000, // 10 second level timeout
          levelLoadingMaxRetry: 4, // Retry level loading 4 times
          levelLoadingRetryDelay: 1000, // 1 second retry delay
          fragLoadingTimeOut: 20000, // 20 second fragment timeout
          fragLoadingMaxRetry: 6, // Retry fragment loading 6 times
          fragLoadingRetryDelay: 1000, // 1 second retry delay
          startFragPrefetch: true, // Prefetch start fragments
          testBandwidth: true // Test bandwidth for adaptive streaming
        });

        hlsRef.current = hls;

        hls.loadSource(rtspUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed');
          setIsLoading(false);
          setIsStreamReady(true);
        });

        // Add more event handlers for better stream management
        hls.on(Hls.Events.LEVEL_LOADED, () => {
          console.log('HLS level loaded');
        });

        hls.on(Hls.Events.FRAG_LOADED, () => {
          // Fragment loaded successfully - reset retry count
          if (retryCount > 0) {
            setRetryCount(0);
          }
          setCanPlay(true);
        });

        hls.on(Hls.Events.BUFFER_APPENDED, () => {
          // Buffer appended - stream is healthy
          setError(null);
        });

        hls.on(Hls.Events.BUFFER_EOS, () => {
          console.log('HLS buffer end of stream');
          setError('Stream has ended');
          toast.info('Stream has ended');
        });

        hls.on(Hls.Events.LEVEL_SWITCHING, (event, data) => {
          console.log('HLS level switching to:', data.level);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          try {
            // Check if this error should be ignored
            if (shouldIgnoreHLSError(data)) {
              // In development, log ignored errors as debug info
              if (process.env.NODE_ENV === 'development' && data && Object.keys(data).length > 0) {
                console.debug('HLS error ignored (non-fatal startup error):', data);
              }
              return;
            }

            // Check for stream end conditions
            if (data.details === 'levelLoadError' && data.response?.code === 404) {
              setError('Stream has ended or is no longer available');
              toast.info('Stream has ended');
              return;
            }

            // Debounce similar errors to prevent spam
            const errorKey = `${data.type}-${data.details}`;
            const now = Date.now();

            if (lastErrorType.current === errorKey && now - lastErrorTime.current < 5000) {
              // Same error type within 5 seconds, ignore
              return;
            }

            lastErrorType.current = errorKey;
            lastErrorTime.current = now;

            console.error('HLS error:', data);
          } catch (err) {
            console.warn('Error processing HLS error event:', err, 'Original data:', data);
            return;
          }

          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                if (data.details === 'levelLoadError' || data.details === 'audioTrackLoadError') {
                  setError('Stream segments not available');
                  if (retryCount < maxRetries) {
                    toast.info('Stream loading issue. Retrying...');
                    setTimeout(() => retryStream(), 2000);
                  } else {
                    toast.error('Stream unavailable. Please check if the stream is active.');
                  }
                } else {
                  setError('Network connection lost');
                  if (retryCount < maxRetries) {
                    toast.info('Network error detected. Retrying...');
                    setTimeout(() => retryStream(), 1000);
                  } else {
                    toast.error('Network connection failed. Please check your internet.');
                  }
                }
                break;

              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media playback error');
                if (retryCount < maxRetries) {
                  toast.info('Media error detected. Attempting recovery...');
                  try {
                    hls.recoverMediaError();
                  } catch (err) {
                    setTimeout(() => retryStream(), 1000);
                  }
                } else {
                  toast.error('Media playback failed. Stream may be corrupted.');
                }
                break;

              default:
                setError(`Stream error: ${data.details || 'Unknown error'}`);
                if (retryCount < maxRetries) {
                  setTimeout(() => retryStream(), 2000);
                } else {
                  toast.error('Stream playback failed. Please try again later.');
                }
                break;
            }
            setIsLoading(false);
          } else {
            // Handle non-fatal errors more intelligently
            if (data.details === 'bufferStalledError') {
              // Buffer stalling is common in live streams, don't spam warnings
              console.warn('HLS buffer stalled:', data);
              // Try to recover by seeking slightly forward
              const video = videoRef.current;
              if (video && !video.paused) {
                try {
                  const currentTime = video.currentTime;
                  video.currentTime = currentTime + 0.1;
                } catch (err) {
                  console.warn('Failed to recover from buffer stall:', err);
                }
              }
            } else if (data.details === 'levelLoadError' || data.details === 'audioTrackLoadError') {
              // These are often temporary network issues
              console.warn('HLS temporary load error:', data);
            } else if (data.details === 'fragLoadError') {
              // Fragment load errors - common when stream is starting
              console.warn('HLS fragment load error (stream may be starting):', data);
            } else if (data.details === 'fragLoadTimeOut') {
              // Fragment load timeout - common during stream startup
              console.warn('HLS fragment load timeout (stream starting):', data);
            } else {
              console.warn('HLS warning:', data);
            }
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = rtspUrl;
        setIsLoading(false);
      } else {
        setError('HLS not supported in this browser');
        setIsLoading(false);
        toast.error('HLS not supported in this browser');
      }

    } else if (rtspUrl.startsWith('rtsp://')) {
      // Direct RTSP (shouldn't happen with our backend, but handle gracefully)
      setStreamType('RTSP Stream');
      setError('RTSP streams need to be converted to HLS first');
      setIsLoading(false);
      toast.error('RTSP streams need to be converted to HLS first');

    } else {
      // Direct video file (MP4, WebM, etc.)
      setStreamType('Direct Video');
      video.src = rtspUrl;
      setIsLoading(false);
    }

    return () => {
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }

      // Clear any pending timeouts
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [rtspUrl]);

  // Mouse movement handler for controls
  const handleMouseMove = () => {
    resetControls();
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (controlsTimeout) {
        clearTimeout(controlsTimeout);
      }
      if (retryTimeout) {
        clearTimeout(retryTimeout);
      }
    };
  }, [controlsTimeout, retryTimeout]);

  if (error) {
    return (
      <div className={`relative bg-black rounded-lg overflow-hidden ${className}`}>
        <div className="aspect-video flex items-center justify-center bg-gradient-to-br from-red-900/20 to-red-800/20">
          <div className="text-center text-white p-6 max-w-md">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-400" />
            <h3 className="text-lg font-semibold mb-2">Connection Lost</h3>
            <p className="text-sm text-gray-300 mb-4">{error}</p>

            {retryCount < maxRetries ? (
              <div className="space-y-3">
                <div className="text-xs text-gray-400">
                  Retry attempt: {retryCount}/{maxRetries}
                </div>
                <div className="flex gap-2 justify-center">
                  <Button
                    onClick={retryStream}
                    variant="outline"
                    size="sm"
                    className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <RotateCcw className="h-4 w-4 mr-2" />
                    )}
                    {isLoading ? 'Retrying...' : 'Retry Now'}
                  </Button>
                  <Button
                    onClick={resetStream}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-white/10"
                  >
                    Reset
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="text-xs text-red-400">
                  Maximum retry attempts reached
                </div>
                <Button
                  onClick={resetStream}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                >
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Start Over
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className={`relative bg-black rounded-lg overflow-hidden group ${className} ${isFullscreen ? 'rounded-none' : ''}`}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => setShowControls(false)}
      onTouchStart={() => setShowControls(true)}
    >
      <video
        ref={videoRef}
        className="w-full aspect-video object-contain min-h-[200px]"
        playsInline
        onClick={togglePlay}
        controls={false}
        preload="metadata"
      />

      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
          <div className="text-center text-white">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-2" />
            <p className="text-sm">Loading {streamType}...</p>
          </div>
        </div>
      )}

      {/* Controls overlay */}
      <div 
        className={`absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent transition-opacity duration-300 ${
          showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {/* Top bar */}
        <div className="absolute top-0 left-0 right-0 p-4">
          <div className="flex items-center justify-between text-white">
            <div className="text-sm font-medium drop-shadow-lg bg-black/20 backdrop-blur-sm px-3 py-1 rounded-full border border-white/10">
              {streamType} {duration > 0 && `• ${formatTime(duration)}`}
            </div>
            <div className="flex items-center gap-2">
              {/* Fullscreen Overlay Manager - Only show in fullscreen */}
              {isFullscreen && onCreateOverlay && onDeleteOverlay && (
                isMobile ? (
                  // Mobile: Use Drawer in fullscreen
                  <Drawer
                    open={showFullscreenOverlayManager}
                    onOpenChange={setShowFullscreenOverlayManager}
                    shouldScaleBackground={false}
                  >
                    <DrawerTrigger asChild>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm shadow-lg border border-white/10"
                        title="Manage Overlays"
                      >
                        <Settings className="h-4 w-4 drop-shadow-md" />
                      </Button>
                    </DrawerTrigger>
                    <DrawerContent className="max-h-[90vh] z-[60]">
                      <DrawerHeader className="pb-2">
                        <DrawerTitle className="flex items-center gap-2 text-lg">
                          <Settings className="h-5 w-5 text-primary" />
                          Overlay Manager
                        </DrawerTitle>
                      </DrawerHeader>
                      <div className="px-4 pb-6 overflow-y-auto flex-1">
                        <OverlayManager
                          overlays={overlays}
                          onCreateOverlay={onCreateOverlay}
                          onDeleteOverlay={onDeleteOverlay}
                        />
                      </div>
                    </DrawerContent>
                  </Drawer>
                ) : (
                  // Desktop: Simple button (could expand to show inline manager)
                  <Button
                    onClick={() => setShowFullscreenOverlayManager(!showFullscreenOverlayManager)}
                    variant="ghost"
                    size="sm"
                    className="text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm shadow-lg border border-white/10"
                    title="Manage Overlays"
                  >
                    <Settings className="h-4 w-4 drop-shadow-md" />
                  </Button>
                )
              )}
              <Button
                onClick={toggleFullscreen}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm shadow-lg border border-white/10"
                title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              >
                {isFullscreen ? <Minimize className="h-4 w-4 drop-shadow-md" /> : <Maximize className="h-4 w-4 drop-shadow-md" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Bottom controls */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          {/* Progress bar */}
          {duration > 0 && !isLiveStream && (
            <div className="mb-4">
              <Slider
                value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                onValueChange={handleSeek}
                max={100}
                step={0.1}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-white/70 mt-1">
                <span>{formatTime(currentTime)}</span>
                <span>{formatTime(duration)}</span>
              </div>
            </div>
          )}

          {/* Live stream progress bar */}
          {isLiveStream && (
            <div className="mb-4">
              <div className="relative">
                <Slider
                  value={[duration > 0 ? (currentTime / duration) * 100 : 0]}
                  onValueChange={handleSeek}
                  max={100}
                  step={0.1}
                  className="w-full"
                />
                {/* Live indicator */}
                <div className="absolute right-0 top-0 transform -translate-y-8">
                  <div className={`flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors ${
                    isLive
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-600 text-gray-200 cursor-pointer hover:bg-gray-500'
                  }`}
                  onClick={!isLive ? goToLive : undefined}
                  >
                    <Radio className="h-3 w-3" />
                    {isLive ? 'LIVE' : 'GO LIVE'}
                  </div>
                </div>
              </div>
              <div className="flex justify-between text-xs text-white/70 mt-1">
                <span className="drop-shadow-md">
                  {isLive ? 'LIVE' : `-${formatTime(liveEdgeTime - currentTime)}`}
                </span>
                <span className="flex items-center gap-1 drop-shadow-md">
                  <Clock className="h-3 w-3" />
                  Live Stream
                </span>
              </div>
            </div>
          )}

          {/* Control buttons */}
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <Button
                onClick={togglePlay}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm shadow-lg border border-white/10"
                disabled={isLoading || (!canPlay && !isStreamReady && !isPlaying)}
                title={isPlaying ? "Pause" : "Play"}
              >
                {isLoading ? (
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-white border-t-transparent drop-shadow-md" />
                ) : isPlaying ? (
                  <Pause className="h-5 w-5 drop-shadow-md" />
                ) : (
                  <Play className="h-5 w-5 drop-shadow-md" />
                )}
              </Button>

              <Button
                onClick={toggleMute}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm shadow-lg border border-white/10"
                title={isMuted || volume === 0 ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX className="h-4 w-4 drop-shadow-md" /> : <Volume2 className="h-4 w-4 drop-shadow-md" />}
              </Button>

              <div className="w-20">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  step={0.01}
                  className="w-full"
                />
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Button
                onClick={resetStream}
                variant="ghost"
                size="sm"
                className="text-white hover:bg-black/30 bg-black/20 backdrop-blur-sm shadow-lg border border-white/10"
                title="Reload Stream"
              >
                <RotateCcw className="h-4 w-4 drop-shadow-md" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Desktop Fullscreen Overlay Manager */}
      {isFullscreen && !isMobile && showFullscreenOverlayManager && onCreateOverlay && onDeleteOverlay && (
        <div className="absolute top-16 right-4 w-80 max-h-[calc(100vh-8rem)] bg-card/95 backdrop-blur-md rounded-lg border shadow-2xl z-50 overflow-hidden animate-in slide-in-from-right-2 fade-in-0 duration-200">
          <div className="p-4 border-b bg-card/50">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold flex items-center gap-2">
                <Settings className="h-4 w-4 text-primary" />
                Overlay Manager
              </h3>
              <Button
                onClick={() => setShowFullscreenOverlayManager(false)}
                variant="ghost"
                size="sm"
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            </div>
          </div>
          <div className="p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
            <OverlayManager
              overlays={overlays}
              onCreateOverlay={onCreateOverlay}
              onDeleteOverlay={onDeleteOverlay}
            />
          </div>
        </div>
      )}

      {/* Overlay Canvas - positioned inside the video container so it works in fullscreen */}
      {overlays.length > 0 && onOverlayUpdate && (
        <OverlayCanvas
          overlays={overlays}
          onOverlayUpdate={onOverlayUpdate}
        />
      )}
    </div>
  );
}
