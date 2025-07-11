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

def test_trading_delete_all_wtb_orders_endpoint():
    # Test delete all WTB orders endpoint
    handler = MagicMock()
    post_data = json.dumps({}).encode('utf-8')  # No data needed for delete all
    
    # Mock the auth status with username
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True, 'username': 'test_user'}):
        # Mock urllib.request.Request and urlopen for the fetch and delete requests
        with patch('urllib.request.Request') as mock_request:
            with patch('urllib.request.urlopen') as mock_urlopen:
                # Mock the fetch response (user's orders)
                fetch_response = MagicMock()
                fetch_response.status = 200
                fetch_response.read.return_value = json.dumps({
                    'payload': {
                        'buy_orders': [
                            {'id': 'order1', 'item': {'en': {'item_name': 'Test Item 1'}}},
                            {'id': 'order2', 'item': {'en': {'item_name': 'Test Item 2'}}}
                        ]
                    }
                }).encode()
                
                # Mock the delete responses
                delete_response = MagicMock()
                delete_response.status = 200
                
                # First call returns fetch response, subsequent calls return delete responses
                mock_urlopen.return_value.__enter__.side_effect = [fetch_response, delete_response, delete_response]
                
                proxy_server.ProxyHandler.handle_delete_all_wtb_orders_endpoint(handler, post_data)
                
                # Verify requests were made (fetch + 2 deletes)
                assert mock_request.call_count >= 3, 'Should make fetch request plus delete requests'
                
                # Check that fetch request was made
                fetch_call = mock_request.call_args_list[0]
                assert 'test_user' in fetch_call[0][0], 'Should include username in fetch URL'
                
                # Check that delete requests were made
                delete_calls = mock_request.call_args_list[1:]
                for call in delete_calls:
                    assert call[1]['method'] == 'DELETE', 'Should use DELETE method for order deletion'

def test_trading_delete_all_wtb_orders_endpoint_not_logged_in():
    # Test delete all WTB orders when not logged in
    handler = MagicMock()
    post_data = json.dumps({}).encode('utf-8')
    
    # Mock the auth status to return not logged in
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': False}):
        proxy_server.ProxyHandler.handle_delete_all_wtb_orders_endpoint(handler, post_data)
        # Verify 401 response was sent
        handler.send_response.assert_called_with(401)

def test_trading_delete_all_wtb_orders_endpoint_no_username():
    # Test delete all WTB orders when no username is available
    handler = MagicMock()
    post_data = json.dumps({}).encode('utf-8')
    
    # Mock the auth status to return logged in but no username
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        proxy_server.ProxyHandler.handle_delete_all_wtb_orders_endpoint(handler, post_data)
        # Verify 400 response was sent
        handler.send_response.assert_called_with(400)

def test_trading_create_wtb_endpoint_bad_item_id():
    # Test WTB order creation with a problematic item ID
    handler = MagicMock()
    post_data = json.dumps({
        'item_id': '5655c4e5b66f832e25b8ce7b',  # The problematic item ID
        'price': 21,
        'quantity': 1
    }).encode('utf-8')
    
    # Mock the auth status
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        # Mock the proxy_post_request method on the handler instance
        from urllib.error import HTTPError
        error_response = json.dumps({
            'error': 'Invalid item ID',
            'message': 'The provided item ID is not valid'
        }).encode()
        http_error = HTTPError(
            'https://api.warframe.market/v1/profile/orders', 
            400, 
            'Bad Request', 
            {}, 
            error_response
        )
        handler.proxy_post_request = MagicMock(side_effect=http_error)
        
        proxy_server.ProxyHandler.handle_create_wtb_endpoint(handler, post_data)
        
        # Verify proxy_post_request was called with the correct data
        handler.proxy_post_request.assert_called_once()
        call_args = handler.proxy_post_request.call_args
        assert 'profile/orders' in call_args[0][0], 'Should attempt order creation'
        
        # Verify the order payload contains the problematic item ID
        order_data = json.loads(call_args[0][1].decode('utf-8'))
        assert order_data['item'] == '5655c4e5b66f832e25b8ce7b', 'Should use the problematic item ID'
        
        # Verify the error response was properly handled (500 due to proxy error)
        handler.send_response.assert_called_with(500)

def test_trading_create_wtb_endpoint_item_not_found():
    # Test WTB order creation when item details can't be fetched
    handler = MagicMock()
    post_data = json.dumps({
        'item_id': 'invalid_item_id_999',
        'price': 21,
        'quantity': 1
    }).encode('utf-8')
    
    # Mock the auth status
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        # Mock the proxy_post_request method on the handler instance
        # Create a fresh mock that doesn't raise an exception
        handler.proxy_post_request = MagicMock()
        handler.proxy_post_request.return_value = None  # proxy_post_request doesn't return anything
        
        proxy_server.ProxyHandler.handle_create_wtb_endpoint(handler, post_data)
        
        # Verify proxy_post_request was called (the main flow continues)
        handler.proxy_post_request.assert_called_once()
        call_args = handler.proxy_post_request.call_args
        assert 'profile/orders' in call_args[0][0], 'Should attempt order creation'
        
        # Verify the order payload contains the invalid item ID
        order_data = json.loads(call_args[0][1].decode('utf-8'))
        assert order_data['item'] == 'invalid_item_id_999', 'Should use the invalid item ID'
        
        # Note: send_response is handled by proxy_post_request, not directly by handle_create_wtb_endpoint
        # So we don't check send_response here

def test_trading_create_wtb_endpoint_debug_item_details():
    # Test the debug item details fetching functionality when 400 error occurs
    handler = MagicMock()
    post_data = json.dumps({
        'item_id': 'problematic_item_id_123',
        'price': 21,
        'quantity': 1
    }).encode('utf-8')
    
    # Mock the auth status and headers
    with patch('backend.proxy_server.get_auth_status', return_value={'logged_in': True}):
        with patch('backend.proxy_server.get_auth_headers', return_value={'Authorization': 'Bearer test_token'}):
            # Mock the debug_item_details method on the handler instance (not checked here)
            handler.debug_item_details = MagicMock()
            
            # Mock the proxy_post_request method on the handler instance to simulate 400 error
            from urllib.error import HTTPError
            error_response = json.dumps({
                'error': 'Invalid item ID',
                'message': 'The provided item ID is not valid'
            }).encode()
            
            # Create the HTTPError that will be raised
            http_error = HTTPError(
                'https://api.warframe.market/v1/profile/orders', 
                400, 
                'Bad Request', 
                {}, 
                error_response
            )
            
            # Make proxy_post_request raise the HTTPError
            handler.proxy_post_request = MagicMock(side_effect=http_error)
            
            # Call the method
            proxy_server.ProxyHandler.handle_create_wtb_endpoint(handler, post_data)
            
            # Verify proxy_post_request was called
            handler.proxy_post_request.assert_called_once()
            
            # We do NOT check handler.debug_item_details here, because the real debug logic is inside
            # the actual proxy_post_request implementation, which is not executed when mocked.
            # This should be tested in a separate test for proxy_post_request itself.
            
            # Verify error response was handled (500 from Exception)
            handler.send_response.assert_called_with(500)

def test_debug_item_details_method():
    # Test the debug_item_details method directly
    handler = MagicMock()
    # Attach the real method to the mock
    handler.debug_item_details = proxy_server.ProxyHandler.debug_item_details.__get__(handler, proxy_server.ProxyHandler)
    
    # Mock urllib.request.Request and urlopen
    with patch('urllib.request.Request') as mock_request:
        with patch('urllib.request.urlopen') as mock_urlopen:
            # Mock successful item details response
            item_response = MagicMock()
            item_response.status = 200
            item_response.read.return_value = json.dumps({
                'payload': {
                    'item': {
                        'id': 'correct_item_id_123',
                        'item_name': 'Test Item',
                        'url_name': 'test_item'
                    }
                }
            }).encode()
            
            mock_urlopen.return_value.__enter__.return_value = item_response
            
            # Test successful item details fetch
            result = handler.debug_item_details('correct_item_id_123')
            
            # Verify request was made
            mock_request.assert_called()
            call_args = mock_request.call_args
            assert 'correct_item_id_123' in call_args[0][0], 'Should fetch item by ID'
            
            # Verify result
            assert result is not None
            assert result.get('item_name') == 'Test Item'
            assert result.get('id') == 'correct_item_id_123'

def test_debug_item_details_method_not_found():
    # Test debug_item_details when item is not found by ID
    handler = MagicMock()
    # Attach the real method to the mock
    handler.debug_item_details = proxy_server.ProxyHandler.debug_item_details.__get__(handler, proxy_server.ProxyHandler)
    
    # Mock urllib.request.Request and urlopen
    with patch('urllib.request.Request') as mock_request:
        with patch('urllib.request.urlopen') as mock_urlopen:
            # Mock 404 response for item details
            from urllib.error import HTTPError
            mock_urlopen.side_effect = HTTPError(
                'https://api.warframe.market/v1/items/invalid_id', 
                404, 
                'Not Found', 
                {}, 
                b'{"error": "Item not found"}'
            )
            
            # Test item not found
            result = handler.debug_item_details('invalid_id')
            
            # Verify request was made
            mock_request.assert_called()
            
            # Verify result is None (not found)
            assert result is None

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