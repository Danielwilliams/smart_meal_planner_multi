// src/services/apiService.js - Updated to include Instacart
import axios from 'axios';

// Ensure we're using the correct API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
console.log('Using API base URL:', API_BASE_URL);

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // Increased to 10 minutes (600,000 ms)
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
});

// Track if a token refresh is in progress
let isRefreshingKrogerToken = false;
let krogerRefreshSubscribers = [];

// Function to add callbacks to be executed after token refresh
function subscribeToTokenRefresh(callback) {
  krogerRefreshSubscribers.push(callback);
}

// Function to execute all callbacks after token refresh
function onKrogerTokenRefreshed() {
  krogerRefreshSubscribers.forEach(callback => callback());
  krogerRefreshSubscribers = [];
}

// Function to handle Kroger token refresh
async function refreshKrogerToken() {
  if (isRefreshingKrogerToken) {
    // Return a promise that resolves when the refresh is done
    return new Promise(resolve => {
      subscribeToTokenRefresh(() => {
        resolve();
      });
    });
  }

  isRefreshingKrogerToken = true;
  console.log('Attempting to refresh Kroger token...');

  try {
    const response = await axiosInstance.post('/kroger/refresh-token');
    console.log('Kroger token refresh succeeded:', response.data);
    
    // Update the token in localStorage
    if (response.data.access_token) {
      localStorage.setItem('kroger_access_token', response.data.access_token);
    }
    
    // Notify all subscribers that the token has been refreshed
    onKrogerTokenRefreshed();
    isRefreshingKrogerToken = false;
    return response.data;
  } catch (error) {
    console.error('Error refreshing Kroger token:', error);
    isRefreshingKrogerToken = false;
    throw error;
  }
}

// Add request interceptor
axiosInstance.interceptors.request.use(
  config => {
    // Add Authorization header if token exists
    const token = localStorage.getItem('access_token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Add Kroger-specific headers if needed for specific endpoints
    if (config.url && config.url.includes('/kroger/') && config.url.includes('/cart/')) {
      const krogerToken = localStorage.getItem('kroger_access_token');
      if (krogerToken) {
        config.headers['Kroger-Authorization'] = `Bearer ${krogerToken}`;
      }
    }
    
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// Add response interceptor
axiosInstance.interceptors.response.use(
  response => {
    return response;
  },
  async error => {
    const originalRequest = error.config;
    
    // Check if it's a Kroger token error and automatic refresh is required
    if (
      error.response &&
      error.response.status === 401 &&
      error.response.data &&
      (error.response.data.message === 'Kroger token expired' || 
       error.response.data.detail === 'Kroger token expired') &&
      !originalRequest._retry
    ) {
      console.log('Kroger token expired. Attempting automatic refresh...');
      originalRequest._retry = true;
      
      try {
        await refreshKrogerToken();
        
        // Update the token in the original request
        const newKrogerToken = localStorage.getItem('kroger_access_token');
        if (newKrogerToken) {
          originalRequest.headers['Kroger-Authorization'] = `Bearer ${newKrogerToken}`;
        }
        
        // Retry the original request with the new token
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        console.error('Failed to refresh Kroger token:', refreshError);
        return Promise.reject(refreshError);
      }
    }
    
    return Promise.reject(error);
  }
);

const apiService = {
  API_BASE_URL,

  // User Authentication
  login: async (email, password) => {
    try {
      const response = await axiosInstance.post('/auth/login', { email, password });
      return response.data;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  signUp: async (userData) => {
    try {
      const response = await axiosInstance.post('/signup', userData);
      return response.data;
    } catch (error) {
      console.error('Signup error:', error);
      throw error;
    }
  },

  resetPassword: async (password, token) => {
    try {
      const response = await axiosInstance.post('/auth/reset-password', { password, token });
      return response.data;
    } catch (error) {
      console.error('Reset password error:', error);
      throw error;
    }
  },

  forgotPassword: async (email) => {
    try {
      const response = await axiosInstance.post('/auth/forgot-password', { email });
      return response.data;
    } catch (error) {
      console.error('Forgot password error:', error);
      throw error;
    }
  },

  verifyEmail: async (token) => {
    try {
      const response = await axiosInstance.get(`/auth/verify-email/${token}`);
      return response.data;
    } catch (error) {
      console.error('Email verification error:', error);
      throw error;
    }
  },

  // User Preferences
  getUserPreferences: async () => {
    try {
      const response = await axiosInstance.get('/preferences');
      return response.data;
    } catch (error) {
      console.error('Get preferences error:', error);
      throw error;
    }
  },

  updateUserPreferences: async (preferences) => {
    try {
      const response = await axiosInstance.post('/preferences', preferences);
      return response.data;
    } catch (error) {
      console.error('Update preferences error:', error);
      throw error;
    }
  },

  // Menus
  generateMenu: async (data) => {
    try {
      const response = await axiosInstance.post('/menu/generate', data);
      return response.data;
    } catch (error) {
      console.error('Generate menu error:', error);
      throw error;
    }
  },

  getMenuHistory: async () => {
    try {
      const response = await axiosInstance.get('/menu/history');
      return response.data;
    } catch (error) {
      console.error('Get menu history error:', error);
      throw error;
    }
  },

  getMenu: async (menuId) => {
    try {
      const response = await axiosInstance.get(`/menu/${menuId}`);
      return response.data;
    } catch (error) {
      console.error('Get menu error:', error);
      throw error;
    }
  },

  // Shopping List
  createShoppingList: async (menuId) => {
    try {
      const response = await axiosInstance.post('/grocery-list/create', { menu_id: menuId });
      return response.data;
    } catch (error) {
      console.error('Create shopping list error:', error);
      throw error;
    }
  },

  // Cart APIs
  getCartContents: async () => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await axiosInstance.get(`/cart/internal/${userId}/contents`);
      return response.data;
    } catch (error) {
      console.error('Get cart contents error:', error);
      throw error;
    }
  },

  addToCart: async (items, store = null) => {
    try {
      const response = await axiosInstance.post('/cart/internal/add_items', {
        items: items,
        store: store
      });
      return response.data;
    } catch (error) {
      console.error('Add to cart error:', error);
      throw error;
    }
  },

  removeFromCart: async (itemName, store) => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await axiosInstance.delete(`/cart/internal/${userId}/remove_item`, {
        data: { item_name: itemName, store: store }
      });
      return response.data;
    } catch (error) {
      console.error('Remove from cart error:', error);
      throw error;
    }
  },

  updateCartItemQuantity: async (itemName, store, quantity) => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await axiosInstance.patch(`/cart/internal/${userId}/update_quantity`, {
        item_name: itemName,
        store: store,
        quantity: quantity
      });
      return response.data;
    } catch (error) {
      console.error('Update cart item quantity error:', error);
      throw error;
    }
  },

  clearCart: async () => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await axiosInstance.delete(`/cart/internal/${userId}/clear`);
      return response.data;
    } catch (error) {
      console.error('Clear cart error:', error);
      throw error;
    }
  },

  clearStoreItems: async (store) => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await axiosInstance.delete(`/cart/internal/${userId}/clear_store/${store}`);
      return response.data;
    } catch (error) {
      console.error('Clear store items error:', error);
      throw error;
    }
  },

  assignStoreToItems: async (items, store) => {
    try {
      const userId = localStorage.getItem('user_id');
      const response = await axiosInstance.patch(`/cart/internal/${userId}/assign_store`, items, {
        params: { store: store }
      });
      return response.data;
    } catch (error) {
      console.error('Assign store to items error:', error);
      throw error;
    }
  },

  // Kroger specific APIs
  updateKrogerLocation: async (locationId) => {
    try {
      const response = await axiosInstance.post('/kroger/store-location', { location_id: locationId });
      return response.data;
    } catch (error) {
      console.error('Update Kroger location error:', error);
      throw error;
    }
  },

  searchKrogerItems: async (items, locationId = null) => {
    try {
      const response = await axiosInstance.post('/kroger/search', { 
        items: items,
        location_id: locationId || localStorage.getItem('kroger_store_location')
      });
      return response.data;
    } catch (error) {
      console.error('Search Kroger items error:', error);
      throw error;
    }
  },

  addToKrogerCart: async (items) => {
    try {
      const response = await axiosInstance.post('/kroger/cart/add', { items: items });
      return response.data;
    } catch (error) {
      console.error('Add to Kroger cart error:', error);
      
      // Check if this is a token expiration error and handle it
      if (
        error.response && 
        error.response.status === 401 && 
        (error.response.data.detail === 'Kroger token expired' || 
         error.response.data.message === 'Kroger token expired')
      ) {
        try {
          // Try to refresh the token and retry
          await refreshKrogerToken();
          const retryResponse = await axiosInstance.post('/kroger/cart/add', { items: items });
          return retryResponse.data;
        } catch (refreshError) {
          console.error('Failed to refresh token and retry add to cart:', refreshError);
          throw refreshError;
        }
      }
      
      throw error;
    }
  },

  // Walmart specific APIs
  searchWalmartItems: async (items) => {
    try {
      const response = await axiosInstance.post('/walmart/search', { items: items });
      return response.data;
    } catch (error) {
      console.error('Search Walmart items error:', error);
      throw error;
    }
  },

  addToWalmartCart: async (items) => {
    try {
      const response = await axiosInstance.post('/walmart/cart/add', { items: items });
      return response.data;
    } catch (error) {
      console.error('Add to Walmart cart error:', error);
      throw error;
    }
  },

  // Instacart specific APIs
  searchInstacartItems: async (items, retailerId = null) => {
    try {
      const payload = { items: items };
      if (retailerId) {
        payload.retailer_id = retailerId;
      }
      const response = await axiosInstance.post('/instacart/search', payload);
      return response.data;
    } catch (error) {
      console.error('Search Instacart items error:', error);
      throw error;
    }
  },

  getInstacartRetailers: async (zipCode) => {
    try {
      const response = await axiosInstance.get(`/instacart/retailers/${zipCode}`);
      return response.data;
    } catch (error) {
      console.error('Get Instacart retailers error:', error);
      throw error;
    }
  },

  createInstacartShoppingList: async (name, items) => {
    try {
      const response = await axiosInstance.post('/instacart/shopping-list/create', {
        name: name,
        items: items
      });
      return response.data;
    } catch (error) {
      console.error('Create Instacart shopping list error:', error);
      throw error;
    }
  },

  transferCartToInstacartList: async (name = "Meal Plan Shopping List") => {
    try {
      const response = await axiosInstance.post('/instacart/cart-to-shopping-list', {
        name: name
      });
      return response.data;
    } catch (error) {
      console.error('Transfer cart to Instacart list error:', error);
      throw error;
    }
  },

  // Store location APIs
  findNearbyStores: async (storeType, options) => {
    try {
      const { zipCode, radius, latitude, longitude } = options;
      
      let endpoint;
      let payload = {};
      
      // Handle store-specific endpoints
      if (storeType === 'kroger') {
        endpoint = '/kroger/stores/near';
        payload = { zip_code: zipCode, radius };
        
        if (latitude && longitude) {
          payload.latitude = latitude;
          payload.longitude = longitude;
        }
      } else if (storeType === 'walmart') {
        endpoint = '/walmart/stores/near';
        payload = { zip_code: zipCode, radius };
      } else if (storeType === 'instacart') {
        // Instacart uses a different endpoint pattern
        return await apiService.getInstacartRetailers(zipCode);
      } else {
        throw new Error(`Unknown store type: ${storeType}`);
      }
      
      const response = await axiosInstance.get(endpoint, { params: payload });
      return response.data;
    } catch (error) {
      console.error(`Find nearby ${storeType} stores error:`, error);
      throw error;
    }
  },

  // Organization APIs
  getOrganizations: async () => {
    try {
      const response = await axiosInstance.get('/organizations');
      return response.data;
    } catch (error) {
      console.error('Get organizations error:', error);
      throw error;
    }
  },

  createOrganization: async (organizationData) => {
    try {
      const response = await axiosInstance.post('/organizations', organizationData);
      return response.data;
    } catch (error) {
      console.error('Create organization error:', error);
      throw error;
    }
  },

  // Saved Recipes
  getSavedRecipes: async () => {
    try {
      const response = await axiosInstance.get('/saved-recipes');
      return response.data;
    } catch (error) {
      console.error('Get saved recipes error:', error);
      throw error;
    }
  },

  saveRecipe: async (recipeData) => {
    try {
      const response = await axiosInstance.post('/saved-recipes', recipeData);
      return response.data;
    } catch (error) {
      console.error('Save recipe error:', error);
      throw error;
    }
  },

  // Recipe Admin
  getRecipeCategories: async () => {
    try {
      const response = await axiosInstance.get('/recipe-admin/categories');
      return response.data;
    } catch (error) {
      console.error('Get recipe categories error:', error);
      throw error;
    }
  },

  addRecipe: async (recipeData) => {
    try {
      const response = await axiosInstance.post('/recipe-admin/recipes', recipeData);
      return response.data;
    } catch (error) {
      console.error('Add recipe error:', error);
      throw error;
    }
  },

  // AI Status
  getAIStatus: async () => {
    try {
      const response = await axiosInstance.get('/ai-status');
      return response.data;
    } catch (error) {
      console.error('Get AI status error:', error);
      throw error;
    }
  }
};

export { axiosInstance };
export default apiService;