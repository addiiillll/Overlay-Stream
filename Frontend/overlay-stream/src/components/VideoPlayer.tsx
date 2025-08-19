'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import { Button } from './ui/button';
import { Slider } from './ui/slider';
import { Play, Pause, Volume2 } from 'lucide-react';

interface VideoPlayerProps {
  rtspUrl: string;
  onPlay?: () => void;
  onPause?: () => void;
}

export default function VideoPlayer({ rtspUrl, onPlay, onPause }: VideoPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(1);
  const videoRef = useRef<HTMLVideoElement>(null);

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
    };

    video.addEventListener('play', handlePlay);
    video.addEventListener('pause', handlePause);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('play', handlePlay);
      video.removeEventListener('pause', handlePause);
      video.removeEventListener('error', handleError);
    };
  }, [onPlay, onPause]);

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
          {rtspUrl.includes('.m3u8') ? (
            <source src={rtspUrl} type="application/x-mpegURL" />
          ) : (
            <source src={rtspUrl} type="video/mp4" />
          )}
          Your browser does not support the video tag.
        </video>
        {!isPlaying && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/20">
            <Play className="h-16 w-16 text-white/80" />
          </div>
        )}
        
        {/* Stream type indicator */}
        <div className="absolute top-4 left-4 bg-black/70 text-white px-2 py-1 rounded text-xs">
          {rtspUrl.startsWith('rtsp://') ? '📡 RTSP Stream' : 
           rtspUrl.includes('.m3u8') ? '🎥 HLS Stream' : 
           rtspUrl.includes('.mp4') ? '🎬 MP4 Video' : '📹 Video'}
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