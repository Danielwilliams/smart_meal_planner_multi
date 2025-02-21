import os
import requests
import base64
import logging
import json
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def get_kroger_access_token(scopes: str = 'product.compact'):
    """Get access token for Kroger API"""
    CLIENT_ID = os.getenv("KROGER_CLIENT_ID")
    CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET")
    BASE_URL = os.getenv("KROGER_BASE_URL", "https://api-ce.kroger.com/v1")
    
    token_url = f"{BASE_URL}/connect/oauth2/token"
    auth_string = f"{CLIENT_ID}:{CLIENT_SECRET}"
    basic_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    
    headers = {
        'Authorization': f'Basic {basic_auth}',
        'Content-Type': 'application/x-www-form-urlencoded'
    }
    
    data = {
        'grant_type': 'client_credentials',
        'scope': 'location'
    }
    
    response = requests.post(
        token_url, 
        headers=headers, 
        data=data,
        timeout=10
    )
    
    if response.status_code == 200:
        return response.json().get('access_token')
    else:
        logger.error(f"Token generation failed: {response.text}")
        return None

def test_kroger_locations():
    """
    Comprehensive test for Kroger Locations API
    """
    BASE_URL = os.getenv("KROGER_BASE_URL", "https://api-ce.kroger.com/v1")
    
    # Get access token
    access_token = get_kroger_access_token('location')
    if not access_token:
        logger.error("Failed to obtain access token")
        return None
    
    # Test different location search strategies
    location_tests = [
        # Strategy 1: Search by zip code
        {
            'name': 'Zip Code Search',
            'endpoint': '/locations',
            'params': {
                'filter.zipCode.near': '45044',  # Example zip code
                'filter.limit': 5,
                'filter.radiusInMiles': 10
            }
        },
        # Strategy 2: Search by latitude and longitude
        {
            'name': 'Lat/Long Search',
            'endpoint': '/locations',
            'params': {
                'filter.latLong.near': '39.306346,-84.278902',  # Example coordinates
                'filter.limit': 5
            }
        },
        # Strategy 3: Search by specific chain
        {
            'name': 'Kroger Chain Search',
            'endpoint': '/locations',
            'params': {
                'filter.chain': 'Kroger',
                'filter.limit': 5
            }
        }
    ]
    
    results = {}
    
    for test in location_tests:
        logger.info(f"\nRunning {test['name']} Test")
        
        headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        
        try:
            response = requests.get(
                f"{BASE_URL}{test['endpoint']}",
                headers=headers,
                params=test['params'],
                timeout=10
            )
            
            logger.info(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                results[test['name']] = {
                    'status': 'success',
                    'total_locations': len(data.get('data', [])),
                    'locations': [
                        {
                            'name': loc.get('name'),
                            'location_id': loc.get('locationId'),
                            'address': loc.get('address', {}).get('addressLine1'),
                            'phone': loc.get('phone')
                        } for loc in data.get('data', [])
                    ]
                }
            else:
                results[test['name']] = {
                    'status': 'error',
                    'message': response.text
                }
        
        except Exception as e:
            logger.error(f"Error in {test['name']}: {str(e)}")
            results[test['name']] = {
                'status': 'error',
                'message': str(e)
            }
    
    return results

if __name__ == "__main__":
    final_results = test_kroger_locations()
    print("\nLocation Search Results:")
    print(json.dumps(final_results, indent=2))