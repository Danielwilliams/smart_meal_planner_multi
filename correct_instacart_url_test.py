#!/usr/bin/env python3
"""
Simplified Instacart API Test with Correct URLs
Based on latest Instacart Developer Platform documentation
"""

import os
import json
import requests

# Get API key from environment variable
API_KEY = os.environ.get("INSTACARTAPI_DEV", "")

print("=" * 50)
print("Instacart API Test - Corrected URLs")
print("=" * 50)
print(f"API Key: {'*' * len(API_KEY) if API_KEY else 'Not set'}")
print()

# Test configurations based on ACTUAL Instacart API format
TEST_CONFIGS = [
    {
        "name": "Developer Platform API - Main URL",
        "url": "https://developer.instacart.com/",
        "requires_auth": False,
        "description": "Testing if the main developer portal is accessible"
    },
    {
        "name": "Instacart Connect API - Basic Test",
        "url": "https://connect.instacart.com/v2022-09-01/healthcheck",
        "requires_auth": False,
        "description": "Testing if the Connect API healthcheck endpoint is accessible"
    },
    {
        "name": "Instacart Connect API - Retailers",
        "url": "https://connect.instacart.com/v2022-09-01/retailers", 
        "requires_auth": True,
        "header_name": "Instacart-Connect-Api-Key",
        "use_prefix": True,
        "description": "Testing the retailers endpoint with API key"
    },
    {
        "name": "Instacart API - Alternative URL Structure",
        "url": "https://api.instacart.com/v1/retailers",
        "requires_auth": True,
        "header_name": "Authorization",
        "use_prefix": False,
        "description": "Testing alternative API URL format"
    },
    {
        "name": "Instacart API - Public API Version",
        "url": "https://api.instacart.com/connect/v1/retailers", 
        "requires_auth": True,
        "header_name": "Authorization",
        "use_prefix": False,
        "description": "Testing public API format"
    }
]

def format_api_key(key, use_prefix=True):
    """Format API key correctly based on requirements"""
    if not key:
        return ""
        
    if use_prefix and not key.startswith("InstacartAPI "):
        return f"InstacartAPI {key}"
    elif not use_prefix and key.startswith("InstacartAPI "):
        return key.replace("InstacartAPI ", "")
        
    return key

def test_url(config):
    """Test a specific URL configuration"""
    print(f"Testing: {config['name']}")
    print(f"URL: {config['url']}")
    print(f"Description: {config['description']}")
    
    headers = {
        "Accept": "application/json"
    }
    
    # Add authentication header if required
    if config.get("requires_auth", False) and API_KEY:
        key = format_api_key(API_KEY, config.get("use_prefix", False))
        header_name = config.get("header_name", "Authorization")
        headers[header_name] = key
        print(f"Using header: {header_name}: {key[:5]}...{key[-5:] if len(key) > 10 else ''}")
    
    try:
        print(f"Making GET request to {config['url']}")
        response = requests.get(config['url'], headers=headers, timeout=10)
        
        print(f"Status Code: {response.status_code}")
        print(f"Response Headers: {dict(response.headers)}")
        
        if response.status_code < 400:
            print("SUCCESS! Connection established")
        else:
            print(f"ERROR: Bad status code {response.status_code}")
            
        # Try to parse response as JSON
        try:
            data = response.json()
            print(f"JSON Response: {json.dumps(data, indent=2)[:500]}")
        except:
            print(f"Text Response: {response.text[:500]}")
            
    except Exception as e:
        print(f"ERROR: {str(e)}")
        
    print("-" * 50)
    
# Run all tests
for config in TEST_CONFIGS:
    test_url(config)
    
print("\nTest complete. If all URLs failed, there may be network connectivity issues.")
print("Check your internet connection and ensure you're not behind a restrictive firewall.")
print("If some URLs worked and others didn't, note which ones worked to update your code.")