/**
 * Final Instacart Backend Service
 * 
 * This is a simplified version that uses relative URLs to work with the Vercel proxy.
 */

import axios from 'axios';

// Create an axios instance for Instacart backend requests
const instacartBackendAxios = axios.create({
  // Use relative URLs - these will go to your own domain (Vercel)
  baseURL: '',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

// Add logging for debugging
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
 */
const getNearbyRetailers = async (zipCode) => {
  try {
    // First try the nearby endpoint
    try {
      const response = await instacartBackendAxios.get('/api/instacart/retailers/nearby', {
        params: { zip_code: zipCode }
      });

      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return response.data;
      }
    } catch (nearbyError) {
      console.warn('Nearby retailers endpoint failed:', nearbyError.message);
    }

    // Fall back to general endpoint
    const response = await instacartBackendAxios.get('/api/instacart/retailers');
    return response.data || [];
  } catch (error) {
    console.error('Error getting nearby retailers:', error);
    throw new Error(`Error getting retailers: ${error.message}`);
  }
};

/**
 * Search for products at a specific retailer
 */
const searchProducts = async (retailerId, query, limit = 10) => {
  try {
    const response = await instacartBackendAxios.get(`/api/instacart/retailers/${retailerId}/products/search`, {
      params: { query, limit }
    });
    
    return response.data || [];
  } catch (error) {
    console.error(`Error searching products:`, error);
    throw error;
  }
};

/**
 * Create a cart with items
 */
const createCart = async (retailerId, items) => {
  try {
    const response = await instacartBackendAxios.post('/api/instacart/carts', {
      retailer_id: retailerId,
      items: items.map(item => ({
        product_id: item.product_id.toString(),
        quantity: item.quantity || 1
      }))
    });
    
    return response.data;
  } catch (error) {
    console.error('Error creating cart:', error);
    throw error;
  }
};

/**
 * Check if the Instacart integration is working
 */
const checkInstacartStatus = async () => {
  try {
    const response = await instacartBackendAxios.get('/api/instacart/status');
    return response.data;
  } catch (error) {
    console.error('Error checking Instacart status:', error);
    return {
      is_connected: false,
      message: error.message,
      error_type: error.name,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get API key information
 */
const getApiKeyInfo = async () => {
  try {
    const response = await instacartBackendAxios.get('/api/instacart/key-info');
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
 */
const getEnvironmentInfo = async () => {
  try {
    const response = await instacartBackendAxios.get('/api/instacart/environment');
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
 */
const addGroceryItemsToInstacart = async (retailerId, groceryItems) => {
  try {
    // Search for each item to get product IDs
    const searchResults = await Promise.all(
      groceryItems.map(async (item) => {
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
      })
    );
    
    const foundProducts = searchResults.filter(Boolean);
    
    if (foundProducts.length === 0) {
      return {
        success: false,
        message: 'No matching products found'
      };
    }
    
    // Create cart with found products
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