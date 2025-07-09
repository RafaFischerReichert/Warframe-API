import json
import pytest
from unittest.mock import patch, MagicMock
from backend import auth_handler
import io

# Example: test a login or token validation function
# Adjust function names as needed for your codebase

def test_dummy_login():
    # Mock the network calls inside handle_login_request (two calls: /auth and /auth/signin)
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc; Path=/;']
    # First call: /auth (get JWT)
    mock_response_auth = MagicMock()
    mock_response_auth.read.return_value = b''
    mock_response_auth.status = 200
    mock_response_auth.headers = mock_headers
    mock_response_auth.__enter__.return_value = mock_response_auth  # Ensure context manager works
    # Second call: /auth/signin (login)
    mock_response_signin = MagicMock()
    mock_response_signin.read.return_value = b'{"success": true, "payload": {"user": {"ingame_name": "dummyuser"}}}'
    mock_response_signin.status = 200
    mock_response_signin.headers = mock_headers
    mock_response_signin.__enter__.return_value = mock_response_signin  # Ensure context manager works
    with patch('urllib.request.urlopen', side_effect=[mock_response_auth, mock_response_signin]):
        result = auth_handler.handle_login_request('dummyuser', 'dummypass')
        assert result['success'] is True
        assert 'csrf_token' in result
        assert 'username' in result
        
        
class MockHTTPResponse:
    def __init__(self, status=200, headers=None, data=None):
        self.status = status
        self._headers = headers or {}
        self._data = data or b''
    def read(self):
        return self._data
    @property
    def headers(self):
        return self._headers
    def __enter__(self):
        return self
    def __exit__(self, exc_type, exc_val, exc_tb):
        pass


def test_handle_login_request_success():
    # Mock the response to /auth/signin
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc; Path=/;']
    response_json = b'{"success": true}'
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=response_json)
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'pass')
        assert result['success']


def test_handle_login_request_failure():
    # Mock a 200 response but no JWT in Set-Cookie
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = []
    response_json = b'{"success": false}'
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=response_json)
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'wrongpass')
        assert not result['success']


def test_bad_json():
    # Mock a response with malformed JSON
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc; Path=/;']
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=b'{"success": true,')
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'pass')
        assert not result['success']
        assert 'Login error:' in result['message']

def test_missing_fields():
    # Mock a response with missing fields in JSON
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc; Path=/;']
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=b'{"success": true, "payload": {"user": {"ingame_name": "testuser"}}}')
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'pass')
        assert result['success'] is True
        assert 'csrf_token' in result
        assert 'username' in result

def test_network_errors():
    # Mock a network error during the request
    with patch('urllib.request.urlopen', side_effect=Exception("Network error")):
        result = auth_handler.handle_login_request('user', 'pass')
        assert not result['success']
        assert "Network error" in result['message']
        
def test_bad_jwt():
    # Mock a response with a bad JWT
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=bad_jwt; Path=/;']
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=b'{"success": true, "payload": {"user": {"ingame_name": "testuser"}}}')
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'pass')
        assert result['success'] is True  # The function accepts any JWT token
    
def test_logout():
    # Test the logout function
    result = auth_handler.handle_logout_request()
    assert result['success'] is True
    assert 'Logged out successfully' in result['message']

def test_token_refresh():
    # Mock being logged in first
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=True):
        with patch('backend.auth_handler.auth_instance.csrf_token', 'test_token'):
            result = auth_handler.handle_token_refresh()
            assert result['success'] is True
            assert 'refreshed' in result['message'].lower()
            assert result['csrf_token'] == 'test_token'

def test_token_refresh_not_logged_in():
    # Test token refresh when not logged in
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=False):
        result = auth_handler.handle_token_refresh()
        assert not result['success']
        assert 'Not logged in' in result['message']

def test_session_expired():
    # Test session expired function
    result = auth_handler.handle_session_expired()
    assert result['success'] is True
    assert 'Session expired' in result['message']

def test_malformed_response():
    # Mock a response with malformed JSON
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc; Path=/;']
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=b'{"success": true, "payload": ')
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'pass')
        assert not result['success']
        assert 'Login error:' in result['message']
        
def test_http_errors():
    # Mock an HTTP error response
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = []
    mock_response = MockHTTPResponse(status=404, headers=mock_headers, data=b'{"error": {"message": "Not Found"}}')
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user', 'pass')
        assert not result['success']
        assert "Not Found" in result['message']

def test_auth_status_logged_in():
    # Test auth status when logged in
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=True):
        with patch('backend.auth_handler.auth_instance.csrf_token', 'test_token'):
            with patch('backend.auth_handler.auth_instance.last_login_time', 1000):
                with patch('backend.auth_handler.auth_instance.username', 'testuser'):
                    status = auth_handler.get_auth_status()
                    assert status['logged_in'] is True
                    assert status['has_csrf_token'] is True
                    assert status['username'] == 'testuser'

def test_auth_status_logged_out():
    # Test auth status when logged out
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=False):
        with patch('backend.auth_handler.auth_instance.csrf_token', None):
            with patch('backend.auth_handler.auth_instance.last_login_time', 0):
                with patch('backend.auth_handler.auth_instance.username', None):
                    status = auth_handler.get_auth_status()
                    assert not status['logged_in']
                    assert not status['has_csrf_token']
                    assert status['username'] is None

def test_get_auth_headers_logged_in():
    # Test getting auth headers when logged in
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=True):
        with patch('backend.auth_handler.auth_instance.csrf_token', 'test_token'):
            headers = auth_handler.get_auth_headers()
            assert headers is not None
            assert headers['Authorization'] == 'Bearer test_token'
            assert headers['X-CSRF-Token'] == 'test_token'

def test_get_auth_headers_logged_out():
    # Test getting auth headers when logged out
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=False):
        headers = auth_handler.get_auth_headers()
        assert headers is None

def test_get_session_cookies_logged_in():
    # Test getting session cookies when logged in
    mock_cookies = MagicMock()
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=True):
        with patch('backend.auth_handler.auth_instance.session_cookies', mock_cookies):
            cookies = auth_handler.get_session_cookies()
            assert cookies == mock_cookies

def test_get_session_cookies_logged_out():
    # Test getting session cookies when logged out
    with patch('backend.auth_handler.auth_instance.is_logged_in', return_value=False):
        cookies = auth_handler.get_session_cookies()
        assert cookies is None

def test_login_success_with_username():
    # Mock a successful login response with username
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc123; Path=/;']
    response_data = b'{"success": true, "payload": {"user": {"ingame_name": "testuser"}}}'
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=response_data)
    
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user@example.com', 'password')
        assert result['success'] is True
        assert result['csrf_token'] == 'abc123'
        assert result['username'] == 'testuser'
        assert 'Login successful' in result['message']

def test_login_success_with_slug():
    # Mock a successful login response with slug instead of ingame_name
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = ['JWT=abc123; Path=/;']
    response_data = b'{"success": true, "payload": {"user": {"slug": "testuser"}}}'
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=response_data)
    
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user@example.com', 'password')
        assert result['success'] is True
        assert result['csrf_token'] == 'abc123'
        assert result['username'] == 'testuser'
        assert 'Login successful' in result['message']

def test_login_no_jwt_token():
    # Mock a response without JWT token
    mock_headers = MagicMock()
    mock_headers.get_all.return_value = []
    response_data = b'{"success": true, "payload": {"user": {"ingame_name": "testuser"}}}'
    mock_response = MockHTTPResponse(status=200, headers=mock_headers, data=response_data)
    
    with patch('urllib.request.urlopen', return_value=mock_response):
        result = auth_handler.handle_login_request('user@example.com', 'password')
        assert not result['success']
        assert 'No JWT token found' in result['message']