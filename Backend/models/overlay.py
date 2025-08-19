from bson import ObjectId
from config import get_db

class Overlay:
    def __init__(self):
        self.db = get_db()
        self.collection = self.db.overlays
    
    def create(self, overlay_data):
        return self.collection.insert_one(overlay_data)
    
    def get_all(self):
        overlays = list(self.collection.find())
        for overlay in overlays:
            overlay['_id'] = str(overlay['_id'])
        return overlays
    
    def get_by_id(self, overlay_id):
        overlay = self.collection.find_one({"_id": ObjectId(overlay_id)})
        if overlay:
            overlay['_id'] = str(overlay['_id'])
        return overlay
    
    def update(self, overlay_id, update_data):
        return self.collection.update_one(
            {"_id": ObjectId(overlay_id)}, 
            {"$set": update_data}
        )
    
    def delete(self, overlay_id):
        return self.collection.delete_one({"_id": ObjectId(overlay_id)})