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

# Semaphore for concurrent requests (max 3)
concurrent_semaphore = threading.Semaphore(3)
# List to track timestamps of last requests for rate limiting
rate_limit_lock = threading.Lock()
request_timestamps = []  # stores timestamps of last requests
RATE_LIMIT = 3  # max requests
RATE_PERIOD = 1.0  # per second

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        print(f"Received request for path: {self.path}")
        
        if self.path.startswith('/api/'):
            # Proxy the request to Warframe Market API
            api_path = self.path[5:]  # Remove '/api/' prefix
            if not api_path.startswith('/'):
                api_path = '/' + api_path
            api_url = f'https://api.warframe.market/v1{api_path}'
            
            print(f"Proxying request: {self.path} -> {api_url}")
            
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
                    
                    with urllib.request.urlopen(req, context=context) as response:
                        data = response.read()
                        content_type = response.headers.get('Content-Type', 'application/json')
                        
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
                    self.path = '/index.html'
                
                with open('.' + self.path, 'rb') as f:
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