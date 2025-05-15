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
BASE_URL = "https://connect.dev.instacart.tools"  # Development server URL
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
        self.api_key = api_key or os.environ.get("INSTACARTAPI_DEV")
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

        # Set the headers with Bearer token authentication
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
    
    def get_retailers(self) -> List[Dict]:
        """
        Get list of available retailers on Instacart.

        Returns:
            List of retailer objects
        """
        # Based on docs, we need to pass a postal code and country code
        params = {
            "postal_code": "80538",  # Default to Loveland, CO
            "country_code": "US"
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

    def get_nearby_retailers(self, zip_code: str) -> List[Dict]:
        """
        Get retailers near a specific ZIP code.

        Args:
            zip_code: The ZIP code to search near (postal code)

        Returns:
            List of nearby retailer objects
        """
        params = {
            "postal_code": zip_code,
            "country_code": "US"  # Assuming US for now
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