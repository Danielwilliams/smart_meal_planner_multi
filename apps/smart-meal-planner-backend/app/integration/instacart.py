"""
Instacart API Integration Module

This module handles all interactions with the Instacart API, including
authentication, product search, and cart management.

Documentation: https://docs.instacart.com/developer_platform_api/
"""

import os
import time
import json
import logging
import requests
from typing import Dict, List, Optional, Any, Union
from fastapi import HTTPException, status

# Configure logging
logger = logging.getLogger(__name__)

# Constants
BASE_URL = "https://connect.instacart.com"  # Production server URL
DEV_BASE_URL = "https://connect.dev.instacart.tools"  # Development server for reference
API_VERSION = "idp/v1"  # IDP API version according to docs

class InstacartClient:
    """Client for interacting with the Instacart API."""
    
    def __init__(self, api_key: Optional[str] = None):
        """
        Initialize the Instacart client.
        
        Args:
            api_key: The Instacart API key. If not provided, will try to get from environment variable.
        """
        # Get the API key from param or environment
        self.api_key = api_key or os.environ.get("INSTACART_API_KEY")
        if not self.api_key:
            logger.error("No Instacart API key provided")
            raise ValueError("Instacart API key is required")

        # Format the API key using Bearer token format per documentation
        if self.api_key.startswith("InstacartAPI "):
            logger.info("Removing 'InstacartAPI ' prefix for Bearer token")
            self.formatted_api_key = self.api_key.replace("InstacartAPI ", "")
        else:
            logger.info("Using API key as Bearer token")
            self.formatted_api_key = self.api_key

        # Create and configure the session
        self.session = requests.Session()

        # Set the headers according to the official documentation
        # Per https://docs.instacart.com/developer_platform_api/api/overview/
        # The official format is: 'Authorization: Bearer <API-key>'
        self.session.headers.update({
            "Authorization": f"Bearer {self.formatted_api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json"
        })

        masked_key = self.formatted_api_key[:4] + "..." + self.formatted_api_key[-4:] if len(self.formatted_api_key) > 8 else "***masked***"
        logger.info(f"Initialized Instacart client with masked key: {masked_key}")
        logger.info(f"Header set: Authorization: Bearer {masked_key}")
    
    def _make_request(
        self, 
        method: str, 
        endpoint: str, 
        params: Dict = None, 
        data: Dict = None
    ) -> Dict:
        """
        Make a request to the Instacart API.
        
        Args:
            method: HTTP method (GET, POST, etc.)
            endpoint: API endpoint
            params: Query parameters
            data: Request body data
            
        Returns:
            API response as dictionary
        """
        url = f"{BASE_URL}/{API_VERSION}/{endpoint}"
        logger.info(f"Making {method} request to {url}")
        
        try:
            # Log the request details for debugging
            logger.info(f"Making {method} request to {url}")
            if params:
                logger.info(f"Request params: {params}")
            if data:
                logger.info(f"Request data: {json.dumps(data)[:100]}...")

            # Make the request
            if method.upper() == "GET":
                response = self.session.get(url, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")

            # Log response info for debugging
            logger.info(f"Response status: {response.status_code}")

            # Check for HTTP errors
            response.raise_for_status()

            if response.status_code == 204:  # No content
                return {}

            # Parse and return the JSON response
            json_data = response.json()
            logger.info(f"Response data sample: {str(json_data)[:200]}...")
            return json_data

        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {str(e)}")
            error_info = {}

            try:
                error_info = response.json()
            except:
                error_info = {"message": str(e)}

            logger.error(f"Error details: {json.dumps(error_info)}")

            status_code = response.status_code
            if status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized access to Instacart API - Check API key format and validity"
                )
            elif status_code == 403:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden access to Instacart API - API key may not have proper permissions"
                )
            elif status_code == 404:
                # Provide more detailed error for 404 responses
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Resource not found on Instacart API: {endpoint} - Check the API endpoint path"
                )
            else:
                # Include original response data in error for debugging
                error_detail = {
                    "message": f"Instacart API error: {str(e)}",
                    "status_code": status_code,
                    "response_data": error_info
                }
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=json.dumps(error_detail)
                )
                
        except requests.exceptions.ConnectionError as e:
            logger.error(f"Connection error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
                detail="Could not connect to Instacart API"
            )
            
        except Exception as e:
            logger.error(f"Unexpected error: {str(e)}")
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Error communicating with Instacart API: {str(e)}"
            )
    
    # API Functions
    
    def get_retailers(self, postal_code: str = "80538", country_code: str = "US") -> List[Dict]:
        """
        Get list of available retailers on Instacart.

        Args:
            postal_code: The postal code to find retailers for
            country_code: The country code (default: US)

        Returns:
            List of retailer objects
        """
        # Based on docs, we need to pass a postal code and country code
        params = {
            "postal_code": postal_code,
            "country_code": country_code
        }
        response = self._make_request("GET", "retailers", params=params)

        # Handle the response format from IDP API - retailers are in a "retailers" key
        if isinstance(response, dict):
            if "data" in response:
                return response.get("data", [])
            elif "retailers" in response:
                return response.get("retailers", [])
        elif isinstance(response, list):
            return response

        return []
    
    def search_products(
        self,
        retailer_id: str,
        query: str,
        limit: int = 10
    ) -> List[Dict]:
        """
        Search for products at a specific retailer.

        Note: Based on documentation, we're using the products/search endpoint
        with a retailer_key parameter

        Args:
            retailer_id: The Instacart retailer ID (retailer_key)
            query: Search query string
            limit: Maximum number of results to return

        Returns:
            List of product objects
        """
        params = {
            "q": query,  # Use 'q' as the query parameter
            "retailer_key": retailer_id,
            "limit": limit
        }

        endpoint = "products/search"  # Use the products/search endpoint
        response = self._make_request("GET", endpoint, params=params)

        # Handle the response format from IDP API
        if isinstance(response, dict):
            if "data" in response:
                return response.get("data", [])
            elif "products" in response:  # Products may be in a "products" key
                return response.get("products", [])
        elif isinstance(response, list):
            return response

        return []

    def get_nearby_retailers(self, postal_code: str = "80538", country_code: str = "US") -> List[Dict]:
        """
        Get retailers near a specific postal code.

        Args:
            postal_code: The postal code to search near
            country_code: The country code (default: US)

        Returns:
            List of nearby retailer objects
        """
        params = {
            "postal_code": postal_code,
            "country_code": country_code
        }

        # Use same retailers endpoint with postal_code
        endpoint = "retailers"
        response = self._make_request("GET", endpoint, params=params)

        # Handle the response format from IDP API
        if isinstance(response, dict):
            if "data" in response:
                return response.get("data", [])
            elif "retailers" in response:  # Retailers response format
                return response.get("retailers", [])
        elif isinstance(response, list):
            return response

        return []
    
    def create_cart(self, retailer_id: str) -> Dict:
        """
        Create a new cart for a specific retailer.
        
        Args:
            retailer_id: The Instacart retailer ID
            
        Returns:
            Cart object with ID
        """
        data = {
            "data": {
                "type": "cart",
                "attributes": {
                    "retailer_id": retailer_id
                }
            }
        }
        
        response = self._make_request("POST", "carts", data=data)
        return response.get("data", {})
    
    def add_item_to_cart(
        self, 
        cart_id: str, 
        product_id: str, 
        quantity: int = 1
    ) -> Dict:
        """
        Add an item to a cart.
        
        Args:
            cart_id: The Instacart cart ID
            product_id: The product ID to add
            quantity: Quantity to add
            
        Returns:
            Updated cart object
        """
        data = {
            "data": {
                "type": "cart_item",
                "attributes": {
                    "product_id": product_id,
                    "quantity": quantity
                }
            }
        }
        
        endpoint = f"carts/{cart_id}/items"
        response = self._make_request("POST", endpoint, data=data)
        
        return response.get("data", {})
    
    def get_cart(self, cart_id: str) -> Dict:
        """
        Get cart details including items.
        
        Args:
            cart_id: The Instacart cart ID
            
        Returns:
            Cart object with items
        """
        endpoint = f"carts/{cart_id}"
        response = self._make_request("GET", endpoint)
        
        return response.get("data", {})
    
    def checkout_url(self, cart_id: str) -> str:
        """
        Get checkout URL for a cart.

        Args:
            cart_id: The Instacart cart ID

        Returns:
            URL to checkout the cart on Instacart website
        """
        data = {
            "data": {
                "type": "checkout_url",
                "attributes": {}
            }
        }

        endpoint = f"carts/{cart_id}/checkout_url"
        response = self._make_request("POST", endpoint, data=data)

        return response.get("data", {}).get("attributes", {}).get("url", "")

    def create_shopping_list_url(
        self,
        retailer_id: str,
        items: List[str],
        postal_code: str = "80538",
        country_code: str = "US"
    ) -> str:
        """
        Create a shopping list page URL that opens directly in Instacart.

        Args:
            retailer_id: The Instacart retailer ID
            items: List of item strings (may contain embedded quantities)
            postal_code: User's postal code for location
            country_code: Country code (default: US)

        Returns:
            URL string for the Instacart shopping list
        """
        # Clean the items by removing any None or empty values
        cleaned_items = [item.strip() for item in items if item and item.strip()]

        if not cleaned_items:
            raise ValueError("No valid items provided for shopping list")

        # Build the request data - based on the error, API expects flat structure
        data = {
            "title": "Smart Meal Planner Shopping List",
            "retailer_id": retailer_id,
            "postal_code": postal_code,
            "country_code": country_code,
            "line_items": [
                parse_item_quantity_and_name(item)
                for item in cleaned_items
            ]
        }

        # Log the request format with retailer ID information
        logger.info(f"Using retailer_id: {retailer_id} for API request")
        logger.info(f"Sending {len(data['line_items'])} items to Instacart:")
        for i, item in enumerate(data['line_items'][:3]):  # Log first 3 items
            logger.info(f"  Item {i+1}: {item}")
        logger.info(f"Full request data: {json.dumps(data, indent=2)}")

        # Use the correct endpoint from official documentation
        endpoint = "products/products_link"  # This is the correct endpoint according to docs
        logger.info(f"Creating shopping list URL for retailer {retailer_id} with {len(cleaned_items)} items")

        try:
            response = self._make_request("POST", endpoint, data=data)

            # Log the full response to debug URL extraction
            logger.info(f"Full response from Instacart API: {json.dumps(response, indent=2)}")

            # Try multiple possible response formats to extract URL
            url = None

            if response:
                # Try direct url field
                if "url" in response:
                    url = response["url"]
                    logger.info("Found URL in root level")

                # Try nested data.attributes.url (original format)
                elif "data" in response and isinstance(response["data"], dict):
                    data_section = response["data"]
                    if "url" in data_section:
                        url = data_section["url"]
                        logger.info("Found URL in data level")
                    elif "attributes" in data_section and isinstance(data_section["attributes"], dict):
                        attributes = data_section["attributes"]
                        if "url" in attributes:
                            url = attributes["url"]
                            logger.info("Found URL in data.attributes level")

                # Try other possible URL field names
                elif "shopping_list_url" in response:
                    url = response["shopping_list_url"]
                    logger.info("Found URL in shopping_list_url field")
                elif "products_link_url" in response:
                    url = response["products_link_url"]
                    logger.info("Found URL in products_link_url field")

            if url and isinstance(url, str) and url.strip():
                logger.info(f"Successfully created shopping list URL: {url[:50]}...")
                return url.strip()
            else:
                logger.error(f"No valid URL found in response. Available keys: {list(response.keys()) if response else 'No response'}")
                logger.error(f"Full response: {response}")
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to get shopping list URL from Instacart. Response keys: {list(response.keys()) if response else 'No response'}"
                )

        except Exception as e:
            logger.error(f"Error creating shopping list: {str(e)}")
            if "502" in str(e) or "Bad Gateway" in str(e):
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Instacart API error: {str(e)}"
                )
            else:
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail=f"Failed to create Instacart shopping list: {str(e)}"
                )

def parse_item_quantity_and_name(item_string: str) -> Dict:
    """
    Parse an item string like "2 tsp Taco Seasoning" into quantity and clean name.

    Args:
        item_string: String like "2 tsp Taco Seasoning" or "8 Corn Tortillas"

    Returns:
        Dict with 'name' and 'quantity' fields
    """
    import re

    # Pattern 1: Quantity with unit (e.g., "1 lb Beef (ground)", "2 tbsp Olive Oil")
    quantity_with_unit_pattern = r'^(\d+(?:\.\d+)?(?:/\d+)?)\s*(lb|lbs|oz|g|kg|cup|cups|tbsp|tsp|cloves?|pieces?|medium|large|small|cans?|slices?)\s+(.+)$'
    quantity_with_unit_match = re.match(quantity_with_unit_pattern, item_string, re.IGNORECASE)

    # Pattern 2: Quantity without unit (e.g., "8 Corn Tortillas", "2 Bell Pepper")
    quantity_only_pattern = r'^(\d+(?:\.\d+)?(?:/\d+)?)\s+(.+)$'
    quantity_only_match = re.match(quantity_only_pattern, item_string)

    if quantity_with_unit_match:
        # Extract quantity, unit, and clean name
        quantity_str, unit, ingredient_name = quantity_with_unit_match.groups()

        # Handle fractions
        if '/' in quantity_str:
            numerator, denominator = quantity_str.split('/')
            quantity = float(numerator) / float(denominator)
        else:
            quantity = float(quantity_str)

        # Return clean name with unit but proper quantity field
        return {
            "name": f"{unit} {ingredient_name}",
            "quantity": quantity
        }

    elif quantity_only_match:
        # Extract quantity and clean name (no unit)
        quantity_str, ingredient_name = quantity_only_match.groups()

        # Handle fractions
        if '/' in quantity_str:
            numerator, denominator = quantity_str.split('/')
            quantity = float(numerator) / float(denominator)
        else:
            quantity = float(quantity_str)

        # Return clean name with proper quantity field
        return {
            "name": ingredient_name,
            "quantity": quantity
        }
    else:
        # No quantity pattern matched, use as-is with default quantity
        return {
            "name": item_string,
            "quantity": 1
        }


# Create a singleton instance to reuse
_instacart_client = None

def get_instacart_client() -> InstacartClient:
    """
    Get or create the Instacart client instance.
    
    Returns:
        InstacartClient instance
    """
    global _instacart_client
    
    if _instacart_client is None:
        _instacart_client = InstacartClient()
        
    return _instacart_client

# Helper functions for common operations

def search_for_grocery_item(retailer_id: str, item_name: str, limit: int = 5) -> List[Dict]:
    """
    Search for a grocery item by name.
    
    Args:
        retailer_id: The Instacart retailer ID
        item_name: Name of the grocery item
        limit: Maximum number of results to return
        
    Returns:
        List of matching products
    """
    client = get_instacart_client()
    return client.search_products(retailer_id, item_name, limit)

def create_cart_with_items(
    retailer_id: str,
    items: List[Dict[str, Union[str, int]]]
) -> Dict:
    """
    Create a cart and add multiple items to it.

    Args:
        retailer_id: The Instacart retailer ID
        items: List of items to add, each with 'product_id' and 'quantity'

    Returns:
        Cart object with checkout URL
    """
    client = get_instacart_client()

    # Create the cart
    cart = client.create_cart(retailer_id)
    cart_id = cart.get("id")

    if not cart_id:
        logger.error("Failed to create cart")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create Instacart cart"
        )

    # Add items to the cart
    for item in items:
        client.add_item_to_cart(
            cart_id,
            product_id=item["product_id"],
            quantity=item.get("quantity", 1)
        )

    # Get checkout URL
    checkout_url = client.checkout_url(cart_id)

    # Get updated cart
    updated_cart = client.get_cart(cart_id)
    updated_cart["checkout_url"] = checkout_url

    return updated_cart

def create_shopping_list_url_from_items(
    retailer_id: str,
    item_names: List[str],
    postal_code: str = "80538",
    country_code: str = "US"
) -> str:
    """
    Create a shopping list URL using Instacart's official API.
    
    This function uses Instacart's official shopping_list_pages API endpoint
    to generate a URL that will open a pre-populated shopping list in Instacart.
    
    Args:
        retailer_id: The Instacart retailer ID
        item_names: List of item names/descriptions
        postal_code: User's postal code
        country_code: Country code (default: US)
        
    Returns:
        URL to a pre-populated shopping list on Instacart
    """
    logger.info(f"Creating shopping list for retailer: {retailer_id}")
    logger.info(f"Item count: {len(item_names) if item_names else 0}")
    
    # First validate and normalize the retailer_id
    if not isinstance(retailer_id, str) or len(retailer_id) < 2:
        logger.warning(f"Invalid retailer_id format detected: {retailer_id}, defaulting to 'kroger'")
        retailer_id = 'kroger'  # Default to a known working retailer

    # Try to convert retailer IDs to the expected numeric format if needed
    # Some retailers have known numeric IDs that work better with the API
    retailer_mapping = {
        "kroger": "8",           # Kroger appears to be retailer ID 8
        "publix": "87",          # Example mapping
        "costco": "5",           # Example mapping
        "aldi": "25",            # Example mapping
        "target": "116",         # Example mapping
        "walmart": "118",        # Example mapping
        "wegmans": "119",        # Example mapping
        "sams_club": "93",       # Example mapping
        "sprouts": "105"         # Example mapping
    }

    # If retailer_id is a name, convert to numeric ID if we have a mapping
    if retailer_id.lower() in retailer_mapping:
        numeric_id = retailer_mapping[retailer_id.lower()]
        logger.info(f"Converting retailer name '{retailer_id}' to numeric ID: {numeric_id}")
        retailer_id = numeric_id
    # If retailer_id starts with 'retailer_', extract the numeric part
    elif retailer_id.startswith('retailer_'):
        numeric_id = retailer_id.replace('retailer_', '')
        logger.info(f"Extracting numeric ID from '{retailer_id}': {numeric_id}")
        retailer_id = numeric_id

    logger.info(f"Using retailer_id: {retailer_id}")
    
    # Log sample items
    if item_names and len(item_names) > 0:
        sample_items = item_names[:3]
        logger.info(f"Sample items: {sample_items}")
    
    # Use the official API - without any fallback
    # Enable verbose logging to diagnose API issues
    old_level = logging.getLogger().level
    logging.getLogger().setLevel(logging.DEBUG)
    
    try:
        # Clean items to ensure proper format
        cleaned_items = []
        for item in item_names:
            if not item:
                continue

            # Handle different item formats
            if isinstance(item, str):
                cleaned_items.append(item)
            elif isinstance(item, dict) and "name" in item:
                cleaned_items.append(item["name"])
            else:
                # Convert to string representation as fallback
                try:
                    cleaned_items.append(str(item))
                except:
                    logger.warning(f"Unable to convert item to string: {item}")
                    continue

        # Get client instance
        client = get_instacart_client()

        # Log API request details
        logger.info(f"Calling products/products_link endpoint for retailer: {retailer_id}")
        logger.info(f"Using postal_code: {postal_code}, country_code: {country_code}")
        logger.info(f"First few items: {cleaned_items[:3] if cleaned_items else []}")
        
        # Call the official API method
        url = client.create_shopping_list_url(
            retailer_id=retailer_id,
            items=cleaned_items,
            postal_code=postal_code,
            country_code=country_code
        )
        
        # Validate the URL
        if not url or not isinstance(url, str) or len(url) < 10:
            logger.error(f"API returned invalid URL: {url}")
            raise ValueError(f"API returned invalid URL: {url}")
            
        logger.info(f"Successfully created shopping list URL via API: {url[:60]}...")
        return url
        
    except Exception as e:
        # Log the API error with detailed information
        logger.error(f"Error using Instacart API: {str(e)}", exc_info=True)

        # Re-raise the exception to propagate it to the caller
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to create Instacart shopping list: {str(e)}"
        )
    finally:
        # Always restore the original logging level
        logging.getLogger().setLevel(old_level)