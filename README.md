# Overlay Stream Application

A full-stack application for streaming RTSP video with dynamic overlay management. Built with React (Nextjs Framework) frontend, Flask backend, and MongoDB database.

## Architecture

- **Frontend**: React with Next.js, TypeScript, Tailwind CSS
- **Backend**: Python Flask with RESTful API
- **Database**: MongoDB for overlay storage
- **Video Processing**: FFmpeg for RTSP stream conversion

## Prerequisites

- Node.js 18+
- Python 3.8+
- MongoDB
- FFmpeg
- MediaMTX (for RTSP streaming)

## Setup Instructions

### 1. Backend Setup

Navigate to the Backend directory:
```bash
cd Backend
```

Install Python dependencies:
```bash
pip install -r requirements.txt
```

Start MongoDB service on your system.

Run the Flask application:
```bash
python app.py
```

The backend will start on `http://127.0.0.1:5000`

### 2. Frontend Setup

Navigate to the Frontend directory:
```bash
cd Frontend/overlay-stream
```

Install Node.js dependencies:
```bash
npm install
```

Start the development server:
```bash
npm run dev
```

The frontend will start on `http://localhost:3000`

### 3. RTSP Stream Setup

Download and run MediaMTX:
1. Download MediaMTX from the official repository
2. Run the MediaMTX server (default port 8554)

Stream a video file using FFmpeg:
```bash
ffmpeg -stream_loop -1 -re -i "path/to/your/video.mp4" -c copy -f rtsp rtsp://127.0.0.1:8554/mystream
```

This command streams your video file in a loop to the RTSP endpoint `rtsp://127.0.0.1:8554/mystream`

## API Documentation

### Base URL
```
http://127.0.0.1:5000/api
```

### Overlay Management Routes

#### Create Overlay
- **POST** `/overlays`
- **Description**: Creates a new overlay configuration
- **Request Body**:
```json
{
  "name": "string",
  "type": "text|image|logo",
  "content": "string",
  "position": {
    "x": "number",
    "y": "number"
  },
  "size": {
    "width": "number",
    "height": "number"
  },
  "style": {
    "color": "string",
    "fontSize": "number",
    "fontFamily": "string"
  }
}
```
- **Response**: Created overlay object with generated `_id`

#### Get All Overlays
- **GET** `/overlays`
- **Description**: Retrieves all saved overlay configurations
- **Response**: Array of overlay objects

#### Update Overlay
- **PUT** `/overlays/{id}`
- **Description**: Updates an existing overlay configuration
- **Parameters**: `id` - MongoDB ObjectId of the overlay
- **Request Body**: Partial overlay object with fields to update
- **Response**: Updated overlay object

#### Delete Overlay
- **DELETE** `/overlays/{id}`
- **Description**: Deletes an overlay configuration
- **Parameters**: `id` - MongoDB ObjectId of the overlay
- **Response**: Success confirmation message

### Stream Management Routes

#### Convert RTSP Stream
- **POST** `/stream/convert`
- **Description**: Converts RTSP stream to HLS format for web playback
- **Request Body**:
```json
{
  "rtsp_url": "rtsp://127.0.0.1:8554/mystream",
  "username": "optional_string",
  "password": "optional_string",
  "rtsp_transport": "tcp|udp",
  "user_agent": "optional_string"
}
```
- **Response**:
```json
{
  "stream_id": "unique_identifier",
  "hls_url": "http://127.0.0.1:5000/streams/{stream_id}/playlist.m3u8",
  "status": "converting"
}
```

#### Test RTSP Connection
- **POST** `/stream/test`
- **Description**: Tests connectivity to an RTSP stream without conversion
- **Request Body**:
```json
{
  "rtsp_url": "rtsp://127.0.0.1:8554/mystream",
  "username": "optional_string",
  "password": "optional_string",
  "rtsp_transport": "tcp|udp"
}
```
- **Response**: Connection status and stream information

#### Stop Stream
- **POST** `/stream/stop/{stream_id}`
- **Description**: Stops an active stream conversion process
- **Parameters**: `stream_id` - Unique identifier of the stream
- **Response**: Confirmation of stream termination

#### Get Stream Status
- **GET** `/stream/status`
- **Description**: Returns status of all active streams
- **Response**: Object containing active stream information

#### List All Streams
- **GET** `/stream/list`
- **Description**: Lists all stream directories and their status
- **Response**: Array of stream information objects

#### Check Stream Ready
- **GET** `/stream/ready/{stream_id}`
- **Description**: Checks if a converted stream is ready for playback
- **Parameters**: `stream_id` - Unique identifier of the stream
- **Response**:
```json
{
  "ready": "boolean",
  "hls_url": "string_if_ready"
}
```

#### Get Stream Logs
- **GET** `/stream/logs/{stream_id}`
- **Description**: Retrieves conversion logs for debugging
- **Parameters**: `stream_id` - Unique identifier of the stream
- **Response**: Log entries for the specified stream

#### Probe RTSP Stream
- **POST** `/stream/probe`
- **Description**: Analyzes RTSP stream properties without conversion
- **Request Body**:
```json
{
  "rtsp_url": "rtsp://127.0.0.1:8554/mystream"
}
```
- **Response**: Stream metadata including codec, resolution, and bitrate information

## Frontend Components

### Main Components

#### VideoPlayer
- Handles HLS video playback using hls.js
- Provides play/pause controls and volume adjustment
- Displays loading states and error handling

#### OverlayCanvas
- Renders overlays on top of video content
- Supports text, image, and logo overlays
- Handles positioning and resizing of overlay elements

#### OverlayManager
- CRUD interface for overlay management
- Form-based overlay creation and editing
- Real-time preview of overlay changes

#### LiveDemo
- Complete demonstration component
- Integrates video player with overlay management
- Provides RTSP URL input and stream testing

### Configuration

Environment variables are configured in `.env.local`:
```
NEXT_PUBLIC_API_BASE_URL=http://127.0.0.1:5000/api
```

## Usage Workflow

1. **Start Services**: Run MediaMTX, MongoDB, Flask backend, and React frontend
2. **Create RTSP Stream**: Use FFmpeg to stream video to MediaMTX
3. **Access Application**: Open `http://localhost:3000` in browser
4. **Input RTSP URL**: Enter `rtsp://127.0.0.1:8554/mystream` in the demo section
5. **Convert Stream**: Click "Start Stream" to convert RTSP to HLS
6. **Manage Overlays**: Create, position, and customize overlays
7. **View Result**: Watch the video with applied overlays in real-time

## Troubleshooting

### Common Issues

**RTSP Connection Failed**
- Verify MediaMTX is running on port 8554
- Check FFmpeg streaming command is active
- Ensure RTSP URL format is correct

**Stream Conversion Errors**
- Check FFmpeg installation and PATH configuration
- Verify sufficient disk space for stream files
- Review stream logs using the logs endpoint

**Frontend API Errors**
- Confirm backend is running on port 5000
- Check CORS configuration in Flask app
- Verify environment variable configuration

**MongoDB Connection Issues**
- Ensure MongoDB service is running
- Check database connection string in config.py
- Verify database permissions and access

## File Structure

```
Overlay-Stream/
├── Backend/
│   ├── models/
│   │   └── overlay.py          # MongoDB overlay model
│   ├── routes/
│   │   ├── overlays.py         # Overlay CRUD endpoints
│   │   └── stream.py           # Stream management endpoints
│   ├── streams/                # Generated HLS stream files
│   ├── app.py                  # Flask application entry point
│   ├── config.py               # Database and app configuration
│   └── requirements.txt        # Python dependencies
├── Frontend/
│   └── overlay-stream/
│       ├── src/
│       │   ├── app/
│       │   │   └── page.tsx    # Main landing page
│       │   ├── components/     # React components
│       │   └── lib/
│       │       ├── api.ts      # API client functions
│       │       └── types.ts    # TypeScript type definitions
│       ├── .env.local          # Environment configuration
│       └── package.json        # Node.js dependencies
└── README.md                   # This documentation
```

## Development Notes

- The application uses HLS (HTTP Live Streaming) for web-compatible video playback
- FFmpeg handles RTSP to HLS conversion with configurable parameters
- Overlays are stored in MongoDB and applied client-side using CSS positioning
- Real-time overlay updates are achieved through React state management
- Stream files are automatically cleaned up when streams are stopped