# Instacart API Integration

This document describes how the Smart Meal Planner integrates with the Instacart API to allow users to search for products and add them to their Instacart carts.

## Architecture

The integration uses a backend proxy pattern to avoid CORS issues that would occur with direct API calls from the browser. This approach is similar to how the Kroger integration works.

```
Frontend (React) <-> Backend (FastAPI) <-> Instacart API
```

## Endpoints

The following endpoints are available for the Instacart integration:

### Backend Endpoints

These are the actual backend endpoints implemented in FastAPI:

#### Status Endpoint

- `GET /instacart/status` - Checks if the Instacart API is properly configured and accessible

#### Retailer Endpoints

- `GET /instacart/retailers` - Gets a list of available retailers on Instacart
- `GET /instacart/retailers/nearby?zip_code={zip_code}` - Gets a list of retailers near a specified ZIP code
- `GET /instacart/retailers/{retailer_id}/products/search?query={query}&limit={limit}` - Searches for products at a specific retailer

#### Cart Endpoints

- `POST /instacart/carts` - Creates a new cart with items
- `POST /instacart/carts/{cart_id}/items` - Adds an item to an existing cart
- `GET /instacart/carts/{cart_id}` - Gets details of a cart

#### Debug Endpoints (Development Only)

- `GET /instacart/config/test` - Tests if the Instacart API key is properly configured
- `GET /instacart/environment` - Gets information about the current environment configuration
- `GET /instacart/debug/retailers/nearby?zip_code={zip_code}` - Gets detailed mock data for nearby retailers
- `GET /instacart/key-info` - Gets detailed API key information and configuration

### Frontend Access Points

In production, these endpoints are accessed through the `/api` prefix based on the routing rules in vercel.json:

- `GET /api/instacart/status`
- `GET /api/instacart/retailers`
- And so on...

The routing rules in vercel.json redirect these requests to the backend server, maintaining the correct path structure.

## Environment Variables

The following environment variables are required for the Instacart integration:

- `INSTACARTAPI_DEV` - Instacart API key for development/testing

## Frontend Service

The `instacartBackendService.js` file provides a service for making requests to the backend proxy endpoints. This service handles error reporting, retries, and formatting of requests and responses.

## Backend Implementation

The backend implementation consists of the following files:

- `app/integration/instacart.py` - Core Instacart API client implementation
- `app/routers/instacart_status.py` - Status endpoint for checking API connectivity
- `app/routers/instacart_store.py` - Endpoints for retailers and product search
- `app/routers/instacart_cart.py` - Endpoints for cart management
- `app/routers/instacart_debug.py` - Debug endpoints for testing and configuration

## Development Notes

- The Instacart API requires authentication using the `Instacart-Connect-Api-Key` header
- The backend handles authentication and error handling for all Instacart API requests
- The frontend service uses a proxy approach to avoid CORS issues
- Each retailer on Instacart has a unique ID that is required for product searches and cart operations
- The API key is stored as an environment variable on the backend and never exposed to the frontend

## Deployment Configuration

The deployment leverages Vercel's routing capabilities to proxy API requests to the backend:

1. Frontend is deployed on Vercel
2. Backend is deployed on Railway at `https://smartmealplannermulti-development.up.railway.app`
3. Vercel routes all `/api/instacart/*` requests to `https://smartmealplannermulti-development.up.railway.app/instacart/*`

This routing setup is defined in `vercel.json`:

```json
{
  "routes": [
    {
      "src": "/api/instacart/(.*)",
      "dest": "https://smartmealplannermulti-development.up.railway.app/instacart/$1",
      "headers": {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Authorization, X-Instacart-API-Key"
      }
    }
  ]
}
```

This configuration:
1. Prevents CORS issues by handling all API requests through the same domain
2. Maintains a clean separation between frontend and backend
3. Allows the frontend to use `/api/*` prefixes while the backend uses its own routing structure

## Example Workflow

1. User navigates to the Cart page
2. Frontend checks Instacart API status with `/api/instacart/status`
   - Request goes to Vercel
   - Vercel proxies to `https://smartmealplannermulti-development.up.railway.app/instacart/status`
   - Backend processes request and returns status information
3. User selects a retailer from the list provided by `/api/instacart/retailers`
4. User assigns items to Instacart in the cart
5. Frontend searches for products using `/api/instacart/retailers/{retailer_id}/products/search`
6. Frontend displays search results to the user
7. User selects items to add to cart
8. Frontend creates a cart using `/api/instacart/carts`
9. User is redirected to Instacart checkout page

## Diagnostic Tools

The integration includes enhanced diagnostic tools for troubleshooting:

1. **InstacartSimpleTester** - A React component that tests all aspects of the integration
2. **Extended API Status** - The `/api/instacart/status` endpoint now includes detailed debugging information
3. **API Key Info** - The `/api/instacart/key-info` endpoint shows the actual API key configuration (for development only)

These diagnostic tools are critical during development but should be secured or removed in production to avoid exposing sensitive information.

## Troubleshooting

If the integration is not working:

1. Check if the Instacart API key is configured correctly using the `/api/instacart/config/test` endpoint
2. Verify that the backend routes are properly registered in `app/main.py`
3. Check the browser console and server logs for error messages
4. Make sure the frontend is using the `/api/instacart/*` paths (not `/instacart/*` directly)
5. Verify that the Vercel routing in `vercel.json` is correctly set up
6. Check if the backend server at Railway is running and accessible
7. Use the InstacartSimpleTester component to get detailed diagnostic information

### Common Issues

1. **Getting HTML instead of JSON responses**
   - This typically means the request is hitting the frontend instead of being routed to the backend
   - Check that you're using `/api/instacart/*` paths, not just `/instacart/*`
   - Verify the Vercel routing rules are correct

2. **"API endpoint not implemented yet" errors**
   - This means the backend endpoint doesn't exist or isn't accessible
   - Check that all the routers are properly registered in `app/main.py`
   - Verify that the backend server is running

3. **API Key errors**
   - Make sure the `INSTACARTAPI_DEV` environment variable is set on the backend server
   - Check if the API key is properly formatted (it might need the `InstacartAPI ` prefix)
   - Use the `/api/instacart/key-info` endpoint to see the actual API key configuration