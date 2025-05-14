# Instacart API Integration Test Instructions

This document provides instructions for testing the Instacart Connect API integration.

## Prerequisites

1. A valid Instacart Connect API key in the correct format
2. The Smart Meal Planner application running locally or deployed

## API Key Format Requirements

The Instacart Connect API requires a specific authorization header format:

```
Authorization: InstacartAPI YOUR_API_KEY
```

The API key itself should be in the format provided by Instacart. Note that the header format is important - "InstacartAPI" followed by a space, then the API key. Any deviation from this format will result in authentication errors.

## Testing Steps

### 1. Basic API Connectivity Test

1. Navigate to the Cart page in the application
2. Open the developer tools (F12 in most browsers)
3. Expand the "Developer Debug Tools" section at the bottom of the page
4. In the "Instacart API Key" field, enter your valid API key
5. Click "Test Direct Instacart API"
6. Verify in the results section that the API connection is successful

### 2. Search Functionality Test

1. Add some grocery items to the Instacart section of your cart
2. Click "Search Instacart" button
3. Monitor the network requests in the browser's developer tools
4. Verify that requests to `https://connect.dev.instacart.tools/v1/retailers/...` are being made with the proper authorization header
5. Check if product search results are displayed correctly

### 3. Cart Creation Test

1. Following a successful search, select some products to add to your cart
2. Click "Create Instacart Cart" button
3. Monitor the network requests
4. Verify that the cart creation request succeeds
5. Confirm you're redirected to the Instacart checkout page

## Troubleshooting Common Issues

### API Key Issues

1. **401 Unauthorized**: Indicates the API key format is incorrect or the key is invalid
   - Verify that the authorization header format is exactly `Authorization: InstacartAPI YOUR_KEY`
   - Check that the API key is valid and hasn't expired

2. **403 Forbidden**: Indicates the API key doesn't have permission for the requested resource
   - Ensure your API key has the necessary permissions for reading retailers, searching products, and creating carts

### Network Issues

1. **CORS Errors**: May appear when directly accessing the Instacart API
   - Check that the application is properly using the direct API connection
   - Verify that the Instacart API allows requests from your domain

2. **Network Errors**: General connectivity issues
   - Ensure you have internet access
   - Verify that `https://connect.dev.instacart.tools` is accessible from your network

### Data Format Issues

1. **500 Server Errors**: Often caused by incorrect data format in requests
   - Check the product IDs are in the correct format
   - Ensure retailer IDs are valid

## Debugging Tools

The InstacartApiTester component provides detailed diagnostics, including:

1. API connectivity status
2. Authorization header format verification
3. Response format analysis
4. Error details with suggested fixes

Use this tool when troubleshooting any API connection issues.

## Collecting Test Results

When reporting issues, please include:

1. The specific error message displayed
2. Network request/response details from developer tools
3. API connection status from the diagnostic tool
4. The specific API key format used (do not share the actual key)

This information will help identify and resolve integration issues quickly.