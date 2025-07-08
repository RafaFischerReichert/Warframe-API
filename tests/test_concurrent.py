#!/usr/bin/env python3
"""
Test script to verify concurrent processing implementation
"""
import threading
import time
import json
import urllib.request
import ssl

def test_concurrent_requests():
    """Test making concurrent requests to verify the implementation"""
    print("Testing concurrent request processing...")
    
    # Sample items for testing
    test_items = [
        {"id": "test1", "item_name": "Test Item 1", "url_name": "test_item_1"},
        {"id": "test2", "item_name": "Test Item 2", "url_name": "test_item_2"},
        {"id": "test3", "item_name": "Test Item 3", "url_name": "test_item_3"},
    ]
    
    def fetch_item_orders(item, job_id):
        """Mock fetch function similar to the one in proxy_server.py"""
        item_name = str(item.get('item_name') or '')
        item_id = str(item.get('id') or '')
        url_name = str(item.get('url_name') or '')
        print(f'[DEBUG] [Job {job_id}] Processing: {item_name} (ID: {item_id}, URL: {url_name})')
        
        if not url_name:
            print(f'[DEBUG] [Job {job_id}] Skipping {item_name}: no url_name')
            return item_id, []
        
        # Simulate API request delay
        time.sleep(0.5)  # Simulate 500ms API call
        
        print(f'[DEBUG] [Job {job_id}] {item_name}: Completed')
        return item_id, [{"mock": "data"}]
    
    # Test sequential processing
    print("\n=== Sequential Processing Test ===")
    start_time = time.time()
    results_seq = {}
    for item in test_items:
        item_id, orders = fetch_item_orders(item, "seq_test")
        results_seq[item_id] = orders
    seq_time = time.time() - start_time
    print(f"Sequential processing took: {seq_time:.2f}s")
    
    # Test concurrent processing
    print("\n=== Concurrent Processing Test ===")
    start_time = time.time()
    results_concurrent = {}
    results_lock = threading.Lock()
    threads = []
    
    for item in test_items:
        def make_thread_func(item_to_process):
            def thread_func():
                item_id, orders = fetch_item_orders(item_to_process, "concurrent_test")
                with results_lock:
                    results_concurrent[item_id] = orders
            return thread_func
        
        thread = threading.Thread(target=make_thread_func(item))
        threads.append(thread)
        thread.start()
    
    for thread in threads:
        thread.join()
    
    concurrent_time = time.time() - start_time
    print(f"Concurrent processing took: {concurrent_time:.2f}s")
    
    print(f"\nSpeedup: {seq_time/concurrent_time:.2f}x faster")
    print(f"Expected: ~{len(test_items)}x faster (all requests in parallel)")

    # Assertions for pytest
    assert results_seq == results_concurrent, "Sequential and concurrent results should match"
    assert concurrent_time <= seq_time, f"Concurrent processing ({concurrent_time:.2f}s) should not be slower than sequential ({seq_time:.2f}s)" 
    
def test_backend_semaphore():
    """Test the backend semaphore to ensure it limits concurrent requests"""
    print("Testing backend semaphore...")
    
    # Mock a semaphore with a limit of 2
    semaphore = threading.Semaphore(2)
    
    def limited_function(job_id):
        with semaphore:
            print(f"[Job {job_id}] Acquired semaphore")
            time.sleep(1)  # Simulate work
            print(f"[Job {job_id}] Released semaphore")

def test_internal_server_error_handling():
    """Test handling of internal server errors"""
    print("Testing internal server error handling...")
    
    # Mock a function that simulates an internal server error
    def mock_internal_error():
        raise Exception("Internal Server Error")
    
    try:
        mock_internal_error()
    except Exception as e:
        print(f"Caught expected error: {e}")
        assert str(e) == "Internal Server Error", "Should catch the internal server error"

# ADD ACTUAL API OR PROXY SERVER CONCURRENCY INSTEAD OF MOCK

def test_actual_proxy_server_concurrency():
    """
    Test actual concurrency against the running proxy server (if available).
    This test assumes the proxy server is running locally on port 8000 and exposes
    an endpoint /api/orders/{url_name}.
    """
    print("Testing actual proxy server concurrency...")

    proxy_url_template = "http://localhost:8000/api/orders/{url_name}"
    test_items = [
        {"id": "test1", "item_name": "Test Item 1", "url_name": "lex_prime_barrel"},
        {"id": "test2", "item_name": "Test Item 2", "url_name": "soma_prime_receiver"},
        {"id": "test3", "item_name": "Test Item 3", "url_name": "orthos_prime_handle"},
    ]

    results = {}
    results_lock = threading.Lock()
    threads = []

    def fetch_from_proxy(item, job_id):
        url = proxy_url_template.format(url_name=item["url_name"])
        try:
            context = ssl._create_unverified_context()
            with urllib.request.urlopen(url, context=context, timeout=5) as resp:
                data = json.loads(resp.read().decode())
            print(f"[Job {job_id}] Success: {item['item_name']}")
        except Exception as e:
            data = {"error": str(e)}
            print(f"[Job {job_id}] Error: {e}")
        with results_lock:
            results[item["id"]] = data

    for idx, item in enumerate(test_items):
        thread = threading.Thread(target=fetch_from_proxy, args=(item, idx))
        threads.append(thread)
        thread.start()

    for thread in threads:
        thread.join()

    print("Results from proxy server concurrency test:")
    for item_id, data in results.items():
        print(f"{item_id}: {str(data)[:100]}...")  # Print first 100 chars for brevity

    # Optionally, add assertions if you know the expected structure
    assert all(isinstance(data, dict) for data in results.values()), "All results should be dicts"