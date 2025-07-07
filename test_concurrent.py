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
    
    return results_seq, results_concurrent

if __name__ == "__main__":
    test_concurrent_requests() 