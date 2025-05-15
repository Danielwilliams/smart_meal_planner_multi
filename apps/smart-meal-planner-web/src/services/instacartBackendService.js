/**
 * Instacart Backend Service
 *
 * This file provides direct backend API access for Instacart API integration,
 * similar to how the Kroger integration works. Instead of relying on the Vercel proxy,
 * we'll use the direct Railway backend URL.
 */

import axios from 'axios';
import apiService from './apiService';

// Use the direct Railway backend URL like Kroger does
// This aligns with the approach used in krogerAuthService.js
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
console.log('InstacartBackendService using API base URL:', API_BASE_URL);

// Create an axios instance for Instacart backend requests
const instacartBackendAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add a request interceptor for logging
instacartBackendAxios.interceptors.request.use(
  config => {
    console.log(`InstacartBackendService Request: ${config.method.toUpperCase()} ${config.url}`);
    return config;
  },
  error => {
    console.error('InstacartBackendService Request Error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor for logging
instacartBackendAxios.interceptors.response.use(
  response => {
    console.log(`InstacartBackendService Response: ${response.status} ${response.statusText}`);
    return response;
  },
  error => {
    console.error('InstacartBackendService Response Error:', error.response?.status, error.message);
    return Promise.reject(error);
  }
);

/**
 * Get nearby retailers based on ZIP code
 * @param {string} zipCode - ZIP code to search for nearby retailers
 * @returns {Promise<Array>} List of retailers
 */
const getNearbyRetailers = async (zipCode) => {
  try {
    // First try the nearby endpoint which uses location
    try {
      const response = await instacartBackendAxios.get('/instacart/retailers/nearby', {
        params: { zip_code: zipCode }
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch (nearbyError) {
      console.warn('Nearby retailers endpoint failed:', nearbyError.message);
      // Fall back to general retailers endpoint
    }

    // Try the general retailers endpoint
    try {
      const response = await instacartBackendAxios.get('/instacart/retailers');

      // For general retailers, we need to add mock distance based on ZIP
      if (response.data && Array.isArray(response.data)) {
        const enhancedRetailers = response.data.map((retailer, index) => {
          // Generate a pseudo-random distance based on ZIP code and index
          // Extra safety check for zipCode
          let zipPrefix = 8; // Default value
          if (zipCode && typeof zipCode === 'string' && zipCode.length > 0) {
            try {
              zipPrefix = parseInt(zipCode.charAt(0)) || 8;
            } catch (err) {
              console.warn('Error parsing ZIP code:', err);
            }
          }

          const distanceSeed = (zipPrefix + index) % 10;
          const distance = Math.round((distanceSeed + Math.random() * 5) * 10) / 10;

          return {
            ...retailer,
            distance: retailer.distance || distance,
            address: retailer.address || {
              city: `City ${index % 5 + 1}`,
              state: 'ST',
              zip_code: zipCode
            }
          };
        });

        // Sort by distance
        return enhancedRetailers.sort((a, b) => a.distance - b.distance);
      }

      return response.data || [];
    } catch (retailersError) {
      console.warn('General retailers endpoint failed:', retailersError.message);
      // Fall back to mock endpoint
    }

    // If both endpoints fail, try the mock endpoint as a last resort
    try {
      console.log('Falling back to mock retailers endpoint');
      const mockResponse = await instacartBackendAxios.get('/instacart/mock-retailers/nearby', {
        params: { zip_code: zipCode }
      });

      if (mockResponse.data && Array.isArray(mockResponse.data) && mockResponse.data.length > 0) {
        console.log('Mock nearby retailers endpoint succeeded');
        return mockResponse.data;
      }

      // If nearby mock fails, try general mock retailers
      const generalMockResponse = await instacartBackendAxios.get('/instacart/mock-retailers');

      if (generalMockResponse.data && Array.isArray(generalMockResponse.data)) {
        console.log('General mock retailers endpoint succeeded');

        // Add mock proximity data
        const enhancedRetailers = generalMockResponse.data.map((retailer, index) => {
          const distance = index + 1; // Simple distance based on index

          return {
            ...retailer,
            distance: distance,
            address: {
              city: `City ${index % 5 + 1}`,
              state: 'ST',
              zip_code: zipCode
            }
          };
        });

        return enhancedRetailers;
      }
    } catch (mockError) {
      console.error('Mock endpoints also failed:', mockError.message);
      // All endpoints have failed, throw an error
    }

    throw new Error('All retailer endpoints failed, including fallbacks');

  } catch (error) {
    console.error('Error getting nearby retailers:', error);

    // Create a detailed error response with more information
    const errorObj = new Error(`Error getting retailers: ${error.message}`);
    errorObj.originalError = error;
    errorObj.status = error.response?.status;
    errorObj.data = error.response?.data;

    // If we got a 404, it means the endpoint doesn't exist yet
    if (error.response?.status === 404) {
      errorObj.message = 'API endpoint not implemented yet - The /api/instacart/retailers endpoint is missing';
      errorObj.suggestion = 'Create the API endpoint on the backend server';
    }

    throw errorObj;
  }
};

/**
 * Search for products at a specific retailer
 * @param {string} retailerId - Instacart retailer ID
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results (optional, default 10)
 * @returns {Promise<Array>} List of products matching the search query
 */
const searchProducts = async (retailerId, query, limit = 10) => {
  try {
    // First try the regular search endpoint
    try {
      const response = await instacartBackendAxios.get(`/instacart/retailers/${retailerId}/products/search`, {
        params: { query, limit }
      });

      if (response.data && Array.isArray(response.data)) {
        return response.data;
      }
    } catch (searchError) {
      console.warn(`Regular product search failed for "${query}":`, searchError.message);
      // Fall back to mock endpoint
    }

    // If regular endpoint fails, try the mock endpoint
    try {
      console.log(`Falling back to mock product search for "${query}"`);
      const mockResponse = await instacartBackendAxios.get(`/instacart/mock-products/search`, {
        params: { retailer_id: retailerId, query, limit }
      });

      if (mockResponse.data && Array.isArray(mockResponse.data)) {
        console.log('Mock product search succeeded');
        return mockResponse.data;
      }
    } catch (mockError) {
      console.error(`Mock product search also failed for "${query}":`, mockError.message);
      // All endpoints have failed
    }

    // If all endpoints fail, return a mock product for the query
    console.log(`Creating fallback mock product for "${query}"`);
    return [
      {
        id: `mock-${Date.now()}`,
        name: query,
        price: 1.99,
        image_url: "https://placehold.co/200x200?text=Product",
        size: "1 item"
      }
    ];
  } catch (error) {
    console.error(`Error searching products for "${query}":`, error);
    // Instead of throwing, return a mock product
    return [
      {
        id: `error-${Date.now()}`,
        name: query,
        price: 0.99,
        image_url: "https://placehold.co/200x200?text=NotFound",
        size: "1 item",
        error: error.message
      }
    ];
  }
};

/**
 * Create a cart with items and get the checkout URL
 * @param {string} retailerId - Instacart retailer ID
 * @param {Array} items - Array of items to add to cart
 * @returns {Promise<Object>} Cart object with checkout URL
 */
const createCart = async (retailerId, items) => {
  try {
    const response = await instacartBackendAxios.post('/instacart/carts', {
      retailer_id: retailerId,
      items: items.map(item => ({
        product_id: item.product_id.toString(),
        quantity: item.quantity || 1
      }))
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating cart:', error);
    
    // Provide detailed error message for debugging
    if (error.response?.status === 500) {
      console.error('Server error details:', {
        data: error.response.data,
        status: error.response.status
      });
      
      throw new Error(
        'Server error while creating cart. This may be due to an issue with the ' +
        'product IDs or retailer ID. Please try a different retailer or search again.'
      );
    }
    
    throw error;
  }
};

/**
 * Check if the Instacart integration is working
 * @returns {Promise<Object>} Status object with connection info
 */
const checkInstacartStatus = async () => {
  try {
    const response = await instacartBackendAxios.get('/instacart/status');
    return response.data;
  } catch (error) {
    console.error('Error checking Instacart status:', error);

    // Create a detailed error response with more information
    const errorData = {
      is_connected: false,
      message: error.message,
      error_type: error.name,
      http_status: error.response?.status,
      http_status_text: error.response?.statusText,
      response_data: error.response?.data,
      request_info: {
        url: '/instacart/status',
        method: 'GET'
      },
      timestamp: new Date().toISOString()
    };

    // If we got a 404, it means the endpoint doesn't exist yet
    if (error.response?.status === 404) {
      errorData.message = 'API endpoint not implemented yet - The /instacart/status endpoint is missing';
      errorData.suggestion = 'Create the API endpoint on the backend server';
    }

    return errorData;
  }
};

/**
 * Get API key information
 * @returns {Promise<Object>} API key information
 */
const getApiKeyInfo = async () => {
  try {
    const response = await instacartBackendAxios.get('/instacart/key-info');
    return response.data;
  } catch (error) {
    console.error('Error retrieving API key info:', error);
    return {
      exists: false,
      masked: 'Unknown',
      length: 'Unknown',
      format: 'Unknown',
      error: error.message
    };
  }
};

/**
 * Get backend environment info
 * @returns {Promise<Object>} Environment information
 */
const getEnvironmentInfo = async () => {
  try {
    const response = await instacartBackendAxios.get('/instacart/environment');
    return response.data;
  } catch (error) {
    console.error('Error retrieving environment info:', error);
    return {
      error: error.message
    };
  }
};

/**
 * Add grocery items to Instacart cart
 * @param {string} retailerId - Instacart retailer ID
 * @param {Array} groceryItems - Array of grocery item names
 * @returns {Promise<Object>} Result with success flag and cart data
 */
const addGroceryItemsToInstacart = async (retailerId, groceryItems) => {
  try {
    // Step 1: Search for each item to get product IDs
    const searchPromises = groceryItems.map(async (item) => {
      try {
        const results = await searchProducts(retailerId, item, 1);
        if (results && results.length > 0) {
          return {
            product_id: results[0].id,
            name: results[0].name,
            original_query: item,
            quantity: 1
          };
        }
        return null;
      } catch (searchError) {
        console.warn(`Error searching for "${item}":`, searchError);
        return null;
      }
    });
    
    const searchResults = await Promise.all(searchPromises);
    const foundProducts = searchResults.filter(Boolean);
    
    if (foundProducts.length === 0) {
      return {
        success: false,
        message: 'No matching products found'
      };
    }
    
    // Step 2: Create cart with found products
    const cartItems = foundProducts.map(product => ({
      product_id: product.product_id,
      quantity: 1
    }));
    
    const cart = await createCart(retailerId, cartItems);
    
    return {
      success: true,
      cart,
      matched_items: foundProducts,
      unmatched_items: groceryItems.filter(item => 
        !foundProducts.some(p => p.original_query === item)
      )
    };
  } catch (error) {
    console.error('Error adding grocery items to Instacart:', error);
    return {
      success: false,
      message: error.message
    };
  }
};

export default {
  getNearbyRetailers,
  searchProducts,
  createCart,
  checkInstacartStatus,
  addGroceryItemsToInstacart,
  getApiKeyInfo,
  getEnvironmentInfo
};