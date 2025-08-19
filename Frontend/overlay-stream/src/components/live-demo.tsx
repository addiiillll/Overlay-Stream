"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import VideoPlayer from "@/components/VideoPlayer"
import OverlayManager from "@/components/OverlayManager"
import OverlayCanvas from "@/components/OverlayCanvas"
import { api } from "@/lib/api"
import type { Overlay } from "@/lib/types"
import { Play, Settings } from "lucide-react"

export default function LiveDemo() {
  const [rtspUrl, setRtspUrl] = useState('rtsp://wowzaec2demo.streamlock.net/vod-multitrack/_definst_/ElephantsDream/elephantsdream2.mp4')
  const [streamUrl, setStreamUrl] = useState('')
  const [overlays, setOverlays] = useState<Overlay[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [showManager, setShowManager] = useState(false)

  useEffect(() => {
    loadOverlays()
  }, [])

  const loadOverlays = async () => {
    try {
      const data = await api.getOverlays()
      setOverlays(data)
    } catch (error) {
      console.error('Failed to load overlays:', error)
    }
  }

  const handleStartStream = async () => {
    try {
      const result = await api.convertRtsp(rtspUrl)
      setStreamUrl(result.stream_url || rtspUrl)
      setIsStreaming(true)
    } catch (error) {
      console.error('Failed to start stream:', error)
    }
  }

  const handleCreateOverlay = async (overlay: Omit<Overlay, '_id'>) => {
    try {
      await api.createOverlay(overlay)
      loadOverlays()
    } catch (error) {
      console.error('Failed to create overlay:', error)
    }
  }

  const handleUpdateOverlay = async (id: string, updates: Partial<Overlay>) => {
    try {
      await api.updateOverlay(id, updates)
      setOverlays(prev => prev.map(o => o._id === id ? { ...o, ...updates } : o))
    } catch (error) {
      console.error('Failed to update overlay:', error)
    }
  }

  const handleDeleteOverlay = async (id: string) => {
    try {
      await api.deleteOverlay(id)
      loadOverlays()
    } catch (error) {
      console.error('Failed to delete overlay:', error)
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="text-center mb-8">
        <h3 className="font-heading font-bold text-2xl md:text-3xl mb-4">Live RTSP Stream Demo</h3>
        <p className="text-muted-foreground text-lg">
          Enter an RTSP URL to start streaming with dynamic overlay management.
        </p>
      </div>

      {!isStreaming ? (
        <div className="max-w-2xl mx-auto mb-8">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Start Your Livestream</CardTitle>
              <CardDescription>
                Enter an RTSP URL to begin streaming with overlay capabilities
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                type="text"
                placeholder="rtsp://your-stream-url-here"
                value={rtspUrl}
                onChange={(e) => setRtspUrl(e.target.value)}
                className="text-center font-mono text-sm"
              />
              <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
                <p className="font-medium">RTSP URL Examples:</p>
                <p>• Demo: rtsp://wowzaec2demo.streamlock.net/vod-multitrack/_definst_/ElephantsDream/elephantsdream2.mp4</p>
                <p>• IP Camera: rtsp://192.168.1.100:554/stream1</p>
                <p>• With Auth: rtsp://user:pass@192.168.1.100:554/stream1</p>
              </div>
              <Button onClick={handleStartStream} size="lg" className="w-full">
                <Play className="h-5 w-5 mr-2" />
                Start Livestream
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Video Player with Overlays */}
          <div className="lg:col-span-3">
            <Card className="overflow-hidden shadow-2xl bg-card/80 backdrop-blur-sm">
              <CardHeader className="pb-4 flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5 text-primary" />
                  Live Stream
                </CardTitle>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowManager(!showManager)}
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Overlays
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                <div className="relative">
                  <VideoPlayer rtspUrl={streamUrl} />
                  <OverlayCanvas 
                    overlays={overlays} 
                    onOverlayUpdate={handleUpdateOverlay}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Overlay Manager */}
          {showManager && (
            <div className="lg:col-span-1">
              <OverlayManager
                overlays={overlays}
                onCreateOverlay={handleCreateOverlay}
                onDeleteOverlay={handleDeleteOverlay}
              />
            </div>
          )}
        </div>
      )}
    </div>
  )
}
