import os
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://overlaystream:2U9Cy9Hwep939gSr@overlaystream.zsgiwbp.mongodb.net/"
DATABASE_NAME = "overlay_stream"

# FFmpeg configuration - you can set this manually if auto-detection fails
FFMPEG_PATH = os.environ.get('FFMPEG_PATH', r'D:\Adil\ffmpeg-2025-08-18-git-0226b6fb2c-essentials_build\bin\ffmpeg.exe')

def get_db():
    client = MongoClient(MONGO_URI)
    return client[DATABASE_NAME]