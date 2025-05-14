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

// Create a separate axios instance for Instacart development environment
// Use development environment URL for Instacart API calls
const INSTACART_DEV_URL = 'https://smartmealplannermulti-development.up.railway.app';
console.log('Using Instacart development URL:', INSTACART_DEV_URL);

const instacartAxiosInstance = axios.create({
  baseURL: INSTACART_DEV_URL,
  timeout: 600000, // 10 minutes
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'X-Instacart-API-Key': 'INSTACARTAPI_DEV' // This will be replaced with the actual key on the backend
  },
  withCredentials: false
});

// Log the configuration for debugging
console.info('Instacart API config:', {
  baseURL: INSTACART_DEV_URL,
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
  try {
    const response = await instacartAxiosInstance.get('/instacart/retailers');
    console.log('Instacart retailers response:', response);
    return response.data;
  } catch (error) {
    console.error('Error fetching Instacart retailers:', error);
    throw error;
  }
};

/**
 * Get a list of nearby retailers on Instacart based on zip code
 * @param {string} zipCode - The ZIP code to search retailers near
 * @returns {Promise<Array>} List of nearby retailers with id, name, logo_url and other details
 */
export const getNearbyRetailers = async (zipCode) => {
  try {
    console.log(`Getting nearby Instacart retailers for ZIP: ${zipCode}`);

    // Try to get retailers by ZIP code first
    try {
      const response = await instacartAxiosInstance.get('/instacart/retailers/nearby', {
        params: { zip_code: zipCode }
      });
      console.log('Nearby Instacart retailers response:', response);

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }

      console.warn('Nearby retailers endpoint returned empty results');
      throw new Error('No nearby retailers found');
    } catch (nearbyError) {
      // If the endpoint doesn't exist or returns an error, fall back to the standard endpoint
      console.warn(`Nearby retailers endpoint failed: ${nearbyError.message}`);
      console.log('Falling back to standard retailers endpoint');

      const response = await instacartAxiosInstance.get('/instacart/retailers');
      console.log('All retailers response:', response);

      if (!response.data || !Array.isArray(response.data) || response.data.length === 0) {
        throw new Error('No retailers available from Instacart API');
      }

      return response.data;
    }
  } catch (error) {
    console.error(`Error fetching Instacart retailers for ZIP ${zipCode}:`, error);

    // Check for specific error conditions and provide better error messages
    if (error.isApiKeyError) {
      throw new Error(`API key error: ${error.apiErrorMessage}`);
    }

    if (error.response && error.response.status === 429) {
      throw new Error('Too many requests to Instacart API. Please try again later.');
    }

    // Propagate the error instead of masking it with mock data
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
    const response = await instacartAxiosInstance.get(
      `/instacart/retailers/${retailerId}/products/search`,
      { params: { query, limit } }
    );
    console.log('Instacart search response:', response);
    return response.data;
  } catch (error) {
    console.error('Error searching Instacart products:', error);
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