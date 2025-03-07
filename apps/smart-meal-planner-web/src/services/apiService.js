// src/services/apiService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 300000,  
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: true
});

// Request interceptor
axiosInstance.interceptors.request.use(
  config => {
    console.log('Request Details:', {
      method: config.method,
      url: config.url,
      baseURL: config.baseURL,
      headers: config.headers
    });
    return config;
  },
  error => {
    console.error('Request Error:', error);
    return Promise.reject(error);
  }
);

// Response interceptor
axiosInstance.interceptors.response.use(
  response => {
    console.log('Response Details:', {
      status: response.status,
      data: response.data
    });
    return response;
  },
  error => {
    console.error('Response Error:', {
      message: error.message,
      code: error.code,
      status: error.response?.status,
      data: error.response?.data
    });
    return Promise.reject(error);
  }
);

// Updated interceptor with better token handling
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    // Make sure we always have the 'Bearer ' prefix
    config.headers.Authorization = token.startsWith('Bearer ') 
      ? token 
      : `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Add response interceptor for handling token expiration
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

const apiService = {
  // Authentication Endpoints
  async login(payload) {
    try {
      console.log('Sending login request with payload:', {
        email: payload.email,
        hasPassword: !!payload.password,
        hasCaptcha: !!payload.captchaToken
      });

      const resp = await axiosInstance.post('/auth/login', {
        email: payload.email,
        password: payload.password,
        captcha_token: payload.captchaToken  // Note: backend might expect snake_case
      });
      
      console.log('Login Response Status:', resp.status);
      return resp.data;
    } catch (err) {
      console.error("Login Error Details:", {
        status: err.response?.status,
        data: err.response?.data,
        validation: err.response?.data?.detail
      });
      throw err;
    }
  },

  async verifyEmail(token) {
    try {
      const resp = await axiosInstance.get(`/auth/verify-email/${token}`);
      return resp.data;
    } catch (err) {
      console.error("Email verification error:", err.response?.data || err.message);
      throw err;
    }
  },

  async signUp(payload) {
    try {
      const resp = await axiosInstance.post('/auth/signup', payload);
      return resp.data;
    } catch (err) {
      console.error("Signup error:", err.response?.data || err.message);
      throw err;
    }
  },

  // User Preferences Endpoints
  async savePreferences(prefs) {
    try {
      const resp = await axiosInstance.put(`/preferences/${prefs.user_id}`, prefs);
      return resp.data;
    } catch (err) {
      console.error("Save preferences error:", err.response?.data || err.message);
      throw err;
    }
  },

  async getUserPreferences(userId) {
    try {
      console.log(`Fetching preferences for userId: ${userId}`);
      
      if (!userId || userId <= 0) {
        throw new Error('Invalid user ID');
      }

      const resp = await axiosInstance.get(`/preferences/${userId}`);
      return resp.data;
    } catch (err) {
      if (err.response?.status === 404 || err.message.includes('Invalid user ID')) {
        return {
          diet_type: '',
          dietary_restrictions: '',
          disliked_ingredients: '',
          recipe_type: '',
          macro_protein: null,
          macro_carbs: null,
          macro_fat: null,
          calorie_goal: null,
          meals: {
            breakfast: false,
            lunch: false,
            dinner: false,
            snacks: false
          },
          appliances: {
            airFryer: false,
            instapot: false,
            crockpot: false
          },
          prepComplexity: 50,
          snacksPerDay: 0,
          servings_per_meal: 1,
          kroger_store_location: null
        };
      }
      throw err;
    }
  },

  // Menu Endpoints
  async getLatestMenu(userId) {
    try {
      const resp = await axiosInstance.get(`/menu/latest/${userId}`);
      return resp.data;
    } catch (err) {
      console.error('Menu fetch error:', err);
      throw err;
    }
  },

  async updateMenuNickname(menuId, nickname) {
    try {
      const response = await axiosInstance.patch(`/menu/${menuId}/nickname`, {
        nickname
      });
      return response.data;
    } catch (err) {
      console.error("Error updating menu nickname:", err.response?.data || err.message);
      throw err;
    }
  },

  getMenuDetails: async (menuId) => {
    try {
      const resp = await axiosInstance.get(`/menu/${menuId}`);
      return resp.data;
    } catch (err) {
      console.error('Error fetching menu details:', err.response?.data || err.message);
      throw err;
    }
  },
  
  async getMenuHistory(userId) {
    try {
      const resp = await axiosInstance.get(`/menu/history/${userId}`);
      return resp.data;
    } catch (err) {
      console.error('Menu history fetch error:', err);
      throw err;
    }
  },

  async generateMenu(menuRequest) {
    try {
      const resp = await axiosInstance.post('/menu/generate', menuRequest);
      return resp.data;
    } catch (err) {
      console.error('Menu generation error:', err);
      throw err;
    }
  },

  // Grocery List Endpoints
  async getLatestGroceryList(userId) {
    try {
      const resp = await axiosInstance.get(`/menu/latest/${userId}/grocery-list`);
      return resp.data;
    } catch (err) {
      console.error('Grocery list fetch error:', err);
      throw err;
    }
  },

  async getGroceryListByMenuId(menuId) {
    try {
      const resp = await axiosInstance.get(`/menu/${menuId}/grocery-list`);
      return resp.data;
    } catch (err) {
      console.error("Fetch grocery list error:", err.response?.data || err.message);
      throw err;
    }
  },

  // Saved Recipie Endpoints
  saveRecipe: async (saveData) => {
    try {
      const response = await axiosInstance.post('/saved-recipes/', saveData);
      return response.data;
    } catch (err) {
      console.error('Error saving recipe:', err);
      throw err;
    }
  },

  unsaveRecipe: async (savedId) => {
    try {
      const response = await axiosInstance.delete(`/saved-recipes/${savedId}`);
      return response.data;
    } catch (err) {
      console.error('Error unsaving recipe:', err);
      throw err;
    }
  },

  getSavedRecipes: async () => {
    try {
      const response = await axiosInstance.get('/saved-recipes/');
      return response.data.saved_recipes || [];
    } catch (err) {
      console.error('Error fetching saved recipes:', err);
      return [];
    }
  },

  async checkRecipeSaved(menuId, recipeId = null, mealTime = null) {
    try {
      const params = new URLSearchParams();
      params.append('menu_id', menuId);
      if (recipeId) params.append('recipe_id', recipeId);
      if (mealTime) params.append('meal_time', mealTime);

      const resp = await axiosInstance.get(`/saved-recipes/check?${params.toString()}`);
      return resp.data;
    } catch (err) {
      console.error("Check saved recipe error:", err.response?.data || err.message);
      throw err;
    }
  },

  // Cart Management Endpoints
  async getCartContents(userId) {
    try {
      console.log('Fetching cart for user:', userId);
      const resp = await axiosInstance.get(`/cart/internal/${userId}/contents`);
      return resp.data;
    } catch (err) {
      console.error("Cart contents fetch error:", err);
      throw err;
    }
  },

  async addToInternalCart(payload) {
    try {
      console.log('Adding to cart:', payload);
      const resp = await axiosInstance.post('/cart/internal/add_items', payload);
      return resp.data;
    } catch (err) {
      console.error("Internal cart add error:", err);
      throw err;
    }
  },

  async assignStoreToItems(userId, items, store) {
    try {
      console.log('Assigning items to store:', { userId, items, store });
      const resp = await axiosInstance.patch(`/cart/internal/${userId}/assign_store`, {
        items,
        store
      });
      return resp.data;
    } catch (err) {
      console.error("Store assignment error:", err);
      throw err;
    }
  },

  // Store-Specific Search Endpoints
  async searchKrogerItems(items) {
    try {
      console.log("Searching Kroger items:", items);
      const response = await axiosInstance.post('/kroger/search', { items });
      console.log("Kroger search response:", response.data);
      
      // Ensure needs_setup is properly handled
      if (response.data.needs_setup === true) {
        return {
          success: false,
          needs_setup: true,
          message: response.data.message
        };
      }
      
      return response.data;
    } catch (err) {
      console.error("Kroger search error:", err);
      // Check if the error response contains needs_setup
      if (err.response?.data?.needs_setup) {
        return {
          success: false,
          needs_setup: true,
          message: err.response.data.message
        };
      }
      throw err;
    }
  },

  // Kroger-Specific Operations
  async addToKrogerCart(items) {
    try {
      const resp = await axiosInstance.post('/kroger/cart/add', {
        items: items.map(item => ({
          upc: item.upc,
          quantity: 1
        }))
      });
      return resp.data;
    } catch (err) {
      console.error("Kroger cart add error:", err);
      if (err.response?.data?.redirect) {
        return {
          success: false,
          redirect: err.response.data.redirect,
          message: "Kroger authentication required"
        };
      }
      throw err;
    }
  },

  // Kroger Connection Management
  async getKrogerConnectionStatus() {
    try {
      const resp = await axiosInstance.get('/kroger/connection-status');
      return resp.data;
    } catch (err) {
      console.error("Kroger connection status error:", err);
      throw err;
    }
  },

  async getKrogerLoginUrl() {
    try {
      const resp = await axiosInstance.get('/kroger/login-url');
      return resp.data;
    } catch (err) {
      console.error("Kroger login URL error:", err);
      throw err;
    }
  },

  async updateKrogerLocation(locationId) {
    try {
      const response = await axiosInstance.post('/kroger/store-location', {
        store_location_id: locationId
      });
      return response.data;
    } catch (err) {
      console.error("Kroger location update error:", err);
      throw err;
    }
  },

  // Store Location Endpoints
  async findNearbyStores(storeType, params) {
    try {
      const response = await axiosInstance.get(`/${storeType}/stores/near`, { 
        params: {
          zip_code: params.zipCode,
          radius: params.radius
        }
      });
      return response.data;
    } catch (err) {
      console.error("Store search error:", err);
      throw err;
    }
  },
  
  // Walmart-Specific Operations
  async searchWalmartItems(items) {
    try {
      console.log('Searching Walmart items:', items);
      const resp = await axiosInstance.post('/walmart/search', { items });
      console.log('Walmart search response:', resp.data);
      return resp.data;
    } catch (err) {
      console.error("Walmart search error:", err);
      throw err;
    }
  },

  async findNearbyWalmartStores(zipCode, radius = 15) {
    try {
      console.log(`Finding Walmart stores near ${zipCode}`);
      const response = await axiosInstance.get('/walmart/stores/near', {
        params: {
          zip_code: zipCode,
          radius: radius
        }
      });
      return response.data;
    } catch (err) {
      console.error("Walmart store search error:", err);
      throw err;
    }
  },

  async getWalmartProductDetails(productId) {
    try {
      console.log(`Getting Walmart product details for ${productId}`);
      const response = await axiosInstance.get(`/walmart/product/${productId}`);
      return response.data;
    } catch (err) {
      console.error("Walmart product details error:", err);
      throw err;
    }
  },

  async addToWalmartCart(items) {
    try {
      console.log('Adding items to Walmart cart:', items);
      const resp = await axiosInstance.post('/walmart/cart/add', {
        items: items.map(item => ({
          id: item.id || item.itemId,
          name: item.name,
          price: item.price || item.salePrice,
          quantity: item.quantity || 1
        }))
      });
      console.log('Walmart cart response:', resp.data);
      return resp.data;
    } catch (err) {
      console.error("Walmart cart add error:", err);
      throw err;
    }
  },

  // Organization Management
  getUserOrganizations: async () => {
    try {
      // Ensure we're using POST instead of GET based on the error
      const response = await axiosInstance.post('/organizations/user');
      return response.data;
    } catch (err) {
      console.error('Error fetching organizations:', err);
      // Return empty array instead of throwing to prevent UI errors
      return [];
    }
  }, 

  createOrganization: async (orgData) => {
    try {
      const response = await axiosInstance.post('/organizations/', orgData);
      return response.data;
    } catch (err) {
      console.error('Error creating organization:', err);
      throw err;
    }
  },  

  getOrganizationDetails: async (orgId) => {
    try {
      const response = await axiosInstance.get(`/organizations/${orgId}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching organization details:', err);
      throw err;
    }
  },  

  // Get organization clients
  getOrganizationClients: async (orgId) => {
    try {
      if (!orgId) {
        throw new Error('Organization ID is required');
      }
      const response = await axiosInstance.post(`/organizations/${orgId}/clients`);
      return response.data;
    } catch (err) {
      console.error('Error fetching organization clients:', err);
      return [];
    }
  }, 

  addClientToOrganization: async (orgId, clientId, role = 'client') => {
    try {
      const response = await axiosInstance.post(`/organizations/${orgId}/clients/${clientId}`, {
        role
      });
      return response.data;
    } catch (err) {
      console.error('Error adding client to organization:', err);
      throw err;
    }
  },  

  // Invite client
  inviteClient: async (orgId, email) => {
    try {
      if (!orgId) {
        throw new Error('Organization ID is required');
      }
      const response = await axiosInstance.post(`/organizations/${orgId}/invitations`, {
        email
      });
      return response.data;
    } catch (err) {
      console.error('Error inviting client:', err);
      throw err;
    }
  }, 

  // Client methods
  getClientDetails: async (clientId) => {
    try {
      const response = await axiosInstance.get(`/organizations/clients/${clientId}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching client details:', err);
      throw err;
    }
  },  

  getClientMenus: async (clientId) => {
    try {
      const response = await axiosInstance.get(`/menu/client/${clientId}`);
      return response.data;
    } catch (err) {
      console.error('Error fetching client menus:', err);
      throw err;
    }
  },

  acceptInvitation: async (token, orgId) => {
    try {
      const response = await axiosInstance.get(`/organizations/${orgId}/invitations/accept/${token}`);
      return response.data;
    } catch (err) {
      console.error('Error accepting invitation:', err);
      throw err;
    }
  },  

  // Menu Sharing
  shareMenuWithClient: async (menuId, clientId, permissionLevel = 'read') => {
    try {
      const response = await axiosInstance.post(`/menu/${menuId}/share`, {
        client_id: clientId,
        permission_level: permissionLevel
      });
      return response.data;
    } catch (err) {
      console.error('Error sharing menu:', err);
      throw err;
    }
  },  

// Get shared menus
getSharedMenus: async () => {
  try {
    // Add necessary parameters based on 422 error
    const response = await axiosInstance.get('/menu/shared', {
      params: {
        user_id: localStorage.getItem('user') ? 
          JSON.parse(localStorage.getItem('user')).userId : null
      }
    });
    return response.data;
  } catch (err) {
    console.error('Error fetching shared menus:', err);
    // Return empty array instead of throwing
    return [];
  }
}
}; // Close the apiService object here

export default apiService;