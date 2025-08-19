from flask import Blueprint, request, jsonify
import subprocess
import os

stream_bp = Blueprint('stream', __name__)

@stream_bp.route('/stream/convert', methods=['POST'])
def convert_rtsp():
    data = request.json
    rtsp_url = data.get('rtsp_url')
    
    if not rtsp_url:
        return jsonify({"error": "RTSP URL required"}), 400
    
    # Check if FFmpeg is available
    ffmpeg_available = check_ffmpeg()
    
    if rtsp_url.startswith('rtsp://'):
        if ffmpeg_available:
            return jsonify({
                "message": "RTSP conversion available",
                "stream_url": rtsp_url,  # For demo, return original
                "type": "rtsp",
                "note": "In production, this would be converted to HLS"
            })
        else:
            return jsonify({
                "message": "RTSP detected but FFmpeg not installed",
                "stream_url": "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
                "type": "fallback",
                "note": "Using fallback video for demo. Install FFmpeg for RTSP support."
            })
    else:
        return jsonify({
            "message": "Direct URL",
            "stream_url": rtsp_url,
            "type": "direct"
        })

def check_ffmpeg():
    """Check if FFmpeg is installed"""
    try:
        subprocess.run(['ffmpeg', '-version'], capture_output=True, check=True)
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        return False

@stream_bp.route('/stream/status')
def stream_status():
    """Check streaming capabilities"""
    return jsonify({
        "ffmpeg_available": check_ffmpeg(),
        "supported_formats": ["MP4", "WebM", "HLS"],
        "rtsp_support": check_ffmpeg()
    })