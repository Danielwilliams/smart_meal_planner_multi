# Instacart API Integration Guide

This document explains the approach we've taken for integrating the Instacart API with the Smart Meal Planner application.

## Backend Proxy Approach

We've implemented a backend proxy approach for Instacart integration, similar to how the Kroger integration works. This solves several problems:

1. **CORS Issues**: Browser security prevents direct API calls to Instacart's domains from our frontend
2. **API Key Security**: Keeps the API key secure on the server rather than in browser code
3. **Consistent Integration**: Matches the pattern used for Kroger integration

## Architecture

```
Frontend (Browser) <--> Our Backend Server <--> Instacart API
```

### Key Components

1. **Backend API Endpoints**: 
   - `/api/instacart/status` - Check connection status
   - `/api/instacart/retailers` - Get all retailers
   - `/api/instacart/retailers/nearby` - Get retailers by ZIP code
   - `/api/instacart/retailers/:id/products/search` - Search products
   - `/api/instacart/carts` - Create cart with items

2. **Frontend Services**:
   - `instacartBackendService.js` - Main service that communicates with our backend API
   - `InstacartTester.jsx` - Component to test API connection from frontend
   - `InstacartResults.jsx` - Component to display search results
   - `InstacartRetailerSelector.jsx` - Component to select retailers

## How to Use

### 1. Getting Retailers

```javascript
import instacartBackendService from '../services/instacartBackendService';

// Get retailers near a ZIP code
const retailers = await instacartBackendService.getNearbyRetailers('80538');
```

### 2. Searching Products

```javascript
// Search for products at a specific retailer
const products = await instacartBackendService.searchProducts(retailerId, 'milk', 5);
```

### 3. Creating a Cart

```javascript
// Create a cart with items
const cart = await instacartBackendService.createCart(retailerId, [
  { product_id: '12345', quantity: 1 },
  { product_id: '67890', quantity: 2 }
]);

// The cart object contains checkout_url which can be used to redirect users
window.location.href = cart.checkout_url;
```

## Troubleshooting

If you encounter issues with the Instacart integration:

1. Use the API Diagnostics tool on the Cart page to test the connection
2. Check network requests in your browser's developer tools
3. Verify that your backend server is properly configured with the Instacart API key
4. Ensure the backend endpoints are correctly responding (check server logs)

## Important Notes

- The Instacart API key is stored securely on the server
- The `/v1` vs `/idp/v1` path is determined by the backend automatically
- All requests use proper authorization headers on the server side
- No direct requests to Instacart domains are made from the browser

## API Key Format

On the backend server, the Instacart API key must be used with the correct authorization header format:

```
Authorization: InstacartAPI YOUR_API_KEY
```