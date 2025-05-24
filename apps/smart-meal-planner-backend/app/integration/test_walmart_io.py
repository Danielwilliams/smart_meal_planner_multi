import os
import json
import logging
from dotenv import load_dotenv
from walmart_io import WalmartIOIntegration

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Load environment variables
load_dotenv()

def test_walmart_search():
    """Test Walmart product search functionality"""
    integration = WalmartIOIntegration()
    
    test_queries = [
        "milk",
        "chicken breast",
        "cereal",
        "apple"
    ]
    
    results = {}
    
    print("\n=== Testing Walmart Product Search ===\n")
    
    for query in test_queries:
        print(f"Searching for: {query}")
        response = integration.search_products(query, limit=3)
        
        if response["success"]:
            print(f"✅ Found {len(response['results'])} results")
            
            # Print the first result
            if response["results"]:
                first_item = response["results"][0]
                print(f"  First result: {first_item['name']}")
                print(f"  Price: ${first_item['price']}")
                print(f"  Brand: {first_item['brand']}")
        else:
            print(f"❌ Search failed: {response['message']}")
        
        results[query] = response["success"]
        print()
    
    overall_success = all(results.values())
    print(f"Overall search test {'passed ✅' if overall_success else 'failed ❌'}")
    return overall_success

def test_walmart_store_locator():
    """Test Walmart store locator functionality"""
    integration = WalmartIOIntegration()
    
    test_zips = [
        "94040",  # Mountain View, CA
        "10001",  # New York, NY
        "60290",  # Chicago, IL
    ]
    
    results = {}
    
    print("\n=== Testing Walmart Store Locator ===\n")
    
    for zip_code in test_zips:
        print(f"Finding stores near: {zip_code}")
        response = integration.find_nearby_stores(zip_code, radius=15)
        
        if response["success"]:
            print(f"✅ Found {len(response['stores'])} stores")
            
            # Print the first store
            if response["stores"]:
                first_store = response["stores"][0]
                print(f"  First store: {first_store['name']}")
                print(f"  Address: {first_store['address']['addressLine1']}, {first_store['address']['city']}, {first_store['address']['state']}")
                print(f"  Distance: {first_store['distance']} miles")
        else:
            print(f"❌ Store search failed: {response['message']}")
        
        results[zip_code] = response["success"]
        print()
    
    overall_success = all(results.values())
    print(f"Overall store locator test {'passed ✅' if overall_success else 'failed ❌'}")
    return overall_success

def test_cart_simulation():
    """Test the cart simulation functionality"""
    integration = WalmartIOIntegration()
    
    print("\n=== Testing Walmart Cart Simulation ===\n")
    
    # Create test items
    test_items = [
        {
            "id": "12345",
            "name": "Test Product 1",
            "price": 9.99,
            "quantity": 2
        },
        {
            "id": "67890",
            "name": "Test Product 2",
            "price": 14.99,
            "quantity": 1
        }
    ]
    
    response = integration.add_to_cart(test_items)
    
    if response["success"]:
        print(f"✅ Cart simulation succeeded")
        print(f"  Message: {response['message']}")
        print(f"  Items in cart: {response['details']['total_items']}")
    else:
        print(f"❌ Cart simulation failed: {response['message']}")
    
    return response["success"]

if __name__ == "__main__":
    print(f"\nWalmart.io API Test Suite")
    print(f"========================\n")
    
    search_success = test_walmart_search()
    store_success = test_walmart_store_locator()
    cart_success = test_cart_simulation()
    
    print("\n=== Test Summary ===")
    print(f"Product Search: {'✅ Passed' if search_success else '❌ Failed'}")
    print(f"Store Locator: {'✅ Passed' if store_success else '❌ Failed'}")
    print(f"Cart Simulation: {'✅ Passed' if cart_success else '❌ Failed'}")
    
    overall = all([search_success, store_success, cart_success])
    print(f"\nOverall Walmart.io Integration Test: {'✅ PASSED' if overall else '❌ FAILED'}")