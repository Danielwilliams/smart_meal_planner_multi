#!/usr/bin/env python3
"""
Simple Instacart API Test Script

This script provides a clean, isolated test of the Instacart API to diagnose connectivity
and authentication issues without the complexity of the full application.
"""

import os
import sys
import json
import requests
import logging
from typing import Dict, Any, Optional

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[logging.StreamHandler(sys.stdout)]
)
logger = logging.getLogger("instacart-test")

# Configuration
DEFAULT_API_KEY = os.environ.get("INSTACARTAPI_DEV", "")

# Available API configurations to test
API_CONFIGS = [
    {
        "name": "Developer Platform API (New)",
        "base_url": "https://platform-api.instacart.com", 
        "version": "v1",
        "header_name": "X-Instacart-API-Key",
        "prefix_needed": False,
        "endpoints": [
            {"path": "retailers/list", "method": "GET", "params": {}},
            {"path": "retailers/nearby", "method": "GET", "params": {"zip_code": "80538"}},
        ]
    },
    {
        "name": "Connect API (Retailers Only)",
        "base_url": "https://connect.instacart.com",
        "version": "v2022-09-01",
        "header_name": "Instacart-Connect-Api-Key",
        "prefix_needed": True,
        "endpoints": [
            {"path": "retailers", "method": "GET", "params": {}},
        ]
    }
]

def get_api_key_variants(api_key: str) -> Dict[str, str]:
    """Generate various formats of the API key to test different options."""
    if not api_key:
        return {"empty": ""}
        
    variants = {
        "as_provided": api_key,
    }
    
    # If key doesn't have 'InstacartAPI ' prefix, add a variant with it
    if not api_key.startswith("InstacartAPI "):
        variants["with_prefix"] = f"InstacartAPI {api_key}"
    # If key does have the prefix, add a variant without it
    else:
        variants["without_prefix"] = api_key.replace("InstacartAPI ", "")
        
    return variants

def make_request(
    base_url: str,
    version: str,
    endpoint: str,
    method: str = "GET", 
    header_name: str = "X-Instacart-API-Key",
    api_key: str = "", 
    params: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Make a request to the Instacart API and return the results.
    
    Args:
        base_url: The base URL for the API
        version: The API version
        endpoint: The API endpoint
        method: The HTTP method to use
        header_name: The name of the header to use for authentication
        api_key: The API key to use
        params: The query parameters to include
        
    Returns:
        A dictionary with the request details and results
    """
    url = f"{base_url}/{version}/{endpoint}"
    
    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    
    if api_key:
        headers[header_name] = api_key
    
    if not params:
        params = {}
        
    result = {
        "url": url,
        "method": method,
        "headers": {k: (v[:10] + "..." if k.lower().find("key") >= 0 and len(v) > 13 else v) for k, v in headers.items()},
        "params": params,
        "status_code": None,
        "response": None,
        "error": None
    }
    
    try:
        logger.info(f"Making {method} request to {url}")
        if method.upper() == "GET":
            response = requests.get(url, headers=headers, params=params, timeout=10)
        elif method.upper() == "POST":
            response = requests.post(url, headers=headers, json=params, timeout=10)
        else:
            result["error"] = f"Unsupported method: {method}"
            return result
            
        result["status_code"] = response.status_code
        
        # Try to parse JSON response
        try:
            result["response"] = response.json()
        except:
            result["response"] = response.text[:500]  # Truncate long responses
            
    except Exception as e:
        result["error"] = str(e)
        
    return result

def run_tests(api_key: str = None):
    """
    Run a series of tests against the Instacart API with various configurations.
    
    Args:
        api_key: The API key to use. If None, will use the environment variable.
    """
    if not api_key:
        api_key = DEFAULT_API_KEY
        
    logger.info(f"Starting Instacart API tests")
    
    # Get API key variants
    api_key_variants = get_api_key_variants(api_key)
    logger.info(f"Testing with {len(api_key_variants)} API key variants")
    
    all_results = []
    
    # Test each API configuration
    for config in API_CONFIGS:
        logger.info(f"Testing {config['name']} configuration")
        
        # Test each API key variant with each endpoint
        for variant_name, variant_key in api_key_variants.items():
            logger.info(f"  Testing with key variant: {variant_name}")
            
            # Apply prefix if needed
            if config["prefix_needed"] and not variant_key.startswith("InstacartAPI ") and variant_key:
                variant_key = f"InstacartAPI {variant_key}"
                logger.info(f"  Applied 'InstacartAPI' prefix for this configuration")
                
            for endpoint in config["endpoints"]:
                logger.info(f"    Testing endpoint: {endpoint['path']}")
                result = make_request(
                    base_url=config["base_url"],
                    version=config["version"],
                    endpoint=endpoint["path"],
                    method=endpoint["method"],
                    header_name=config["header_name"],
                    api_key=variant_key,
                    params=endpoint["params"]
                )
                
                # Add test metadata
                result["test_info"] = {
                    "api_config": config["name"],
                    "key_variant": variant_name,
                    "endpoint": endpoint["path"]
                }
                
                if result["status_code"] == 200:
                    logger.info(f"    SUCCESS! Status code: {result['status_code']}")
                else:
                    logger.info(f"    FAILED! Status code: {result['status_code']}, Error: {result['error']}")
                    
                all_results.append(result)
    
    # Generate report
    success_count = sum(1 for r in all_results if r["status_code"] == 200)
    logger.info(f"Test results: {success_count}/{len(all_results)} successful")
    
    # Save all results to a file
    with open("instacart_api_test_results.json", "w") as f:
        json.dump(all_results, f, indent=2)
        
    logger.info(f"Results saved to instacart_api_test_results.json")
    
    # Display successful configurations
    successful_configs = []
    for result in all_results:
        if result["status_code"] == 200:
            successful_configs.append(result["test_info"])
            
    if successful_configs:
        logger.info("Successful configurations:")
        for config in successful_configs:
            logger.info(f"  API: {config['api_config']}, Key: {config['key_variant']}, Endpoint: {config['endpoint']}")
    else:
        logger.error("No successful API configurations found")

if __name__ == "__main__":
    # Allow API key to be passed as command line argument
    api_key = sys.argv[1] if len(sys.argv) > 1 else None
    run_tests(api_key)