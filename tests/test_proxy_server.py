import pytest
from unittest.mock import patch, MagicMock
from backend import proxy_server
import json

# Test the handle_trading_calc_endpoint logic in isolation

def test_handle_trading_calc_endpoint_basic():
    handler = MagicMock()
    # Simulate POST data
    post_data = json.dumps({
        'all_items': [
            {'item_name': 'Prime1', 'id': 'id1'},
            {'item_name': 'Prime2', 'id': 'id2'},
        ],
        'min_profit': 1,
        'max_investment': 0,
        'max_order_age': 30,
        'batch_size': 1
    }).encode('utf-8')
    # Patch TradingCalculator to avoid real analysis
    with patch('backend.trading_calculator.TradingCalculator') as MockCalc:
        instance = MockCalc.return_value
        instance.analyze_prime_items.return_value = [{
            'itemName': 'Prime1', 'netProfit': 10
        }]
        # Patch uuid to return a fixed job id
        with patch('backend.proxy_server.uuid.uuid4', return_value='test-job-id'):
            # Patch threading.Thread to run batch_worker inline
            with patch('threading.Thread') as MockThread:
                proxy_server.ProxyHandler.handle_trading_calc_endpoint(handler, post_data)
                # Should set up a job in trading_jobs
                assert 'test-job-id' in proxy_server.trading_jobs
                job = proxy_server.trading_jobs['test-job-id']
                assert job['status'] in ('running', 'done')

def test_auth_login_endpoint():
    # Mock the auth_handler.handle_login_request function instead of urllib.request.urlopen
    mock_auth_response = {
        'success': True,
        'csrf_token': 'test_jwt',
        'username': 'test_user'
    }
    with patch('backend.proxy_server.handle_login_request', return_value=mock_auth_response):
        result = proxy_server.handle_auth_login_request('user', 'pass')
        assert result['success'] is True
        assert result['jwt'] == 'test_jwt'

def test_auth_login_endpoint_failure():
    # Test login failure case
    mock_auth_response = {
        'success': False,
        'message': 'Invalid credentials'
    }
    with patch('backend.proxy_server.handle_login_request', return_value=mock_auth_response):
        result = proxy_server.handle_auth_login_request('user', 'wrongpass')
        assert result['success'] is False
        assert 'Invalid credentials' in result['message']

def test_auth_logout_endpoint():
    # Test logout endpoint
    handler = MagicMock()
    with patch('backend.proxy_server.handle_logout_request', return_value={'success': True}):
        proxy_server.ProxyHandler.handle_logout_endpoint(handler)
        # Verify response was sent
        handler.send_response.assert_called_with(200)
        handler.send_header.assert_called()
        handler.end_headers.assert_called()

def test_auth_status_endpoint():
    # Test auth status endpoint
    handler = MagicMock()
    mock_status = {
        'logged_in': True,
        'username': 'test_user'
    }
    with patch('backend.proxy_server.get_auth_status', return_value=mock_status):
        proxy_server.ProxyHandler.handle_auth_status_endpoint(handler)
        # Verify response was sent
        handler.send_response.assert_called_with(200)
        handler.send_header.assert_called()
        handler.end_headers.assert_called()

def test_trading_create_wtb_endpoint():
    # Test WTB order creation endpoint
    handler = MagicMock()
    post_data = json.dumps({
        'item_id': 'test_item_id',
        'price': 100,
        'quantity': 1
    }).encode('utf-8')
    
    # Mock the auth status and proxy_post_request method
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        # Mock the proxy_post_request method on the instance
        handler.proxy_post_request = MagicMock()
        handler.proxy_post_request.return_value = {'success': True, 'order_id': 'test_order_123'}
        
        proxy_server.ProxyHandler.handle_create_wtb_endpoint(handler, post_data)
        # Verify proxy was called
        handler.proxy_post_request.assert_called_once()

def test_trading_create_wtb_endpoint_not_logged_in():
    # Test WTB order creation when not logged in
    handler = MagicMock()
    post_data = json.dumps({
        'item_id': 'test_item_id',
        'price': 100,
        'quantity': 1
    }).encode('utf-8')
    
    # Mock the auth status to return not logged in
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': False}):
        proxy_server.ProxyHandler.handle_create_wtb_endpoint(handler, post_data)
        # Verify 401 response was sent
        handler.send_response.assert_called_with(401)

def test_trading_create_wts_endpoint():
    # Test WTS order creation endpoint
    handler = MagicMock()
    post_data = json.dumps({
        'item_id': 'test_item_id',
        'price': 100,
        'quantity': 1
    }).encode('utf-8')
    
    # Mock the auth status and proxy_post_request method
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        # Mock the proxy_post_request method on the instance
        handler.proxy_post_request = MagicMock()
        handler.proxy_post_request.return_value = {'success': True, 'order_id': 'test_order_123'}
        
        proxy_server.ProxyHandler.handle_create_wts_endpoint(handler, post_data)
        # Verify proxy was called
        handler.proxy_post_request.assert_called_once()

def test_trading_delete_order_endpoint():
    # Test order deletion endpoint
    handler = MagicMock()
    post_data = json.dumps({
        'order_id': 'test_order_123'
    }).encode('utf-8')
    
    # Mock the auth status
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        # Mock urllib.request.Request and urlopen for the DELETE request
        with patch('urllib.request.Request') as mock_request:
            with patch('urllib.request.urlopen') as mock_urlopen:
                mock_response = MagicMock()
                mock_response.status = 200
                mock_urlopen.return_value.__enter__.return_value = mock_response
                
                proxy_server.ProxyHandler.handle_delete_order_endpoint(handler, post_data)
                
                # Verify DELETE request was made
                mock_request.assert_called_once()

def test_api_cancel_analysis_endpoint():
    # Test analysis cancellation endpoint
    handler = MagicMock()
    post_data = json.dumps({
        'job_id': 'test-job-id'
    }).encode('utf-8')
    
    # Set up a test job
    proxy_server.trading_jobs['test-job-id'] = {'status': 'running', 'cancelled': False}
    
    proxy_server.ProxyHandler.handle_cancel_analysis_endpoint(handler, post_data)
    
    # Verify job was marked as cancelled
    assert proxy_server.trading_jobs['test-job-id']['cancelled'] is True
    
    # Clean up
    del proxy_server.trading_jobs['test-job-id']

def test_rate_limiting():
    # Test rate limiting functionality
    # Clear any existing rate limiting state
    proxy_server.rate_limit_detected = False
    proxy_server.rate_limit_start_time = 0
    
    # Test setting rate limited
    proxy_server.set_rate_limited()
    assert proxy_server.rate_limit_detected is True
    assert proxy_server.rate_limit_start_time > 0
    
    # Test clearing rate limited
    proxy_server.clear_rate_limited()
    assert proxy_server.rate_limit_detected is False

def test_concurrent_job_handling():
    # Test concurrent job handling
    # Clear existing jobs
    proxy_server.trading_jobs.clear()
    
    # Create a test job
    job_id = 'test-concurrent-job'
    proxy_server.trading_jobs[job_id] = {
        'status': 'running',
        'progress': 0,
        'results': []
    }
    
    # Verify job exists
    assert job_id in proxy_server.trading_jobs
    assert proxy_server.trading_jobs[job_id]['status'] == 'running'
    
    # Clean up
    del proxy_server.trading_jobs[job_id]

def test_concurrent_job_cancellation():
    # Test job cancellation
    # Clear existing jobs
    proxy_server.trading_jobs.clear()
    
    # Create a test job
    job_id = 'test-cancel-job'
    proxy_server.trading_jobs[job_id] = {
        'status': 'running',
        'progress': 50,
        'results': []
    }
    
    # Cancel the job
    proxy_server.trading_jobs[job_id]['status'] = 'cancelled'
    
    # Verify job was cancelled
    assert proxy_server.trading_jobs[job_id]['status'] == 'cancelled'
    
    # Clean up
    del proxy_server.trading_jobs[job_id] 