from flask import Blueprint, request, jsonify, send_file
import subprocess
import os
import threading
import time
import uuid
import shutil
from pathlib import Path
from config import FFMPEG_PATH

stream_bp = Blueprint('stream', __name__)

# Global dictionary to track active streams
active_streams = {}

# Create streams directory if it doesn't exist
STREAMS_DIR = Path("streams")
STREAMS_DIR.mkdir(exist_ok=True)

@stream_bp.route('/stream/convert', methods=['POST'])
def convert_rtsp():
    data = request.json
    rtsp_url = data.get('rtsp_url')
    username = data.get('username')  # Optional RTSP username
    password = data.get('password')  # Optional RTSP password
    rtsp_transport = data.get('rtsp_transport', 'tcp')  # tcp or udp
    user_agent = data.get('user_agent')  # Optional custom user agent

    if not rtsp_url:
        return jsonify({"error": "RTSP URL required"}), 400

    # Check if FFmpeg is available
    ffmpeg_path = check_ffmpeg()

    if rtsp_url.startswith('rtsp://'):
        if ffmpeg_path:
            # Generate unique stream ID
            stream_id = str(uuid.uuid4())

            # Start RTSP to HLS conversion with authentication options
            success = start_rtsp_conversion(
                rtsp_url, stream_id, ffmpeg_path,
                username=username, password=password,
                rtsp_transport=rtsp_transport, user_agent=user_agent
            )

            if success:
                return jsonify({
                    "message": "RTSP conversion started",
                    "stream_url": f"http://127.0.0.1:5000/api/stream/hls/{stream_id}/playlist.m3u8",
                    "stream_id": stream_id,
                    "type": "hls",
                    "note": "RTSP stream converted to HLS"
                })
            else:
                return jsonify({
                    "error": "Failed to start RTSP conversion",
                    "stream_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                    "type": "fallback",
                    "note": "Using fallback video due to conversion error"
                }), 500
        else:
            return jsonify({
                "message": "RTSP detected but FFmpeg not installed",
                "stream_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "type": "fallback",
                "note": "FFmpeg is required for RTSP support. Please install FFmpeg and restart the server.",
                "install_instructions": {
                    "windows": "Download from https://ffmpeg.org/download.html and add to PATH",
                    "mac": "brew install ffmpeg",
                    "linux": "sudo apt install ffmpeg"
                }
            })
    else:
        # Handle direct video URLs (MP4, etc.)
        return jsonify({
            "message": "Direct URL",
            "stream_url": rtsp_url,
            "type": "direct"
        })

def start_rtsp_conversion(rtsp_url, stream_id, ffmpeg_path, username=None, password=None, rtsp_transport='tcp', user_agent=None):
    """Start FFmpeg process to convert RTSP to HLS with authentication support"""
    try:
        # Create directory for this stream
        stream_dir = STREAMS_DIR / stream_id
        stream_dir.mkdir(exist_ok=True)

        # Build FFmpeg command with authentication and connection options
        ffmpeg_cmd = [ffmpeg_path]

        # Add connection timeout and buffer options (using compatible options)
        ffmpeg_cmd.extend([
            '-timeout', '30000000',      # 30 second timeout for input
            '-analyzeduration', '10000000',  # Analyze duration
            '-probesize', '10000000',    # Probe size
        ])

        # Add RTSP transport protocol
        ffmpeg_cmd.extend(['-rtsp_transport', rtsp_transport])

        # Add user agent if provided
        if user_agent:
            ffmpeg_cmd.extend(['-user_agent', user_agent])
        else:
            # Use a common user agent that many servers accept
            ffmpeg_cmd.extend(['-user_agent', 'FFmpeg/4.0'])

        # Add authentication if provided
        if username and password:
            # Method 1: Add credentials to URL if not already present
            if '@' not in rtsp_url.split('://')[1]:
                url_parts = rtsp_url.split('://')
                authenticated_url = f"{url_parts[0]}://{username}:{password}@{url_parts[1]}"
                ffmpeg_cmd.extend(['-i', authenticated_url])
            else:
                ffmpeg_cmd.extend(['-i', rtsp_url])
        else:
            ffmpeg_cmd.extend(['-i', rtsp_url])

        # Add video and audio encoding options (optimized for live streaming)
        ffmpeg_cmd.extend([
            '-c:v', 'libx264',           # H.264 video codec
            '-c:a', 'aac',               # AAC audio codec
            '-preset', 'fast',           # Fast encoding preset (balance speed/quality)
            '-tune', 'zerolatency',      # Zero latency tuning for live streams
            '-profile:v', 'main',        # Main profile for better compatibility
            '-level', '4.0',             # H.264 level 4.0
            '-pix_fmt', 'yuv420p',       # Pixel format for web compatibility
            '-g', '60',                  # GOP size (2 seconds at 30fps)
            '-keyint_min', '60',         # Minimum keyframe interval
            '-sc_threshold', '0',        # Disable scene change detection
            '-b:v', '800k',              # Video bitrate
            '-maxrate', '1000k',         # Maximum bitrate
            '-bufsize', '1600k',         # Buffer size (2x bitrate)
            '-b:a', '128k',              # Audio bitrate
            '-ar', '44100',              # Audio sample rate
            '-ac', '2',                  # Audio channels (stereo)
            '-r', '30',                  # Force 30fps output
            '-vsync', 'cfr',             # Constant frame rate
        ])

        # Add HLS specific options (optimized for stability and compatibility)
        ffmpeg_cmd.extend([
            '-f', 'hls',                 # HLS format
            '-hls_time', '4',            # 4-second segments (balance between latency and stability)
            '-hls_list_size', '6',       # Keep 6 segments (better buffering)
            '-hls_wrap', '10',           # Wrap segment numbers after 10 (prevents overflow)
            '-hls_flags', 'delete_segments+append_list+omit_endlist',  # Better live streaming flags
            '-hls_segment_type', 'mpegts',  # Explicit segment type
            '-hls_segment_filename', str(stream_dir / 'segment_%03d.ts'),
            '-hls_playlist_type', 'event',  # Event playlist for live streams
            '-hls_allow_cache', '0',     # Disable caching for live streams
            '-hls_base_url', f'http://127.0.0.1:5000/api/stream/hls/{stream_id}/',  # Base URL for segments
            '-y',                        # Overwrite output files
            '-loglevel', 'info',         # Less verbose logging
            str(stream_dir / 'playlist.m3u8')
        ])

        print(f"Starting FFmpeg conversion for stream {stream_id}")
        # Don't print the full command if it contains credentials
        if username and password:
            safe_cmd = [arg if not (username in arg and password in arg) else '[CREDENTIALS_HIDDEN]' for arg in ffmpeg_cmd]
            print(f"Command: {' '.join(safe_cmd)}")
        else:
            print(f"Command: {' '.join(ffmpeg_cmd)}")

        # Start FFmpeg process in background
        process = subprocess.Popen(
            ffmpeg_cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            universal_newlines=True,
            cwd=str(stream_dir)  # Set working directory to stream directory
        )

        # Store process info (without exposing credentials)
        safe_cmd_str = ' '.join([arg if not (username and password and username in arg and password in arg) else '[CREDENTIALS_HIDDEN]' for arg in ffmpeg_cmd])
        active_streams[stream_id] = {
            'process': process,
            'rtsp_url': rtsp_url,
            'stream_dir': stream_dir,
            'start_time': time.time(),
            'status': 'starting',
            'error': None,
            'ffmpeg_cmd': safe_cmd_str,
            'logs': [],
            'auth_used': bool(username and password)
        }

        # Start monitoring thread
        monitor_thread = threading.Thread(
            target=monitor_stream,
            args=(stream_id, process),
            daemon=True
        )
        monitor_thread.start()

        return True

    except Exception as e:
        print(f"Error starting RTSP conversion: {e}")
        # Clean up on error
        if stream_id in active_streams:
            del active_streams[stream_id]
        return False

def monitor_stream(stream_id, process):
    """Monitor FFmpeg process and handle cleanup"""
    try:
        # Wait a bit to see if process starts successfully
        time.sleep(5)  # Wait longer for network connections

        if process.poll() is not None:
            # Process ended quickly, likely an error
            stderr_output = process.stderr.read() if process.stderr else "No error output"
            stdout_output = process.stdout.read() if process.stdout else "No stdout output"
            print(f"Stream {stream_id} ended early. Error: {stderr_output}")
            print(f"Stream {stream_id} stdout: {stdout_output}")

            # Update stream status
            if stream_id in active_streams:
                active_streams[stream_id]['status'] = 'error'
                active_streams[stream_id]['error'] = f"FFmpeg error: {stderr_output[:200]}"
                active_streams[stream_id]['logs'].append(f"STDERR: {stderr_output}")
                active_streams[stream_id]['logs'].append(f"STDOUT: {stdout_output}")

            cleanup_stream(stream_id)
            return

        # Wait for playlist file to be created before marking as ready
        if stream_id in active_streams:
            stream_dir = active_streams[stream_id]['stream_dir']
            playlist_path = stream_dir / 'playlist.m3u8'

            # Wait up to 60 seconds for playlist to be created (longer timeout)
            playlist_ready = False
            for i in range(60):
                # Check if process is still running
                if process.poll() is not None:
                    # Process ended, get error output
                    stderr_output = process.stderr.read() if process.stderr else "No error output"
                    stdout_output = process.stdout.read() if process.stdout else "No stdout output"
                    print(f"Stream {stream_id} FFmpeg process ended early")
                    print(f"Stream {stream_id} stderr: {stderr_output}")
                    print(f"Stream {stream_id} stdout: {stdout_output}")

                    active_streams[stream_id]['status'] = 'error'
                    active_streams[stream_id]['error'] = f"FFmpeg process ended: {stderr_output[:200]}"
                    active_streams[stream_id]['logs'].append(f"STDERR: {stderr_output}")
                    active_streams[stream_id]['logs'].append(f"STDOUT: {stdout_output}")
                    cleanup_stream(stream_id)
                    return

                if playlist_path.exists() and playlist_path.stat().st_size > 0:
                    print(f"Stream {stream_id} playlist created successfully after {i+1} seconds")
                    active_streams[stream_id]['status'] = 'ready'
                    playlist_ready = True
                    break

                # Print progress every 10 seconds
                if i % 10 == 0 and i > 0:
                    print(f"Stream {stream_id} still waiting for playlist... ({i}/60 seconds)")

                time.sleep(1)

            if not playlist_ready:
                print(f"Stream {stream_id} playlist not created within timeout")
                # Get final process output for debugging
                if process.poll() is None:
                    process.terminate()
                    time.sleep(2)
                stderr_output = process.stderr.read() if process.stderr else "No error output"
                stdout_output = process.stdout.read() if process.stdout else "No stdout output"
                print(f"Stream {stream_id} final stderr: {stderr_output}")
                print(f"Stream {stream_id} final stdout: {stdout_output}")

                active_streams[stream_id]['status'] = 'error'
                active_streams[stream_id]['error'] = "Playlist file not created within timeout"
                active_streams[stream_id]['logs'].append(f"TIMEOUT_STDERR: {stderr_output}")
                active_streams[stream_id]['logs'].append(f"TIMEOUT_STDOUT: {stdout_output}")
                cleanup_stream(stream_id)
                return

        # Update status to running
        if stream_id in active_streams:
            active_streams[stream_id]['status'] = 'streaming'

        print(f"Stream {stream_id} is running successfully")

        # Monitor process
        while process.poll() is None:
            time.sleep(5)

        print(f"Stream {stream_id} ended normally")
        cleanup_stream(stream_id)

    except Exception as e:
        print(f"Error monitoring stream {stream_id}: {e}")
        if stream_id in active_streams:
            active_streams[stream_id]['status'] = 'error'
            active_streams[stream_id]['error'] = str(e)
        cleanup_stream(stream_id)

def cleanup_stream(stream_id):
    """Clean up stream resources"""
    if stream_id in active_streams:
        stream_info = active_streams[stream_id]

        # Terminate process if still running
        if stream_info['process'].poll() is None:
            stream_info['process'].terminate()
            time.sleep(2)
            if stream_info['process'].poll() is None:
                stream_info['process'].kill()

        # Clean up files after a delay (to allow last segments to be served)
        def delayed_cleanup():
            time.sleep(30)  # Wait 30 seconds
            try:
                if stream_info['stream_dir'].exists():
                    shutil.rmtree(stream_info['stream_dir'])
            except Exception as e:
                print(f"Error cleaning up stream directory: {e}")

        cleanup_thread = threading.Thread(target=delayed_cleanup, daemon=True)
        cleanup_thread.start()

        # Remove from active streams
        del active_streams[stream_id]

@stream_bp.route('/stream/hls/<stream_id>/<filename>')
def serve_hls_file(stream_id, filename):
    """Serve HLS playlist and segment files with better error handling"""
    try:
        # Check if stream exists
        if stream_id not in active_streams:
            print(f"Stream {stream_id} not found in active streams")
            return jsonify({"error": "Stream not found"}), 404

        stream_info = active_streams[stream_id]
        stream_dir = stream_info['stream_dir']
        file_path = stream_dir / filename

        # Check if file exists
        if not file_path.exists():
            print(f"File {filename} not found in stream {stream_id}")
            # For playlist files, check if stream is still starting
            if filename.endswith('.m3u8') and stream_info.get('status') == 'starting':
                return jsonify({"error": "Stream is still starting, please wait"}), 503
            return jsonify({"error": "File not found"}), 404

        # Check if file is readable and not empty
        try:
            file_size = file_path.stat().st_size
            if file_size == 0:
                print(f"File {filename} is empty in stream {stream_id}")
                return jsonify({"error": "File is empty"}), 404
        except OSError as e:
            print(f"Error accessing file {filename}: {e}")
            return jsonify({"error": "File access error"}), 500

        # Set appropriate content type and headers
        if filename.endswith('.m3u8'):
            mimetype = 'application/vnd.apple.mpegurl'
            headers = {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range'
            }
        elif filename.endswith('.ts'):
            mimetype = 'video/mp2t'
            headers = {
                'Cache-Control': 'public, max-age=31536000',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Range'
            }
        else:
            mimetype = 'application/octet-stream'
            headers = {
                'Access-Control-Allow-Origin': '*'
            }

        response = send_file(
            file_path,
            mimetype=mimetype,
            as_attachment=False
        )

        # Add headers to response
        for key, value in headers.items():
            response.headers[key] = value

        return response

    except Exception as e:
        print(f"Error serving HLS file {filename} for stream {stream_id}: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": "Internal server error"}), 500

def check_ffmpeg():
    """Check if FFmpeg is installed"""
    # Check manual configuration first
    if FFMPEG_PATH:
        try:
            subprocess.run([FFMPEG_PATH, '-version'], capture_output=True, check=True, timeout=5)
            print(f"FFmpeg found at configured path: {FFMPEG_PATH}")
            return FFMPEG_PATH
        except:
            print(f"Configured FFmpeg path not working: {FFMPEG_PATH}")

    # List of possible FFmpeg locations
    ffmpeg_paths = [
        'ffmpeg',  # System PATH
        'ffmpeg.exe',  # Windows with .exe
        r'C:\ffmpeg\bin\ffmpeg.exe',  # Common Windows location
        r'C:\Program Files\ffmpeg\bin\ffmpeg.exe',  # Program Files
        '/usr/bin/ffmpeg',  # Linux
        '/usr/local/bin/ffmpeg',  # macOS/Linux
    ]

    for ffmpeg_path in ffmpeg_paths:
        try:
            result = subprocess.run(
                [ffmpeg_path, '-version'],
                capture_output=True,
                check=True,
                timeout=5
            )
            print(f"FFmpeg found at: {ffmpeg_path}")
            return ffmpeg_path
        except (subprocess.CalledProcessError, FileNotFoundError, subprocess.TimeoutExpired):
            continue

    print("FFmpeg not found in any common locations")
    return None

def get_ffmpeg_path():
    """Get the FFmpeg executable path"""
    return check_ffmpeg()

@stream_bp.route('/stream/status')
def stream_status():
    """Check streaming capabilities"""
    ffmpeg_path = check_ffmpeg()
    return jsonify({
        "ffmpeg_available": ffmpeg_path is not None,
        "ffmpeg_path": ffmpeg_path,
        "supported_formats": ["MP4", "WebM", "HLS"],
        "rtsp_support": ffmpeg_path is not None,
        "active_streams": len(active_streams)
    })

@stream_bp.route('/stream/stop/<stream_id>', methods=['POST'])
def stop_stream(stream_id):
    """Stop a specific stream"""
    if stream_id not in active_streams:
        return jsonify({"error": "Stream not found"}), 404

    cleanup_stream(stream_id)
    return jsonify({"message": "Stream stopped successfully"})

@stream_bp.route('/stream/list')
def list_streams():
    """List all active streams"""
    streams = []
    for stream_id, info in active_streams.items():
        streams.append({
            "stream_id": stream_id,
            "rtsp_url": info['rtsp_url'],
            "start_time": info['start_time'],
            "status": info.get('status', 'unknown'),
            "error": info.get('error'),
            "running": info['process'].poll() is None,
            "uptime": time.time() - info['start_time']
        })

    return jsonify({"active_streams": streams})

@stream_bp.route('/stream/health/<stream_id>')
def stream_health(stream_id):
    """Get detailed health info for a specific stream"""
    if stream_id not in active_streams:
        return jsonify({"error": "Stream not found"}), 404

    info = active_streams[stream_id]
    playlist_path = info['stream_dir'] / 'playlist.m3u8'

    health_info = {
        "stream_id": stream_id,
        "status": info.get('status', 'unknown'),
        "error": info.get('error'),
        "running": info['process'].poll() is None,
        "uptime": time.time() - info['start_time'],
        "playlist_exists": playlist_path.exists(),
        "playlist_size": playlist_path.stat().st_size if playlist_path.exists() else 0,
        "segment_count": len(list(info['stream_dir'].glob('*.ts'))),
        "ready": info.get('status') in ['ready', 'streaming']
    }

    return jsonify(health_info)

@stream_bp.route('/stream/ready/<stream_id>')
def stream_ready(stream_id):
    """Check if a stream is ready for playback"""
    if stream_id not in active_streams:
        return jsonify({"ready": False, "error": "Stream not found"}), 404

    info = active_streams[stream_id]
    playlist_path = info['stream_dir'] / 'playlist.m3u8'

    is_ready = (
        info.get('status') in ['ready', 'streaming'] and
        playlist_path.exists() and
        playlist_path.stat().st_size > 0
    )

    return jsonify({
        "ready": is_ready,
        "status": info.get('status', 'unknown'),
        "playlist_exists": playlist_path.exists(),
        "playlist_size": playlist_path.stat().st_size if playlist_path.exists() else 0,
        "error": info.get('error'),
        "process_running": info['process'].poll() is None
    })

@stream_bp.route('/stream/logs/<stream_id>')
def stream_logs(stream_id):
    """Get FFmpeg logs for a stream"""
    if stream_id not in active_streams:
        return jsonify({"error": "Stream not found"}), 404

    info = active_streams[stream_id]
    return jsonify({
        "stream_id": stream_id,
        "status": info.get('status', 'unknown'),
        "error": info.get('error'),
        "ffmpeg_cmd": info.get('ffmpeg_cmd', ''),
        "logs": info.get('logs', []),
        "process_running": info['process'].poll() is None,
        "uptime": time.time() - info['start_time']
    })

@stream_bp.route('/stream/probe', methods=['POST'])
def probe_rtsp():
    """Probe RTSP stream to check if it's accessible"""
    data = request.json
    rtsp_url = data.get('rtsp_url')

    if not rtsp_url:
        return jsonify({"error": "RTSP URL required"}), 400

    ffmpeg_path = check_ffmpeg()
    if not ffmpeg_path:
        return jsonify({"error": "FFmpeg not available"}), 500

    try:
        # Simple probe command
        probe_cmd = [
            ffmpeg_path,
            '-i', rtsp_url,
            '-t', '1',  # Just 1 second
            '-f', 'null',
            '-'
        ]

        print(f"Probing RTSP stream: {rtsp_url}")
        print(f"Probe command: {' '.join(probe_cmd)}")

        result = subprocess.run(
            probe_cmd,
            capture_output=True,
            text=True,
            timeout=60  # Increase timeout to 60 seconds
        )

        return jsonify({
            "success": result.returncode == 0,
            "returncode": result.returncode,
            "stdout": result.stdout,
            "stderr": result.stderr,
            "command": ' '.join(probe_cmd)
        })

    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "error": "Probe timeout",
            "command": ' '.join(probe_cmd)
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error": str(e),
            "command": ' '.join(probe_cmd) if 'probe_cmd' in locals() else 'N/A'
        })

@stream_bp.route('/stream/test', methods=['POST'])
def test_rtsp_connection():
    """Test RTSP connection before starting conversion"""
    data = request.json
    rtsp_url = data.get('rtsp_url')
    username = data.get('username')
    password = data.get('password')
    rtsp_transport = data.get('rtsp_transport', 'tcp')

    if not rtsp_url:
        return jsonify({"error": "RTSP URL required"}), 400

    ffmpeg_path = check_ffmpeg()
    if not ffmpeg_path:
        return jsonify({"error": "FFmpeg not available"}), 500

    try:
        # Build test command
        test_cmd = [ffmpeg_path]
        test_cmd.extend([
            '-timeout', '10000000',      # 10 second timeout
            '-rtsp_transport', rtsp_transport,
            '-user_agent', 'FFmpeg/4.0',
            '-analyzeduration', '5000000',  # Analyze duration for testing
            '-probesize', '5000000',     # Probe size for testing
        ])

        # Add authentication if provided
        if username and password:
            if '@' not in rtsp_url.split('://')[1]:
                url_parts = rtsp_url.split('://')
                authenticated_url = f"{url_parts[0]}://{username}:{password}@{url_parts[1]}"
                test_cmd.extend(['-i', authenticated_url])
            else:
                test_cmd.extend(['-i', rtsp_url])
        else:
            test_cmd.extend(['-i', rtsp_url])

        # Just probe the stream, don't convert
        test_cmd.extend(['-t', '1', '-f', 'null', '-'])

        print(f"Testing RTSP connection: {rtsp_url}")

        # Run test command
        result = subprocess.run(
            test_cmd,
            capture_output=True,
            text=True,
            timeout=15  # 15 second timeout for test
        )

        success = result.returncode == 0
        error_output = result.stderr if result.stderr else ""

        # Analyze the error for common issues
        error_analysis = analyze_rtsp_error(error_output)

        return jsonify({
            "success": success,
            "error_output": error_output[:500],  # Limit error output
            "analysis": error_analysis,
            "suggestions": get_rtsp_suggestions(error_analysis)
        })

    except subprocess.TimeoutExpired:
        return jsonify({
            "success": False,
            "error_output": "Connection timeout",
            "analysis": "timeout",
            "suggestions": ["Check if the RTSP URL is accessible", "Try using UDP transport instead of TCP"]
        })
    except Exception as e:
        return jsonify({
            "success": False,
            "error_output": str(e),
            "analysis": "unknown_error",
            "suggestions": ["Check FFmpeg installation", "Verify RTSP URL format"]
        })

def analyze_rtsp_error(error_output):
    """Analyze RTSP error output to determine the issue"""
    error_lower = error_output.lower()

    if "403 forbidden" in error_lower:
        return "authentication_required"
    elif "401 unauthorized" in error_lower:
        return "invalid_credentials"
    elif "404 not found" in error_lower:
        return "stream_not_found"
    elif "connection refused" in error_lower:
        return "connection_refused"
    elif "timeout" in error_lower:
        return "timeout"
    elif "no route to host" in error_lower:
        return "network_unreachable"
    elif "protocol not supported" in error_lower:
        return "protocol_error"
    else:
        return "unknown_error"

def get_rtsp_suggestions(error_type):
    """Get suggestions based on error type"""
    suggestions = {
        "authentication_required": [
            "This stream requires authentication",
            "Provide username and password",
            "Check if the stream URL includes credentials"
        ],
        "invalid_credentials": [
            "The provided credentials are incorrect",
            "Verify username and password",
            "Contact the stream provider for correct credentials"
        ],
        "stream_not_found": [
            "The stream path is incorrect",
            "Verify the RTSP URL",
            "Check if the stream is currently active"
        ],
        "connection_refused": [
            "The server is not accepting connections",
            "Check if the server is running",
            "Verify the port number in the URL"
        ],
        "timeout": [
            "Connection timed out",
            "Check network connectivity",
            "Try using UDP transport instead of TCP"
        ],
        "network_unreachable": [
            "Cannot reach the server",
            "Check network connectivity",
            "Verify the server address"
        ],
        "protocol_error": [
            "RTSP protocol issue",
            "Try different transport method (TCP/UDP)",
            "Check if the URL format is correct"
        ]
    }

    return suggestions.get(error_type, [
        "Unknown error occurred",
        "Check FFmpeg logs for more details",
        "Verify RTSP URL and network connectivity"
    ])

@stream_bp.route('/stream/debug/ffmpeg')
def debug_ffmpeg():
    """Debug FFmpeg detection"""
    debug_info = {
        "environment_path": os.environ.get('PATH', ''),
        "ffmpeg_configured": FFMPEG_PATH,
        "detection_results": []
    }

    # Test all possible paths
    test_paths = [
        'ffmpeg',
        'ffmpeg.exe',
        r'C:\ffmpeg\bin\ffmpeg.exe',
        r'C:\Program Files\ffmpeg\bin\ffmpeg.exe'
    ]

    if FFMPEG_PATH:
        test_paths.insert(0, FFMPEG_PATH)

    for path in test_paths:
        try:
            result = subprocess.run([path, '-version'], capture_output=True, timeout=5)
            debug_info["detection_results"].append({
                "path": path,
                "success": result.returncode == 0,
                "error": result.stderr.decode()[:200] if result.stderr else None
            })
        except Exception as e:
            debug_info["detection_results"].append({
                "path": path,
                "success": False,
                "error": str(e)
            })

    return jsonify(debug_info)

@stream_bp.route('/stream/logs/<stream_id>')
def get_stream_logs(stream_id):
    """Get FFmpeg logs for a specific stream"""
    if stream_id not in active_streams:
        return jsonify({"error": "Stream not found"}), 404

    stream_info = active_streams[stream_id]

    # Try to read current stderr/stdout if process is still running
    current_logs = []
    if stream_info['process'].poll() is None:
        # Process is still running, try to read some output
        try:
            # Read available stderr without blocking
            import select
            import sys
            if hasattr(select, 'select'):  # Unix-like systems
                ready, _, _ = select.select([stream_info['process'].stderr], [], [], 0)
                if ready:
                    current_logs.append(stream_info['process'].stderr.read(1024))
        except:
            pass

    return jsonify({
        "stream_id": stream_id,
        "ffmpeg_command": stream_info.get('ffmpeg_cmd', ''),
        "status": stream_info.get('status', 'unknown'),
        "logs": stream_info.get('logs', []),
        "current_logs": current_logs,
        "process_running": stream_info['process'].poll() is None
    })