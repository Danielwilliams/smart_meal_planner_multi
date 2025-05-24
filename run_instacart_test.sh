#!/bin/bash
# Run Instacart API tests with proper environment variables

echo "=== Instacart API Test Runner ==="
echo "This script will run tests against the Instacart API"
echo

# Check if API key is set in environment
if [ -z "$INSTACARTAPI_DEV" ]; then
  echo "INSTACARTAPI_DEV environment variable not set."
  echo "Do you want to enter an API key now? (y/n)"
  read answer
  
  if [ "$answer" == "y" ]; then
    echo "Enter your Instacart API key:"
    read api_key
    export INSTACARTAPI_DEV="$api_key"
    echo "API key set for this session."
  else
    echo "No API key provided. Tests will likely fail."
  fi
else
  echo "Using API key from environment: ${INSTACARTAPI_DEV:0:4}...${INSTACARTAPI_DEV: -4}"
fi

# Check if API key has the prefix
if [[ "$INSTACARTAPI_DEV" == "InstacartAPI "* ]]; then
  echo "API key has 'InstacartAPI' prefix"
else
  echo "API key does NOT have 'InstacartAPI' prefix"
fi

echo
echo "==== Running Simple Test ===="
python3 simple_instacart_test.py

echo
echo "==== Running Comprehensive Test ===="
python3 instacart_api_test.py

echo
echo "==== Tests Completed ===="
echo "Check the output above for success/failure messages"
echo "Results have been saved to instacart_api_test_results.json"