import os
import requests
import base64
import re  
from typing import Optional, Dict, List, Any
import logging
from urllib.parse import urlencode
from app.integration.kroger_db import get_user_kroger_credentials, update_kroger_store_location
from app.db import get_db_connection
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
        
        # Using only product.compact scope which is the only one allowed with client_credentials
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

def refresh_kroger_token(user_id: int) -> Optional[str]:
    """
    Refresh the Kroger API token for a specific user using their refresh token
    
    This function attempts to refresh a user's Kroger access token using their stored
    refresh token. This is different from getting a client_credentials token, as it 
    preserves user-specific scopes like cart.basic:write.
    
    Args:
        user_id: The database ID of the user
        
    Returns:
        Optional[str]: The new access token if successful, None if failed
    """
    try:
        logger.info(f"Attempting to refresh token for user {user_id}")
        
        # Get the user's credentials including refresh token
        from app.integration.kroger_db import get_user_kroger_credentials, update_kroger_tokens
        user_creds = get_user_kroger_credentials(user_id)
        
        if not user_creds or not user_creds.get('refresh_token'):
            logger.error(f"No refresh token found for user {user_id}")
            return None
            
        refresh_token = user_creds.get('refresh_token')
        
        # Prepare for token refresh
        token_url = f"{KROGER_BASE_URL}/connect/oauth2/token"
        
        # Create basic auth header with client credentials
        auth_string = f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}"
        basic_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
        
        headers = {
            'Authorization': f'Basic {basic_auth}',
            'Content-Type': 'application/x-www-form-urlencoded',
            'Accept': 'application/json'
        }
        
        # Use refresh_token grant type
        data = {
            'grant_type': 'refresh_token',
            'refresh_token': refresh_token
        }
        
        # Request new tokens
        response = requests.post(
            token_url, 
            headers=headers, 
            data=data,
            timeout=10
        )
        
        if response.status_code == 200:
            # Parse token data
            token_data = response.json()
            new_access_token = token_data.get('access_token')
            new_refresh_token = token_data.get('refresh_token')
            
            if new_access_token and new_refresh_token:
                # Update tokens in database
                update_success = update_kroger_tokens(
                    user_id=user_id,
                    access_token=new_access_token,
                    refresh_token=new_refresh_token
                )
                
                if update_success:
                    logger.info(f"Successfully refreshed and updated tokens for user {user_id}")
                    return new_access_token
                else:
                    logger.error("Failed to save refreshed tokens to database")
            else:
                logger.error("Tokens missing from refresh response")
        else:
            logger.error(f"Token refresh failed: {response.status_code} - {response.text}")
            
        return None
        
    except Exception as e:
        logger.error(f"Error refreshing token: {str(e)}")
        return None

def add_to_kroger_cart(access_token: str, location_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Standalone function to add items to Kroger cart
    
    Note: This function requires an access token with cart.basic:write scope,
    which can only be obtained through the authorization_code flow, not
    the client_credentials flow used for product search.
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
        elif response.status_code == 401:
            logger.error(f"Unauthorized - token invalid or expired: {response.text}")
            return {
                "success": False,
                "message": "Authentication failed - token expired or invalid",
                "error_code": "token_invalid",
                "needs_refresh": True
            }
        elif response.status_code == 403:
            logger.error(f"Forbidden - insufficient permissions: {response.text}")
            return {
                "success": False,
                "message": "Insufficient permissions - cart write access required",
                "error_code": "permission_denied"
            }
        else:
            logger.error(f"Failed to add items to Kroger cart: {response.status_code} - {response.text}")
            return {
                "success": False,
                "message": f"Failed to add items to cart: {response.text}",
                "status_code": response.status_code
            }
    except Exception as e:
        logger.error(f"Error adding items to Kroger cart: {str(e)}")
        return {
            "success": False,
            "message": f"Unexpected error: {str(e)}"
        }

class KrogerIntegration:
    def __init__(self, user_id=None, access_token=None):
        # Use environment variable for base URL with fallback to certification environment
        self.base_url = os.getenv("KROGER_BASE_URL", "https://api-ce.kroger.com/v1")
        
        # Log initialization
        logger.info(f"Initializing KrogerIntegration with base_url: {self.base_url}")
        
        # Get credentials from environment - mandatory for API access
        self.client_id = os.getenv("KROGER_CLIENT_ID")
        self.client_secret = os.getenv("KROGER_CLIENT_SECRET")
        
        # Log credential status (not the actual values)
        logger.debug(f"Client ID exists: {bool(self.client_id)}")
        logger.debug(f"Client Secret exists: {bool(self.client_secret)}")
        
        # Store user_id for operations that need it
        self.user_id = user_id
        
        # Store access token if provided (for operations that use an existing token)
        self.access_token = access_token
        
    def search_products(self, query: str, location_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Search for products on Kroger
        This is a wrapper around the standalone kroger_search_item function
        """
        logger.info(f"Searching for: {query} at location: {location_id}")
        return kroger_search_item(query, location_id)

    def get_access_token(self) -> Dict[str, Any]:
        try:
            logger.info("Attempting to get Kroger access token")
            
            if not self.client_id or not self.client_secret:
                logger.error("Missing Kroger API credentials")
                return {
                    "success": False,
                    "message": "Missing Kroger API credentials"
                }
            
            auth_string = f"{self.client_id}:{self.client_secret}"
            basic_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
            
            token_url = f"{self.base_url}/connect/oauth2/token"
            
            headers = {
                'Authorization': f'Basic {basic_auth}',
                'Content-Type': 'application/x-www-form-urlencoded',
                'Accept': 'application/json'
            }
            
            # Use only product.compact scope with client_credentials grant type
            data = {
                'grant_type': 'client_credentials',
                'scope': 'product.compact'  # Only scope allowed with client_credentials
            }
            
            logger.info(f"Sending token request to: {token_url}")
            logger.debug(f"Scopes: {data['scope']}")
            
            response = requests.post(
                token_url, 
                headers=headers, 
                data=data,
                timeout=10
            )
            
            logger.info(f"Token Request Status: {response.status_code}")
            
            if response.status_code == 200:
                token_data = response.json()
                logger.info("✅ Token generated successfully")
                logger.debug(f"Access Token: {token_data.get('access_token')[:10]}...")  # Log first 10 chars
                return {
                    "success": True,
                    "access_token": token_data.get('access_token'),
                    "expires_in": token_data.get('expires_in')
                }
            else:
                # Enhanced error logging
                logger.error(f"Token generation failed. Status: {response.status_code}")
                logger.error(f"Response Content: {response.text}")
                
                # Check for specific error types
                error_msg = f"Token generation failed. Status {response.status_code}: {response.text}"
                try:
                    error_data = response.json()
                    if 'error' in error_data:
                        error_msg = f"Kroger API error: {error_data['error']}"
                        if error_data.get('error_description'):
                            error_msg += f" - {error_data['error_description']}"
                except Exception:
                    pass  # Use default error message if JSON parsing fails
                
                return {
                    "success": False,
                    "message": error_msg
                }
        
        except Exception as e:
            logger.error(f"Unexpected error during token generation: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Unexpected error: {str(e)}"
            }

    def find_nearby_stores(self, zip_code: str = '80538', radius: int = 10) -> Dict[str, Any]:
        """
        Find nearby Kroger stores using Certification environment
        """
        try:
            # Debug logging for environment setup
            logger.info("=====================================================")
            logger.info(f"KROGER STORE SEARCH with ZIP: {zip_code}, radius: {radius}")
            logger.debug(f"KROGER_BASE_URL: {KROGER_BASE_URL}")
            logger.debug(f"Client ID exists: {bool(KROGER_CLIENT_ID)}")
            logger.debug(f"Client Secret exists: {bool(KROGER_CLIENT_SECRET)}")
            
            # Get access token first with the correct scope for locations
            token_result = self.get_access_token()
            
            if not token_result.get("success"):
                logger.error(f"Failed to obtain access token: {token_result.get('message')}")
                return token_result
            
            access_token = token_result["access_token"]
            locations_url = f"{self.base_url}/locations"
            
            # Log token length for debugging (don't log the actual token)
            logger.debug(f"Access token length: {len(access_token)}")
            logger.debug(f"Access token first 10 chars: {access_token[:10]}...")
            
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            params = {
                "filter.zipCode.near": zip_code,
                "filter.limit": 5,
                "filter.radiusInMiles": radius
            }
            
            # Detailed pre-request logging
            logger.info(f"Sending request to: {locations_url}")
            logger.debug(f"Request Params: {params}")
            
            try:
                response = requests.get(
                    locations_url, 
                    headers=headers, 
                    params=params,
                    timeout=15  # Increased timeout
                )
            except requests.exceptions.RequestException as req_err:
                logger.error(f"Request error during store lookup: {str(req_err)}")
                return {
                    "success": False,
                    "message": f"Connection error: {str(req_err)}"
                }
            
            # Enhanced response logging
            logger.info(f"Store Lookup Status: {response.status_code}")
            logger.debug(f"Response Headers: {dict(response.headers)}")
            
            # Log the entire response content for debugging
            try:
                logger.debug(f"Response Content: {response.text}")
            except Exception as log_err:
                logger.debug(f"Could not log response content: {str(log_err)}")
            
            if response.status_code == 200:
                # Try to parse the JSON response with error handling
                try:
                    data = response.json()
                except Exception as json_err:
                    logger.error(f"Failed to parse JSON response: {str(json_err)}")
                    return {
                        "success": False,
                        "message": "Failed to parse response from Kroger API"
                    }
                
                stores = data.get('data', [])
                
                logger.info(f"Found {len(stores)} stores")
                
                # Map the stores with detailed error handling
                mapped_stores = []
                for store in stores:
                    try:
                        mapped_store = {
                            "name": store.get('name', 'Unknown Store'),
                            "location_id": store.get('locationId', ''),  # CRITICAL: Include locationId
                            "address": store.get('address', {}).get('addressLine1', 'No address'),
                            "city": store.get('address', {}).get('city', ''),
                            "state": store.get('address', {}).get('state', ''),
                            "zipCode": store.get('address', {}).get('zipCode', ''),
                            "distance": store.get('distance', 0.0)  # Add default value
                        }
                        mapped_stores.append(mapped_store)
                    except Exception as store_err:
                        logger.error(f"Error mapping store: {str(store_err)}")
                        # Continue processing other stores
                
                return {
                    "success": True,
                    "stores": mapped_stores
                }
            elif response.status_code == 400:
                # Parse error details from response
                try:
                    error_data = response.json()
                    error_msg = error_data.get('error_description', error_data.get('message', 'Invalid request'))
                    logger.error(f"Bad request error: {error_msg}")
                    
                    # Check if it's a scope issue
                    if 'scope' in error_msg.lower():
                        return {
                            "success": False,
                            "message": "API permission error. The application doesn't have proper permissions to search stores."
                        }
                    
                    return {
                        "success": False,
                        "message": f"Request error: {error_msg}"
                    }
                except Exception:
                    logger.error(f"Bad request with unparseable error: {response.text}")
                    return {
                        "success": False,
                        "message": f"Invalid request: {response.text}"
                    }
            elif response.status_code == 401:
                # Handle authentication error specifically
                logger.error("Authentication error when searching for Kroger stores")
                
                try:
                    error_info = response.json()
                    error_detail = error_info.get('error_description', 'Authentication failed')
                    logger.error(f"Auth error details: {error_detail}")
                    
                    return {
                        "success": False,
                        "needs_reconnect": True,
                        "message": f"Authentication error: {error_detail}"
                    }
                except Exception:
                    return {
                        "success": False,
                        "needs_reconnect": True,
                        "message": "Your Kroger authentication has expired. Please reconnect your account."
                    }
            else:
                logger.error(f"Store lookup failed. Status: {response.status_code}")
                logger.error(f"Response Content: {response.text}")
                return {
                    "success": False,
                    "message": f"Store lookup failed. Status {response.status_code}: {response.text}"
                }
        
        except Exception as e:
            logger.error(f"Unexpected error during store lookup: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Unexpected error: {str(e)}"
            }

    async def set_store_location(self, user_id: int, location_id: str) -> Dict[str, Any]:
        """Save store location to user profile using the kroger_db helper function"""
        try:
            logger.info(f"Setting store location for user {user_id}: {location_id}")
            
            # Use the existing update_kroger_store_location function which is properly tested
            success = update_kroger_store_location(user_id, location_id)
            
            if not success:
                logger.warning(f"No rows updated for user {user_id}")
                return {
                    "success": False,
                    "message": "Failed to update store location - user not found"
                }
            
            logger.info(f"Successfully updated store location for user {user_id}")    
            return {
                "success": True,
                "message": "Store location updated successfully"
            }
            
        except Exception as e:
            logger.error(f"Error setting store location: {str(e)}", exc_info=True)
            return {
                "success": False,
                "message": f"Database error: {str(e)}"
            }
   