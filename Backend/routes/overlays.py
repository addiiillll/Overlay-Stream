from flask import Blueprint, request, jsonify
from models.overlay import Overlay

overlay_bp = Blueprint('overlays', __name__)
overlay_model = Overlay()

@overlay_bp.route('/overlays', methods=['POST'])
def create_overlay():
    data = request.json
    result = overlay_model.create(data)
    return jsonify({"id": str(result.inserted_id)}), 201

@overlay_bp.route('/overlays', methods=['GET'])
def get_overlays():
    overlays = overlay_model.get_all()
    return jsonify(overlays)

@overlay_bp.route('/overlays/<overlay_id>', methods=['GET'])
def get_overlay(overlay_id):
    overlay = overlay_model.get_by_id(overlay_id)
    if overlay:
        return jsonify(overlay)
    return jsonify({"error": "Overlay not found"}), 404

@overlay_bp.route('/overlays/<overlay_id>', methods=['PUT'])
def update_overlay(overlay_id):
    data = request.json
    result = overlay_model.update(overlay_id, data)
    if result.modified_count:
        return jsonify({"message": "Updated successfully"})
    return jsonify({"error": "Overlay not found"}), 404

@overlay_bp.route('/overlays/<overlay_id>', methods=['DELETE'])
def delete_overlay(overlay_id):
    result = overlay_model.delete(overlay_id)
    if result.deleted_count:
        return jsonify({"message": "Deleted successfully"})
    return jsonify({"error": "Overlay not found"}), 404