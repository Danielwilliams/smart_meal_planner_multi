import os
import requests
import base64
import logging
import json
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

def kroger_api_diagnostic():
    """Focused Kroger API Diagnostic for product.compact"""
    CLIENT_ID = os.getenv("KROGER_CLIENT_ID")
    CLIENT_SECRET = os.getenv("KROGER_CLIENT_SECRET")
    BASE_URL = os.getenv("KROGER_BASE_URL", "https://api-ce.kroger.com/v1")
    LOCATION_ID = os.getenv("DEFAULT_KROGER_LOCATION_ID", "01400390")
    
    print("Kroger API Diagnostic (product.compact)")
    print("=" * 40)
    
    # Prepare token request
    token_url = f"{BASE_URL}/connect/oauth2/token"
    auth_string = f"{CLIENT_ID}:{CLIENT_SECRET}"
    basic_auth = base64.b64encode(auth_string.encode('utf-8')).decode('utf-8')
    
    token_headers = {
        'Authorization': f'Basic {basic_auth}',
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json'
    }
    
    token_data = {
        'grant_type': 'client_credentials',
        'scope': 'product.compact'
    }
    
    try:
        # Token Request
        token_response = requests.post(
            token_url, 
            headers=token_headers, 
            data=token_data,
            timeout=10
        )
        
        print(f"Token Request Status: {token_response.status_code}")
        
        if token_response.status_code != 200:
            print("Token Generation Failed")
            print("Response Details:")
            print(json.dumps(token_response.json(), indent=2))
            return False
        
        token_data = token_response.json()
        access_token = token_data.get('access_token')
        
        # Detailed Token Info
        print("\nToken Details:")
        print(f"Expires in: {token_data.get('expires_in', 'N/A')} seconds")
        
        # Search Request
        search_url = f"{BASE_URL}/products"
        search_headers = {
            'Authorization': f'Bearer {access_token}',
            'Accept': 'application/json'
        }
        
        search_params = {
            'filter.term': 'milk',
            'filter.limit': '5',
            'filter.locationId': LOCATION_ID
        }
        
        search_response = requests.get(
            search_url,
            headers=search_headers,
            params=search_params,
            timeout=10
        )
        
        print(f"\nSearch Request Status: {search_response.status_code}")
        
        if search_response.status_code != 200:
            print("Search Request Failed")
            print("Response Details:")
            print(json.dumps(search_response.json(), indent=2))
            return False
        
        # Parse Results
        search_results = search_response.json()
        print("\nSearch Results:")
        for product in search_results.get('data', []):
            print(f"- {product.get('description', 'Unknown Product')}")
        
        return True
    
    except Exception as e:
        print(f"Unexpected Error: {str(e)}")
        return False

if __name__ == "__main__":
    result = kroger_api_diagnostic()
    print("\nFinal Test Result:", "PASSED" if result else "FAILED")