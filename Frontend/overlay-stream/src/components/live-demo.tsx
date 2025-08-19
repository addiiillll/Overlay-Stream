"use client"

import { useState, useEffect, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer"
import EnhancedVideoPlayer from "@/components/EnhancedVideoPlayer"
import OverlayManager from "@/components/OverlayManager"
import { useIsMobile } from "@/hooks/use-mobile"
import { api } from "@/lib/api"
import type { Overlay } from "@/lib/types"
import { Play, Settings, ChevronDown, TestTube, AlertCircle, CheckCircle, Sparkles } from "lucide-react"
import { toast } from "sonner"

export default function LiveDemo() {
  const [rtspUrl, setRtspUrl] = useState('rtsp://127.0.0.1:8554/mystream')
  const [streamUrl, setStreamUrl] = useState('')
  const [overlays, setOverlays] = useState<Overlay[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [showManager, setShowManager] = useState(true)
  const [streamInfo, setStreamInfo] = useState<any>(null)
  const [drawerOpen, setDrawerOpen] = useState(false)

  const isMobile = useIsMobile()

  // Store scroll position to prevent auto-scroll on drawer close
  const scrollPositionRef = useRef<number>(0)

  // Authentication and connection options
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rtspTransport, setRtspTransport] = useState<'tcp' | 'udp'>('tcp')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [probeResult, setProbeResult] = useState<any>(null)
  const [isProbing, setIsProbing] = useState(false)

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

  const handleProbeStream = async () => {
    if (!rtspUrl.startsWith('rtsp://')) {
      alert('Probing is only available for RTSP URLs')
      return
    }

    setIsProbing(true)
    setProbeResult(null)

    try {
      console.log('Probing RTSP stream:', rtspUrl)
      const result = await api.probeRtsp(rtspUrl)
      console.log('Probe result:', JSON.stringify(result, null, 2))
      setProbeResult(result)
    } catch (error) {
      console.error('Failed to probe stream:', error)
      toast.error('Failed to probe stream')
      setProbeResult({
        success: false,
        error: 'Failed to connect to server',
        stderr: 'Network error'
      })
    } finally {
      setIsProbing(false)
    }
  }

  const handleTestConnection = async () => {
    if (!rtspUrl.startsWith('rtsp://')) {
      alert('Testing is only available for RTSP URLs')
      return
    }

    setIsTesting(true)
    setTestResult(null)

    try {
      console.log('Testing RTSP connection for:', rtspUrl)
      const result = await api.testRtsp(rtspUrl, {
        username: username || undefined,
        password: password || undefined,
        rtsp_transport: rtspTransport
      })

      console.log('Test result:', result)
      setTestResult(result)
    } catch (error) {
      console.error('Failed to test connection:', error)
      toast.error('Failed to test connection')
      setTestResult({
        success: false,
        error_output: 'Failed to connect to server',
        analysis: 'connection_error',
        suggestions: ['Check if the backend server is running', 'Verify network connectivity']
      })
    } finally {
      setIsTesting(false)
    }
  }

  const handleStartStream = async () => {
    try {
      console.log('Starting stream conversion for:', rtspUrl)
      const result = await api.convertRtsp(rtspUrl, {
        username: username || undefined,
        password: password || undefined,
        rtsp_transport: rtspTransport
      })
      console.log('Stream conversion result:', result)

      if (result.error) {
        console.error('Stream conversion error:', result.error)
        toast.error(`Stream Error: ${result.error}`)
        return
      }

      setStreamInfo(result)
      setIsStreaming(true)

      // If it's an HLS stream, wait for it to be ready
      if (result.type === 'hls' && result.stream_id) {
        console.log('HLS stream starting, waiting for segments...')

        // Poll for stream readiness with timeout
        let attempts = 0
        const maxAttempts = 30 // 60 seconds total (2 seconds * 30)

        const checkReady = async () => {
          try {
            attempts++
            const readyResult = await api.checkStreamReady(result.stream_id)
            console.log(`Stream ready check (${attempts}/${maxAttempts}):`, JSON.stringify(readyResult, null, 2))

            if (readyResult.ready) {
              console.log('Stream is ready, starting playback')
              console.log('Setting stream URL to:', result.stream_url)
              setStreamUrl(result.stream_url || rtspUrl)
            } else if (readyResult.error || !readyResult.process_running) {
              console.error('Stream failed:', JSON.stringify(readyResult, null, 2))
              // Get detailed logs
              try {
                const logs = await api.getStreamLogs(result.stream_id)
                console.error('Stream logs:', JSON.stringify(logs, null, 2))
                toast.error(`Stream failed: ${readyResult.error || 'Process stopped unexpectedly'}`)
              } catch (logError) {
                console.error('Failed to get logs:', logError)
                toast.error(`Stream failed: ${readyResult.error || 'Unknown error'}`)
              }
            } else if (attempts >= maxAttempts) {
              console.error('Stream timeout after', attempts, 'attempts')
              // Get final logs
              try {
                const logs = await api.getStreamLogs(result.stream_id)
                console.error('Final stream logs:', logs)
                toast.error('Stream timeout. The RTSP source may be slow or unavailable.')
              } catch (logError) {
                console.error('Failed to get final logs:', logError)
                toast.error('Stream timeout. The RTSP source may be slow or unavailable.')
              }
            } else {
              // Check again in 2 seconds
              setTimeout(checkReady, 2000)
            }
          } catch (error) {
            console.error('Error checking stream readiness:', error)
            if (attempts >= 5) {
              // After 5 failed attempts, give up
              toast.error('Failed to check stream status')
            } else {
              // Try again
              setTimeout(checkReady, 2000)
            }
          }
        }

        checkReady()
      } else {
        // Direct video or non-HLS stream
        console.log('Setting direct stream URL to:', result.stream_url || rtspUrl)
        setStreamUrl(result.stream_url || rtspUrl)
      }

    } catch (error) {
      console.error('Failed to start stream:', error)
      toast.error('Failed to start stream')
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/20">
      <div className="container mx-auto px-4 py-4 md:py-8">
        <div className="text-center mb-8 md:mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="p-2 rounded-full bg-gradient-to-r from-primary to-primary/80">
              <Sparkles className="h-6 w-6 text-primary-foreground" />
            </div>
            <h1 className="font-heading font-bold text-2xl sm:text-3xl md:text-4xl bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
              OverlayStream
            </h1>
          </div>
          <p className="text-muted-foreground text-base sm:text-lg max-w-2xl mx-auto px-4">
            Transform your livestreams with professional overlays. Convert RTSP streams to HLS and add dynamic graphics in real-time.
          </p>
        </div>

        {!isStreaming ? (
          <div className="max-w-3xl mx-auto">
            <Card className="border-0 shadow-2xl bg-card/80 backdrop-blur-sm">
              <CardHeader className="text-center pb-6">
                <CardTitle className="text-xl sm:text-2xl font-bold bg-gradient-to-r from-primary to-primary/70 bg-clip-text text-transparent">
                  Start Your Livestream
                </CardTitle>
                <CardDescription className="text-sm sm:text-base px-4">
                  Enter an RTSP URL to begin streaming with professional overlay capabilities
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <Label htmlFor="rtsp-url" className="text-sm font-medium text-foreground/80">Stream URL</Label>
                  <Input
                    id="rtsp-url"
                    type="text"
                    placeholder="rtsp://your-stream-url-here or https://video-url.mp4"
                    value={rtspUrl}
                    onChange={(e) => setRtspUrl(e.target.value)}
                    className="font-mono text-sm h-12 bg-background/80 border-border/60 hover:border-border focus:border-primary/50 transition-all duration-200 shadow-sm focus:shadow-md"
                  />
                </div>

                <Collapsible open={showAdvanced} onOpenChange={setShowAdvanced}>
                  <CollapsibleTrigger asChild>
                    <Button
                      variant="outline"
                      className="w-full h-12 bg-card/50 border-border/50 hover:border-border transition-all duration-200 shadow-sm hover:shadow-md"
                    >
                      <Settings className="h-4 w-4 mr-2 text-foreground" />
                      <span className="font-medium">Advanced Options</span>
                      <ChevronDown className={`h-4 w-4 ml-auto transition-transform duration-200 ${showAdvanced ? 'rotate-180' : ''}`} />
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="space-y-6 mt-4 p-6 bg-card/30 backdrop-blur-sm rounded-lg border border-border/50 shadow-sm">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-3">
                        <Label htmlFor="username" className="text-sm font-medium text-foreground/80">Username (optional)</Label>
                        <Input
                          id="username"
                          type="text"
                          placeholder="Enter username"
                          value={username}
                          onChange={(e) => setUsername(e.target.value)}
                          className="bg-background/80 border-border/60 hover:border-border focus:border-primary/50 transition-colors"
                        />
                      </div>
                      <div className="space-y-3">
                        <Label htmlFor="password" className="text-sm font-medium text-foreground/80">Password (optional)</Label>
                        <Input
                          id="password"
                          type="password"
                          placeholder="Enter password"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          className="bg-background/80 border-border/60 hover:border-border focus:border-primary/50 transition-colors"
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label htmlFor="transport" className="text-sm font-medium text-foreground/80">RTSP Transport Protocol</Label>
                      <Select value={rtspTransport} onValueChange={(value: 'tcp' | 'udp') => setRtspTransport(value)}>
                        <SelectTrigger className="bg-background/80 border-border/60 hover:border-border focus:border-primary/50 transition-colors">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="bg-popover/95 backdrop-blur-sm border-border/50">
                          <SelectItem value="tcp" className="hover:bg-accent/50">TCP (Recommended)</SelectItem>
                          <SelectItem value="udp" className="hover:bg-accent/50">UDP</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </CollapsibleContent>
              </Collapsible>

              {rtspUrl.startsWith('rtsp://') && (
                <div className="flex gap-3">
                  <Button
                    onClick={handleProbeStream}
                    variant="outline"
                    className="flex-1 h-11 bg-card/50 hover:bg-card/80 border-border/50 hover:border-border transition-all duration-200 shadow-sm hover:shadow-md"
                    disabled={isProbing}
                  >
                    <TestTube className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium">{isProbing ? 'Probing...' : 'Probe Stream'}</span>
                  </Button>
                  <Button
                    onClick={handleTestConnection}
                    variant="outline"
                    className="flex-1 h-11 bg-card/50 hover:bg-card/80 border-border/50 hover:border-border transition-all duration-200 shadow-sm hover:shadow-md"
                    disabled={isTesting}
                  >
                    <TestTube className="h-4 w-4 mr-2 text-muted-foreground" />
                    <span className="font-medium">{isTesting ? 'Testing...' : 'Test Connection'}</span>
                  </Button>
                </div>
              )}

              {probeResult && (
                <div className={`p-3 rounded-lg border ${
                  probeResult.success
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {probeResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="font-medium">
                      {probeResult.success ? 'Stream Accessible' : 'Stream Probe Failed'}
                    </span>
                  </div>
                  {!probeResult.success && (
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Error Details:</p>
                      <pre className="text-xs bg-black/10 p-2 rounded overflow-x-auto">
                        {probeResult.stderr || probeResult.error || 'Unknown error'}
                      </pre>
                    </div>
                  )}
                </div>
              )}

              {testResult && (
                <div className={`p-3 rounded-lg border ${
                  testResult.success
                    ? 'bg-green-50 border-green-200 text-green-800'
                    : 'bg-red-50 border-red-200 text-red-800'
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    {testResult.success ? (
                      <CheckCircle className="h-4 w-4" />
                    ) : (
                      <AlertCircle className="h-4 w-4" />
                    )}
                    <span className="font-medium">
                      {testResult.success ? 'Connection Successful' : 'Connection Failed'}
                    </span>
                  </div>
                  {!testResult.success && testResult.suggestions && (
                    <div className="text-sm space-y-1">
                      <p className="font-medium">Suggestions:</p>
                      <ul className="list-disc list-inside space-y-1">
                        {testResult.suggestions.map((suggestion: string, index: number) => (
                          <li key={index}>{suggestion}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1 p-3 bg-muted/50 rounded">
                <p className="font-medium">Stream URL Examples:</p>
                <p>• Direct MP4: https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4</p>
                <p>• RTSP Test 1: rtsp://rtsp.stream/pattern</p>
                <p>• RTSP Test 2: rtsp://demo.rtsp.org/BigBuckBunny_320x180.mp4</p>
                <p>• Wowza Demo: rtsp://wowzaec2demo.streamlock.net/vod/mp4:BigBuckBunny_115k.mp4</p>
                <p>• IP Camera: rtsp://192.168.1.100:554/stream1</p>
                <p>• With Auth: rtsp://user:pass@192.168.1.100:554/stream1</p>
                <p className="text-amber-600">⚠️ RTSP streams may timeout due to network restrictions or server availability</p>
              </div>

                <Button
                  onClick={handleStartStream}
                  size="lg"
                  className="w-full h-12 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 transition-all duration-200 shadow-lg hover:shadow-xl"
                >
                  <Play className="h-5 w-5 mr-2" />
                  Start Livestream
                </Button>
              </CardContent>
            </Card>
          </div>
        ) : (
          <div className={`${isMobile ? 'space-y-6' : 'grid xl:grid-cols-4 lg:grid-cols-3 gap-8'}`}>
            {/* Video Player with Overlays */}
            <div className={`${isMobile ? 'w-full px-2' : 'xl:col-span-3 lg:col-span-2'}`}>
              <Card className={`overflow-hidden shadow-2xl bg-card/80 backdrop-blur-sm border-0 ${isMobile ? 'mx-0' : ''}`}>
                <CardHeader className="pb-4 flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    Live Stream
                  </CardTitle>
                  <div className="flex gap-2">
                    {isMobile ? (
                      // Mobile: Use Drawer with controlled state
                      <Drawer
                        open={drawerOpen}
                        onOpenChange={(open) => {
                          if (open) {
                            // Store current scroll position when opening
                            scrollPositionRef.current = window.scrollY;
                          } else {
                            // Restore scroll position when closing
                            setTimeout(() => {
                              window.scrollTo({
                                top: scrollPositionRef.current,
                                behavior: 'instant'
                              });
                            }, 50);
                          }
                          setDrawerOpen(open);
                        }}
                        shouldScaleBackground={false}
                      >
                        <DrawerTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Settings className="h-4 w-4 mr-1" />
                            Overlays
                          </Button>
                        </DrawerTrigger>
                        <DrawerContent className="max-h-[90vh]">
                          <DrawerHeader className="pb-2">
                            <DrawerTitle className="flex items-center gap-2 text-lg">
                              <Settings className="h-5 w-5 text-primary" />
                              Overlay Manager
                            </DrawerTitle>
                          </DrawerHeader>
                          <div className="px-4 pb-6 overflow-y-auto flex-1">
                            <OverlayManager
                              overlays={overlays}
                              onCreateOverlay={handleCreateOverlay}
                              onDeleteOverlay={handleDeleteOverlay}
                            />
                          </div>
                        </DrawerContent>
                      </Drawer>
                    ) : (
                      // Desktop: Use toggle button
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowManager(!showManager)}
                      >
                        <Settings className="h-4 w-4 mr-1" />
                        Overlays
                      </Button>
                    )}

                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className={`relative ${isMobile ? 'min-h-[250px] sm:min-h-[300px]' : ''}`}>
                    <EnhancedVideoPlayer
                      rtspUrl={streamUrl}
                      onPlay={() => {
                        console.log('Video playing')
                        toast.success('Stream started')
                      }}
                      onPause={() => {
                        console.log('Video paused')
                        toast.info('Stream paused')
                      }}
                      className={`w-full ${isMobile ? 'min-h-[250px] sm:min-h-[300px]' : ''}`}
                      overlays={overlays}
                      onOverlayUpdate={handleUpdateOverlay}
                      onCreateOverlay={handleCreateOverlay}
                      onDeleteOverlay={handleDeleteOverlay}
                    />
                  </div>
                </CardContent>
            </Card>
          </div>

            {/* Desktop Overlay Manager - Only show on desktop when not mobile */}
            {!isMobile && showManager && (
              <div className="xl:col-span-1 lg:col-span-1">
                <Card className="shadow-xl bg-card/80 backdrop-blur-sm border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Settings className="h-5 w-5 text-primary" />
                      Overlay Manager
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <OverlayManager
                      overlays={overlays}
                      onCreateOverlay={handleCreateOverlay}
                      onDeleteOverlay={handleDeleteOverlay}
                    />
                  </CardContent>
                </Card>
              </div>
            )}


        </div>
      )}
    </div>
    </div>
  )
}
