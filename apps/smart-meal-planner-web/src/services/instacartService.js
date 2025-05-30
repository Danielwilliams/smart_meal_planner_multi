/**
 * Instacart API Service
 *
 * This service handles all interactions with the Instacart API endpoints
 * in our backend, which in turn communicates with the Instacart API.
 *
 * IMPORTANT: We're using Instacart's development environment, not production!
 */

import axios from 'axios';
import apiService from './apiService';
// Import mock data for fallback
import { getMockRetailersByZip } from './mockData/instacartRetailers';
import { getMockProductSearch } from './mockData/instacartProducts';

// Determine which endpoint to use based on environment
// For production, use our own API proxy to avoid CORS issues
const isProduction = process.env.NODE_ENV === 'production';

// Try to detect if we're in Vercel Preview or actual deployment
const isVercel = typeof window !== 'undefined' && 
                 window.location.hostname.includes('vercel.app');

// In production, we'll use our own API proxy to avoid CORS issues
// We'll try different approaches in case one fails
const getBaseUrl = () => {
  if (isProduction || isVercel) {
    // For production or Vercel previews, use relative path proxy
    return '';
  } else {
    // In development, use direct URL
    return 'https://smartmealplannermulti-development.up.railway.app';
  }
};

const INSTACART_DEV_URL = getBaseUrl();

console.log(`Using Instacart ${isProduction ? 'production proxy' : 'direct development'} URL:`, 
  INSTACART_DEV_URL || 'relative paths');
  
// Helper function to get the full API path for retailer endpoints
const getRetailerPath = (path, useProxy = false) => {
  if (useProxy || (isProduction || isVercel)) {
    // Use /api prefix for production or when proxy is requested
    return `/api${path.startsWith('/') ? path : `/${path}`}`;
  } else {
    // Direct URL for development
    return `${INSTACART_DEV_URL}${path.startsWith('/') ? path : `/${path}`}`;
  }
};

// Flag to enable mock data fallback
const ENABLE_MOCK_FALLBACK = false; // Keeping disabled to find the root cause

const instacartAxiosInstance = axios.create({
  baseURL: INSTACART_DEV_URL,
  timeout: 600000, // 10 minutes
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Instacart-API-Key': 'INSTACARTAPI_DEV' // This will be replaced with the actual key on the backend
  },
  withCredentials: isProduction, // Enable credentials for same-origin requests in production
  // Set to true to include cookies in same-origin requests
});

// Log the configuration for debugging
console.info('Instacart API config:', {
  baseURL: INSTACART_DEV_URL,
  environment: process.env.NODE_ENV,
  withCredentials: isProduction,
  headers: {
    // Don't log the actual API key value in production
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Instacart-API-Key': '[CONFIGURED]'
  }
});

// Add a request interceptor to log API call details
instacartAxiosInstance.interceptors.request.use(
  config => {
    console.log(`Instacart API Request: ${config.method.toUpperCase()} ${config.url}`, config);
    return config;
  },
  error => {
    console.error('Instacart API Request Error:', error);
    return Promise.reject(error);
  }
);

// Add a response interceptor to log responses
instacartAxiosInstance.interceptors.response.use(
  response => {
    console.log('Instacart API Response:', response.status, response.data);
    return response;
  },
  error => {
    console.error('Instacart API Response Error:', error.response ? error.response.status : 'Network Error',
                 error.response ? error.response.data : error.message);
                 
    // Enhance error object with more debugging information
    if (error.response) {
      // If unauthorized (401) or forbidden (403), likely an API key issue
      if (error.response.status === 401 || error.response.status === 403) {
        error.isApiKeyError = true;
        error.apiErrorMessage = 'API key unauthorized. Please check the INSTACARTAPI_DEV configuration.';
      }
    }
    
    return Promise.reject(error);
  }
);

/**
 * Get a list of available retailers on Instacart
 * @returns {Promise<Array>} List of retailers with id, name, and logo_url
 * @deprecated Use getNearbyRetailers instead for more accurate location-based results
 */
export const getRetailers = async () => {
  const attempts = [
    () => instacartAxiosInstance.get('/instacart/retailers'),
    () => axios.get(getRetailerPath('/instacart/retailers')),
    () => axios.get('/api/instacart/retailers'),
    // Ultimate fallback - direct URL
    () => axios.get('https://smartmealplannermulti-development.up.railway.app/instacart/retailers')
  ];
  
  let lastError = null;
  
  // Try each approach until one works
  for (const attempt of attempts) {
    try {
      const response = await attempt();
      console.log('Instacart retailers response:', response);
      return response.data;
    } catch (error) {
      console.warn('Retailers attempt failed:', error.message);
      lastError = error;
      // Continue to next attempt
    }
  }
  
  // If we get here, all attempts failed
  console.error('Error fetching Instacart retailers:', lastError);
  
  // Use mock data as fallback if enabled
  if (ENABLE_MOCK_FALLBACK) {
    console.log('⚠️ API is unreachable - Using mock data as fallback');
    return getMockRetailersByZip('80538');
  }
  
  throw lastError;
};

/**
 * Get a list of nearby retailers on Instacart based on zip code
 * @param {string} zipCode - The ZIP code to search retailers near
 * @returns {Promise<Array>} List of nearby retailers with id, name, logo_url and other details
 */
export const getNearbyRetailers = async (zipCode) => {
  try {
    console.log(`Getting nearby Instacart retailers for ZIP: ${zipCode}`);

    // If we're in production and having CORS issues, we'll add a retry mechanism
    // that falls back to our API proxy with relative paths
    const maxRetries = 2;
    let attempt = 0;
    let lastError = null;
    
    // Try to get retailers by ZIP code with retries
    while (attempt < maxRetries) {
      try {
        // If we're on a retry, use a different approach
        let endpoint = '/instacart/retailers/nearby';
        let instance = instacartAxiosInstance;
        
        // On retry, use direct axios with different configurations
        if (attempt > 0) {
          console.log('Using fallback approach on retry');
          endpoint = '/api/instacart/retailers/nearby';
          instance = axios;
        }
        
        console.log(`Attempt ${attempt + 1}: Fetching from ${endpoint}`);
        const response = await instance.get(endpoint, {
          params: { zip_code: zipCode },
          // Use these headers for direct axios calls
          ...(attempt > 0 ? { 
            headers: instacartAxiosInstance.defaults.headers,
            withCredentials: true
          } : {})
        });
        
        console.log('Nearby Instacart retailers response:', response);

        if (response.data && Array.isArray(response.data) && response.data.length > 0) {
          return response.data;
        }

        console.warn('Nearby retailers endpoint returned empty results');
        throw new Error('No nearby retailers found');
      } catch (nearbyError) {
        lastError = nearbyError;
        attempt++;
        console.warn(`Attempt ${attempt} failed:`, nearbyError.message);
        
        // If it's the last attempt, try the fallback to all retailers
        if (attempt === maxRetries) {
          // If the endpoint doesn't exist or returns an error, fall back to the standard endpoint
          console.warn(`All nearby retailer attempts failed: ${nearbyError.message}`);
          console.log('Falling back to standard retailers endpoint');

          try {
            // Try both direct and relative paths
            let allRetailersResponse;
            try {
              allRetailersResponse = await instacartAxiosInstance.get('/instacart/retailers');
            } catch (directError) {
              console.warn('Direct retailer endpoint failed, trying relative path');
              allRetailersResponse = await axios.get('/api/instacart/retailers', {
                headers: instacartAxiosInstance.defaults.headers
              });
            }
            
            console.log('All retailers response:', allRetailersResponse);

            if (!allRetailersResponse.data || !Array.isArray(allRetailersResponse.data) || allRetailersResponse.data.length === 0) {
              throw new Error('No retailers available from Instacart API');
            }

            return allRetailersResponse.data;
          } catch (fallbackError) {
            console.error('Final fallback attempt failed:', fallbackError);
            
            // Use mock data as a last resort if enabled
            if (ENABLE_MOCK_FALLBACK) {
              console.log('⚠️ API is unreachable - Using mock data as fallback');
              return getMockRetailersByZip(zipCode);
            }
            
            throw fallbackError; // Throw the fallback error if mock data is disabled
          }
        }
        
        // Wait briefly before retrying
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    // If we got here, all retries failed
    // Use mock data as a last resort if enabled
    if (ENABLE_MOCK_FALLBACK) {
      console.log('⚠️ API is unreachable - Using mock data as fallback');
      return getMockRetailersByZip(zipCode);
    }
    
    throw lastError || new Error('Failed to get nearby retailers after multiple attempts');
  } catch (error) {
    console.error(`Error fetching Instacart retailers for ZIP ${zipCode}:`, error);
    
    // Check for specific error conditions and provide better error messages
    if (error.isApiKeyError) {
      throw new Error(`API key error: ${error.apiErrorMessage}`);
    }
    
    if (error.response && error.response.status === 429) {
      throw new Error('Too many requests to Instacart API. Please try again later.');
    }
    
    // For CORS errors, suggest a different approach
    if (error.message && error.message.includes('CORS')) {
      throw new Error('CORS error: Try using a different browser or clearing your browser cache.');
    }
    
    // Use mock data as a last resort if enabled
    if (ENABLE_MOCK_FALLBACK) {
      console.log('⚠️ API is unreachable - Using mock data as fallback');
      return getMockRetailersByZip(zipCode);
    }
    
    // Propagate the error if mock data is disabled
    throw error;
  }
};

/**
 * Search for products at a specific retailer
 * @param {string} retailerId - Instacart retailer ID
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results (optional, default 10)
 * @returns {Promise<Array>} List of products matching the search query
 */
export const searchProducts = async (retailerId, query, limit = 10) => {
  try {
    console.log(`Searching Instacart (DEV) products - retailer: ${retailerId}, query: ${query}, limit: ${limit}`);
    
    // Try multiple approaches for searching products
    const searchAttempts = [
      // First try the standard approach
      async () => {
        const response = await instacartAxiosInstance.get(
          `/instacart/retailers/${retailerId}/products/search`,
          { params: { query, limit } }
        );
        return response.data;
      },
      // Then try with API prefix
      async () => {
        const response = await axios.get(
          `/api/instacart/retailers/${retailerId}/products/search`,
          {
            params: { query, limit },
            headers: instacartAxiosInstance.defaults.headers
          }
        );
        return response.data;
      },
      // Finally try direct URL as last attempt
      async () => {
        const response = await axios.get(
          `https://smartmealplannermulti-development.up.railway.app/instacart/retailers/${retailerId}/products/search`,
          {
            params: { query, limit },
            headers: instacartAxiosInstance.defaults.headers
          }
        );
        return response.data;
      }
    ];
    
    // Try each approach in sequence
    let lastError = null;
    for (const attempt of searchAttempts) {
      try {
        const results = await attempt();
        console.log('Instacart search response:', results);
        return results;
      } catch (err) {
        console.warn('Product search attempt failed:', err.message);
        lastError = err;
        // Continue to next attempt
      }
    }
    
    // If all attempts failed, use mock data if enabled
    if (ENABLE_MOCK_FALLBACK) {
      console.log('⚠️ API is unreachable - Using mock product data as fallback');
      return getMockProductSearch(query, limit);
    }
    
    // Otherwise throw the error
    throw lastError || new Error('Failed to search products after multiple attempts');
  } catch (error) {
    console.error('Error searching Instacart products:', error);
    
    // Use mock data as fallback if enabled
    if (ENABLE_MOCK_FALLBACK) {
      console.log('⚠️ API is unreachable - Using mock product data as fallback');
      return getMockProductSearch(query, limit);
    }
    
    throw error;
  }
};

/**
 * Create a new Instacart cart with items
 * @param {string} retailerId - Instacart retailer ID
 * @param {Array} items - Array of items to add, each with product_id and quantity
 * @returns {Promise<Object>} Cart object with ID and checkout URL
 */
export const createCart = async (retailerId, items) => {
  try {
    console.log(`Creating Instacart (DEV) cart - retailer: ${retailerId}, items:`, items);
    const response = await instacartAxiosInstance.post('/instacart/carts', {
      retailer_id: retailerId,
      items
    });
    console.log('Instacart cart creation response:', response);
    return response.data;
  } catch (error) {
    console.error('Error creating Instacart cart:', error);
    throw error;
  }
};

/**
 * Add an item to an existing cart
 * @param {string} cartId - Instacart cart ID
 * @param {string} productId - Product ID to add
 * @param {number} quantity - Quantity to add
 * @returns {Promise<Object>} Updated cart object
 */
export const addItemToCart = async (cartId, productId, quantity = 1) => {
  try {
    console.log(`Adding item to Instacart (DEV) cart - cartId: ${cartId}, productId: ${productId}, quantity: ${quantity}`);
    const response = await instacartAxiosInstance.post(`/instacart/carts/${cartId}/items`, {
      product_id: productId,
      quantity
    });
    console.log('Add item response:', response);
    return response.data;
  } catch (error) {
    console.error('Error adding item to Instacart cart:', error);
    throw error;
  }
};

/**
 * Get cart details
 * @param {string} cartId - Instacart cart ID
 * @returns {Promise<Object>} Cart object with items
 */
export const getCart = async (cartId) => {
  try {
    console.log(`Getting Instacart (DEV) cart - cartId: ${cartId}`);
    const response = await instacartAxiosInstance.get(`/instacart/carts/${cartId}`);
    console.log('Get cart response:', response);
    return response.data;
  } catch (error) {
    console.error('Error getting Instacart cart:', error);
    throw error;
  }
};

/**
 * Match grocery list items to Instacart products
 * @param {string} retailerId - Instacart retailer ID
 * @param {number} menuId - Menu ID containing grocery list
 * @returns {Promise<Object>} Matching results with matches and unmatched items
 */
export const matchGroceryList = async (retailerId, menuId) => {
  try {
    console.log(`Matching grocery list with Instacart (DEV) - retailerId: ${retailerId}, menuId: ${menuId}`);
    const response = await instacartAxiosInstance.get(`/instacart/match/${retailerId}`, {
      params: { menu_id: menuId }
    });
    console.log('Match grocery list response:', response);
    return response.data;
  } catch (error) {
    console.error('Error matching grocery list with Instacart:', error);
    throw error;
  }
};

/**
 * Helper to add an array of grocery items to Instacart
 * @param {string} retailerId - Instacart retailer ID
 * @param {Array} groceryItems - Array of grocery item names
 * @returns {Promise<Object>} Cart object with checkout URL
 */
export const addGroceryItemsToInstacart = async (retailerId, groceryItems) => {
  try {
    console.log(`Adding grocery items to Instacart (DEV) - retailerId: ${retailerId}, items:`, groceryItems);

    // First search for each item
    const itemPromises = groceryItems.map(item =>
      searchProducts(retailerId, item, 1)
        .then(results => {
          console.log(`Search results for "${item}":`, results);
          return results && results.length > 0 ? results[0] : null;
        })
    );

    const searchResults = await Promise.all(itemPromises);
    const foundProducts = searchResults.filter(Boolean);

    console.log('Found products:', foundProducts);

    if (foundProducts.length === 0) {
      throw new Error('No matching products found on Instacart');
    }

    // Create cart with found products
    const cartItems = foundProducts.map(product => ({
      product_id: product.id,
      quantity: 1
    }));

    console.log('Creating cart with items:', cartItems);
    const cart = await createCart(retailerId, cartItems);
    console.log('Created cart:', cart);
    return cart;
  } catch (error) {
    console.error('Error adding grocery items to Instacart:', error);
    throw error;
  }
};

export default {
  getRetailers,
  getNearbyRetailers,
  searchProducts,
  createCart,
  addItemToCart,
  getCart,
  matchGroceryList,
  addGroceryItemsToInstacart
};