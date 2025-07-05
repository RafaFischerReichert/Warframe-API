#!/usr/bin/env python3
"""
Test script to check Warframe Market API response
"""
import urllib.request
import ssl

def test_api():
    api_url = 'https://api.warframe.market/v1/items'
    
    try:
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
            
            print(f"API response: status={response.status}")
            print(f"Content-Type: {content_type}")
            print(f"Data length: {len(data)}")
            print(f"First 200 chars: {data[:200]}")
            
            # Try to decode as JSON
            try:
                import json
                json_data = json.loads(data.decode('utf-8'))
                print("JSON parsing successful!")
                if 'payload' in json_data and 'items' in json_data['payload']:
                    print(f"Number of items: {len(json_data['payload']['items'])}")
                else:
                    print("No items found in response")
            except json.JSONDecodeError as e:
                print(f"JSON parsing failed: {e}")
                
    except Exception as e:
        print(f"Error: {e}")

if __name__ == '__main__':
    test_api() 