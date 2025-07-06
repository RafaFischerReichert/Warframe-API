#!/usr/bin/env python3
"""
Simple test script to verify authentication endpoints
"""
import requests
import json

BASE_URL = "http://localhost:8000"

def test_auth_status():
    """Test the auth status endpoint"""
    print("Testing auth status endpoint...")
    try:
        response = requests.get(f"{BASE_URL}/auth/status")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_login_invalid():
    """Test login with invalid credentials"""
    print("\nTesting login with invalid credentials...")
    try:
        response = requests.post(f"{BASE_URL}/auth/login", 
                               json={"email": "test@example.com", "password": "wrong"})
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200  # Should return 200 with error message
    except Exception as e:
        print(f"Error: {e}")
        return False

def test_logout():
    """Test logout endpoint"""
    print("\nTesting logout endpoint...")
    try:
        response = requests.post(f"{BASE_URL}/auth/logout")
        print(f"Status: {response.status_code}")
        print(f"Response: {response.json()}")
        return response.status_code == 200
    except Exception as e:
        print(f"Error: {e}")
        return False

def main():
    print("Testing Warframe Market Authentication Endpoints")
    print("=" * 50)
    
    # Test auth status
    test_auth_status()
    
    # Test invalid login
    test_login_invalid()
    
    # Test logout
    test_logout()
    
    print("\n" + "=" * 50)
    print("Test completed!")
    print("\nTo test with real credentials:")
    print("1. Open http://localhost:8000/login.html in your browser")
    print("2. Enter your Warframe Market credentials")
    print("3. Check the authentication status")

if __name__ == "__main__":
    main() 