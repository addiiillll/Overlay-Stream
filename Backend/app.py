from flask import Flask, jsonify
from flask_cors import CORS
from routes.overlays import overlay_bp
from routes.stream import stream_bp

app = Flask(__name__)
CORS(app)

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