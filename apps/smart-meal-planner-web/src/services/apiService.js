// src/services/apiService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';

const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 600000, // Increased to 10 minutes (600,000 ms)
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  },
  withCredentials: false
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

// Updated interceptor with improved token handling and logging
axiosInstance.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  
  if (token) {
    // Make sure we always have the 'Bearer ' prefix
    const formattedToken = token.startsWith('Bearer ') 
      ? token 
      : `Bearer ${token}`;
      
    config.headers.Authorization = formattedToken;
    
    // Log token usage for debugging
    if (config.url && config.url.includes('org-invitations/accept')) {
      console.log('Setting auth header for invitation acceptance:', {
        tokenExists: !!token,
        tokenHasBearer: token.startsWith('Bearer '),
        headerAfterFormat: config.headers.Authorization.substr(0, 15) + '...' // Don't log full token
      });
    }
  } else if (config.url && config.url.includes('org-invitations/accept')) {
    console.warn('No auth token found in localStorage when accepting invitation!');
  }
  
  return config;
}, (error) => {
  console.error('Request interceptor error:', error);
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

  async healthCheck() {
    try {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'GET',
        mode: 'cors'
      });
      return await response.json();
    } catch (err) {
      console.error("Health check error:", err);
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

  resendVerificationEmail: async (email) => {
  try {
    const response = await axiosInstance.post('/auth/resend-verification', { email });
    return response.data;
  } catch (err) {
    console.error("Resend verification error:", err.response?.data || err.message);
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
      console.log(`Fetching menu details for ID: ${menuId}`);
      const resp = await axiosInstance.get(`/menu/${menuId}`);
      return resp.data;
    } catch (err) {
      console.error('Error fetching menu details:', err.response?.data || err.message);
      
      // If we get a 404 or other error, try the client endpoint as fallback
      try {
        console.log(`Trying client menu endpoint for ID: ${menuId}`);
        const clientResp = await axiosInstance.get(`/client/menus/${menuId}`);
        console.log("Client menu fetch successful:", clientResp.data);
        return clientResp.data;
      } catch (clientErr) {
        console.error('Client menu endpoint also failed:', clientErr);
        throw err; // Throw original error
      }
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
    // Store the latest menu ID before generation to help with recovery
    let latestMenuIdBeforeGeneration = null;
    
    try {
      console.log('Generating menu with request:', menuRequest);
      
      // Attempt to get latest menu ID before generation
      try {
        if (menuRequest.user_id) {
          const menuHistory = await this.getMenuHistory(menuRequest.user_id);
          if (menuHistory && menuHistory.length > 0) {
            latestMenuIdBeforeGeneration = menuHistory[0].menu_id;
            console.log(`Latest menu ID before generation: ${latestMenuIdBeforeGeneration}`);
          }
        }
      } catch (e) {
        console.warn("Could not fetch latest menu ID before generation:", e);
      }
      
      const resp = await axiosInstance.post('/menu/generate', menuRequest, {
        timeout: 900000 // 15 minutes timeout for menu generation
      });
      console.log('Menu generation successful');
      return resp.data;
    } catch (err) {
      console.error('Menu generation error:', err);
      
      // Special handling for timeouts - they could be partial successes
      if (err.code === 'ECONNABORTED' || (err.response && err.response.status === 504)) {
        console.log("Timeout detected, checking if menu was partially created...");
        
        // Check if a new menu was created despite the timeout
        try {
          if (menuRequest.user_id) {
            const menuHistory = await this.getMenuHistory(menuRequest.user_id);
            
            if (menuHistory && menuHistory.length > 0 && 
                (latestMenuIdBeforeGeneration === null || 
                 menuHistory[0].menu_id !== latestMenuIdBeforeGeneration)) {
              // We have a new menu that was created!
              console.log("Found newly created menu despite timeout:", menuHistory[0]);
              
              // Return the menu with a special flag
              return {
                ...menuHistory[0],
                _partial_success: true,
                message: "Menu was created but connection timed out during retrieval."
              };
            }
          }
        } catch (recoveryErr) {
          console.error("Error checking for partial success:", recoveryErr);
        }
        
        throw new Error('Menu generation timed out. Please try again or generate a shorter menu.');
      }
      
      throw err;
    }
  },
  
  async generateMenuForClient(clientId, menuRequest) {
    // Store the latest menu ID before generation to help with recovery
    let latestMenuIdBeforeGeneration = null;
    
    try {
      console.log(`Generating menu for client ${clientId} with request:`, menuRequest);
      
      // Attempt to get the latest menu ID before generation
      try {
        const clientMenus = await this.getClientMenus(clientId);
        if (clientMenus && clientMenus.length > 0) {
          latestMenuIdBeforeGeneration = clientMenus[0].menu_id;
          console.log(`Latest menu ID before generation: ${latestMenuIdBeforeGeneration}`);
        }
      } catch (e) {
        console.warn("Could not fetch latest menu ID before generation:", e);
      }
      
      // Generate the menu
      const resp = await axiosInstance.post(`/menu/generate-for-client/${clientId}`, menuRequest, {
        timeout: 900000 // 15 minutes timeout for menu generation
      });
      
      console.log('Client menu generation successful');
      return resp.data;
    } catch (err) {
      console.error(`Error generating menu for client ${clientId}:`, err);
      
      // Special handling for timeouts - they could be partial successes
      if (err.code === 'ECONNABORTED' || (err.response && err.response.status === 504)) {
        console.log("Timeout detected, checking if menu was partially created...");
        
        // Check if a new menu was created despite the timeout
        try {
          const clientMenus = await this.getClientMenus(clientId);
          
          if (clientMenus && clientMenus.length > 0 && 
              (latestMenuIdBeforeGeneration === null || 
               clientMenus[0].menu_id !== latestMenuIdBeforeGeneration)) {
            // We have a new menu that was created!
            console.log("Found newly created menu despite timeout:", clientMenus[0]);
            
            // Return the menu with a special flag
            return {
              ...clientMenus[0],
              _partial_success: true,
              message: "Menu was created but connection timed out during retrieval."
            };
          }
        } catch (recoveryErr) {
          console.error("Error checking for partial success:", recoveryErr);
        }
        
        throw new Error('Menu generation timed out. Please try again or generate a shorter menu.');
      }
      
      throw err;
    }
  },
  
  async generateAndShareMenu(clientId, menuRequest) {
    try {
      console.log(`Generating and sharing menu for client ${clientId} with request:`, menuRequest);
      const resp = await axiosInstance.post(`/menu/generate-and-share/${clientId}`, menuRequest, {
        timeout: 900000 // 15 minutes timeout for menu generation
      });
      console.log('Client menu generation and sharing successful');
      return resp.data;
    } catch (err) {
      console.error(`Error generating and sharing menu for client ${clientId}:`, err);
      if (err.code === 'ECONNABORTED') {
        throw new Error('Menu generation timed out. Please try again or generate a shorter menu.');
      }
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
      console.log(`Fetching grocery list for menu ${menuId}`);
      const resp = await axiosInstance.get(`/menu/${menuId}/grocery-list`);
      console.log('Grocery list response:', resp.data);
      
      // Ensure we return in the expected format with groceryList property
      if (resp.data && !resp.data.groceryList && Array.isArray(resp.data)) {
        console.log('Converting array response to groceryList format');
        return { groceryList: resp.data };
      }
      
      // Make sure we never return an empty groceryList
      if (resp.data && resp.data.groceryList && resp.data.groceryList.length === 0) {
        console.log('Empty grocery list detected, trying fallback approaches');
        
        // Try to get menu details and extract from there
        try {
          console.log(`Fetching full menu details for ${menuId}`);
          const menuDetails = await this.getMenuDetails(menuId);
          console.log('Menu details:', menuDetails);
          
          // Define a deep scan function to find ingredients anywhere in the menu structure
          const deepScanForIngredients = (obj) => {
            console.log('Deep scanning for ingredients in object type:', typeof obj);
            
            const ingredients = [];
            
            // Function to process any ingredient object or string
            const processIngredient = (ing) => {
              if (typeof ing === 'string') {
                ingredients.push({ name: ing, quantity: '' });
                console.log('Added string ingredient:', ing);
              } else if (typeof ing === 'object' && ing !== null) {
                // Look for name in common fields
                const name = ing.name || ing.ingredient || '';
                // Look for quantity in common fields
                const quantity = ing.quantity || ing.amount || '';
                
                if (name) {
                  ingredients.push({ 
                    name: quantity ? `${quantity} ${name}` : name, 
                    quantity: '' 
                  });
                  console.log('Added object ingredient:', quantity ? `${quantity} ${name}` : name);
                }
              }
            };
            
            // Recursive function to search through any object structure
            const searchObject = (node, path = '') => {
              if (!node) return;
              
              // Handle arrays
              if (Array.isArray(node)) {
                node.forEach((item, idx) => searchObject(item, `${path}[${idx}]`));
                return;
              }
              
              // Handle objects
              if (typeof node === 'object' && node !== null) {
                // Log keys for debugging
                console.log(`Checking node at ${path} with keys:`, Object.keys(node));
                
                // Check for ingredients array directly
                if ('ingredients' in node && Array.isArray(node.ingredients)) {
                  console.log(`Found ingredients array at ${path} with ${node.ingredients.length} items`);
                  node.ingredients.forEach(ing => processIngredient(ing));
                }
                
                // Look for title/quantity pairs (simple snack format)
                if ('title' in node && !('ingredients' in node)) {
                  console.log(`Found simple item at ${path} with title: ${node.title}`);
                  processIngredient({
                    name: node.title,
                    quantity: node.quantity || node.amount || ''
                  });
                }
                
                // Recursively process all properties
                Object.keys(node).forEach(key => {
                  if (typeof node[key] === 'object' && node[key] !== null) {
                    searchObject(node[key], path ? `${path}.${key}` : key);
                  }
                });
              }
            };
            
            // Start search from root object
            searchObject(obj);
            return ingredients;
          };
          
          // Try meal_plan_json first
          if (menuDetails && menuDetails.meal_plan_json) {
            console.log('Found meal_plan_json, attempting to extract ingredients');
            
            let mealPlanData = menuDetails.meal_plan_json;
            // Parse if string
            if (typeof mealPlanData === 'string') {
              try {
                mealPlanData = JSON.parse(mealPlanData);
                console.log('Successfully parsed meal_plan_json');
              } catch (e) {
                console.error('Failed to parse meal_plan_json:', e);
              }
            }
            
            // Deep scan for ingredients
            const extractedIngredients = deepScanForIngredients(mealPlanData);
            
            if (extractedIngredients.length > 0) {
              console.log(`Found ${extractedIngredients.length} ingredients in meal_plan_json`);
              return { groceryList: extractedIngredients };
            }
          }
          
          // Try meal_plan next if meal_plan_json didn't work
          if (menuDetails && menuDetails.meal_plan) {
            console.log('Found meal_plan, attempting to extract ingredients');
            
            let mealPlanData = menuDetails.meal_plan;
            // Parse if string
            if (typeof mealPlanData === 'string') {
              try {
                mealPlanData = JSON.parse(mealPlanData);
                console.log('Successfully parsed meal_plan');
              } catch (e) {
                console.error('Failed to parse meal_plan:', e);
              }
            }
            
            // Deep scan for ingredients
            const extractedIngredients = deepScanForIngredients(mealPlanData);
            
            if (extractedIngredients.length > 0) {
              console.log(`Found ${extractedIngredients.length} ingredients in meal_plan`);
              return { groceryList: extractedIngredients };
            }
          }
          
          // Last resort: scan the entire menu object
          console.log('No ingredients found in specific fields, scanning entire menu object');
          const extractedIngredients = deepScanForIngredients(menuDetails);
          
          if (extractedIngredients.length > 0) {
            console.log(`Found ${extractedIngredients.length} ingredients in full menu`);
            return { groceryList: extractedIngredients };
          }
        } catch (menuErr) {
          console.error('Failed to get menu details or extract ingredients:', menuErr);
        }
      }
      
      return resp.data;
    } catch (err) {
      console.error("Fetch grocery list error:", err.response?.data || err.message);
      
      // Try the client endpoint as fallback
      try {
        console.log(`Trying client endpoint for grocery list for menu ${menuId}`);
        const clientResp = await axiosInstance.get(`/client/menus/${menuId}/grocery-list`);
        console.log('Client grocery list response:', clientResp.data);
        
        // Check if client response has empty grocery list
        if (clientResp.data && (!clientResp.data.groceryList || 
            (clientResp.data.groceryList && clientResp.data.groceryList.length === 0))) {
          
          // Try to get the client menu and extract ingredients
          try {
            console.log(`Client grocery list is empty, fetching client menu ${menuId}`);
            const clientMenu = await this.getClientMenu(menuId);
            console.log('Client menu:', clientMenu);
            
            // Create extraction function for client menu
            const extractFromClientMenu = (obj) => {
              const ingredients = [];
              
              const scan = (node) => {
                if (!node) return;
                
                if (Array.isArray(node)) {
                  node.forEach(item => scan(item));
                  return;
                }
                
                if (typeof node === 'object' && node !== null) {
                  // Check for ingredients array
                  if (node.ingredients && Array.isArray(node.ingredients)) {
                    node.ingredients.forEach(ing => {
                      if (typeof ing === 'string') {
                        ingredients.push({ name: ing, quantity: '' });
                      } else if (typeof ing === 'object' && ing !== null) {
                        const name = ing.name || '';
                        const quantity = ing.quantity || ing.amount || '';
                        if (name) {
                          ingredients.push({ 
                            name: quantity ? `${quantity} ${name}` : name, 
                            quantity: '' 
                          });
                        }
                      }
                    });
                  }
                  
                  // Check for simple item format
                  if (node.title && !node.ingredients) {
                    const title = node.title;
                    const quantity = node.quantity || node.amount || '';
                    ingredients.push({ 
                      name: quantity ? `${quantity} ${title}` : title, 
                      quantity: '' 
                    });
                  }
                  
                  // Recursively process all properties
                  Object.keys(node).forEach(key => {
                    if (typeof node[key] === 'object' && node[key] !== null) {
                      scan(node[key]);
                    }
                  });
                }
              };
              
              scan(obj);
              return ingredients;
            };
            
            const clientIngredients = extractFromClientMenu(clientMenu);
            
            if (clientIngredients.length > 0) {
              console.log(`Extracted ${clientIngredients.length} ingredients from client menu`);
              return { groceryList: clientIngredients };
            }
          } catch (clientMenuErr) {
            console.error('Failed to extract ingredients from client menu:', clientMenuErr);
          }
        }
        
        return clientResp.data;
      } catch (clientErr) {
        console.error("Client grocery list endpoint also failed:", clientErr);
        
        // Log error but don't use hardcoded data
        console.error(`All attempts to get grocery list for menu ${menuId} failed`);
        
        throw err; // Throw the original error
      }
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
  
  async clearStoreItems(userId, store) {
    try {
      console.log(`Clearing ${store} items for user ${userId}`);
      const resp = await axiosInstance.delete(`/cart/internal/${userId}/clear_store/${store}`);
      return resp.data;
    } catch (err) {
      console.error("Clear store items error:", err);
      throw err;
    }
  },
  
  async removeCartItem(userId, itemName, store) {
    try {
      console.log(`Removing ${itemName} from ${store} for user ${userId}`);
      const resp = await axiosInstance.delete(`/cart/internal/${userId}/remove_item`, {
        data: {
          item_name: itemName,
          store
        }
      });
      return resp.data;
    } catch (err) {
      console.error("Remove cart item error:", err);
      throw err;
    }
  },
  
  async updateCartItemQuantity(userId, itemName, store, quantity) {
    try {
      console.log(`Updating quantity for ${itemName} in ${store} to ${quantity}`);
      const resp = await axiosInstance.patch(`/cart/internal/${userId}/update_quantity`, {
        item_name: itemName,
        store,
        quantity
      });
      return resp.data;
    } catch (err) {
      console.error("Update item quantity error:", err);
      throw err;
    }
  },

  // Store-Specific Search Endpoints
  async searchKrogerItems(items) {
    try {
      console.log("Searching Kroger items:", items);
      
      // Check if we have a selected Kroger store in localStorage
      const savedKrogerStoreId = localStorage.getItem('kroger_store_location_id');
      console.log("Saved Kroger store location ID:", savedKrogerStoreId);
      
      // Make the API request
      let response = await axiosInstance.post('/kroger/search', { items });
      console.log("Kroger search response:", response.data);
      
      // If the search was successful, mark the store as configured
      if (response.data && response.data.success) {
        localStorage.setItem('kroger_store_configured', 'true');
        return response.data;
      }
      
      // If we need store setup and have a saved location ID, try to update and retry
      if (response.data && response.data.needs_setup && savedKrogerStoreId) {
        console.log("Need Kroger setup but have saved location ID. Trying silent update.");
        
        try {
          // Update the store location without requiring user interaction
          await this.updateKrogerLocation(savedKrogerStoreId);
          
          // Retry the search with updated location
          console.log("Retrying Kroger search after location update");
          const retryResponse = await axiosInstance.post('/kroger/search', { items });
          
          if (retryResponse.data && retryResponse.data.success) {
            console.log("Retry successful after location update");
            localStorage.setItem('kroger_store_configured', 'true');
            return retryResponse.data;
          }
          
          // If retry still needs setup, let the UI handle it
          if (retryResponse.data && retryResponse.data.needs_setup) {
            console.log("Still need setup after retry, let UI handle it");
            return {
              success: false,
              needs_setup: true,
              tried_saved_location: true,
              message: "Please select a Kroger store in the dialog"
            };
          }
          
          // For any other response, return it directly
          return retryResponse.data;
        } catch (updateError) {
          console.error("Failed to update location silently:", updateError);
          // Fall through to returning the original response
        }
      }
      
      // If we got here, return the original response
      return response.data;
    } catch (err) {
      console.error("Kroger search error:", err);
      
      // Create an error object with helpful information for the UI
      const errorResponse = {
        success: false,
        message: err.message || "Failed to search Kroger items"
      };
      
      // Handle known error responses
      if (err.response) {
        // For needs_setup response, try saved location if available
        if (err.response.data && err.response.data.needs_setup) {
          errorResponse.needs_setup = true;
          
          // Try with saved location ID if available
          const savedLocationId = localStorage.getItem('kroger_store_location_id');
          if (savedLocationId) {
            try {
              await this.updateKrogerLocation(savedLocationId);
              errorResponse.message = "Attempting to restore saved location. Please try again.";
              errorResponse.try_again = true;
            } catch (updateErr) {
              console.error("Failed to restore location:", updateErr);
            }
          }
        }
        
        // For authentication errors, include details
        if (err.response.status === 401) {
          errorResponse.auth_error = true;
          errorResponse.message = "Authentication error. Please reconnect your Kroger account.";
        }
        
        // Include any messages from the server response
        if (err.response.data && err.response.data.message) {
          errorResponse.message = err.response.data.message;
        }
      }
      
      return errorResponse;
    }
  },

  // Kroger-Specific Operations
  async addToKrogerCart(items) {
    try {
      console.log('Adding items to Kroger cart:', items);
      
      // Prepare items for Kroger API
      const krogerItems = items.map(item => ({
        upc: item.upc,
        quantity: item.quantity || 1
      }));
      
      // Set a longer timeout for this specific request
      const response = await axiosInstance.post('/kroger/cart/add', {
        items: krogerItems
      }, {
        timeout: 60000 // 60 seconds timeout for Kroger (their API can be slow)
      });
      
      return response.data;
    } catch (err) {
      console.error("Kroger cart add error:", err);
      
      // Improved error handling with comprehensive logging
      console.log('Kroger error details:', {
        message: err.message,
        code: err.code,
        response: err.response?.data,
        status: err.response?.status
      });
      
      // Try to refresh token on auth errors
      if (err.response?.status === 401 || 
          (err.response?.data?.error && err.response?.data?.error.includes('Token')) ||
          (err.message && err.message.includes('token'))) {
        
        try {
          // Try to refresh the token
          console.log('Attempting to refresh Kroger token...');
          await this.refreshKrogerToken();
          
          // If refresh succeeds, suggest retry
          return {
            success: false,
            token_refreshed: true,
            message: "Kroger token refreshed, please try again"
          };
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          return {
            success: false,
            needs_reconnect: true,
            message: "Your Kroger session has expired. Please reconnect your account."
          };
        }
      }
      
      // Check for auth errors that need reconnection
      if (err.response?.data?.needs_reconnect) {
        console.log('Kroger auth error detected, needs reconnection');
        return {
          success: false,
          needs_reconnect: true,
          message: "Your Kroger session has expired. Please reconnect your account."
        };
      }
      
      // Check for timeout error
      if (err.code === 'ECONNABORTED') {
        return {
          success: false,
          message: "Request timed out. The operation may have still succeeded. Please check your Kroger cart."
        };
      }
      
      // Check for redirect needed
      if (err.response?.data?.redirect) {
        return {
          success: false,
          redirect: err.response.data.redirect,
          message: "Kroger authentication required"
        };
      }
      
      // Return the error in a way the component can handle
      return {
        success: false,
        message: err.response?.data?.detail || err.message || "Failed to add items to Kroger cart"
      };
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
  
  async exchangeKrogerAuthCode(code) {
    try {
      console.log('Exchanging Kroger auth code for tokens');
      const resp = await axiosInstance.post('/kroger/exchange-token', { code });
      console.log('Kroger token exchange successful');
      
      // Mark Kroger as connected in localStorage for immediate UI feedback
      localStorage.setItem('kroger_connected', 'true');
      
      return resp.data;
    } catch (err) {
      console.error("Kroger token exchange error:", err);
      throw err;
    }
  },
  
  async refreshKrogerToken() {
    try {
      console.log('Attempting to refresh Kroger token');
      const resp = await axiosInstance.post('/kroger/refresh-token');
      console.log('Kroger token refresh response:', resp.data);
      return resp.data;
    } catch (err) {
      console.error("Kroger token refresh error:", err);
      throw err;
    }
  },

  async updateKrogerLocation(locationId) {
    try {
      console.log(`Updating Kroger store location to: ${locationId}`);
      
      if (!locationId) {
        console.error("Cannot update Kroger location: locationId is empty or null");
        return {
          success: false,
          message: "Missing store location ID"
        };
      }
      
      // Simple request with just the location ID - this matches the single-user app
      const response = await axiosInstance.post('/kroger/store-location', {
        store_location_id: locationId
      });
      
      console.log('Kroger location update response:', response.data);
      
      // Cache in localStorage for fallback
      localStorage.setItem('kroger_store_location_id', locationId);
      
      return {
        success: true,
        message: "Kroger store location updated successfully"
      };
    } catch (err) {
      console.error("Kroger location update error:", err);
      
      // If the main endpoint fails, try the direct update endpoint as fallback
      try {
        console.log("Trying direct store update endpoint as fallback");
        const directResponse = await axiosInstance.post('/kroger/direct-store-update', {
          store_id: locationId
        });
        
        if (directResponse.data && directResponse.data.success) {
          // Still cache the location ID
          localStorage.setItem('kroger_store_location_id', locationId);
          
          return {
            success: true,
            message: "Kroger store location updated successfully"
          };
        }
      } catch (directErr) {
        console.error("Direct update also failed:", directErr);
      }
      
      // Create user-friendly error message for the failure case
      let errorMessage = "Failed to update Kroger store location.";
      
      if (err.response?.status === 401) {
        errorMessage = "Authorization error. Please log in again.";
      } else if (err.response?.data?.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
    }
  },

  // Store Location Endpoints
  async findNearbyStores(storeType, params) {
    try {
      console.log(`Finding ${storeType} stores near ${params.zipCode} within ${params.radius} miles`);
      
      const response = await axiosInstance.get(`/${storeType}/stores/near`, { 
        params: {
          zip_code: params.zipCode,
          radius: params.radius
        }
      });
      
      console.log('Store search response:', response.data);
      
      // Enhanced error handling and response validation
      if (!response.data) {
        return {
          success: false,
          message: "No response data received from the server"
        };
      }
      
      // Normalize the response structure
      if (response.data.success && Array.isArray(response.data.stores)) {
        // Validate that each store has a location ID
        const validatedStores = response.data.stores.map((store, index) => {
          // Ensure every store has a location_id
          if (!store.location_id && !store.locationId) {
            console.warn(`Store ${index} missing location ID:`, store);
            return {
              ...store,
              location_id: `unknown_${index}`  // Add a fallback ID
            };
          }
          return store;
        });
        
        return {
          success: true,
          stores: validatedStores
        };
      }
      
      return response.data;
    } catch (err) {
      console.error("Store search error:", err);
      
      // Create user-friendly error message
      let errorMessage = "Failed to find stores. Please try again later.";
      
      if (err.response?.status === 401) {
        errorMessage = "Authorization error. Please reconnect your Kroger account.";
      } else if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      return {
        success: false,
        message: errorMessage
      };
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
      const response = await axiosInstance.get('/organizations/');
      return response.data;
    } catch (err) {
      console.error('Error fetching organizations:', err);
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
      console.log(`Fetching organization details for ID: ${orgId}`);
      const response = await axiosInstance.get(`/organizations/${orgId}`);
      console.log('Organization API response:', response.data);
      return response.data;
    } catch (err) {
      console.error('Error fetching organization details:', err);
      // Instead of throwing, return a basic object with a default name
      return { 
        id: orgId,
        name: 'Your Nutrition Provider',
        error: true 
      };
    }
  },  

  // Get organization clients
  getOrganizationClients: async (orgId) => {
    try {
      if (!orgId) {
        throw new Error('Organization ID is required');
      }
      // Use the alternative endpoint that doesn't have path parameter issues
      const response = await axiosInstance.get(`/organization-clients/${orgId}`);
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
      // Use the alternative endpoint that doesn't have path parameter issues
      const response = await axiosInstance.post(`/org-invitations/invite`, {
        email,
        organization_id: orgId
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
      console.log(`Fetching menus for client ID: ${clientId}`);
      const response = await axiosInstance.get(`/menu/client/${clientId}`);
      console.log('Client menus response:', response.data);
      return response.data;
    } catch (err) {
      console.error('Error fetching client menus:', err);
      // Log detailed error information
      if (err.response) {
        console.error('Response error details:', {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
      } else if (err.request) {
        console.error('Request was made but no response:', err.request);
      } else {
        console.error('Error setting up request:', err.message);
      }
      // Return empty array instead of throwing to prevent UI crashes
      return [];
    }
  },

  checkInvitation: async (token, orgId) => {
    try {
      const response = await axiosInstance.get(`/org-invitations/check/${token}/${orgId}`);
      return response.data;
    } catch (err) {
      console.error('Error checking invitation validity:', err);
      return { valid: false, message: 'Error validating invitation' };
    }
  },
  
  acceptInvitation: async (token, orgId) => {
    try {
      console.log(`Accepting invitation with token: ${token} and orgId: ${orgId}`);
      console.log('Using authorization token:', localStorage.getItem('access_token') ? 'Token exists' : 'No token found');
      
      // Verify the authorization header is being set correctly
      const currentToken = localStorage.getItem('access_token');
      if (currentToken) {
        console.log('Token format check:', 
          currentToken.startsWith('Bearer ') ? 'Has Bearer prefix' : 'Missing Bearer prefix');
      }
      
      // Make the API call with explicit headers to ensure token is sent
      const response = await axiosInstance.get(`/org-invitations/accept/${token}/${orgId}`, {
        headers: {
          'Authorization': currentToken && !currentToken.startsWith('Bearer ') 
            ? `Bearer ${currentToken}` 
            : currentToken
        }
      });
      
      console.log('Invitation accepted successfully. Response:', response.data);
      
      // Update user account type in local storage for immediate use
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      userData.account_type = 'client';
      userData.organization_id = orgId;
      localStorage.setItem('user', JSON.stringify(userData));
      
      return response.data;
    } catch (err) {
      console.error('Error accepting invitation:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
        config: err.config ? {
          url: err.config.url,
          method: err.config.method,
          headers: err.config.headers
        } : 'No config available'
      });
      throw err;
    }
  },  

  // Menu Sharing
  shareMenuWithClient: async (menuId, clientId, permissionLevel = 'read') => {
    try {
      const response = await axiosInstance.post(`/menu/share/${menuId}/client/${clientId}`, {
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
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      const userId = userData.userId;
      const role = userData.role || null;
      const organizationId = userData.organizationId || userData.organization_id || null;
      
      console.log('Getting shared menus for user:', {
        userId,
        role,
        organizationId,
        accountType: userData.account_type,
        fullUserData: userData
      });
      
      if (!userId) {
        console.warn('User ID not found in local storage');
        return [];
      }
      
      // Try the client dashboard endpoint first
      try {
        console.log('Attempting to fetch client dashboard data');
        const dashboardResponse = await axiosInstance.get('/client/dashboard');
        console.log('Client dashboard response:', dashboardResponse.data);
        
        // If we get a successful response, extract the shared menus
        if (dashboardResponse.data && dashboardResponse.data.shared_menus) {
          // Process shared menus to ensure dates are valid
          const processedMenus = dashboardResponse.data.shared_menus.map(menu => {
            // Check if shared_at is valid date and format it if needed
            if (menu.shared_at) {
              try {
                const date = new Date(menu.shared_at);
                if (!isNaN(date.getTime())) {
                  menu.shared_at = date.toISOString();
                }
              } catch (e) {
                // If date parsing fails, use current time
                menu.shared_at = new Date().toISOString();
              }
            } else {
              menu.shared_at = new Date().toISOString();
            }
            return menu;
          });
          return processedMenus;
        }
      } catch (dashboardErr) {
        console.warn('Could not fetch client dashboard, falling back to shared menus endpoint:', dashboardErr);
      }
      
      // Fall back to the regular shared menus endpoint
      const response = await axiosInstance.get(`/menu/shared/${userId}`);
      console.log('Shared menus response:', response.data);
      
      // Process shared menus to ensure dates are valid
      if (Array.isArray(response.data)) {
        const processedMenus = response.data.map(menu => {
          // Check if shared_at is valid date and format it if needed
          if (menu.shared_at) {
            try {
              const date = new Date(menu.shared_at);
              if (!isNaN(date.getTime())) {
                menu.shared_at = date.toISOString();
              }
            } catch (e) {
              // If date parsing fails, use current time
              menu.shared_at = new Date().toISOString();
            }
          } else {
            menu.shared_at = new Date().toISOString();
          }
          return menu;
        });
        return processedMenus;
      }
      
      return response.data;
    } catch (err) {
      console.error('Error fetching shared menus:', err);
      // Log detailed error information
      if (err.response) {
        console.error('Response error details:', {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
      } else if (err.request) {
        console.error('Request was made but no response:', err.request);
      } else {
        console.error('Error setting up request:', err.message);
      }
      return [];
    }
  },

  // Scraped Recipes Methods
  getScrapedRecipes: async (filters = {}) => {
    try {
      console.log('Fetching scraped recipes with filters:', filters);
      
      // Build query params
      const params = new URLSearchParams();
      if (filters.limit) params.append('limit', filters.limit);
      if (filters.offset !== undefined) params.append('offset', filters.offset);
      if (filters.search) params.append('search', filters.search);
      if (filters.cuisine) params.append('cuisine', filters.cuisine);
      if (filters.complexity) params.append('complexity', filters.complexity);
      if (filters.tags) params.append('tags', filters.tags);
      
      const response = await axiosInstance.get(`/scraped-recipes/?${params.toString()}`);
      console.log('Scraped recipes response:', response.data);
      return response.data;
    } catch (err) {
      console.error('Error fetching scraped recipes:', err);
      throw err;
    }
  },

  getScrapedRecipeById: async (recipeId) => {
    try {
      console.log(`Fetching scraped recipe with ID: ${recipeId}`);
      const response = await axiosInstance.get(`/scraped-recipes/${recipeId}`);
      return response.data;
    } catch (err) {
      console.error(`Error fetching scraped recipe ${recipeId}:`, err);
      throw err;
    }
  },

  getRecipeCount: async () => {
    try {
      const response = await axiosInstance.get('/scraped-recipes/count');
      return response.data.count;
    } catch (err) {
      console.error('Error fetching recipe count:', err);
      throw err;
    }
  },

  // Custom Menu Builder Methods
  saveCustomMenu: async (menuData, clientId = null) => {
    try {
      // If clientId is provided, we're creating a menu for a client
      let endpoint = '/menu/custom';
      if (clientId) {
        endpoint = `/menu/client/${clientId}/custom`;
      }
      
      const response = await axiosInstance.post(endpoint, menuData);
      return response.data;
    } catch (err) {
      console.error('Error saving custom menu:', err);
      throw err;
    }
  },
  
  // Client Dashboard Methods
  getClientDashboard: async () => {
    try {
      const response = await axiosInstance.get('/client/dashboard');
      return response.data;
    } catch (err) {
      console.error('Error fetching client dashboard:', err);
      throw err;
    }
  },
  
  getClientMenu: async (menuId) => {
    try {
      console.log(`Fetching client menu ${menuId}`);
      const response = await axiosInstance.get(`/client/menus/${menuId}`);
      return response.data;
    } catch (err) {
      console.error(`Error fetching client menu ${menuId}:`, err);
      
      // If we get a 422 error, try the regular menu endpoint as fallback
      if (err.response && (err.response.status === 422 || err.response.status === 404)) {
        console.log(`Falling back to regular menu endpoint for menu ${menuId}`);
        try {
          const regularMenuResponse = await axiosInstance.get(`/menu/${menuId}`);
          return regularMenuResponse.data;
        } catch (fallbackErr) {
          console.error(`Fallback also failed for menu ${menuId}:`, fallbackErr);
          throw fallbackErr;
        }
      }
      
      throw err;
    }
  },
  
  getClientGroceryList: async (menuId) => {
    try {
      console.log(`Fetching client grocery list for menu ${menuId}`);
      const response = await axiosInstance.get(`/client/menus/${menuId}/grocery-list`);
      
      // Check if we got valid data
      if (response.data && response.data.groceryList) {
        console.log(`Successfully retrieved grocery list with ${response.data.groceryList.length} items`);
        return response.data;
      }
      
      console.log("Response didn't contain expected groceryList property:", response.data);
      
      // Try the regular grocery list endpoint as fallback
      try {
        console.log("Trying regular grocery list endpoint as fallback");
        const regularResponse = await axiosInstance.get(`/menu/${menuId}/grocery-list`);
        return regularResponse.data;
      } catch (fallbackErr) {
        console.error("Fallback grocery list endpoint also failed:", fallbackErr);
        // Return the original data we got even if it's not what we expected
        return response.data;
      }
    } catch (err) {
      console.error(`Error fetching client grocery list for menu ${menuId}:`, err);
      
      // Try the regular grocery list endpoint as fallback
      try {
        console.log("Client endpoint failed, trying regular grocery list endpoint");
        const regularResponse = await axiosInstance.get(`/menu/${menuId}/grocery-list`);
        return regularResponse.data;
      } catch (fallbackErr) {
        console.error("Fallback grocery list endpoint also failed:", fallbackErr);
        throw err; // Throw the original error
      }
    }
  },
  
  getClientRecipe: async (recipeId) => {
    try {
      const response = await axiosInstance.get(`/client/recipes/${recipeId}`);
      return response.data;
    } catch (err) {
      console.error(`Error fetching client recipe ${recipeId}:`, err);
      throw err;
    }
  },
  
  toggleMenuSharing: async (menuId, shared, clientId = null) => {
    try {
      const response = await axiosInstance.patch(`/client/toggle-menu-sharing/${menuId}`, {
        shared,
        client_id: clientId
      });
      return response.data;
    } catch (err) {
      console.error(`Error toggling menu sharing for menu ${menuId}:`, err);
      throw err;
    }
  },

  // New function to share a menu directly with a client
  shareMenuWithClient: async (menuId, clientId) => {
    try {
      const response = await axiosInstance.post(`/menu/share/${menuId}/client/${clientId}`);
      return response.data;
    } catch (err) {
      console.error(`Error sharing menu ${menuId} with client ${clientId}:`, err);
      throw err;
    }
  },

  // Get menus created for a specific client
  getMenusForClient: async (clientId) => {
    try {
      const response = await axiosInstance.get(`/menu/for-client/${clientId}`);
      return response.data.menus;
    } catch (err) {
      console.error(`Error getting menus for client ${clientId}:`, err);
      throw err;
    }
  },
  
  getMenuSharingDetails: async (menuId) => {
    try {
      const response = await axiosInstance.get(`/menu/${menuId}/sharing`);
      return response.data;
    } catch (err) {
      console.error(`Error getting menu sharing details for menu ${menuId}:`, err);
      throw err;
    }
  },
  
  removeMenuSharing: async (menuId, clientId) => {
    try {
      // We're using our share endpoint but with shared=false to remove sharing
      const response = await axiosInstance.post(`/menu/share/${menuId}/client/${clientId}`, {
        shared: false
      });
      return response.data;
    } catch (err) {
      console.error(`Error removing menu sharing for menu ${menuId} and client ${clientId}:`, err);
      throw err;
    }
  },
  
  toggleRecipeSharing: async (recipeId, shared) => {
    try {
      const response = await axiosInstance.patch(`/client/toggle-recipe-sharing/${recipeId}`, {
        shared
      });
      return response.data;
    } catch (err) {
      console.error(`Error toggling recipe sharing for recipe ${recipeId}:`, err);
      throw err;
    }
  },

  // AI Model Status Endpoints
  getAIModelStatus: async () => {
    try {
      const response = await axiosInstance.get('/ai/model-status');
      return response.data;
    } catch (err) {
      console.error('Error fetching AI model status:', err);
      return {
        isAvailable: false,
        message: 'Error checking AI status'
      };
    }
  },

  getTrainingStatus: async () => {
    try {
      const response = await axiosInstance.get('/ai/training-status');
      return response.data;
    } catch (err) {
      console.error('Error fetching training status:', err);
      throw err;
    }
  },

  triggerModelTraining: async (force = false) => {
    try {
      const response = await axiosInstance.post(`/ai/trigger-training?force=${force}`);
      return response.data;
    } catch (err) {
      console.error('Error triggering model training:', err);
      throw err;
    }
  },

  // Custom Menu Endpoints
  generateCustomMenu: async (menuData) => {
    try {
      const response = await axiosInstance.post('/custom-menu/generate', menuData);
      return response.data;
    } catch (err) {
      console.error('Error generating custom menu:', err);
      throw err;
    }
  },

  generateCustomMenuForClient: async (clientId, menuData) => {
    try {
      const response = await axiosInstance.post(`/custom-menu/generate-for-client/${clientId}`, menuData);
      return response.data;
    } catch (err) {
      console.error(`Error generating custom menu for client ${clientId}:`, err);
      throw err;
    }
  },

  addRecipeToCustomMenu: async (menuId, recipe) => {
    try {
      const response = await axiosInstance.post(`/custom-menu/${menuId}/add-recipe`, recipe);
      return response.data;
    } catch (err) {
      console.error(`Error adding recipe to menu ${menuId}:`, err);
      throw err;
    }
  },

  suggestCustomMeal: async () => {
    try {
      const response = await axiosInstance.get('/custom-menu/suggest-meal');
      return response.data;
    } catch (err) {
      console.error('Error suggesting custom meal:', err);
      throw err;
    }
  }
}; // Close the apiService object here

export default apiService;