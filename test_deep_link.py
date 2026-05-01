#!/usr/bin/env python3
"""
Test script to simulate deep link processing that should happen in the Flutter app
"""

import json
import urllib.parse

def test_deep_link_parsing():
    """Test parsing a deep link URL like what the app should receive"""
    
    # Simulate the deep link that was shown in the logs
    deep_link_url = "smartmealplanner://kroger-auth?code=XGUwpRMdXMzuWhXPb5qd3ze4X24u9lt6tIOPwOv7&state=1750892015245"
    
    print(f"Testing deep link URL: {deep_link_url}")
    
    # Parse the URL
    parsed = urllib.parse.urlparse(deep_link_url)
    
    print(f"Scheme: {parsed.scheme}")
    print(f"Host: {parsed.netloc}")
    print(f"Path: {parsed.path}")
    print(f"Query: {parsed.query}")
    
    # Parse query parameters
    query_params = urllib.parse.parse_qs(parsed.query)
    
    print(f"Query parameters: {query_params}")
    
    # Extract auth code
    auth_code = query_params.get('code', [None])[0]
    state = query_params.get('state', [None])[0]
    
    print(f"Auth code: {auth_code}")
    print(f"State: {state}")
    
    # Simulate what the Flutter app should do
    if parsed.scheme == 'smartmealplanner' and parsed.netloc == 'kroger-auth' and auth_code:
        print("✅ Deep link format is correct and contains auth code")
        print(f"✅ Would call backend with code: {auth_code[:10]}...")
        
        # Simulate the API call that should work now with Authorization header
        api_payload = {
            "code": auth_code,
            "redirect_uri": "smartmealplanner://kroger-auth"
        }
        
        print(f"API payload: {json.dumps(api_payload, indent=2)}")
        print("API headers should include: Authorization: Bearer {user_auth_token}")
        
        return True
    else:
        print("❌ Deep link format is incorrect or missing auth code")
        return False

if __name__ == "__main__":
    test_deep_link_parsing()