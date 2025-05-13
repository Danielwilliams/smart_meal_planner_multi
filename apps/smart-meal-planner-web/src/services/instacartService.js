/**
 * Instacart API Service
 * 
 * This service handles all interactions with the Instacart API endpoints
 * in our backend, which in turn communicates with the Instacart API.
 */

import apiService, { axiosInstance } from './apiService';

/**
 * Get a list of available retailers on Instacart
 * @returns {Promise<Array>} List of retailers with id, name, and logo_url
 */
export const getRetailers = async () => {
  try {
    const response = await axiosInstance.get('/instacart/retailers');
    return response.data;
  } catch (error) {
    console.error('Error fetching Instacart retailers:', error);
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
    const response = await axiosInstance.get(
      `/instacart/retailers/${retailerId}/products/search`,
      { params: { query, limit } }
    );
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
    const response = await axiosInstance.post('/instacart/carts', {
      retailer_id: retailerId,
      items
    });
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
    const response = await axiosInstance.post(`/instacart/carts/${cartId}/items`, {
      product_id: productId,
      quantity
    });
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
    const response = await axiosInstance.get(`/instacart/carts/${cartId}`);
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
    const response = await axiosInstance.get(`/instacart/match/${retailerId}`, {
      params: { menu_id: menuId }
    });
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
    // First search for each item
    const itemPromises = groceryItems.map(item => 
      searchProducts(retailerId, item, 1)
        .then(results => results.length > 0 ? results[0] : null)
    );
    
    const searchResults = await Promise.all(itemPromises);
    const foundProducts = searchResults.filter(Boolean);
    
    if (foundProducts.length === 0) {
      throw new Error('No matching products found on Instacart');
    }
    
    // Create cart with found products
    const cartItems = foundProducts.map(product => ({
      product_id: product.id,
      quantity: 1
    }));
    
    const cart = await createCart(retailerId, cartItems);
    return cart;
  } catch (error) {
    console.error('Error adding grocery items to Instacart:', error);
    throw error;
  }
};

export default {
  getRetailers,
  searchProducts,
  createCart,
  addItemToCart,
  getCart,
  matchGroceryList,
  addGroceryItemsToInstacart
};