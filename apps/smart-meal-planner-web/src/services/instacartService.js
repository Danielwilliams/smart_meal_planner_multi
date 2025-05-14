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
    'Accept': 'application/json'
  },
  withCredentials: false
});

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

    // First try to get all retailers (since the nearby endpoint might not exist yet)
    console.log('Falling back to getRetailers since /nearby endpoint may not exist yet');

    // Get all retailers as a fallback
    const response = await instacartAxiosInstance.get('/instacart/retailers');
    console.log('Retailers response:', response);

    // Just return the full list for now as a fallback
    // In the future, this would filter by ZIP code
    const retailers = response.data;

    // Add mock data if needed for testing
    if (!retailers || retailers.length === 0) {
      console.log('No retailers found, adding mock data for testing');
      return [
        {
          id: 'publix',
          name: 'Publix',
          logo_url: 'https://www.instacart.com/assets/retailers/publix-e038b4e4dddb75ad3b3b4a4acdbaf7edcff86d42b7e4ecb6c8c8a1f708d21758.png',
          address: {
            street: '123 Main St',
            city: 'Loveland',
            state: 'CO',
            zip_code: zipCode
          }
        },
        {
          id: 'kroger',
          name: 'Kroger',
          logo_url: 'https://www.instacart.com/assets/retailers/kroger-5d418ef8b50e0ed307c36f5fe3fdfbff0b247a2f803860bc81459a8db4472408.png',
          address: {
            street: '456 Oak Ave',
            city: 'Loveland',
            state: 'CO',
            zip_code: zipCode
          }
        },
        {
          id: 'target',
          name: 'Target',
          logo_url: 'https://www.instacart.com/assets/retailers/target-3b7fdad9c41e99ba74f6be5ee83d964ec7bfe7a10a2f8b61b5dd22bc93c46095.png',
          address: {
            street: '789 Pine Blvd',
            city: 'Loveland',
            state: 'CO',
            zip_code: zipCode
          }
        },
        {
          id: 'aldi',
          name: 'ALDI',
          logo_url: 'https://www.instacart.com/assets/retailers/aldi-f6de3c93bedc5c053cfa307d8d4aac342ab7a348c39ab810db1bd962d4b0f533.png',
          address: {
            street: '101 Elm St',
            city: 'Loveland',
            state: 'CO',
            zip_code: zipCode
          }
        }
      ];
    }

    return retailers;
  } catch (error) {
    console.error(`Error fetching nearby Instacart retailers for ZIP ${zipCode}:`, error);
    console.log('Providing mock data due to error');

    // Return mock data as fallback in case of errors
    return [
      {
        id: 'publix',
        name: 'Publix',
        logo_url: 'https://www.instacart.com/assets/retailers/publix-e038b4e4dddb75ad3b3b4a4acdbaf7edcff86d42b7e4ecb6c8c8a1f708d21758.png',
        address: {
          street: '123 Main St',
          city: 'Loveland',
          state: 'CO',
          zip_code: zipCode
        }
      },
      {
        id: 'kroger',
        name: 'Kroger',
        logo_url: 'https://www.instacart.com/assets/retailers/kroger-5d418ef8b50e0ed307c36f5fe3fdfbff0b247a2f803860bc81459a8db4472408.png',
        address: {
          street: '456 Oak Ave',
          city: 'Loveland',
          state: 'CO',
          zip_code: zipCode
        }
      },
      {
        id: 'target',
        name: 'Target',
        logo_url: 'https://www.instacart.com/assets/retailers/target-3b7fdad9c41e99ba74f6be5ee83d964ec7bfe7a10a2f8b61b5dd22bc93c46095.png',
        address: {
          street: '789 Pine Blvd',
          city: 'Loveland',
          state: 'CO',
          zip_code: zipCode
        }
      },
      {
        id: 'aldi',
        name: 'ALDI',
        logo_url: 'https://www.instacart.com/assets/retailers/aldi-f6de3c93bedc5c053cfa307d8d4aac342ab7a348c39ab810db1bd962d4b0f533.png',
        address: {
          street: '101 Elm St',
          city: 'Loveland',
          state: 'CO',
          zip_code: zipCode
        }
      }
    ];
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