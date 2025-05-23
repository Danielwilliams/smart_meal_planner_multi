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
/**
 * Get user ZIP code from local storage or sessionStorage
 * @returns {string|null} ZIP code if found, null otherwise
 */
const getUserZipCode = () => {
  try {
    // Try different storage options where ZIP code might be saved
    // 1. Check localStorage for user profile
    const userProfileStr = localStorage.getItem('userProfile');
    if (userProfileStr) {
      try {
        const userProfile = JSON.parse(userProfileStr);
        if (userProfile && userProfile.zip_code) {
          console.log('Using ZIP code from localStorage userProfile:', userProfile.zip_code);
          return userProfile.zip_code;
        }
      } catch (e) {
        console.warn('Error parsing user profile from localStorage:', e);
      }
    }

    // 2. Check localStorage for specific zip code entry
    const zipCode = localStorage.getItem('zipCode');
    if (zipCode) {
      console.log('Using ZIP code from localStorage:', zipCode);
      return zipCode;
    }

    // 3. Check sessionStorage
    const sessionZipCode = sessionStorage.getItem('zipCode');
    if (sessionZipCode) {
      console.log('Using ZIP code from sessionStorage:', sessionZipCode);
      return sessionZipCode;
    }

    return null;
  } catch (e) {
    console.warn('Error retrieving user ZIP code:', e);
    return null;
  }
};

/**
 * Get nearby retailers based on ZIP code
 * @param {string} zipCode - ZIP code to search for nearby retailers
 * @returns {Promise<Array>} List of retailers
 */
const getNearbyRetailers = async (zipCode) => {
  try {
    // If zipCode is not provided, try to get it from user profile
    if (!zipCode) {
      const userZipCode = getUserZipCode();
      if (userZipCode) {
        zipCode = userZipCode;
      } else {
        // Default to Loveland, CO if no ZIP code available
        zipCode = '80538';
      }
      console.log('Using ZIP code for retailers:', zipCode);
    }

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

    // Try the general retailers endpoint - always include postal_code and country_code
    try {
      const response = await instacartBackendAxios.get('/instacart/retailers', {
        params: {
          postal_code: zipCode || '80538',  // Default to Loveland, CO
          country_code: 'US'
        }
      });

      // Handle different response formats
      if (response.data) {
        // First check if it's an object with a retailers array (new IDP API format)
        if (typeof response.data === 'object' && !Array.isArray(response.data) && response.data.retailers) {
          console.log('Found retailers array in response.data.retailers');
          response.data = response.data.retailers;
        }

        // Now check if we have an array to process
        if (Array.isArray(response.data)) {
          const enhancedRetailers = response.data.map((retailer, index) => {
            // Generate a pseudo-random distance based on ZIP code and index
            // Extra safety check for zipCode
            let zipPrefix = 8; // Default value
            if (zipCode && typeof zipCode === 'string' && zipCode.length > 0) {
              try {
                zipPrefix = parseInt(zipCode.substring(0, 1)) || 8;
              } catch (err) {
                console.warn('Error parsing ZIP code:', err);
              }
            }

            const distanceSeed = (zipPrefix + index) % 10;
            const distance = Math.round((distanceSeed + Math.random() * 5) * 10) / 10;

            // Handle different retailer formats
            let retailerId, retailerName, logoUrl;

            if (retailer.retailer_key) {
              // IDP API format
              retailerId = retailer.retailer_key;
              retailerName = retailer.name;
              logoUrl = retailer.retailer_logo_url;
            } else if (retailer.attributes) {
              // Connect API format
              retailerId = retailer.id;
              retailerName = retailer.attributes.name;
              logoUrl = retailer.attributes.logo_url;
            } else {
              // Generic format
              retailerId = retailer.id;
              retailerName = retailer.name;
              logoUrl = retailer.logo_url;
            }

            return {
              id: retailerId,
              name: retailerName,
              logo_url: logoUrl,
              distance: retailer.distance || distance,
              address: retailer.address || null // Don't create mock addresses
            };
          });

          // Sort by distance
          return enhancedRetailers.sort((a, b) => a.distance - b.distance);
        }
      }

      return response.data || [];
    } catch (retailersError) {
      console.warn('General retailers endpoint failed:', retailersError.message);
      // Fall back to mock endpoint
    }

    // Instead of falling back to mock endpoints, return an error that the UI can handle
    console.log('All retailer endpoints failed');

    // Return structured error object
    throw new Error('Failed to retrieve retailers');

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

    // Instead of throwing the error, return a structured error object
    // that won't cause TypeErrors when used
    return {
      error: errorObj.message,
      errorType: 'fetchError',
      status: errorObj.status || 500,
      timestamp: new Date().toISOString()
    };
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
    console.log(`Searching for "${query}" at retailer ${retailerId}`);

    // First try the regular search endpoint
    try {
      const response = await instacartBackendAxios.get(`/instacart/retailers/${retailerId}/products/search`, {
        params: { query, limit }
      });

      console.log('Product search response:', response.data);

      // Handle different response formats
      if (response.data) {
        // Check if it's an object with a products array (new IDP API format)
        if (typeof response.data === 'object' && !Array.isArray(response.data)) {
          if (response.data.products) {
            console.log('Found products array in response.data.products');
            return response.data.products.map(product => ({
              id: product.product_id || product.id,
              name: product.name,
              price: product.price,
              image_url: product.image_url,
              size: product.size || ''
            }));
          } else if (response.data.error) {
            // This is an error response, log and continue to next attempt
            console.warn('Error response from product search:', response.data.error);
            throw new Error(response.data.error);
          }
        }

        // If it's already an array, use it directly
        if (Array.isArray(response.data)) {
          return response.data;
        }
      }

      // If no valid data format was found, throw an error
      throw new Error('Invalid response format from product search endpoint');
    } catch (searchError) {
      console.warn(`Regular product search failed for "${query}":`, searchError.message);
      // Fall back to next attempt
    }

    // Return a single product to show instead of completely failing the UI
    console.log(`Creating fallback product for "${query}"`);
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
    // Return a structured error object that the UI can handle
    return {
      error: error.message,
      errorType: 'searchError',
      status: error.response?.status || 500,
      timestamp: new Date().toISOString(),
      // Include a fallback product to avoid UI errors
      fallbackProducts: [
        {
          id: `error-${Date.now()}`,
          name: query,
          price: 0.99,
          image_url: "https://placehold.co/200x200?text=Error",
          size: "1 item",
          error: error.message
        }
      ]
    };
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
    // Try to get the user's ZIP code
    const userZipCode = getUserZipCode() || '80538';

    // The status endpoint will make test API calls, make sure we include required parameters
    const response = await instacartBackendAxios.get('/instacart/status', {
      params: {
        postal_code: userZipCode,
        country_code: 'US'
      }
    });
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

/**
 * Create a direct shopping list URL from item names
 *
 * This uses the Instacart "Create Shopping List Page" API endpoint which is
 * much more efficient than the traditional cart approach. It generates a
 * direct URL that opens Instacart with pre-populated items.
 *
 * @param {string} retailerId - Instacart retailer ID
 * @param {Array<string>} itemNames - Array of ingredient names/descriptions
 * @param {string} postalCode - Optional postal code (defaults to user zip code)
 * @returns {Promise<Object>} Result with success flag and shopping list URL
 */
const createShoppingListUrl = async (retailerId, itemNames, postalCode = null) => {
  try {
    // Use user's ZIP code if not provided
    if (!postalCode) {
      postalCode = getUserZipCode() || '80538';
    }

    // Make the API request
    const response = await instacartBackendAxios.post('/instacart/shopping-list', {
      retailer_id: retailerId,
      items: itemNames,
      postal_code: postalCode,
      country_code: 'US'
    });

    return {
      success: true,
      url: response.data.url,
      item_count: response.data.item_count
    };
  } catch (error) {
    console.error('Error creating shopping list URL:', error);
    return {
      success: false,
      error: error.message,
      status: error.response?.status,
      data: error.response?.data
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
  getEnvironmentInfo,
  createShoppingListUrl
};