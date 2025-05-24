# Instacart API Development Environment Fix

## Overview
This document details the changes made to fix the Instacart API integration by properly configuring it to use the Instacart development server and API structure. The key issue was that we were attempting to use a development environment API key with production API endpoints.

## Critical Issues Fixed
1. Incorrect server URL: Using wrong base URL for development environment
2. Incorrect API version and path structure
3. Incorrect authentication method (header format)
4. Outdated endpoint paths for API resources

## Changes Made

### 1. Updated Base URL and API Version for Development Environment
```python
# Old
BASE_URL = "https://platform-api.instacart.com"  # This was wrong
API_VERSION = "v1"  # This was wrong

# New
BASE_URL = "https://connect.dev.instacart.tools"  # Correct dev environment URL
API_VERSION = "idp/v1"  # Correct API version and path
```

### 2. Updated Authentication Method
```python
# Old
self.session.headers.update({
    "Instacart-Connect-Api-Key": self.formatted_api_key,  # Wrong header
    "Content-Type": "application/json",
    "Accept": "application/json"
})

# New
self.session.headers.update({
    "Authorization": f"Bearer {self.formatted_api_key}",  # Correct Bearer token format
    "Content-Type": "application/json",
    "Accept": "application/json"
})
```

### 3. Updated API Key Formatting
```python
# Old (adding InstacartAPI prefix)
if not self.api_key.startswith("InstacartAPI "):
    logger.info("Adding 'InstacartAPI' prefix to key")
    self.formatted_api_key = f"InstacartAPI {self.api_key}"

# New (removing InstacartAPI prefix for Bearer token)
if self.api_key.startswith("InstacartAPI "):
    logger.info("Removing 'InstacartAPI ' prefix for Bearer token")
    self.formatted_api_key = self.api_key.replace("InstacartAPI ", "")
```

### 4. Updated Retailers Endpoint Parameters
```python
# Old
response = self._make_request("GET", "retailers")
return response.get("data", [])

# New
params = {
    "postal_code": "80538",  # Required parameter
    "country_code": "US"     # Required parameter
}
response = self._make_request("GET", "retailers", params=params)
```

### 5. Updated Product Search Endpoint
```python
# Old
endpoint = f"retailers/{retailer_id}/products/search"

# New
endpoint = "products/search"  # Correct endpoint path
params = {
    "q": query,  # Use 'q' as the query parameter
    "retailer_key": retailer_id,  # Correct parameter name
    "limit": limit
}
```

### 6. Updated Nearby Retailers Functionality
```python
# Old
endpoint = "retailers/nearby"  # This endpoint doesn't exist
params = {
    "zip_code": zip_code
}

# New
endpoint = "retailers"  # Use the same endpoint with postal_code
params = {
    "postal_code": zip_code,  # Correct parameter name
    "country_code": "US"      # Required parameter
}
```

## Reference Documentation
The changes were made based on the official Instacart Developer Platform API documentation, specifically the "Create a recipe page" tutorial which showed:

1. The correct development server: `https://connect.dev.instacart.tools`
2. The correct API version path: `idp/v1`
3. The correct authentication header: `Authorization: Bearer <API-key>`
4. The correct parameters for retailers endpoint: `postal_code` and `country_code`

## Testing the Changes
A new test script (`test_instacart_dev.py`) has been created to verify the updated integration. This script tests:

1. Retrieving retailers
2. Retrieving nearby retailers for a specific ZIP code
3. Searching for products at a specific retailer

To run the test:
```
python test_instacart_dev.py
```

## Production Deployment Note
According to the documentation, when moving to production:
1. Create a production API key
2. Update the base URL to `https://connect.instacart.com`
3. Keep the same API version and endpoints

The current code is now properly configured for the development environment.