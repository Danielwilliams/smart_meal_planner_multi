"""
Test script for Instacart endpoints

This script tests the Instacart API endpoints without requiring authentication.
It helps verify if the endpoints are working correctly.
"""

import sys
import requests
import json

# Configure the base URL
# Use the local server if testing locally
BASE_URL = "http://127.0.0.1:8000"  # Change to your local server port if different
# Comment out the above and uncomment below if testing against production
# BASE_URL = "https://smartmealplannermulti-development.up.railway.app"

def test_endpoint(endpoint_path, method="GET", data=None):
    """Test an endpoint and print the result"""
    url = f"{BASE_URL}{endpoint_path}"
    print(f"\n🔍 Testing {method} {url}")
    
    try:
        if method == "GET":
            response = requests.get(url)
        elif method == "POST":
            response = requests.post(url, json=data)
        else:
            print(f"❌ Unsupported method: {method}")
            return
        
        print(f"📊 Status Code: {response.status_code}")
        
        if 200 <= response.status_code < 300:
            print(f"✅ Success!")
            try:
                # Pretty print the JSON response with indentation
                print("📋 Response:")
                print(json.dumps(response.json(), indent=2))
            except:
                print(f"📄 Raw Response: {response.text[:200]}...")
        else:
            print(f"❌ Failed with status code {response.status_code}")
            print(f"📄 Response: {response.text[:200]}...")
    
    except Exception as e:
        print(f"❌ Error: {str(e)}")

def main():
    # Test endpoints
    endpoints = [
        "/api/instacart/test",
        "/api/instacart/key-info",
        "/api/instacart/environment",
        "/api/instacart/status",
        "/api/instacart/retailers",
        "/api/instacart/retailers/nearby?zip_code=80538"
    ]
    
    print("=== 🚀 Starting Instacart API Endpoint Tests ===")
    print(f"🔗 Base URL: {BASE_URL}")
    
    # Test each endpoint
    for endpoint in endpoints:
        test_endpoint(endpoint)
    
    print("\n=== 🏁 Tests completed ===")

if __name__ == "__main__":
    main()