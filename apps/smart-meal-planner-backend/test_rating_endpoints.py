#!/usr/bin/env python3
"""
Test script for rating endpoints
Run this after starting the development server to verify rating functionality
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_rating_endpoints():
    """Test rating endpoints without authentication (should get 401)"""
    
    print("Testing Rating Endpoints...")
    print("=" * 50)
    
    # Test 1: Rate a recipe (should require auth)
    print("\n1. Testing recipe rating endpoint (should require auth):")
    response = requests.post(f"{BASE_URL}/ratings/recipes/1/rate", 
                           json={"rating_score": 4.5, "made_recipe": True})
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Test 2: Get recipe ratings (public endpoint)
    print("\n2. Testing get recipe ratings (public):")
    response = requests.get(f"{BASE_URL}/ratings/recipes/1/ratings")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Test 3: Rate a menu (should require auth)
    print("\n3. Testing menu rating endpoint (should require auth):")
    response = requests.post(f"{BASE_URL}/ratings/menus/1/rate",
                           json={"rating_score": 4.0, "variety_rating": 4})
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Test 4: Get menu ratings (public endpoint)
    print("\n4. Testing get menu ratings (public):")
    response = requests.get(f"{BASE_URL}/ratings/menus/1/ratings")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    # Test 5: Get recommendations (should require auth)
    print("\n5. Testing recommendations endpoint (should require auth):")
    response = requests.get(f"{BASE_URL}/ratings/recipes/recommended")
    print(f"Status: {response.status_code}")
    print(f"Response: {response.json()}")
    
    print("\n" + "=" * 50)
    print("Test completed!")
    print("\nExpected results:")
    print("- Endpoints requiring auth should return 401")
    print("- Public endpoints should return 200 or valid error messages")
    print("- No server crashes or 500 errors")

if __name__ == "__main__":
    try:
        test_rating_endpoints()
    except requests.exceptions.ConnectionError:
        print("Could not connect to server. Make sure the development server is running on http://localhost:8000")
    except Exception as e:
        print(f"Error running tests: {e}")