#!/usr/bin/env python3
"""
Authentication handler for Warframe Market API v1
Handles login, CSRF token management, and session cookies
"""
import urllib.request
import urllib.parse
import json
import ssl
import http.cookiejar
import threading
import time
import urllib.error
from typing import Optional, Dict, Any

class WarframeMarketAuth:
    def __init__(self):
        self.base_url = "https://api.warframe.market/v1"
        self.csrf_token = None
        self.session_cookies = None
        self.auth_lock = threading.Lock()
        self.last_login_time = 0
        self.login_valid_duration = 3600  # 1 hour in seconds
        
    def login(self, email: str, password: str) -> Dict[str, Any]:
        """
        Login to Warframe Market using v1 endpoint
        Returns dict with success status and any error messages
        """
        print(f"[DEBUG] Starting login for email: {email}")
        print("[DEBUG] About to acquire auth lock")
        
        # Try to acquire lock with timeout
        if not self.auth_lock.acquire(timeout=5.0):  # 5 second timeout
            print("[DEBUG] Failed to acquire auth lock within 5 seconds - possible deadlock")
            return {
                "success": False,
                "message": "Authentication system busy, please try again"
            }
        
        print("[DEBUG] Acquired auth lock")
        try:
            print("[DEBUG] About to create SSL context")
            # Create SSL context
            context = ssl.create_default_context()
            context.check_hostname = False
            context.verify_mode = ssl.CERT_NONE
            print("[DEBUG] Created SSL context")
            
            # Try to get JWT token from main API endpoint
            print("[DEBUG] Getting JWT token from main API...")
            try:
                csrf_req = urllib.request.Request(
                    f"{self.base_url}/auth",
                    headers={
                        'Accept': 'application/json',
                        'User-Agent': 'Warframe-Market-Auth/1.0'
                    }
                )
                
                with urllib.request.urlopen(csrf_req, context=context) as csrf_response:
                    print(f"[DEBUG] JWT request status: {csrf_response.status}")
                    # Extract JWT token from Set-Cookie header
                    set_cookie = csrf_response.headers.get_all('Set-Cookie')
                    jwt_token = None
                    if set_cookie:
                        print(f"[DEBUG] JWT Set-Cookie headers: {set_cookie}")
                        for cookie_str in set_cookie:
                            if 'JWT=' in cookie_str:
                                jwt_token = cookie_str.split('JWT=')[1].split(';')[0]
                                print(f"[DEBUG] Found JWT token: {jwt_token}")
                                break
            except Exception as e:
                print(f"[DEBUG] JWT request failed: {e}")
                jwt_token = None
            
            print("[DEBUG] About to prepare login data")
            # Prepare login data
            login_data = {
                "email": email,
                "password": password
            }
            print(f"[DEBUG] Login data: {login_data}")
            
            print("[DEBUG] About to encode data")
            # Encode data
            data = json.dumps(login_data).encode('utf-8')
            print(f"[DEBUG] Encoded login data: {data}")
            
            print("[DEBUG] About to create request")
            # Create request with JWT token if we have one
            login_headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'User-Agent': 'Warframe-Market-Auth/1.0'
            }
            
            if jwt_token:
                # Try different header names for CSRF token
                login_headers['X-CSRF-Token'] = jwt_token
                login_headers['CSRF-Token'] = jwt_token
                login_headers['X-CSRF-TOKEN'] = jwt_token
                # Also try as Authorization header
                login_headers['Authorization'] = f'Bearer {jwt_token}'
                print(f"[DEBUG] Added JWT token to multiple headers: {jwt_token}")
            
            login_url = f"{self.base_url}/auth/signin"
            req = urllib.request.Request(
                login_url,
                data=data,
                headers=login_headers
            )
            print(f"[DEBUG] Created request for URL: {login_url}")
            
            print("[DEBUG] About to make network request")
            # Make request using urlopen with context
            with urllib.request.urlopen(req, context=context) as response:
                print(f"[DEBUG] Got response: status={response.status}")
                response_data = response.read()
                print(f"[DEBUG] Response data: {response_data[:200]}")
                response_json = json.loads(response_data.decode('utf-8'))
                print(f"[DEBUG] Response JSON: {response_json}")
                
                # Extract JWT token from Set-Cookie header
                set_cookie = response.headers.get_all('Set-Cookie')
                jwt_token = None
                if set_cookie:
                    print(f"[DEBUG] Set-Cookie headers: {set_cookie}")
                    for cookie_str in set_cookie:
                        if 'JWT=' in cookie_str:
                            jwt_token = cookie_str.split('JWT=')[1].split(';')[0]
                            print(f"[DEBUG] Found JWT token in Set-Cookie: {jwt_token}")
                            break
                
                if response.status == 200 and jwt_token:
                    self.csrf_token = jwt_token  # Store JWT as our auth token
                    self.last_login_time = time.time()
                    print(f"[DEBUG] Login successful, JWT token: {jwt_token}")
                    return {
                        "success": True,
                        "message": "Login successful",
                        "csrf_token": jwt_token
                    }
                elif response.status == 200:
                    print("[DEBUG] No JWT token found in response cookies")
                    return {
                        "success": False,
                        "message": "No JWT token found in response"
                    }
                else:
                    error_msg = response_json.get('error', {}).get('message', 'Unknown error')
                    print(f"[DEBUG] Login failed: {error_msg}")
                    return {
                        "success": False,
                        "message": f"Login failed: {error_msg}"
                    }
                    
        except urllib.error.HTTPError as e:
            print(f"[DEBUG] HTTPError: {e}")
            try:
                error_data = e.read().decode('utf-8')
                print(f"[DEBUG] Raw error response: {error_data}")
                try:
                    error_json = json.loads(error_data)
                    error_msg = error_json.get('error', {}).get('message', 'HTTP Error')
                    print(f"[DEBUG] Parsed error JSON: {error_json}")
                except json.JSONDecodeError:
                    error_msg = error_data
                    print(f"[DEBUG] Error response is not JSON: {error_data}")
            except Exception as ex:
                error_msg = f"HTTP Error {e.code}"
                print(f"[DEBUG] Exception reading error response: {ex}")
            
            return {
                "success": False,
                "message": f"Login failed: {error_msg}"
            }
            
        except Exception as e:
            print(f"[DEBUG] Exception during login: {e}")
            return {
                "success": False,
                "message": f"Login error: {str(e)}"
            }
        finally:
            print("[DEBUG] Releasing auth lock")
            self.auth_lock.release()
    
    def is_logged_in(self) -> bool:
        """Check if user is currently logged in and session is valid"""
        if not self.csrf_token:
            return False
        
        # Check if login is still valid (within 1 hour)
        if time.time() - self.last_login_time > self.login_valid_duration:
            # Don't call logout() here to avoid deadlock
            # Just clear the data directly
            self.csrf_token = None
            self.session_cookies = None
            self.last_login_time = 0
            return False
        
        return True
    
    def logout(self):
        """Clear authentication data"""
        with self.auth_lock:
            self.csrf_token = None
            self.session_cookies = None
            self.last_login_time = 0
    
    def get_auth_headers(self) -> Optional[Dict[str, str]]:
        """Get authentication headers for API requests"""
        if not self.is_logged_in():
            return None
        
        return {
            'Authorization': f'Bearer {self.csrf_token or ""}',
            'X-CSRF-Token': self.csrf_token or ""
        }
    
    def get_session_cookies(self) -> Optional[http.cookiejar.CookieJar]:
        """Get session cookies for API requests"""
        if not self.is_logged_in():
            return None
        
        return self.session_cookies
    
    def get_auth_status(self) -> Dict[str, Any]:
        """Get current authentication status"""
        with self.auth_lock:
            return {
                "logged_in": self.is_logged_in(),
                "has_csrf_token": self.csrf_token is not None,
                "login_time": self.last_login_time,
                "session_age": time.time() - self.last_login_time if self.last_login_time > 0 else 0
            }

# Global auth instance
auth_instance = WarframeMarketAuth()

def handle_login_request(email: str, password: str) -> Dict[str, Any]:
    """Handle login request from frontend"""
    return auth_instance.login(email, password)

def handle_logout_request() -> Dict[str, Any]:
    """Handle logout request from frontend"""
    auth_instance.logout()
    return {"success": True, "message": "Logged out successfully"}

def get_auth_status() -> Dict[str, Any]:
    """Get current authentication status"""
    return auth_instance.get_auth_status()

def get_auth_headers() -> Optional[Dict[str, str]]:
    """Get authentication headers for API requests"""
    return auth_instance.get_auth_headers()

def get_session_cookies() -> Optional[http.cookiejar.CookieJar]:
    """Get session cookies for API requests"""
    return auth_instance.get_session_cookies() 