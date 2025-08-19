'use client';

import { useState, useRef, useEffect } from 'react';
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
  Settings,
  AlertCircle,
  Loader2
} from 'lucide-react';
import Hls from 'hls.js';
import { toast } from 'sonner';

interface VideoPlayerProps {
  rtspUrl: string;
  onPlay?: () => void;
  onPause?: () => void;
}

export default function VideoPlayer({ rtspUrl, onPlay, onPause }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [streamType, setStreamType] = useState<string>('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);
  const [controlsTimeout, setControlsTimeout] = useState<NodeJS.Timeout | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

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

    const handleError = (e: Event) => {
      console.log('Video error:', e);
      setIsPlaying(false);
      setError('Video playback error');
    };

    const handleLoadStart = () => {
      setIsLoading(true);
      setError(null);
    };

    const handleLoadedData = () => {
      setIsLoading(false);
      setError(null);
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);
    video.addEventListener('loadstart', handleLoadStart);
    video.addEventListener('loadeddata', handleLoadedData);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
      video.removeEventListener('loadstart', handleLoadStart);
      video.removeEventListener('loadeddata', handleLoadedData);
    };
  }, [onPlay, onPause]);

  // Handle HLS stream loading
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !rtspUrl) return;

    // Clean up previous HLS instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsLoading(true);
    setError(null);

    // Determine stream type and handle accordingly
    if (rtspUrl.includes('/api/stream/hls/') || rtspUrl.endsWith('.m3u8')) {
      // HLS stream
      setStreamType('HLS Stream');

      if (Hls.isSupported()) {
        const hls = new Hls({
          enableWorker: false,
          lowLatencyMode: true,
          backBufferLength: 90
        });

        hlsRef.current = hls;

        hls.loadSource(rtspUrl);
        hls.attachMedia(video);

        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('HLS manifest parsed');
          setIsLoading(false);
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('HLS error:', data);
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                setError('Network connection lost. Please check your internet connection.');
                toast.error('Network connection lost');
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                setError('Media playback error. The stream may be corrupted.');
                toast.error('Media playback error');
                try {
                  hls.recoverMediaError();
                } catch (err) {
                  console.error('Failed to recover from media error:', err);
                }
                break;
              default:
                setError(`Stream error: ${data.details || 'Unknown error'}`);
                toast.error('Stream playback failed');
                break;
            }
            setIsLoading(false);
          }
        });

      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        video.src = rtspUrl;
        setIsLoading(false);
      } else {
        setError('HLS not supported in this browser');
        setIsLoading(false);
      }

    } else if (rtspUrl.startsWith('rtsp://')) {
      // Direct RTSP (shouldn't happen with our backend, but handle gracefully)
      setStreamType('RTSP Stream');
      setError('RTSP streams need to be converted to HLS first');
      setIsLoading(false);

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
    };
  }, [rtspUrl]);

  const togglePlay = async () => {
    if (!videoRef.current) return;

    try {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        await videoRef.current.play();
      }
    } catch (error) {
      console.log('Video play/pause interrupted:', error);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseFloat(e.target.value);
    setVolume(newVolume);
    if (videoRef.current) {
      videoRef.current.volume = newVolume;
    }
  };

  return (
    <div className="relative w-full max-w-4xl mx-auto bg-black rounded-lg overflow-hidden">
      <div className="relative w-full aspect-video bg-gray-900 flex items-center justify-center">
        <video
          ref={videoRef}
          className="w-full h-full object-cover"
          onLoadedData={() => console.log('Video loaded')}
          crossOrigin="anonymous"
          controls={false}
          disablePictureInPicture
          controlsList="nodownload nofullscreen noremoteplayback"
        >
          Your browser does not support the video tag.
        </video>

        {/* Loading indicator */}
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
              <p>Loading stream...</p>
            </div>
          </div>
        )}

        {/* Error indicator */}
        {error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50">
            <div className="text-white text-center max-w-md p-4">
              <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
              <p className="text-red-400 font-semibold mb-2">Stream Error</p>
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Play button overlay */}
        {!isPlaying && !isLoading && !error && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-16 w-16 text-white/80" />
          </div>
        )}

        {/* Stream type indicator */}
        <div className="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-xs">
          {streamType || (
            rtspUrl.startsWith('rtsp://') ? '📡 RTSP Stream' :
            rtspUrl.includes('.m3u8') || rtspUrl.includes('/api/stream/hls/') ? '🎥 HLS Stream' :
            rtspUrl.includes('.mp4') ? '🎬 MP4 Video' : '📹 Video'
          )}
        </div>
      </div>
      
      <div className="absolute bottom-0 left-0 right-0 flex items-center gap-4 bg-gradient-to-t from-black/80 to-transparent p-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={togglePlay}
          className="text-white hover:bg-white/20"
        >
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        
        <div className="flex items-center gap-2 text-white">
          <Volume2 className="h-4 w-4" />
          <Slider
            value={[volume]}
            onValueChange={(value) => {
              const newVolume = value[0];
              setVolume(newVolume);
              if (videoRef.current) {
                videoRef.current.volume = newVolume;
              }
            }}
            max={1}
            min={0}
            step={0.1}
            className="w-20"
          />
        </div>
      </div>
    </div>
  );
}