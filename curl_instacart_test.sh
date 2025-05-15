#!/bin/bash
# Test Instacart API connectivity using curl

echo "=== Instacart API Curl Test ==="
echo "Testing basic connectivity to potential Instacart API endpoints"
echo

# Check if API key is provided
API_KEY="${INSTACARTAPI_DEV}"
if [ -z "$API_KEY" ]; then
  echo "INSTACARTAPI_DEV environment variable not set."
  echo "Some tests will fail without an API key."
  echo
fi

# Display first and last 4 characters of the API key for verification
if [ ! -z "$API_KEY" ]; then
  KEY_START="${API_KEY:0:4}"
  KEY_END="${API_KEY: -4}"
  echo "Using API key starting with $KEY_START and ending with $KEY_END"
  
  # Check for InstacartAPI prefix
  if [[ "$API_KEY" == InstacartAPI* ]]; then
    echo "API key has 'InstacartAPI' prefix"
    
    # Extract the actual key part
    KEY_ONLY="${API_KEY#InstacartAPI }"
    echo "Key without prefix: ${KEY_ONLY:0:4}...${KEY_ONLY: -4}"
  else
    echo "API key does NOT have 'InstacartAPI' prefix"
  fi
  echo
fi

# Function to test an endpoint
test_endpoint() {
  local name="$1"
  local url="$2"
  local header="$3"
  local key="$4"
  
  echo "Testing: $name"
  echo "URL: $url"
  
  if [ ! -z "$header" ] && [ ! -z "$key" ]; then
    echo "Using header: $header"
    echo "Command: curl -s -i -H \"$header: $key\" \"$url\""
    echo
    echo "Response:"
    curl -s -i -H "$header: $key" "$url" | head -20
  else
    echo "Command: curl -s -i \"$url\""
    echo
    echo "Response:"
    curl -s -i "$url" | head -20
  fi
  
  echo
  echo "----------------------------------------"
}

# Tests without authentication
echo "=== Basic Connectivity Tests (No Auth) ==="
test_endpoint "Instacart Website" "https://www.instacart.com" "" ""
test_endpoint "Connect API Base URL" "https://connect.instacart.com" "" ""
test_endpoint "Developer Portal" "https://developer.instacart.com" "" ""
test_endpoint "Possible API Endpoint" "https://api.instacart.com" "" ""

# Only run authenticated tests if API key is provided
if [ ! -z "$API_KEY" ]; then
  echo "=== Authenticated API Tests ==="
  
  # Create InstacartAPI prefixed version if needed
  PREFIXED_KEY="$API_KEY"
  if [[ "$API_KEY" != InstacartAPI* ]]; then
    PREFIXED_KEY="InstacartAPI $API_KEY"
  fi
  
  # Create non-prefixed version if needed
  NON_PREFIXED_KEY="$API_KEY"
  if [[ "$API_KEY" == InstacartAPI* ]]; then
    NON_PREFIXED_KEY="${API_KEY#InstacartAPI }"
  fi
  
  # Test with different URL and header combinations
  test_endpoint "Connect API - Retailers (Prefixed)" "https://connect.instacart.com/v2022-09-01/retailers" "Instacart-Connect-Api-Key" "$PREFIXED_KEY"
  test_endpoint "Connect API - Retailers (Non-Prefixed)" "https://connect.instacart.com/v2022-09-01/retailers" "Instacart-Connect-Api-Key" "$NON_PREFIXED_KEY"
  test_endpoint "Alternative API - Retailers" "https://api.instacart.com/v1/retailers" "Authorization" "$NON_PREFIXED_KEY"
fi

echo "=== Testing Complete ==="
echo "Check the responses above to identify successful connections."
echo "Look for HTTP/1.1 200 OK or similar successful status codes in the responses."
echo "Note any error messages to help diagnose connectivity issues."