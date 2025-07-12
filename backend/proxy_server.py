#!/usr/bin/env python3
"""
Simple proxy server to handle CORS for Warframe Market API
"""
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
import urllib.request
import urllib.error
from urllib.parse import urlparse, parse_qs
import json
import ssl
import threading
import time
from backend.auth_handler import handle_login_request, handle_logout_request, get_auth_status, get_auth_headers
import uuid
from .trading_calculator import TradingCalculator
import urllib.request
import traceback
from backend.wtb_metadata_store import set_order_metadata, get_all_metadata_for_user, delete_order_metadata, delete_all_metadata_for_user

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

# Global cancellation flag for trading analysis
trading_analysis_cancelled = False

# In-memory job store for batch processing
trading_jobs = {}
trading_jobs_lock = threading.Lock()

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
        
def handle_auth_login_request(username: str, password: str) -> dict:
    """
    Handle authentication login request
    
    Args:
        username: The username/email for login
        password: The password for login
        
    Returns:
        dict: Response with success status and JWT token if successful
    """
    try:
        # Use the existing auth handler to perform the login
        result = handle_login_request(username, password)
        
        # If login was successful, extract the JWT token
        if result.get('success'):
            jwt_token = result.get('csrf_token')  # The auth handler stores JWT as csrf_token
            return {
                'success': True,
                'jwt': jwt_token
            }
        else:
            return {
                'success': False,
                'message': result.get('message', 'Login failed')
            }
            
    except Exception as e:
        return {
            'success': False,
            'message': f'Login error: {str(e)}'
        }

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        print(f"Received GET request for path: {self.path}")
        
        # New: Handle fetching user's current WTB orders
        if self.path == '/trading/my-wtb-orders':
            self.handle_my_wtb_orders_endpoint()
            return
        
        # Handle trading analysis progress polling endpoint FIRST
        if self.path.startswith('/api/trading-calc-progress'):
            self.handle_trading_calc_progress()
            return
        
        # Handle authentication endpoints
        if self.path == '/auth/status':
            self.handle_auth_status_endpoint()
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
                elif self.path == '/data/syndicate_items.json':
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
        elif self.path == '/trading/delete-all-wtb-orders':
            self.handle_delete_all_wtb_orders_endpoint(post_data)
            return
        
        # Trading calculator endpoint
        elif self.path == '/api/trading-calc':
            self.handle_trading_calc_endpoint(post_data)
            return
        # Trading analysis cancel endpoint
        elif self.path == '/api/cancel-analysis':
            self.handle_cancel_analysis_endpoint(post_data)
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
                # print(f"[DEBUG] Request headers:")
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
                    
        except urllib.error.HTTPError as e:
            print(f"HTTP Error {e.code}: {e.reason}")
            # Read the error response body to see what the API is telling us
            error_data = e.read()
            try:
                error_json = json.loads(error_data.decode('utf-8'))
                print(f"[DEBUG] API Error Response: {error_json}")
            except:
                print(f"[DEBUG] API Error Response (raw): {error_data}")
            
            # Check for rate limiting in error message
            if e.code == 429 or "429" in str(e) or "Too Many Requests" in str(e):
                set_rate_limited()
                print(f"[RATE LIMIT] Rate limiting detected via POST error: {e}")
            
            # Debug: If this is a 400 error on order creation, try to fetch item details
            if e.code == 400 and '/profile/orders' in api_url:
                print(f"[DEBUG] 400 error on order creation - attempting to debug item details...")
                try:
                    # Extract item_id from the request payload
                    request_data = json.loads(post_data.decode('utf-8'))
                    item_id = request_data.get('item', '')
                    if item_id:
                        print(f"[DEBUG] Attempting to fetch details for item_id: {item_id}")
                        # Try to fetch item details to see what might be wrong
                        self.debug_item_details(item_id)
                except Exception as debug_e:
                    print(f"[DEBUG] Error during debug item details: {debug_e}")
            
            self.send_response(e.code)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(error_data)
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

    def handle_create_wtb_endpoint(self, post_data):
        """Handle creating WTB orders"""
        try:
            data = json.loads(post_data.decode('utf-8'))
            print(f"[DEBUG] Received WTB order data: {data}")
            item_id = data.get('item_id', '')
            price = data.get('price', 0)
            quantity = data.get('quantity', 1)
            item_name = data.get('item_name', '')
            sell_price = data.get('sell_price', None)
            net_profit = data.get('net_profit', None)
            total_investment = data.get('total_investment', None)
            
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
            username = auth_status.get('username')
            
            # Create WTB order via Warframe Market API
            order_data = {
                "item": item_id,  # This should be the item's ObjectId
                "order_type": "buy",
                "platinum": price,
                "quantity": quantity,
                "visible": True
            }
            print(f"[DEBUG] Order payload: {order_data}")
            
            # Proxy to Warframe Market API and intercept the response to store metadata
            api_url = 'https://api.warframe.market/v1/profile/orders'
            import ssl
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            import urllib.request
            req = urllib.request.Request(api_url, data=json.dumps(order_data).encode())
            req.add_header('Content-Type', 'application/json')
            req.add_header('Accept', 'application/json')
            req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
            # Add Authorization header if present
            auth_headers = self.headers.get('Authorization')
            if auth_headers:
                req.add_header('Authorization', auth_headers)
            else:
                from backend.auth_handler import get_auth_headers
                auth_headers_dict = get_auth_headers()
                jwt_token = None
                if auth_headers_dict:
                    for key, value in auth_headers_dict.items():
                        req.add_header(key, value)
                        if key.lower() == 'authorization' and value.lower().startswith('bearer '):
                            jwt_token = value[7:]
                    if jwt_token:
                        req.add_header('Cookie', f'JWT={jwt_token}')
            with urllib.request.urlopen(req, context=context) as response:
                data_bytes = response.read()
                content_type = response.headers.get('Content-Type', 'application/json')
                api_response = json.loads(data_bytes.decode('utf-8'))
                order_id = api_response.get('payload', {}).get('order', {}).get('id')
                # Store metadata if order_id is present
                if order_id:
                    set_order_metadata(username, order_id, {
                        'item_id': item_id,
                        'item_name': item_name,
                        'buy_price': price,
                        'sell_price': sell_price,
                        'net_profit': net_profit,
                        'total_investment': total_investment,
                        'quantity': quantity
                    })
                # Return transformed response
                self.send_response(response.status)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', content_type)
                self.end_headers()
                transformed_response = {
                    'success': True,
                    'order_id': order_id,
                    'message': 'Order created successfully'
                }
                self.wfile.write(json.dumps(transformed_response).encode())
        except json.JSONDecodeError:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Invalid JSON data'})
            self.wfile.write(error_response.encode())
        except Exception as e:
            print(f"[ERROR] Exception creating WTB order: {e}")
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Error creating WTB order: {str(e)}'})
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
        """Handle deleting orders and remove metadata if WTB"""
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
            username = auth_status.get('username')
            
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
                
                # Remove metadata for this order
                delete_order_metadata(username, order_id)
                
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

    def handle_trading_calc_endpoint(self, post_data):
        global trading_analysis_cancelled
        trading_analysis_cancelled = False  # Ensure reset at the very start
        print('[DEBUG] trading_analysis_cancelled reset to False at start of analysis')
        data = json.loads(post_data.decode('utf-8'))
        all_items = data.get('all_items', [])
        min_profit = data.get('min_profit', 10)
        max_investment = data.get('max_investment', 0)
        max_order_age = data.get('max_order_age', 30)
        batch_size = data.get('batch_size', 3)
        calc = TradingCalculator(min_profit, max_investment, max_order_age)
        prime_items = [item for item in all_items if 'prime' in (item.get('item_name') or '').lower()]
        print(f'[DEBUG] Found {len(prime_items)} Prime items from API. Sample: {[item.get("item_name") for item in prime_items[:5]]}')
        # Assign a unique job ID
        job_id = str(uuid.uuid4())
        with trading_jobs_lock:
            trading_jobs[job_id] = {
                'status': 'running',
                'progress': 0,
                'total': len(prime_items),
                'results': [],
                'cancelled': False,
            }
        # Start batch processing in a background thread
        def batch_worker():
            orders_data = {}
            
            def fetch_item_orders(item, job_id):
                """Fetch orders for a single item - designed to be run in a thread"""
                # Check for cancellation at the start of each item fetch
                with trading_jobs_lock:
                    if trading_jobs[job_id]['cancelled']:
                        print(f'[DEBUG] [Job {job_id}] Cancelled during item fetch')
                        return None, []
                
                item_name = str(item.get('item_name') or '')
                item_id = str(item.get('id') or '')
                url_name = str(item.get('url_name') or '')
                print(f'[DEBUG] [Job {job_id}] Processing: {item_name} (ID: {item_id}, URL: {url_name})')
                
                if not url_name:
                    print(f'[DEBUG] [Job {job_id}] Skipping {item_name}: no url_name')
                    return item_id, []
                
                api_url = f'https://api.warframe.market/v1/items/{url_name}/orders?include=item'
                try:
                    context = ssl.create_default_context()
                    context.check_hostname = False
                    context.verify_mode = ssl.CERT_NONE
                    req = urllib.request.Request(api_url)
                    req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
                    req.add_header('Platform', 'pc')
                    req.add_header('accept', 'application/json')
                    
                    with urllib.request.urlopen(req, context=context) as response:
                        status = response.status
                        data = response.read()
                        try:
                            orders_json = json.loads(data.decode('utf-8'))
                            all_orders = orders_json.get('payload', {}).get('orders', [])
                            ingame_orders = [o for o in all_orders if o.get('user', {}).get('status') == 'ingame']
                            print(f'[DEBUG] [Job {job_id}] {item_name}: {len(all_orders)} total orders, {len(ingame_orders)} ingame orders')
                            return item_id, ingame_orders
                        except Exception as je:
                            print(f'[DEBUG] [Job {job_id}] JSON error for {item_name} (status {status}): {je}\nResponse: {data[:200]!r}')
                            return item_id, []
                except Exception as e:
                    print(f'[DEBUG] [Job {job_id}] Error fetching orders for {item_name}: {e}')
                    return item_id, []
            
            for batch_start in range(0, len(prime_items), batch_size):
                # Check for cancellation before starting each batch
                with trading_jobs_lock:
                    if trading_jobs[job_id]['cancelled']:
                        print(f'[DEBUG] Job {job_id} cancelled during batch processing')
                        trading_jobs[job_id]['status'] = 'cancelled'
                        return
                
                batch = prime_items[batch_start:batch_start+batch_size]
                batch_start_time = time.time()
                print(f'[DEBUG] [Job {job_id}] Starting concurrent batch {batch_start//batch_size+1} with {len(batch)} items')
                
                # Create threads for concurrent API requests
                threads = []
                results = {}
                results_lock = threading.Lock()
                
                # Start all threads for this batch
                for item in batch:
                    # Check for cancellation before starting each thread
                    with trading_jobs_lock:
                        if trading_jobs[job_id]['cancelled']:
                            print(f'[DEBUG] Job {job_id} cancelled before starting threads')
                            trading_jobs[job_id]['status'] = 'cancelled'
                            return
                    
                    def make_thread_func(item_to_process):
                        def thread_func():
                            item_id, orders = fetch_item_orders(item_to_process, job_id)
                            with results_lock:
                                results[item_id] = orders
                        return thread_func
                    
                    thread = threading.Thread(target=make_thread_func(item))
                    threads.append(thread)
                    thread.start()
                
                # Wait for all threads to complete
                for thread in threads:
                    thread.join()
                
                # Collect results from all threads
                for item_id, orders in results.items():
                    if item_id is not None:  # Skip cancelled items
                        orders_data[item_id] = orders
                
                # After each batch, analyze and update job results
                batch_opps = calc.analyze_prime_items(batch, orders_data, max_order_age=max_order_age)
                with trading_jobs_lock:
                    trading_jobs[job_id]['results'].extend(batch_opps)
                    trading_jobs[job_id]['progress'] += len(batch)
                batch_time = time.time() - batch_start_time
                print(f'[DEBUG] [Job {job_id}] Batch {batch_start//batch_size+1} complete in {batch_time:.2f}s, {trading_jobs[job_id]["progress"]}/{trading_jobs[job_id]["total"]} items processed')
            
            with trading_jobs_lock:
                trading_jobs[job_id]['status'] = 'done'
            print(f'[DEBUG] [Job {job_id}] Analysis complete!')
        threading.Thread(target=batch_worker, daemon=True).start()
        # Respond with job ID
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'job_id': job_id}).encode())

    def handle_trading_calc_progress(self):
        # Parse job_id from query string
        query = urlparse(self.path).query
        params = parse_qs(query)
        job_id = params.get('job_id', [None])[0]
        if not job_id:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({'error': 'Missing job_id'}).encode())
            return
        with trading_jobs_lock:
            job = trading_jobs.get(job_id)
            if not job:
                self.send_response(404)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'error': 'Job not found'}).encode())
                return
            # Debug log for progress
            print(f'[DEBUG] POLL job_id={job_id} progress={job["progress"]}/{job["total"]} results={len(job["results"])} status={job["status"]}')
            # Return current progress and results so far
            self.send_response(200)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({
                'status': job['status'],
                'progress': job['progress'],
                'total': job['total'],
                'results': job['results'],
                'cancelled': job['cancelled'],
            }).encode())

    def handle_cancel_analysis_endpoint(self, post_data):
        global trading_analysis_cancelled
        trading_analysis_cancelled = True
        print('[DEBUG] trading_analysis_cancelled set to True by cancel endpoint')
        # Also cancel all running jobs
        with trading_jobs_lock:
            for job in trading_jobs.values():
                job['cancelled'] = True
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Content-Type', 'application/json')
        self.end_headers()
        self.wfile.write(json.dumps({'success': True, 'message': 'Analysis cancelled.'}).encode())

    def handle_my_wtb_orders_endpoint(self):
        """Fetch the logged-in user's current WTB (buy) orders from Warframe Market and return as JSON, merging metadata."""
        # Check authentication
        auth_headers = get_auth_headers()
        auth_status = get_auth_status()
        if not auth_headers or not auth_status.get('logged_in'):
            self.send_response(401)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Not logged in'})
            self.wfile.write(error_response.encode())
            return
        username = auth_status.get('username')
        if not username:
            self.send_response(400)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': 'Could not determine username for profile orders'})
            self.wfile.write(error_response.encode())
            return
        try:
            api_url = f'https://api.warframe.market/v1/profile/{username}/orders'
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(api_url)
            # Use browser-like headers
            req.add_header('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:140.0) Gecko/20100101 Firefox/140.0')
            req.add_header('platform', 'pc')
            req.add_header('language', 'en')
            req.add_header('Origin', 'https://warframe.market')
            req.add_header('Referer', 'https://warframe.market/')
            req.add_header('Accept', 'application/json')
            req.add_header('Content-Type', 'application/json')
            # Only send JWT in Cookie header
            jwt_token = None
            for key, value in auth_headers.items():
                if key.lower() == 'authorization' and value.lower().startswith('bearer '):
                    jwt_token = value[7:]
            if jwt_token:
                req.add_header('Cookie', f'JWT={jwt_token}')
            with urllib.request.urlopen(req, context=context) as response:
                data = response.read()
                orders_json = json.loads(data.decode('utf-8'))
                buy_orders = orders_json.get('payload', {}).get('buy_orders', [])
                print(f"[DEBUG] Found {len(buy_orders)} WTB orders for user")
                
                # Merge metadata
                metadata = get_all_metadata_for_user(username)
                enhanced_orders = []
                for order in buy_orders:
                    order_id = order.get('id')
                    meta = metadata.get(order_id, {}) if metadata else {}
                    # Merge fields, prefer live order fields for id, platinum, etc.
                    merged = {
                        'id': order.get('id'),
                        'item_id': meta.get('item_id', order.get('item', {}).get('id')),
                        'itemName': meta.get('item_name', 'Unknown Item'),
                        'buyPrice': meta.get('buy_price', order.get('platinum')),
                        'sellPrice': meta.get('sell_price', None),
                        'netProfit': meta.get('net_profit', None),
                        'totalInvestment': meta.get('total_investment', None),
                        'quantity': meta.get('quantity', order.get('quantity', 1)),
                        'creation_date': order.get('creation_date'),
                        'platinum': order.get('platinum'),
                    }
                    enhanced_orders.append(merged)
                
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({'success': True, 'orders': enhanced_orders}).encode())
        except Exception as e:
            print(f"[ERROR] Exception in handle_my_wtb_orders_endpoint: {e}")
            traceback.print_exc()  # Print the full traceback
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Error fetching WTB orders: {str(e)}'})
            self.wfile.write(error_response.encode())

    def handle_delete_all_wtb_orders_endpoint(self, post_data):
        """Handle deleting all WTB orders for the logged-in user and remove all metadata."""
        try:
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

            username = auth_status.get('username')
            if not username:
                self.send_response(400)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                error_response = json.dumps({'success': False, 'message': 'Could not determine username for profile orders'})
                self.wfile.write(error_response.encode())
                return

            # First, fetch all user's orders to get the WTB order IDs
            print(f"[DEBUG] Fetching orders for user: {username}")
            fetch_url = f'https://api.warframe.market/v1/profile/{username}/orders'
            
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            
            # Fetch orders
            fetch_req = urllib.request.Request(fetch_url)
            fetch_req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
            fetch_req.add_header('platform', 'pc')
            fetch_req.add_header('language', 'en')
            fetch_req.add_header('Origin', 'https://warframe.market')
            fetch_req.add_header('Referer', 'https://warframe.market/')
            fetch_req.add_header('Accept', 'application/json')
            fetch_req.add_header('Content-Type', 'application/json')
            
            # Add auth headers for fetch
            auth_headers = get_auth_headers()
            jwt_token = None
            if auth_headers:
                for key, value in auth_headers.items():
                    fetch_req.add_header(key, value)
                    if key.lower() == 'authorization' and value.lower().startswith('bearer '):
                        jwt_token = value[7:]
                if jwt_token:
                    fetch_req.add_header('Cookie', f'JWT={jwt_token}')
            with urllib.request.urlopen(fetch_req, context=context) as response:
                data = response.read()
                orders_json = json.loads(data.decode('utf-8'))
                buy_orders = orders_json.get('payload', {}).get('buy_orders', [])
                print(f"[DEBUG] Found {len(buy_orders)} WTB orders to delete")
                
                if not buy_orders:
                    # No orders to delete
                    self.send_response(200)
                    self.send_header('Access-Control-Allow-Origin', '*')
                    self.send_header('Content-Type', 'application/json')
                    self.end_headers()
                    response_data = json.dumps({'success': True, 'message': 'No WTB orders found to delete'})
                    self.wfile.write(response_data.encode())
                    # Remove all metadata for this user
                    delete_all_metadata_for_user(username)
                    return
                
                # Delete each WTB order individually
                deleted_count = 0
                failed_count = 0
                
                for order in buy_orders:
                    order_id = order.get('id')
                    if not order_id:
                        continue
                        
                    delete_url = f'https://api.warframe.market/v1/profile/orders/{order_id}'
                    print(f"[DEBUG] Deleting order {order_id}")
                    
                    delete_req = urllib.request.Request(delete_url, method='DELETE')
                    delete_req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
                    
                    # Add auth headers for delete
                    if auth_headers:
                        for key, value in auth_headers.items():
                            delete_req.add_header(key, value)
                        if jwt_token:
                            delete_req.add_header('Cookie', f'JWT={jwt_token}')
                    try:
                        with urllib.request.urlopen(delete_req, context=context) as delete_response:
                            if delete_response.status == 200:
                                deleted_count += 1
                                print(f"[DEBUG] Successfully deleted order {order_id}")
                                # Remove metadata for this order
                                delete_order_metadata(username, order_id)
                            else:
                                failed_count += 1
                                print(f"[DEBUG] Failed to delete order {order_id}, status: {delete_response.status}")
                    except Exception as e:
                        failed_count += 1
                        print(f"[DEBUG] Exception deleting order {order_id}: {e}")
                
                # Remove all metadata for this user after all deletes
                delete_all_metadata_for_user(username)
                
                # Return results
                self.send_response(200)
                self.send_header('Access-Control-Allow-Origin', '*')
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                
                if failed_count == 0:
                    response_data = json.dumps({
                        'success': True, 
                        'message': f'Successfully deleted {deleted_count} WTB orders'
                    })
                else:
                    response_data = json.dumps({
                        'success': True, 
                        'message': f'Deleted {deleted_count} WTB orders, {failed_count} failed'
                    })
                
                self.wfile.write(response_data.encode())
        except Exception as e:
            print(f"[ERROR] Exception in handle_delete_all_wtb_orders_endpoint: {e}")
            traceback.print_exc()  # Print the full traceback
            self.send_response(500)
            self.send_header('Access-Control-Allow-Origin', '*')
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            error_response = json.dumps({'success': False, 'message': f'Error deleting WTB orders: {str(e)}'})
            self.wfile.write(error_response.encode())

    def do_OPTIONS(self):
        # Handle CORS preflight requests
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.send_header('Access-Control-Max-Age', '86400')
        self.end_headers()

    def debug_item_details(self, item_id):
        """Debug helper to fetch item details when order creation fails"""
        try:
            # First try to get the item by ID
            item_url = f'https://api.warframe.market/v1/items/{item_id}'
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(item_url)
            req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
            req.add_header('Platform', 'pc')
            req.add_header('accept', 'application/json')
            
            with urllib.request.urlopen(req, context=context) as response:
                item_data = response.read()
                item_json = json.loads(item_data.decode('utf-8'))
                print(f"[DEBUG] Item details by ID: {item_json}")
                if 'payload' in item_json and 'item' in item_json['payload']:
                    item_info = item_json['payload']['item']
                    print(f"[DEBUG] Item found: {item_info.get('item_name', 'Unknown')} (ID: {item_info.get('id')})")
                    return item_info
        except Exception as e:
            print(f"[DEBUG] Could not fetch item details by ID {item_id}: {e}")
        
        # If that fails, try to search for the item
        try:
            search_url = f'https://api.warframe.market/v1/items/search?q={item_id}'
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            req = urllib.request.Request(search_url)
            req.add_header('User-Agent', 'Warframe-Market-Proxy/1.0')
            req.add_header('Platform', 'pc')
            req.add_header('accept', 'application/json')
            
            with urllib.request.urlopen(req, context=context) as response:
                search_data = response.read()
                search_json = json.loads(search_data.decode('utf-8'))
                print(f"[DEBUG] Search results: {search_json}")
                if 'payload' in search_json and 'items' in search_json['payload']:
                    items = search_json['payload']['items']
                    if items:
                        print(f"[DEBUG] Found {len(items)} potential matches:")
                        for item in items[:3]:  # Show first 3 matches
                            print(f"[DEBUG]   - {item.get('item_name', 'Unknown')} (ID: {item.get('id')})")
                        return items[0] if items else None
        except Exception as e:
            print(f"[DEBUG] Could not search for item {item_id}: {e}")
        
        print(f"[DEBUG] Could not find any details for item_id: {item_id}")
        return None

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

def handle_dummy_proxy(self):
    """A dummy proxy endpoint for testing."""
    self.send_response(200)
    self.send_header('Access-Control-Allow-Origin', '*')
    self.send_header('Content-Type', 'application/json')
    self.end_headers()
    response = {'success': True, 'message': 'Dummy proxy endpoint reached'}
    self.wfile.write(json.dumps(response).encode())

if __name__ == '__main__':
    run_server() 