import json
import os
import threading

METADATA_FILE = 'wtb_order_metadata.json'
LOCK = threading.Lock()

# Structure: { username: { order_id: { ...metadata... } } }

def load_metadata():
    if not os.path.exists(METADATA_FILE):
        return {}
    with LOCK:
        with open(METADATA_FILE, 'r', encoding='utf-8') as f:
            try:
                return json.load(f)
            except Exception:
                return {}

def save_metadata(data):
    with LOCK:
        with open(METADATA_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

def set_order_metadata(username, order_id, metadata):
    data = load_metadata()
    if username not in data:
        data[username] = {}
    data[username][order_id] = metadata
    save_metadata(data)

def get_order_metadata(username, order_id):
    data = load_metadata()
    return data.get(username, {}).get(order_id)

def get_all_metadata_for_user(username):
    data = load_metadata()
    return data.get(username, {})

def delete_order_metadata(username, order_id):
    data = load_metadata()
    if username in data and order_id in data[username]:
        del data[username][order_id]
        if not data[username]:
            del data[username]
        save_metadata(data)

def delete_all_metadata_for_user(username):
    data = load_metadata()
    if username in data:
        del data[username]
        save_metadata(data) 