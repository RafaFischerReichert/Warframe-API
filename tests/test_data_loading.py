import pytest
import json
import os

def test_syndicate_items_json_loads():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    assert isinstance(data, list) or isinstance(data, dict) 
    
def test_malformed_json():
    path = os.path.join('data', 'malformed.json')
    with pytest.raises(json.JSONDecodeError):
        with open(path, 'r', encoding='utf-8') as f:
            json.load(f)
            
def test_empty_json_file():
    path = os.path.join('data', 'empty.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    assert data == {}, "Empty JSON file should load as an empty dict"

def test_truly_empty_file():
    """Test a file that is completely empty (no content at all)"""
    # Create a temporary empty file for this test
    import tempfile
    with tempfile.NamedTemporaryFile(mode='w', delete=False, suffix='.json') as f:
        f.write('')  # Write nothing to make it truly empty
    
    try:
        with pytest.raises(json.JSONDecodeError):
            with open(f.name, 'r', encoding='utf-8') as json_file:
                json.load(json_file)
    finally:
        import os
        os.unlink(f.name)  # Clean up the temporary file
            
def test_missing_json_file():
    path = os.path.join('data', 'missing.json')
    with pytest.raises(FileNotFoundError):
        with open(path, 'r', encoding='utf-8') as f:
            json.load(f)
            
def test_data_loading():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    assert isinstance(data, list) or isinstance(data, dict), "Data should be a list or dict"
    assert len(data) > 0, "Data should not be empty"

def test_validate_data_schema():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Validate schema for each syndicate's items
    for syndicate in data.values():
        assert 'items' in syndicate, "Each syndicate should have an 'items' field"
        for item in syndicate['items']:
            assert 'name' in item, "Each item should have a 'name' field"
            assert isinstance(item['name'], str), "'name' should be a string"
            assert 'type' in item, "Each item should have a 'type' field"
            assert isinstance(item['type'], str), "'type' should be a string"
            assert 'standing_cost' in item, "Each item should have a 'standing_cost' field"
            assert isinstance(item['standing_cost'], int), "'standing_cost' should be an int"

def test_data_integrity():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Check for duplicate item names within each syndicate
    for syndicate in data.values():
        seen_names = set()
        for item in syndicate['items']:
            assert item['name'] not in seen_names, f"Duplicate item name found: {item['name']}"
            seen_names.add(item['name'])
        # Check for required fields
        for item in syndicate['items']:
            assert 'name' in item, "Each item should have a 'name' field"
            assert 'type' in item, "Each item should have a 'type' field"
            assert 'standing_cost' in item, "Each item should have a 'standing_cost' field"

def test_data_consistency():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'r', encoding='utf-8') as f:
        data = json.load(f)
    # Check if all items have consistent structure
    for syndicate in data.values():
        for item in syndicate['items']:
            assert isinstance(item, dict), "Each item should be a dictionary"
            assert 'name' in item, "Each item should have a 'name' field"
            assert 'type' in item, "Each item should have a 'type' field"
            assert 'standing_cost' in item, "Each item should have a 'standing_cost' field"
            assert isinstance(item['name'], str), "'name' should be a string"
            assert isinstance(item['type'], str), "'type' should be a string"
            assert isinstance(item['standing_cost'], int), "'standing_cost' should be an int"

def test_data_file_exists():
    path = os.path.join('data', 'syndicate_items.json')
    assert os.path.exists(path), f"Data file {path} should exist"
    
    # Check if the file is not empty
    assert os.path.getsize(path) > 0, "Data file should not be empty"
    
def test_data_file_encoding():
    path = os.path.join('data', 'syndicate_items.json')
    with open(path, 'rb') as f:
        content = f.read()
    try:
        content.decode('utf-8')
    except UnicodeDecodeError:
        pytest.fail(f"Data file {path} is not valid UTF-8 encoded")
    
    # Check if the file can be read as JSON
    with open(path, 'r', encoding='utf-8') as f:
        json.load(f)  # Should not raise an error
        
def test_data_file_permissions():
    path = os.path.join('data', 'syndicate_items.json')
    assert os.access(path, os.R_OK), f"Data file {path} should be readable"
    
def test_data_file_size():
    path = os.path.join('data', 'syndicate_items.json')
    size = os.path.getsize(path)
    assert size > 0, f"Data file {path} should not be empty (size: {size} bytes)"
    
    # Check if the file size is reasonable (e.g., not too large)
    assert size < 10 * 1024 * 1024, f"Data file {path} should not exceed 10MB (size: {size} bytes)"  # 10MB limit
    
def test_data_file_last_modified():
    path = os.path.join('data', 'syndicate_items.json')
    last_modified = os.path.getmtime(path)
    assert last_modified > 0, f"Data file {path} should have a valid last modified timestamp"
    
    # Check if the file was modified recently (e.g., within the last year)
    import time
    one_year_ago = time.time() - (365 * 24 * 60 * 60)  # One year in seconds
    assert last_modified > one_year_ago, f"Data file {path} should have been modified within the last year"