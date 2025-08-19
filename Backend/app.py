from flask import Flask, jsonify
from flask_cors import CORS
from routes.overlays import overlay_bp
from routes.stream import stream_bp
import os
from pathlib import Path

app = Flask(__name__)

# Configure CORS with specific settings for streaming
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:3000", "http://127.0.0.1:3000"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Range", "Accept"],
        "expose_headers": ["Content-Range", "Accept-Ranges", "Content-Length"],
        "supports_credentials": False
    }
})

# Create necessary directories
STREAMS_DIR = Path("streams")
STREAMS_DIR.mkdir(exist_ok=True)

# Register blueprints
app.register_blueprint(overlay_bp, url_prefix='/api')
app.register_blueprint(stream_bp, url_prefix='/api')

@app.route('/')
def health_check():
    return jsonify({"status": "Backend running", "version": "1.0"})

@app.route('/api/docs')
def api_docs():
    return jsonify({
        "endpoints": {
            "overlays": {
                "POST /api/overlays": "Create overlay",
                "GET /api/overlays": "Get all overlays",
                "GET /api/overlays/<id>": "Get overlay by ID",
                "PUT /api/overlays/<id>": "Update overlay",
                "DELETE /api/overlays/<id>": "Delete overlay"
            },
            "streaming": {
                "POST /api/stream/convert": "Convert RTSP URL",
                "GET /api/stream/hls/<id>": "Get HLS stream"
            }
        }
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)