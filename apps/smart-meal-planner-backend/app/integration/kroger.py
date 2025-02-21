import os
import requests
import base64
import re  
from typing import Optional, Dict, List, Any
import logging
from urllib.parse import urlencode
from .kroger_db import get_user_kroger_credentials
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

logger = logging.getLogger(__name__)

# Configuration
KROGER_BASE_URL = os.getenv("KROGER_BASE_URL", "https://api-ce.kroger.com/v1")
KROGER_CLIENT_ID = os.getenv("KROGER_CLIENT_ID")
KROGER_CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET")
KROGER_REDIRECT_URI = os.getenv("KROGER_REDIRECT_URI", "http://127.0.0.1:8000/callback")
DEFAULT_KROGER_LOCATION_ID = os.getenv("DEFAULT_KROGER_LOCATION_ID")

def debug_environment():
    """Debug function to check environment variables"""
    logger.debug("Checking Kroger environment configuration:")
    logger.debug(f"KROGER_BASE_URL: {KROGER_BASE_URL}")
    logger.debug(f"Client ID length: {len(KROGER_CLIENT_ID) if KROGER_CLIENT_ID else 0}")
    logger.debug(f"Client Secret length: {len(KROGER_CLIENT_SECRET) if KROGER_CLIENT_SECRET else 0}")


def get_kroger_access_token() -> Dict[str, Any]:
    """
    Get an access token for Kroger API using client credentials flow
    """
    debug_environment()
    
    try:
        token_url = f"{KROGER_BASE_URL}/connect/oauth2/token"
        
        # Create basic auth header with explicit encoding
        auth_string = f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}"
        basic_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
        
        headers = {
            'Authorization': f'Basic {basic_auth}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }
        
        # Using only product.compact scope
        data = {
            'grant_type': 'client_credentials',
            'scope': 'product.compact'
        }
        
        logger.debug(f"Making token request to: {token_url}")
        
        response = requests.post(
            token_url, 
            headers=headers, 
            data=data,
            timeout=10
        )
        
        logger.debug(f"Response Status: {response.status_code}")
        logger.debug(f"Response Content: {response.text[:100]}...")
        
        if response.status_code == 200:
            token_data = response.json()
            return {
                "success": True,
                "access_token": token_data.get('access_token'),
                "expires_in": token_data.get('expires_in')
            }
        else:
            logger.error(f"Token request failed: {response.text}")
            return {
                "success": False,
                "status": "error",
                "message": f"Failed to get token: {response.text}"
            }
            
    except Exception as e:
        logger.error(f"Error getting token: {str(e)}")
        return {
            "success": False,
            "status": "error",
            "message": str(e)
        }

def clean_search_term(item: str) -> str:
    """
    Clean and standardize search terms for Kroger API
    
    :param item: Original item string (e.g. "1 1/4 cup red onion")
    :return: Cleaned search term (e.g. "red onion")
    """
    # Remove trailing commas and whitespace
    item = item.strip().rstrip(',').strip()
    
    # Common cooking measurements and their variations
    measurements = [
        r'\d*\.?\d+\s*(?:cups?|cup|c\.|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|milliliters?|l|liters?)',
        r'\d+/\d+\s*(?:cups?|cup|c\.|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|milliliters?|l|liters?)',
        r'\d+\s+\d+/\d+\s*(?:cups?|cup|c\.|tbsp|tsp|tablespoons?|teaspoons?|oz|ounces?|lbs?|pounds?|g|grams?|ml|milliliters?|l|liters?)'
    ]
    
    # Remove measurements
    for measurement in measurements:
        item = re.sub(measurement, '', item, flags=re.IGNORECASE)
    
    # Remove any leading numbers (including fractions)
    item = re.sub(r'^\d+\s*', '', item)  # whole numbers
    item = re.sub(r'^\d+/\d+\s*', '', item)  # fractions
    item = re.sub(r'^\d+\s+\d+/\d+\s*', '', item)  # mixed numbers
    
    # Remove common prefixes
    prefixes = [
        r'fresh\s+',
        r'organic\s+',
        r'whole\s+',
        r'raw\s+',
        r'dried\s+',
        r'frozen\s+',
        r'chilled\s+',
        r'diced\s+',
        r'sliced\s+',
        r'chopped\s+',
        r'minced\s+'
    ]
    
    for prefix in prefixes:
        item = re.sub(prefix, '', item, flags=re.IGNORECASE)
    
    # Clean up any remaining whitespace
    item = ' '.join(item.split())
    
    logger.debug(f"Cleaned search term: '{item}'")
    return item

def kroger_search_item(query: str, location_id: Optional[str] = None) -> Dict[str, Any]:
    try:
        # Clean search term
        cleaned_query = clean_search_term(query)
        logger.info(f"Original query: {query}, Cleaned query: {cleaned_query}")
        
        # Get token using our working function
        token_response = get_kroger_access_token()
        
        if not token_response['success']:
            logger.error("Failed to get access token")
            return {
                "success": False,
                "message": "Failed to obtain access token",
                "results": []
            }
        
        access_token = token_response['access_token']
        
        # Use KROGER_BASE_URL from environment
        search_url = f"{KROGER_BASE_URL}/products"
        
        # More robust headers
        search_headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json',
            'Content-Type': 'application/json; charset=utf-8'
        }
        
        # CRITICAL CHANGE: Ensure location ID is ALWAYS passed
        effective_location_id = location_id or DEFAULT_KROGER_LOCATION_ID
        
        if not effective_location_id:
            logger.error("No location ID provided or configured")
            return {
                "success": False,
                "message": "A Kroger store location ID is required",
                "results": []
            }
        
        # Prepare params WITH location ID
        params = {
            'filter.term': cleaned_query,
            'filter.limit': '50',
            'filter.locationId': effective_location_id  # ALWAYS include location ID
        }
        
        logger.debug(f"Making search request to: {search_url}")
        logger.debug(f"Search params: {params}")
        logger.debug(f"Search headers: {search_headers}")
        logger.debug(f"Using Location ID: {effective_location_id}")
        
        # Send the search request
        search_response = requests.get(
            search_url,
            headers=search_headers,
            params=params,
            timeout=10,
            verify=True
        )
        
        # Enhanced logging
        logger.debug(f"Search response status: {search_response.status_code}")
        logger.debug(f"Search response headers: {dict(search_response.headers)}")
        logger.debug(f"Search response content: {search_response.text}")
        
        if search_response.status_code != 200:
            logger.error(f"Search failed: {search_response.text}")
            return {
                "success": False,
                "message": f"Search failed with status {search_response.status_code}",
                "results": []
            }
        
        try:
            data = search_response.json().get('data', [])
            results = []
            
            for item in data:
                try:
                    # Extract product details with comprehensive error handling
                    result = {
                        "name": item.get('description', 'Unknown Product'),
                        "upc": item.get('upc', ''),
                        "brand": item.get('brand', 'Unknown Brand'),
                        "price": (
                            item.get('items', [{}])[0]
                            .get('price', {})
                            .get('regular', 'N/A')
                        ),
                        "size": (
                            item.get('items', [{}])[0]
                            .get('size', 'N/A')
                        ),
                        "fulfillment": {
                            "instore": (
                                item.get('fulfillment', {})
                                .get('instore', False)
                            ),
                            "curbside": (
                                item.get('fulfillment', {})
                                .get('curbside', False)
                            ),
                            "delivery": (
                                item.get('fulfillment', {})
                                .get('delivery', False)
                            ),
                            "shiptohome": (
                                item.get('fulfillment', {})
                                .get('shiptohome', False)
                            )
                        }
                    }
                    results.append(result)
                except Exception as item_err:
                    logger.warning(f"Error processing item: {item_err}")
                    continue
            
            return {
                "success": True,
                "results": results
            }
            
        except Exception as parse_err:
            logger.error(f"Error parsing response: {parse_err}")
            return {
                "success": False,
                "message": "Failed to parse search results",
                "results": []
            }
            
    except Exception as e:
        logger.error(f"Unexpected error in Kroger search: {str(e)}")
        return {
            "success": False,
            "message": str(e),
            "results": []
        }


def add_to_kroger_cart(access_token: str, location_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Standalone function to add items to Kroger cart
    """
    cart_url = f"{KROGER_BASE_URL}/cart/add"
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json"
    }

    payload = {
        "locationId": location_id,
        "items": items
    }
    
    try:
        response = requests.put(cart_url, headers=headers, json=payload)
        
        if response.status_code in (200, 201):
            return {
                "success": True,
                "message": "Items added to cart successfully",
                "details": response.json()
            }
        else:
            logger.error(f"Failed to add items to Kroger cart: {response.status_code} - {response.text}")
            return {
                "success": False,
                "message": f"Failed to add items to cart: {response.text}"
            }
    except Exception as e:
        logger.error(f"Error adding items to Kroger cart: {str(e)}")
        return {
            "success": False,
            "message": f"Unexpected error: {str(e)}"
        }

class KrogerIntegration:
    def __init__(self, id: Optional[int] = None, access_token: Optional[str] = None):
        """Initialize Kroger Integration"""
        if access_token:
            self.access_token = access_token
        elif id:
            # Retrieve user-specific credentials
            credentials = get_user_kroger_credentials(id)
            
            # Try to get access token
            token_response = get_kroger_access_token()
            
            if token_response['success']:
                self.access_token = token_response['access_token']
            else:
                raise ValueError("Failed to obtain Kroger access token")
        else:
            # Fallback to environment credentials
            token_response = get_kroger_access_token()
            
            if token_response['success']:
                self.access_token = token_response['access_token']
            else:
                raise ValueError("Failed to obtain Kroger access token")

def get_kroger_cart(access_token: str) -> Dict[str, Any]:
    """Get current Kroger cart contents"""
    try:
        cart_url = f"{KROGER_BASE_URL}/cart"
        
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}"
        }

        response = requests.get(cart_url, headers=headers)
        
        logger.info(f"Get cart response status: {response.status_code}")

        if response.status_code == 200:
            return {
                "success": True,
                "cart": response.json()
            }
        else:
            error_msg = f"Failed to get Kroger cart: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg
            }

    except Exception as e:
        error_msg = f"Error getting Kroger cart: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "message": error_msg
        }

def clear_kroger_cart(access_token: str) -> Dict[str, Any]:
    """Clear the Kroger cart"""
    try:
        cart_url = f"{KROGER_BASE_URL}/cart"
        
        headers = {
            "Accept": "application/json",
            "Authorization": f"Bearer {access_token}"
        }

        response = requests.delete(cart_url, headers=headers)
        
        logger.info(f"Clear cart response status: {response.status_code}")

        if response.status_code == 204:
            return {
                "success": True,
                "message": "Cart cleared successfully"
            }
        else:
            error_msg = f"Failed to clear Kroger cart: {response.status_code} - {response.text}"
            logger.error(error_msg)
            return {
                "success": False,
                "message": error_msg
            }

    except Exception as e:
        error_msg = f"Error clearing Kroger cart: {str(e)}"
        logger.error(error_msg)
        return {
            "success": False,
            "message": error_msg
        }