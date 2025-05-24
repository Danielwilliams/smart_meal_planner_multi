#!/usr/bin/env python3
"""
Instacart API Test Script for Development Environment

Tests the Instacart Developer Platform API integration with the correct
development environment settings.
"""

import os
import json
import requests
import logging
from typing import Dict, Any, List

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("instacart-test")

# Constants
BASE_URL = "https://connect.dev.instacart.tools"
API_VERSION = "idp/v1"

def get_api_key():
    """Get API key from environment variable or prompt user."""
    api_key = os.environ.get("INSTACARTAPI_DEV")

    if not api_key:
        # If running in an interactive terminal, prompt for the API key
        try:
            import sys
            print("\nINSTACARTAPI_DEV environment variable is not set.")
            print("You can set it by running: export INSTACARTAPI_DEV=\"your_api_key_here\"")
            print("Alternatively, you can enter it now:")

            api_key = input("Enter your Instacart API key: ").strip()

            if not api_key:
                raise ValueError("No API key provided.")

            # Temporarily set the environment variable so other functions work
            os.environ["INSTACARTAPI_DEV"] = api_key

        except Exception as e:
            raise ValueError("INSTACARTAPI_DEV environment variable is not set and could not prompt for it.")

    # Format the key for Bearer authentication (remove InstacartAPI prefix if present)
    if api_key.startswith("InstacartAPI "):
        api_key = api_key.replace("InstacartAPI ", "")

    return api_key

def make_request(endpoint: str, params: Dict[str, Any] = None, method: str = "GET") -> Dict[str, Any]:
    """Make a request to the Instacart API."""
    url = f"{BASE_URL}/{API_VERSION}/{endpoint}"
    api_key = get_api_key()
    
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
        "Content-Type": "application/json"
    }
    
    logger.info(f"Making {method} request to {url}")
    logger.info(f"Headers: {headers}")
    if params:
        logger.info(f"Params: {params}")
    
    try:
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=params)
        else:
            raise ValueError(f"Unsupported method: {method}")
        
        logger.info(f"Response status code: {response.status_code}")
        
        if response.status_code >= 400:
            logger.error(f"Error response: {response.text}")
            return {"error": f"HTTP {response.status_code}: {response.text}"}
        
        # Try to parse response as JSON
        try:
            data = response.json()
            logger.info(f"Response content (truncated): {json.dumps(data)[:500]}")
            return data
        except ValueError:
            logger.info(f"Response content (not JSON): {response.text[:500]}")
            return {"text": response.text}
            
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        return {"error": str(e)}

def test_get_retailers():
    """Test getting retailers."""
    logger.info("=== Testing Get Retailers ===")
    params = {
        "postal_code": "80538",
        "country_code": "US"
    }
    return make_request("retailers", params=params)

def test_get_nearby_retailers(zip_code: str = "80538"):
    """Test getting nearby retailers."""
    logger.info(f"=== Testing Get Nearby Retailers for {zip_code} ===")
    params = {
        "postal_code": zip_code,
        "country_code": "US"
    }
    return make_request("retailers", params=params)

def test_search_products(retailer_id: str, query: str = "milk"):
    """Test searching products."""
    logger.info(f"=== Testing Search Products for '{query}' at retailer {retailer_id} ===")
    params = {
        "q": query,
        "retailer_key": retailer_id,
        "limit": 5
    }
    return make_request("products/search", params=params)

def main():
    """Run the tests."""
    try:
        logger.info("Starting Instacart API tests with development environment settings")
        
        # Test getting retailers
        retailers_response = test_get_retailers()

        # Test getting nearby retailers
        nearby_retailers_response = test_get_nearby_retailers("80538")

        # Extract retailers from the response
        retailers = retailers_response.get("retailers", [])
        logger.info(f"Found {len(retailers)} retailers")

        # If we got retailers, test searching products
        if retailers and len(retailers) > 0:
            retailer_id = retailers[0].get("retailer_key")
            retailer_name = retailers[0].get("name")
            logger.info(f"Using retailer: {retailer_name} (ID: {retailer_id})")
            products = test_search_products(retailer_id, "milk")
        else:
            logger.warning("No retailers found, skipping product search test")
        
        logger.info("Tests completed")
        
    except Exception as e:
        logger.error(f"Test failed: {str(e)}")

if __name__ == "__main__":
    main()