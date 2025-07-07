#!/usr/bin/env python3
"""
Simple proxy server to handle CORS for Warframe Market API
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.parse
import json
import ssl
import threading
import time
import os
import base64
import urllib.error
import http.cookiejar
from auth_handler import handle_login_request, handle_logout_request, get_auth_status, get_auth_headers, get_session_cookies

# ===== CONFIGURATION =====
REQUESTS_PER_SECOND = 5  # Change from 3 to 5
# ========================

# Rate limiting detection
rate_limit_detected = False
rate_limit_start_time = 0
rate_limit_lock = threading.Lock()

# Semaphore for concurrent requests (max = REQUESTS_PER_SECOND * 2)
concurrent_semaphore = threading.Semaphore(REQUESTS_PER_SECOND * 2)
# List to track timestamps of last requests for rate limiting
request_timestamps = []  # stores timestamps of last requests
RATE_LIMIT = REQUESTS_PER_SECOND  # max requests
RATE_PERIOD = 1.0  # per second

def get_rate_limit_status():
    """Get current rate limiting status"""
    global rate_limit_detected, rate_limit_start_time
    with rate_limit_lock:
        if rate_limit_detected:
            elapsed = time.time() - rate_limit_start_time
            return {
                "rate_limited": True,
                "elapsed_seconds": elapsed,
                "estimated_wait": max(0, 60 - elapsed)  # Assume 60 second cooldown
            }
        else:
            return {
                "rate_limited": False,
                "elapsed_seconds": 0,
                "estimated_wait": 0
            }

def set_rate_limited():
    """Mark that we've been rate limited"""
    global rate_limit_detected, rate_limit_start_time
    with rate_limit_lock:
        rate_limit_detected = True
        rate_limit_start_time = time.time()
        print(f"[RATE LIMIT] Rate limiting detected at {time.strftime('%H:%M:%S')}")

def clear_rate_limited():
    """Clear rate limiting status"""
    global rate_limit_detected
    with rate_limit_lock:
        if rate_limit_detected:
            print(f"[RATE LIMIT] Rate limiting cleared at {time.strftime('%H:%M:%S')}")
        rate_limit_detected = False

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        print(f"Received GET request for path: {self.path}")
        
        # Handle authentication endpoints
        if self.path == '/auth/status':
            self.handle_auth_status_endpoint()
            return
        
        # Handle rate limit status endpoint
        if self.path == '/rate-limit-status':
            self.handle_rate_limit_status_endpoint()
            return
        
        # Handle trading workflow endpoints (POST only)
        if self.path == '/trading/create-wtb':
            self.send_response(405)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Method not allowed'})
            self.wfile.write(error_response.encode())
            return
        
        if self.path == '/trading/create-wts':
            self.send_response(405)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Method not allowed'})
            self.wfile.write(error_response.encode())
            return
        
        if self.path == '/trading/delete-order':
            self.send_response(405)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Method not allowed'})
            self.wfile.write(error_response.encode())
            return
        
        if self.path.startswith('/api/'):
            # Proxy the request to Warframe Market API
            api_path = self.path[5:]  # Remove '/api/' prefix
            if not api_path.startswith('/'):
                api_path = '/' + api_path
            api_url = f'https://api.warframe.market/v1{api_path}'
            
            print(f"Proxying GET request: {self.path} -> {api_url}")
            
            try:
                # Acquire concurrency semaphore
                with concurrent_semaphore:
                    # Rate limiting
                    while True:
                        with rate_limit_lock:
                            now = time.time()
                            # Remove timestamps older than RATE_PERIOD
                            while request_timestamps and now - request_timestamps[0] > RATE_PERIOD:
                                request_timestamps.pop(0)
                            if len(request_timestamps) < RATE_LIMIT:
                                request_timestamps.append(now)
                                break
                        time.sleep(0.05)  # Wait a bit before retrying
                    
                    # Create context to ignore SSL certificate verification
                    context = ssl.create_default_context()
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    
                    # Make request to Warframe Market API
                    req = urllib.request.Request(api_url)
                    req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
                    
                    # Add Authorization header if present
                    auth_header = self.headers.get('Authorization')
                    if auth_header:
                        req.add_header('Authorization', auth_header)
                    else:
                        # Try to get auth headers from our auth handler
                        auth_headers = get_auth_headers()
                        if auth_headers:
                            for key, value in auth_headers.items():
                                req.add_header(key, value)
                    
                    with urllib.request.urlopen(req, context=context) as response:
                        data = response.read()
                        content_type = response.headers.get('Content-Type', 'application/json')
                        
                        # Check for rate limiting
                        if response.status == 429:
                            set_rate_limited()
                            print(f"[RATE LIMIT] HTTP 429 detected for {api_url}")
                        elif response.status == 200:
                            # Clear rate limiting if we get a successful response
                            clear_rate_limited()
                        
                        print(f"API response: status={response.status}, content-type={content_type}, data_length={len(data)}")
                        print(f"First 100 chars of response: {data[:100]}")
                        
                        # Send response with CORS headers and original status code
                        self.send_response(response.status)
                        self.send_header('Access-Control-Allow-Origin', '*')
                        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                        self.send_header('Content-Type', content_type)
                        self.send_header('Content-Length', str(len(data)))
                        self.end_headers()
                        self.wfile.write(data)
                    
            except Exception as e:
                print(f"Error proxying request: {e}")
                
                # Check for rate limiting in error message
                if "429" in str(e) or "Too Many Requests" in str(e):
                    set_rate_limited()
                    print(f"[RATE LIMIT] Rate limiting detected via error: {e}")
                
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'error': f'Proxy error: {str(e)}'})
                self.wfile.write(error_response.encode())
        else:
            print(f"Serving static file: {self.path}")
            # Serve static files
            try:
                if self.path == '/':
                    self.path = '/trading-calculator.html'
                
                # Serve files from frontend or data directory
                if self.path.startswith('/js/') or self.path.startswith('/css/') or self.path.endswith('.html') or self.path == '/trading-calculator.html' or self.path == '/login.html' or self.path == '/index.html':
                    file_path = './frontend' + self.path
                elif self.path == '/syndicate_items.json':
                    file_path = './data/syndicate_items.json'
                else:
                    # fallback to frontend for any other static
                    file_path = './frontend' + self.path
                with open(file_path, 'rb') as f:
                    content = f.read()
                
                # Determine content type
                if self.path.endswith('.html'):
                    content_type = 'text/html'
                elif self.path.endswith('.css'):
                    content_type = 'text/css'
                elif self.path.endswith('.js'):
                    content_type = 'application/javascript'
                else:
                    content_type = 'text/plain'
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                
            except FileNotFoundError:
                self.send_response(404)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(b'File not found')
            except Exception as e:
                self.send_response(500)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'text/plain')
                self.end_headers()
                self.wfile.write(f'Server error: {str(e)}'.encode())

    def do_POST(self):
        print(f"Received POST request for path: {self.path}")
        
        # Get request body
        content_length = int(self.headers.get('Content-Length', 0))
        post_data = self.rfile.read(content_length)
        
        # Handle authentication endpoints
        if self.path == '/auth/login':
            self.handle_login_endpoint(post_data)
            return
        elif self.path == '/auth/logout':
            self.handle_logout_endpoint()
            return
        elif self.path == '/auth/status':
            self.handle_auth_status_endpoint()
            return
        
        # Handle trading workflow endpoints
        elif self.path == '/trading/create-wtb':
            self.handle_create_wtb_endpoint(post_data)
            return
        elif self.path == '/trading/create-wts':
            self.handle_create_wts_endpoint(post_data)
            return
        elif self.path == '/trading/delete-order':
            self.handle_delete_order_endpoint(post_data)
            return
        
        if self.path.startswith('/api/'):
            # Proxy POST requests to Warframe Market API
            api_path = self.path[5:]  # Remove '/api/' prefix
            if not api_path.startswith('/'):
                api_path = '/' + api_path
            api_url = f'https://api.warframe.market/v1{api_path}'
            
            print(f"Proxying POST request: {self.path} -> {api_url}")
            self.proxy_post_request(api_url, post_data)
        else:
            self.send_response(404)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'error': 'Endpoint not found'})
            self.wfile.write(error_response.encode())

    def proxy_post_request(self, api_url, post_data):
        """Proxy POST requests to Warframe Market API"""
        try:
            # Acquire concurrency semaphore
            with concurrent_semaphore:
                # Rate limiting
                while True:
                    with rate_limit_lock:
                        now = time.time()
                        while request_timestamps and now - request_timestamps[0] > RATE_PERIOD:
                            request_timestamps.pop(0)
                        if len(request_timestamps) < RATE_LIMIT:
                            request_timestamps.append(now)
                            break
                    time.sleep(0.05)
                
                context = ssl.create_default_context()
                context.check_hostname = False
                context.verify_mode = ssl.CERT_NONE
                
                req = urllib.request.Request(api_url, data=post_data)
                req.add_header('Content-Type', 'application/json')
                req.add_header('Accept', 'application/json')
                req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
                
                # Add Authorization header if present
                auth_header = self.headers.get('Authorization')
                if auth_header:
                    req.add_header('Authorization', auth_header)
                else:
                    # Try to get auth headers from our auth handler
                    auth_headers = get_auth_headers()
                    jwt_token = None
                    if auth_headers:
                        for key, value in auth_headers.items():
                            req.add_header(key, value)
                            if key.lower() == 'authorization' and value.lower().startswith('bearer '):
                                jwt_token = value[7:]
                        # Also add JWT as a cookie if available
                        if jwt_token:
                            req.add_header('Cookie', f'JWT={jwt_token}')
                            print(f"[DEBUG] Added Cookie header: JWT={jwt_token}")
                    else:
                        print("[DEBUG] No auth headers available for POST request.")
                
                # Debug: print outgoing request details
                print(f"[DEBUG] Proxying POST to {api_url}")
                print(f"[DEBUG] Request headers:")
                for header, value in req.header_items():
                    print(f"    {header}: {value}")
                print(f"[DEBUG] Request payload: {post_data}")
                
                with urllib.request.urlopen(req, context=context) as response:
                    data = response.read()
                    content_type = response.headers.get('Content-Type', 'application/json')
                    
                    # Check for rate limiting
                    if response.status == 429:
                        set_rate_limited()
                        print(f"[RATE LIMIT] HTTP 429 detected for {api_url}")
                    elif response.status == 200:
                        # Clear rate limiting if we get a successful response
                        clear_rate_limited()
                    
                    # Transform the response for order creation endpoints
                    if '/profile/orders' in api_url and response.status == 200:
                        try:
                            api_response = json.loads(data.decode('utf-8'))
                            # Transform to frontend-expected format
                            transformed_response = {
                                'success': True,
                                'order_id': api_response.get('payload', {}).get('order', {}).get('id'),
                                'message': 'Order created successfully'
                            }
                            data = json.dumps(transformed_response).encode()
                            content_type = 'application/json'
                            print(f"[DEBUG] Transformed response: {transformed_response}")
                        except Exception as e:
                            print(f"[DEBUG] Failed to transform response: {e}")
                    
                    self.send_response(response.status)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
                    self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                    self.send_header('Content-Type', content_type)
                    self.send_header('Content-Length', str(len(data)))
                    self.end_headers()
                    self.wfile.write(data)
                    
        except Exception as e:
            print(f"Error proxying POST request: {e}")
            
            # Check for rate limiting in error message
            if "429" in str(e) or "Too Many Requests" in str(e):
                set_rate_limited()
                print(f"[RATE LIMIT] Rate limiting detected via POST error: {e}")
            
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'error': f'Proxy error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_login_endpoint(self, post_data):
        """Handle login requests"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            email = data.get('email', '')
            password = data.get('password', '')
            
            if not email or not password:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Email and password are required'})
                self.wfile.write(error_response.encode())
                return
            
            result = handle_login_request(email, password)
            
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Invalid JSON data'})
            self.wfile.write(error_response.encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_logout_endpoint(self):
        """Handle logout requests"""
        try:
            result = handle_logout_request()
            
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_auth_status_endpoint(self):
        """Handle authentication status requests"""
        try:
            result = get_auth_status()
            
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_rate_limit_status_endpoint(self):
        """Handle rate limit status requests"""
        try:
            result = get_rate_limit_status()
            
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(result).encode())
            
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_create_wtb_endpoint(self, post_data):
        """Handle creating WTB orders"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            print(f"[DEBUG] Received WTB order data: {data}")
            item_id = data.get('item_id', '')
            price = data.get('price', 0)
            quantity = data.get('quantity', 1)
            
            if not item_id or price <= 0:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Item ID and valid price are required'})
                self.wfile.write(error_response.encode())
                return
            
            # Check if user is logged in
            auth_status = get_auth_status()
            if not auth_status.get('logged_in'):
                self.send_response(401)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Must be logged in to create orders'})
                self.wfile.write(error_response.encode())
                return
            
            # Create WTB order via Warframe Market API
            order_data = {
                "item": item_id,  # This should be the item's ObjectId
                "order_type": "buy",
                "platinum": price,
                "quantity": quantity,
                "visible": True
            }
            print(f"[DEBUG] Order payload: {order_data}")
            
            # Proxy to Warframe Market API
            api_url = 'https://api.warframe.market/v1/profile/orders'
            self.proxy_post_request(api_url, json.dumps(order_data).encode())
            
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Invalid JSON data'})
            self.wfile.write(error_response.encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_create_wts_endpoint(self, post_data):
        """Handle creating WTS orders"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            item_id = data.get('item_id', '')
            price = data.get('price', 0)
            quantity = data.get('quantity', 1)
            
            if not item_id or price <= 0:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Item ID and valid price are required'})
                self.wfile.write(error_response.encode())
                return
            
            # Check if user is logged in
            auth_status = get_auth_status()
            if not auth_status.get('logged_in'):
                self.send_response(401)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Must be logged in to create orders'})
                self.wfile.write(error_response.encode())
                return
            
            # Create WTS order via Warframe Market API
            order_data = {
                "item": item_id,  # This should be the item's ObjectId
                "order_type": "sell",
                "platinum": price,
                "quantity": quantity,
                "visible": True
            }
            
            # Proxy to Warframe Market API
            api_url = 'https://api.warframe.market/v1/profile/orders'
            self.proxy_post_request(api_url, json.dumps(order_data).encode())
            
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Invalid JSON data'})
            self.wfile.write(error_response.encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_delete_order_endpoint(self, post_data):
        """Handle deleting orders"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            print(f"[DEBUG] Received delete order data: {data}")
            order_id = data.get('order_id', '')
            
            if not order_id:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Order ID is required'})
                self.wfile.write(error_response.encode())
                return
            
            # Check if user is logged in
            auth_status = get_auth_status()
            if not auth_status.get('logged_in'):
                self.send_response(401)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Must be logged in to delete orders'})
                self.wfile.write(error_response.encode())
                return
            
            # Delete order via Warframe Market API
            api_url = f'https://api.warframe.market/v1/profile/orders/{order_id}'
            print(f"[DEBUG] Deleting order at URL: {api_url}")
            
            # Use DELETE method
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            req = urllib.request.Request(api_url, method='DELETE')
            req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
            
            # Debug: print outgoing request details
            print(f"[DEBUG] DELETE request headers:")
            for header, value in req.header_items():
                print(f"    {header}: {value}")
            
            # Add auth headers
            auth_headers = get_auth_headers()
            jwt_token = None
            if auth_headers:
                for key, value in auth_headers.items():
                    req.add_header(key, value)
                    if key.lower() == 'authorization' and value.lower().startswith('bearer '):
                        jwt_token = value[7:]
                # Also add JWT as a cookie if available
                if jwt_token:
                    req.add_header('Cookie', f'JWT={jwt_token}')
                    print(f"[DEBUG] Added Cookie header for delete: JWT={jwt_token}")
            else:
                print("[DEBUG] No auth headers available for DELETE request.")
            
            with urllib.request.urlopen(req, context=context) as response:
                data = response.read()
                content_type = response.headers.get('Content-Type', 'application/json')
                
                # Transform the response for delete endpoints
                if response.status == 200:
                    try:
                        # For successful deletes, return frontend-expected format
                        transformed_response = {
                            'success': True,
                            'message': 'Order deleted successfully'
                        }
                        data = json.dumps(transformed_response).encode()
                        content_type = 'application/json'
                        print(f"[DEBUG] Delete response transformed: {transformed_response}")
                    except Exception as e:
                        print(f"[DEBUG] Failed to transform delete response: {e}")
                
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, DELETE')
                self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
                self.send_header('Content-Type', content_type)
                self.send_header('Content-Length', str(len(data)))
                self.end_headers()
                self.wfile.write(data)
            
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Invalid JSON data'})
            self.wfile.write(error_response.encode())
        except Exception as e:
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Server error: {str(e)}'})
            self.wfile.write(error_response.encode())

    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

def run_server(port=8000):
    server_address = ('', port)
    httpd = ThreadingHTTPServer(server_address, ProxyHandler)
    print(f"Proxy server running on http://localhost:{port}")
    print("This server handles CORS and proxies requests to Warframe Market API")
    print("Press Ctrl+C to stop the server")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print("\nShutting down server...")
        httpd.shutdown()

if __name__ == '__main__':
    run_server() 