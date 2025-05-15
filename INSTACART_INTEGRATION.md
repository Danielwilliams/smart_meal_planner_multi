# Instacart API Integration

This document describes how the Smart Meal Planner integrates with the Instacart API to allow users to search for products and add them to their Instacart carts.

## Architecture

The integration uses a backend proxy pattern to avoid CORS issues that would occur with direct API calls from the browser. This approach is similar to how the Kroger integration works.

```
Frontend (React) <-> Backend (FastAPI) <-> Instacart API
```

## Endpoints

The following endpoints are available for the Instacart integration:

### Status Endpoint

- `GET /instacart/status` - Checks if the Instacart API is properly configured and accessible

### Retailer Endpoints

- `GET /instacart/retailers` - Gets a list of available retailers on Instacart
- `GET /instacart/retailers/nearby?zip_code={zip_code}` - Gets a list of retailers near a specified ZIP code
- `GET /instacart/retailers/{retailer_id}/products/search?query={query}&limit={limit}` - Searches for products at a specific retailer

### Cart Endpoints

- `POST /instacart/carts` - Creates a new cart with items
- `POST /instacart/carts/{cart_id}/items` - Adds an item to an existing cart
- `GET /instacart/carts/{cart_id}` - Gets details of a cart

### Debug Endpoints (Development Only)

- `GET /instacart/config/test` - Tests if the Instacart API key is properly configured
- `GET /instacart/environment` - Gets information about the current environment configuration
- `GET /instacart/debug/retailers/nearby?zip_code={zip_code}` - Gets detailed mock data for nearby retailers

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

## Example Workflow

1. User navigates to the Cart page
2. Frontend checks Instacart API status with `/api/instacart/status`
3. User selects a retailer from the list provided by `/api/instacart/retailers`
4. User assigns items to Instacart in the cart
5. Frontend searches for products using `/api/instacart/retailers/{retailer_id}/products/search`
6. Frontend displays search results to the user
7. User selects items to add to cart
8. Frontend creates a cart using `/api/instacart/carts`
9. User is redirected to Instacart checkout page

## Troubleshooting

If the integration is not working:

1. Check if the Instacart API key is configured correctly using the `/api/instacart/config/test` endpoint
2. Verify that the backend routes are properly registered in `app/main.py`
3. Check the browser console and server logs for error messages
4. Make sure the frontend is using the backend proxy endpoints with the correct paths
5. Verify that the API key has the necessary permissions for the operations being performed