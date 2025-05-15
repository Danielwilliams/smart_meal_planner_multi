#!/usr/bin/env python3
"""
Super Simple Instacart API Test

This script is an extremely simplified test of the Instacart API connectivity,
with no dependencies on the application code.
"""

import os
import json
import requests

# Get API key from environment variable
API_KEY = os.environ.get("INSTACARTAPI_DEV", "")

print("=" * 50)
print("Instacart API Test")
print("=" * 50)
print(f"API Key: {'*' * len(API_KEY) if API_KEY else 'Not set'}")
print()

def test_api_config(name, base_url, version, endpoint, header_name, key_format):
    print(f"Testing: {name}")
    print(f"URL: {base_url}/{version}/{endpoint}")
    
    # Format the API key based on the configuration
    formatted_key = API_KEY
    if not API_KEY:
        print("ERROR: No API key provided in INSTACARTAPI_DEV environment variable")
        return False
        
    if key_format == "prefix" and not API_KEY.startswith("InstacartAPI "):
        formatted_key = f"InstacartAPI {API_KEY}"
    elif key_format == "no_prefix" and API_KEY.startswith("InstacartAPI "):
        formatted_key = API_KEY.replace("InstacartAPI ", "")
    
    # Set up headers
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
        header_name: formatted_key
    }
    
    # Make request
    url = f"{base_url}/{version}/{endpoint}"
    try:
        print(f"Making GET request to {url}")
        response = requests.get(url, headers=headers)
        
        print(f"Status Code: {response.status_code}")
        if response.status_code == 200:
            print("SUCCESS!")
            try:
                data = response.json()
                print(f"Response contains {len(data['data']) if 'data' in data else 0} items")
                print(json.dumps(data, indent=2)[:500] + '...' if len(json.dumps(data)) > 500 else json.dumps(data, indent=2))
                return True
            except:
                print(f"Response is not valid JSON: {response.text[:200]}")
        else:
            print(f"ERROR: {response.status_code}")
            print(f"Response: {response.text[:500]}")
        
    except Exception as e:
        print(f"ERROR: {str(e)}")
    
    print()
    return False

# Test Configurations
configs = [
    {
        "name": "Developer Platform API - List Retailers",
        "base_url": "https://platform-api.instacart.com",
        "version": "v1",
        "endpoint": "retailers/list",
        "header_name": "X-Instacart-API-Key",
        "key_format": "no_prefix"
    },
    {
        "name": "Developer Platform API - Nearby Retailers",
        "base_url": "https://platform-api.instacart.com",
        "version": "v1",
        "endpoint": "retailers/nearby?zip_code=80538",
        "header_name": "X-Instacart-API-Key",
        "key_format": "no_prefix"
    },
    {
        "name": "Connect API - List Retailers",
        "base_url": "https://connect.instacart.com",
        "version": "v2022-09-01",
        "endpoint": "retailers",
        "header_name": "Instacart-Connect-Api-Key",
        "key_format": "prefix"
    }
]

# Run tests
successful = 0
for config in configs:
    if test_api_config(**config):
        successful += 1
    print("-" * 50)

# Summary
print(f"Test Summary: {successful}/{len(configs)} configurations successful")
print()

if successful == 0:
    print("TROUBLESHOOTING:")
    print("1. Check that your API key is correctly set in INSTACARTAPI_DEV")
    print("2. Verify that you have the correct API key for the Instacart service you're using")
    print("3. Check network connectivity - are you behind a firewall or VPN?")
    print("4. You might need to request specific API access from Instacart")
elif successful < len(configs):
    print("PARTIAL SUCCESS:")
    print("Some API configurations are working. Check your code to make sure")
    print("you're using the correct configuration that worked in this test.")
else:
    print("ALL TESTS PASSED!")
    print("If you're still having issues in your application, check:")
    print("1. How your app formats the API key")
    print("2. The exact endpoint URLs used in your app")
    print("3. Headers and other request parameters")