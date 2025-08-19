import os
from pymongo import MongoClient

MONGO_URI = "mongodb+srv://overlaystream:2U9Cy9Hwep939gSr@overlaystream.zsgiwbp.mongodb.net/"
DATABASE_NAME = "overlay_stream"

def get_db():
    client = MongoClient(MONGO_URI)
    return client[DATABASE_NAME]