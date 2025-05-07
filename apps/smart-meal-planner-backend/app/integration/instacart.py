import os
import requests
import logging
import base64
import re
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configuration
INSTACART_BASE_URL = os.getenv("INSTACART_BASE_URL", "https://platform-api.instacart.com")
INSTACART_API_KEY = os.getenv("INSTACARTAPI_DEV")

def debug_environment():
    """Debug function to check environment variables"""
    logger.debug("Checking Instacart environment configuration:")
    logger.debug(f"INSTACART_BASE_URL: {INSTACART_BASE_URL}")
    logger.debug(f"INSTACART_API_KEY exists: {bool(INSTACART_API_KEY)}")

def clean_search_term(item: str) -> str:
    """
    Clean and standardize search terms for Instacart API
    
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

class InstacartIntegration:
    def __init__(self):
        debug_environment()
        self.base_url = INSTACART_BASE_URL
        self.api_key = INSTACART_API_KEY
        
    def _get_headers(self) -> Dict[str, str]:
        """
        Create headers required for Instacart API requests
        """
        headers = {
            'Authorization': f'Bearer {self.api_key}',
            'Content-Type': 'application/json',
            'Accept': 'application/json'
        }
        
        return headers
    
    def search_products(self, query: str, retailer_id: Optional[str] = None, limit: int = 20) -> Dict[str, Any]:
        """
        Search for products on Instacart
        
        :param query: Search term
        :param retailer_id: Optional retailer ID to search within specific store
        :param limit: Maximum number of results to return
        :return: Dictionary with search results
        """
        try:
            # Clean the search query
            clean_query = clean_search_term(query)
            logger.info(f"Searching Instacart products for: {clean_query}")
            
            # Instacart API endpoint for product search
            endpoint = "/v1/products/search"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            params = {
                'query': clean_query,
                'limit': limit
            }
            
            # Add retailer_id if provided
            if retailer_id:
                params['retailer_id'] = retailer_id
                
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
                
                for item in data.get('products', []):
                    result = {
                        "id": item.get('id'),
                        "name": item.get('name', 'Unknown Product'),
                        "brand": item.get('brand', {}).get('name', 'Unknown Brand'),
                        "price": item.get('price', {}).get('amount', 0.0),
                        "image_url": item.get('image_url'),
                        "size": item.get('size', 'N/A'),
                        "original_query": query,
                        "retailer": item.get('retailer', {}).get('name', 'Instacart')
                    }
                    results.append(result)
                
                return {
                    "success": True,
                    "results": results
                }
            else:
                logger.error(f"Instacart search error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Search failed with status {response.status_code}: {response.text}",
                    "results": []
                }
                
        except Exception as e:
            logger.error(f"Error searching Instacart products: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "results": []
            }
    
    def get_available_retailers(self, zip_code: str = '80538') -> Dict[str, Any]:
        """
        Get available retailers in a given zip code
        
        :param zip_code: Zip code to search for retailers
        :return: Dictionary with available retailers
        """
        try:
            logger.info(f"Getting available Instacart retailers for ZIP: {zip_code}")
            
            endpoint = "/v1/retailers"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            params = {
                'zipcode': zip_code
            }
            
            response = requests.get(
                url,
                headers=headers,
                params=params,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                retailers = []
                for retailer in data.get('retailers', []):
                    retailers.append({
                        "id": retailer.get('id'),
                        "name": retailer.get('name'),
                        "logo_url": retailer.get('logo_url'),
                        "delivery_fee": retailer.get('delivery_fee', {}).get('amount', 0.0)
                    })
                
                return {
                    "success": True,
                    "retailers": retailers
                }
            else:
                logger.error(f"Retailer search error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to find retailers: {response.text}",
                    "retailers": []
                }
                
        except Exception as e:
            logger.error(f"Error finding retailers: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "retailers": []
            }
    
    def create_shopping_list(self, name: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Create a shopping list on Instacart
        
        :param name: Name of the shopping list
        :param items: List of items to add to the shopping list
        :return: Dictionary with shopping list details
        """
        try:
            logger.info(f"Creating Instacart shopping list: {name} with {len(items)} items")
            
            endpoint = "/v1/shopping_lists"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            # Format items for Instacart API
            formatted_items = []
            for item in items:
                formatted_item = {
                    "product_id": item.get("id"),
                    "quantity": item.get("quantity", 1)
                }
                formatted_items.append(formatted_item)
            
            payload = {
                "name": name,
                "items": formatted_items
            }
            
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code in (200, 201):
                data = response.json()
                
                return {
                    "success": True,
                    "shopping_list": {
                        "id": data.get('id'),
                        "name": data.get('name'),
                        "url": data.get('url'),  # URL to access the shopping list on Instacart
                        "items_count": len(formatted_items)
                    }
                }
            else:
                logger.error(f"Shopping list creation error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to create shopping list: {response.text}"
                }
                
        except Exception as e:
            logger.error(f"Error creating shopping list: {str(e)}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def add_to_existing_shopping_list(self, shopping_list_id: str, items: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Add items to an existing shopping list
        
        :param shopping_list_id: ID of the shopping list
        :param items: List of items to add
        :return: Dictionary with updated shopping list details
        """
        try:
            logger.info(f"Adding {len(items)} items to Instacart shopping list: {shopping_list_id}")
            
            endpoint = f"/v1/shopping_lists/{shopping_list_id}/items"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            # Format items for Instacart API
            formatted_items = []
            for item in items:
                formatted_item = {
                    "product_id": item.get("id"),
                    "quantity": item.get("quantity", 1)
                }
                formatted_items.append(formatted_item)
            
            payload = {
                "items": formatted_items
            }
            
            response = requests.post(
                url,
                headers=headers,
                json=payload,
                timeout=10
            )
            
            if response.status_code in (200, 201):
                data = response.json()
                
                return {
                    "success": True,
                    "added_items": len(formatted_items),
                    "shopping_list_id": shopping_list_id
                }
            else:
                logger.error(f"Adding to shopping list error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to add items to shopping list: {response.text}"
                }
                
        except Exception as e:
            logger.error(f"Error adding to shopping list: {str(e)}")
            return {
                "success": False,
                "message": str(e)
            }
    
    def get_shopping_lists(self) -> Dict[str, Any]:
        """
        Get all shopping lists for the current user
        
        :return: Dictionary with shopping lists
        """
        try:
            logger.info("Getting Instacart shopping lists")
            
            endpoint = "/v1/shopping_lists"
            url = f"{self.base_url}{endpoint}"
            
            headers = self._get_headers()
            
            response = requests.get(
                url,
                headers=headers,
                timeout=10
            )
            
            if response.status_code == 200:
                data = response.json()
                
                shopping_lists = []
                for sl in data.get('shopping_lists', []):
                    shopping_lists.append({
                        "id": sl.get('id'),
                        "name": sl.get('name'),
                        "url": sl.get('url'),
                        "items_count": sl.get('items_count', 0)
                    })
                
                return {
                    "success": True,
                    "shopping_lists": shopping_lists
                }
            else:
                logger.error(f"Getting shopping lists error: {response.status_code} - {response.text}")
                return {
                    "success": False,
                    "message": f"Failed to get shopping lists: {response.text}",
                    "shopping_lists": []
                }
                
        except Exception as e:
            logger.error(f"Error getting shopping lists: {str(e)}")
            return {
                "success": False,
                "message": str(e),
                "shopping_lists": []
            }

# Test function to verify Instacart API integration
def test_instacart_integration():
    """Test function to verify Instacart API integration"""
    integration = InstacartIntegration()
    
    # Test product search
    search_results = integration.search_products("milk", limit=5)
    print("Search Results:", search_results)
    
    # Test retailer search
    retailer_results = integration.get_available_retailers("80538")
    print("Retailer Results:", retailer_results)
    
    return search_results.get("success", False) and retailer_results.get("success", False)

if __name__ == "__main__":
    if test_instacart_integration():
        print("Instacart integration tests passed!")
    else:
        print("Instacart integration tests failed!")