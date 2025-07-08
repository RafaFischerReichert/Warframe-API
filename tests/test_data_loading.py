import pytest
import json
import os

def test_syndicate_items_json_loads():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    assert isinstance(data, list) or isinstance(data, dict) 