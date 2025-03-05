import os
import requests
import logging
import time
import json
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
WALMART_BASE_URL = os.getenv("WALMART_BASE_URL", "https://developer.api.walmart.com/api-proxy/service")
WALMART_CONSUMER_ID = os.getenv("WALMART_CONSUMER_ID", "")
WALMART_CONSUMER_SECRET = os.getenv("WALMART_CONSUMER_SECRET", "")
WALMART_ENV = os.getenv("WALMART_ENV", "production")  # 'production' or 'stage'

# If WALMART_ENV is stage, use the stage credentials
if WALMART_ENV == "stage":
    WALMART_CONSUMER_ID = os.getenv("WALMART_STAGE_CONSUMER_ID", "0c3150a4-d8f0-44b4-8b4f-4c2a1cecb163")
else:
    WALMART_CONSUMER_ID = os.getenv("WALMART_PROD_CONSUMER_ID", "0694cf0e-00f0-4b11-ac97-e38cd4d8f3a7")

def debug_environment():
    """Debug function to check environment variables"""
    logger.debug("Checking Walmart environment configuration:")
    logger.debug(f"WALMART_BASE_URL: {WALMART_BASE_URL}")
    logger.debug(f"WALMART_ENV: {WALMART_ENV}")
    logger.debug(f"WALMART_CONSUMER_ID: {WALMART_CONSUMER_ID[:5]}... (truncated)")

class WalmartIOIntegration:
    def __init__(self):
        debug_environment()
        self.base_url = WALMART_BASE_URL
        self.consumer_id = WALMART_CONSUMER_ID
        self.consumer_secret = WALMART_CONSUMER_SECRET

    def _get_headers(self) -> Dict[str, str]:
        """
        Create headers required for Walmart API requests
        """
        timestamp = str(int(time.time() * 1000))
        
        headers = {
            'WM_SEC.KEY_VERSION': '1',
            'WM_CONSUMER.ID': self.consumer_id,
            'WM_CONSUMER.INTIMESTAMP': timestamp,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
        }
        
        return headers

    def search_products(self, query: str, limit: int = 20) -> Dict[str, Any]:
        """
        Search for products using Walmart Search API
        
        :param query: Search term
        :param limit: Maximum number of results to return
        :return: Dictionary with search results
        """
        try:
            logger.info(f"Searching Walmart products for: {query}")
            
            endpoint = f"/affil/product/v2/search"
            url = f"{self.base_url}{endpoint}"
            
            # Process query
            clean_query = query.strip().lower()
            
            headers = self._get_headers()
            
            params = {
                'query': clean_query,
                'numItems': limit
            }
            
            logger.debug(f"Search URL: {url}")
            logger.debug(f"Headers: {headers}")
            logger.debug(f"Params: {params}")
            
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=10
            )
            
            logger.debug(f"Response Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                
                # Transform data to match our app's expected format
                results = []
                
                for item in data.get('items', []):
                    result = {
                        "id": item.get('itemId'),
                        "name": item.get('name', 'Unknown Product'),
                        "brand": item.get('brandName', 'Unknown Brand'),
                        "price": item.get('salePrice', 0.0),
                        "image_url": item.get('largeImage'),
                        "available_online": item.get('availableOnline', False),
                        "original_query": query,
                        "size": item.get('size', 'N/A')
                    }
                    results.append(result)
                
                return {
                    "success": True,
                    "results": results
                }
            else:
                logger.error(f"Walmart search error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Search failed with status {response.status_code}: {response.text}",
                    "results": []
                }
                
        except Exception as e:
            logger.error(f"Error searching Walmart products: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "results": []
            }

    def get_product_details(self, product_id: str) -> Dict[str, Any]:
        """
        Get detailed information about a specific product
        
        :param product_id: Walmart product ID
        :return: Dictionary with product details
        """
        try:
            logger.info(f"Getting Walmart product details for ID: {product_id}")
            
            endpoint = f"/affil/product/v2/items/{product_id}"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            response = requests.get(
                url,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                return {
                    "success": True,
                    "product": response.json()
                }
            else:
                logger.error(f"Product details error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to get product details: {response.text}"
                }
                
        except Exception as e:
            logger.error(f"Error getting product details: {str(e)}")
            return {
                "success": False,
                "message": str(e)
            }
            
    def find_nearby_stores(self, zip_code: str = '94040', radius: int = 10) -> Dict[str, Any]:
        """
        Find Walmart stores near a given zip code
        
        :param zip_code: Zip code to search around
        :param radius: Search radius in miles
        :return: Dictionary with store results
        """
        try:
            logger.info(f"Finding Walmart stores near ZIP: {zip_code}")
            
            endpoint = "/affil/product/v2/stores"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            params = {
                'zip': zip_code,
                'distance': radius
            }
            
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                store_data = response.json().get('stores', [])
                
                stores = []
                for store in store_data:
                    stores.append({
                        "locationId": store.get('storeId'),
                        "name": f"Walmart #{store.get('storeNumber')}",
                        "address": {
                            "addressLine1": store.get('streetAddress'),
                            "city": store.get('city'),
                            "state": store.get('stateProvCode'),
                            "zipCode": store.get('zip')
                        },
                        "distance": store.get('distance'),
                        "phone": store.get('phoneNumber'),
                        "hours": self._format_store_hours(store.get('operationalHours', {}))
                    })
                
                return {
                    "success": True,
                    "stores": stores
                }
            else:
                logger.error(f"Store search error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to find stores: {response.text}",
                    "stores": []
                }
                
        except Exception as e:
            logger.error(f"Error finding stores: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "stores": []
            }
    
    def _format_store_hours(self, hours_data: Dict) -> Dict[str, Any]:
        """
        Format store hours from Walmart API to a standardized format
        
        :param hours_data: Hours data from Walmart API
        :return: Formatted hours dictionary
        """
        days = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]
        formatted_hours = {}
        
        for day in days:
            day_data = hours_data.get(day.capitalize(), {})
            
            # Check if the store is closed on this day
            if not day_data or day_data.get('closed', True):
                formatted_hours[day] = {
                    "open": None,
                    "close": None,
                    "open24": False
                }
            else:
                open_time = day_data.get('open')
                close_time = day_data.get('close')
                
                # Check if store is open 24 hours
                open24 = (open_time == "00:00" and close_time == "24:00")
                
                formatted_hours[day] = {
                    "open": open_time,
                    "close": close_time,
                    "open24": open24
                }
        
        return formatted_hours

    def add_to_cart(self, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Add items to Walmart cart (simulated)
        
        :param items: List of items to add to cart
        :return: Status dictionary
        """
        try:
            # Note: Walmart doesn't have a public Cart API
            # This is a simulated response for compatibility with our app
            
            logger.info(f"Simulating adding {len(items)} items to Walmart cart")
            
            item_details = []
            for item in items:
                item_details.append({
                    "id": item.get("id"),
                    "name": item.get("name", "Unknown Product"),
                    "price": item.get("price", 0.0),
                    "quantity": item.get("quantity", 1)
                })
            
            return {
                "success": True,
                "message": "Items added to cart simulation",
                "details": {
                    "items": item_details,
                    "total_items": len(items)
                }
            }
                
        except Exception as e:
            logger.error(f"Error adding to cart: {str(e)}")
            return {
                "success": False,
                "message": str(e)
            }

def test_walmart_integration():
    """Test function to verify Walmart API integration"""
    integration = WalmartIOIntegration()
    
    # Test product search
    search_results = integration.search_products("milk", limit=5)
    print("Search Results:", json.dumps(search_results, indent=2))
    
    # Test store locator
    store_results = integration.find_nearby_stores("94040", 10)
    print("Store Results:", json.dumps(store_results, indent=2))
    
    return search_results["success"] and store_results["success"]

if __name__ == "__main__":
    if test_walmart_integration():
        print("Walmart integration tests passed!")
    else:
        print("Walmart integration tests failed!")