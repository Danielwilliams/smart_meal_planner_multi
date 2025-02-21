// src/services/apiService.js
import axios from 'axios';


const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://api.smartmealplannerio.com';



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
    const response = await axiosInstance.patch(`/menu/${menuId}/nickname`, nickname, {
      headers: {
        'Content-Type': 'text/plain'
      }
    });
    return response.data;
  } catch (err) {
    console.error("Error updating menu nickname:", err);
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

  // Cart Management Endpoints
  async getCartContents(userId) {
    try {
      console.log('Fetching cart for user:', userId);
      const resp = await axiosInstance.get(`/cart/internal/${userId}/contents`);
      return resp.data;
    } catch (err) {
      console.error("Cart contents fetch error:", err.response?.data || err.message);
      throw err;
    }
  },

  async addToInternalCart(payload) {
    try {
      console.log('Adding to cart:', payload);
      const resp = await axiosInstance.post('/cart/internal/add_items', payload);
      return resp.data;
    } catch (err) {
      console.error("Internal cart add error:", err.response?.data || err.message);
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
      console.error("Store assignment error:", err.response?.data || err.message);
      throw err;
    }
  },

  // Store Search and Cart Operations
  async searchStoreItems(payload) {
  try {
    console.log('Searching store items:', payload);
    const resp = await axiosInstance.post('/cart/store/search', {
      items: payload.items,
      store: payload.store
    });
    
    // Enhanced error handling
    if (resp.data.status === 'error') {
      console.warn('Store search error:', resp.data);
      if (resp.data.redirect) {
        // Different handling based on error type
        if (resp.data.needs_setup) {
          // Redirect to preferences
          window.location.href = '/preferences-page';
        } else if (resp.data.needs_credentials) {
          // Prompt for Kroger credentials
          window.location.href = '/preferences-page';
        } else if (resp.data.needs_login) {
          // Redirect to Kroger login
          window.location.href = resp.data.redirect;
        }
      }
      throw new Error(resp.data.message);
    }
    
    return resp.data;
  } catch (err) {
    console.error("Store search error:", err.response?.data || err.message);
    throw err;
  }
},

async testKrogerLogin() {
  try {
    const resp = await axiosInstance.get('/kroger/test-login');
    return resp.data;
  } catch (err) {
    console.error("Kroger login test error:", err.response?.data || err.message);
    throw err;
  }
},

  async addToStoreCart(store, itemId, quantity = 1) {
    try {
      const resp = await axiosInstance.post('/store/cart/add', {
        store,
        item_id: itemId,
        quantity
      });
      return resp.data;
    } catch (err) {
      console.error("Store cart add error:", err.response?.data || err.message);
      throw err;
    }
  },

  async getKrogerConnectionStatus() {
    try {
      const resp = await axiosInstance.get('/kroger/connection-status');
      return resp.data;
    } catch (err) {
      console.error("Kroger connection status error:", err.response?.data || err.message);
      throw err;
    }
  },  

  async getKrogerLoginUrl() {
    try {
      const resp = await axiosInstance.get('/kroger/login-url');
      return resp.data;
    } catch (err) {
      console.error("Kroger login URL error:", err.response?.data || err.message);
      throw err;
    }
  },

  // Kroger Specific Endpoints
async addToKrogerCart(items) {
  try {
    const resp = await axiosInstance.post('/cart/add-kroger', {
      items: items.map(item => ({
        upc: item.upc,
        quantity: 1  // default quantity
      }))
    });
    return resp.data;
  } catch (err) {
    console.error("Kroger cart add error:", err.response?.data || err.message);
    
    // Handle connection needed scenario
    if (err.response?.data?.redirect) {
      window.location.href = err.response.data.redirect;
    }
    
    throw err;
  }
},

  async getKrogerCart(locationId) {
    try {
      const resp = await axiosInstance.get('/cart/kroger', {
        params: { location_id: locationId }
      });
      return resp.data;
    } catch (err) {
      console.error("Kroger cart fetch error:", err.response?.data || err.message);
      throw err;
    }
  },

  async clearKrogerCart(locationId) {
    try {
      const resp = await axiosInstance.delete('/cart/kroger', {
        params: { location_id: locationId }
      });
      return resp.data;
    } catch (err) {
      console.error("Kroger cart clear error:", err.response?.data || err.message);
      throw err;
    }
  },

  // Kroger Auth and Location Endpoints
  async getKrogerAuthStatus() {
    try {
      const resp = await axiosInstance.get('/kroger/connection-status');
      return resp.data;
    } catch (err) {
      console.error("Kroger auth status error:", err.response?.data || err.message);
      throw err;
    }
  },

  async updateKrogerLocation(locationId) {
    try {
      const resp = await axiosInstance.post('/kroger/store-location', {
        store_location_id: locationId
      });
      return resp.data;
    } catch (err) {
      console.error("Kroger location update error:", err.response?.data || err.message);
      throw err;
    }
  },

  // Progress Tracking
  async getUserProgress(userId) {
    try {
      const resp = await axiosInstance.get(`/users/${userId}/progress`);
      return resp.data;
    } catch (err) {
      console.error('User progress fetch error:', err);
      throw err;
    }
  },

  // Error Handler Helper
  handleError(error) {
    if (error.response) {
      return {
        message: error.response.data.detail || 'Server error occurred',
        status: error.response.status
      };
    } else if (error.request) {
      return {
        message: 'No response from server',
        status: 503
      };
    } else {
      return {
        message: error.message || 'An error occurred',
        status: 500
      };
    }
  }
};



export default apiService;
