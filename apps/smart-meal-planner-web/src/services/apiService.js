// src/services/apiService.js
import axios from 'axios';

// Ensure we're using the correct API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
console.log('🐛 REACT_APP_API_BASE_URL env var:', process.env.REACT_APP_API_BASE_URL);
console.log('🐛 Final API_BASE_URL:', API_BASE_URL);

// Store the API URL for use in other methods
let apiUrl = API_BASE_URL;

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
    
    isRefreshingKrogerToken = false;
    onKrogerTokenRefreshed();
    return true;
  } catch (error) {
    console.error('Kroger token refresh failed:', error);
    isRefreshingKrogerToken = false;
    krogerRefreshSubscribers = []; // Clear subscribers on error
    return false;
  }
}

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
  
  async generateAiShoppingList(menuId, additionalPreferences = null, useCache = true) {
    try {
      console.log(`Generating AI shopping list for menu ${menuId}`);
      const payload = {
        menu_id: menuId,
        use_ai: true,
        use_cache: useCache
      };

      if (additionalPreferences) {
        payload.additional_preferences = additionalPreferences;
      }

      console.log("AI shopping list request payload:", payload);

      // Use a longer timeout for AI processing
      const resp = await axiosInstance.post(`/menu/${menuId}/ai-shopping-list`, payload, {
        timeout: 60000 // 60 second timeout for AI processing
      });

      console.log('AI shopping list raw response:', resp);
      console.log('AI shopping list response data:', resp.data);

      // Save the response data for potential fallback during polling
      this.lastShoppingListResponse = resp.data;

      // Check if response was from cache
      if (resp.data && resp.data.cached) {
        console.log("Retrieved cached response from server:", resp.data.cache_timestamp);
      }

      // Check if response requires polling for completion
      if (resp.data && resp.data.status === "processing") {
        console.log("AI processing in progress - starting to poll for results");

        try {
          // Poll for the final results
          const pollResult = await this.pollForShoppingListResults(menuId);
          if (pollResult) {
            console.log("Final response received");
            return pollResult;
          }
        } catch (pollError) {
          console.error("Polling error:", pollError);
          console.log("Using initial response instead due to polling failure");
          // Continue with the initial response
        }
      }

      // Validate and ensure proper response structure
      let responseData = resp.data;

      // If we got a string instead of an object (happens with some JSON parsing issues)
      if (typeof responseData === 'string') {
        try {
          console.log("Response is a string, attempting to parse as JSON");
          responseData = JSON.parse(responseData);
        } catch (parseErr) {
          console.error("Failed to parse response string as JSON:", parseErr);
          // Return a basic valid structure
          return {
            groceryList: [],
            recommendations: ["Error processing AI response"],
            nutritionTips: ["Try again or use standard list"],
            error: "Response parsing error"
          };
        }
      }

      // Ensure we have a valid groceryList property
      if (!responseData.groceryList) {
        console.warn("Response missing groceryList property");
        responseData.groceryList = [];
      }

      // Ensure we have valid recommendations
      if (!responseData.recommendations || !Array.isArray(responseData.recommendations)) {
        console.warn("Response missing valid recommendations array");
        responseData.recommendations = ["Shop by category to save time"];
      }

      // Ensure we have valid nutritionTips
      if (!responseData.nutritionTips || !Array.isArray(responseData.nutritionTips)) {
        console.warn("Response missing valid nutritionTips array");
        responseData.nutritionTips = ["Focus on whole foods for better nutrition"];
      }

      // Process all grocery list items to ensure they have quantity and display_name
      if (responseData.groceryList && Array.isArray(responseData.groceryList)) {
        responseData.groceryList.forEach(category => {
          if (category.items && Array.isArray(category.items)) {
            category.items = category.items.map(item => {
              // Handle string items
              if (typeof item === 'string') {
                return {
                  name: item,
                  quantity: "1",
                  unit: "",
                  display_name: `${item}: 1`
                };
              }
              // Handle object items with missing fields
              else if (typeof item === 'object') {
                const name = item.name || "Unknown item";
                const quantity = item.quantity || "1";
                const unit = item.unit || "";
                const display_name = `${name}: ${quantity}${unit ? ' ' + unit : ''}`.trim();

                return {
                  ...item,
                  name,
                  quantity,
                  unit,
                  display_name
                };
              }
              return item;
            });
          }
        });
      }

      return responseData;
    } catch (err) {
      console.error('AI shopping list generation error:', err);

      // Return a fallback response object instead of throwing
      console.log("Returning fallback AI shopping list due to error");
      return {
        groceryList: [],
        recommendations: ["Error generating AI shopping list"],
        nutritionTips: ["Using standard list instead"],
        error: err.message || "Network or server error"
      };
    }
  },

  async getAiShoppingListStatus(menuId, preferences = null) {
    try {
      console.log(`Checking AI shopping list status for menu ${menuId}`);
      const url = `/menu/${menuId}/ai-shopping-list/status`;

      // Add preferences as query parameter if provided
      const params = preferences ? `?preferences=${encodeURIComponent(preferences)}` : '';

      const resp = await axiosInstance.get(`${url}${params}`);
      console.log('AI shopping list status response:', resp.data);

      // Store the initial response for potential fallback during polling
      this.lastShoppingListResponse = resp.data;

      // Ensure consistent structure even for error responses
      const responseData = resp.data;

      // Add default fields if missing
      if (!responseData.groceryList) {
        responseData.groceryList = [];
      }

      if (!responseData.recommendations || !Array.isArray(responseData.recommendations)) {
        responseData.recommendations = [];
      }

      if (!responseData.nutritionTips || !Array.isArray(responseData.nutritionTips)) {
        responseData.nutritionTips = [];
      }

      if (!responseData.pantryStaples || !Array.isArray(responseData.pantryStaples)) {
        responseData.pantryStaples = ["Salt", "Pepper", "Olive Oil"];
      }

      if (!responseData.healthySwaps || !Array.isArray(responseData.healthySwaps)) {
        responseData.healthySwaps = [];
      }

      if (!responseData.bulkItems || !Array.isArray(responseData.bulkItems)) {
        responseData.bulkItems = [];
      }

      return responseData;
    } catch (err) {
      console.error('AI shopping list status check error:', err);

      // Return a valid error response
      return {
        status: "error",
        message: err.message || "Error checking AI shopping list status",
        groceryList: [],
        recommendations: ["Error checking status"],
        nutritionTips: ["Please try again"],
        pantryStaples: ["Salt", "Pepper", "Olive Oil"],
        healthySwaps: [],
        bulkItems: []
      };
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

  // Enhanced grocery list fetch with fallbacks
  async getEnhancedGroceryList(menuId) {
    console.log(`Fetching enhanced grocery list for menu ID: ${menuId}`);

    // Try multiple endpoints in sequence to get the most reliable data
    try {
      // CLEAR ANY EXISTING CACHE for this menu ID
      try {
        const cacheString = localStorage.getItem('AI_SHOPPING_CACHE_KEY');
        if (cacheString) {
          const cacheData = JSON.parse(cacheString);
          if (cacheData && cacheData[menuId]) {
            console.log("Clearing cached shopping list for menu", menuId);
            delete cacheData[menuId];
            localStorage.setItem('AI_SHOPPING_CACHE_KEY', JSON.stringify(cacheData));
          }
        }
      } catch (cacheError) {
        console.warn("Error clearing cache:", cacheError);
      }

      // First try the direct grocery list endpoint
      console.log(`Attempt 1: Direct grocery list endpoint for menu ${menuId}`);
      try {
        const resp = await axiosInstance.get(`/menu/${menuId}/grocery-list`);
        console.log("Direct grocery list fetch succeeded:", resp.data);

        if (resp.data && (
            (Array.isArray(resp.data) && resp.data.length > 0) ||
            (resp.data.ingredient_list && Array.isArray(resp.data.ingredient_list) && resp.data.ingredient_list.length > 0) ||
            (resp.data.items && Array.isArray(resp.data.items) && resp.data.items.length > 0)
        )) {
          return resp.data;
        }
        console.log("Direct endpoint returned empty or invalid data, trying next endpoint");
      } catch (err) {
        console.error("Direct grocery list endpoint failed:", err);
      }

      // Then try the AI shopping list endpoint
      console.log(`Attempt 2: AI shopping list endpoint for menu ${menuId}`);
      try {
        const resp = await this.generateAiShoppingList(menuId, null, true);
        console.log("AI shopping list fetch result:", resp);

        if (resp && resp.groceryList && Array.isArray(resp.groceryList) && resp.groceryList.length > 0) {
          return {
            groceryList: resp.groceryList,
            nutritionTips: resp.nutritionTips,
            recommendations: resp.recommendations
          };
        }
        console.log("AI endpoint returned empty or invalid data, trying next endpoint");
      } catch (err) {
        console.error("AI shopping list endpoint failed:", err);
      }

      // Next try the menu details endpoint and extract ingredients
      console.log(`Attempt 3: Extract from menu details for ${menuId}`);
      try {
        const menuDetails = await this.getMenuDetails(menuId);
        console.log("Menu details fetch succeeded, extracting grocery list");

        // Extract ingredients from meal_plan_json or meal_plan
        let ingredients = [];
        let mealPlanData = null;

        if (menuDetails.meal_plan_json) {
          try {
            mealPlanData = typeof menuDetails.meal_plan_json === 'string'
              ? JSON.parse(menuDetails.meal_plan_json)
              : menuDetails.meal_plan_json;
          } catch (e) {
            console.error("Failed to parse meal_plan_json:", e);
          }
        } else if (menuDetails.meal_plan) {
          try {
            mealPlanData = typeof menuDetails.meal_plan === 'string'
              ? JSON.parse(menuDetails.meal_plan)
              : menuDetails.meal_plan;
          } catch (e) {
            console.error("Failed to parse meal_plan:", e);
          }
        }

        if (mealPlanData && mealPlanData.days && Array.isArray(mealPlanData.days)) {
          // Extract ingredients from days/meals/snacks
          mealPlanData.days.forEach(day => {
            // Extract from meals
            if (day.meals && Array.isArray(day.meals)) {
              day.meals.forEach(meal => {
                if (meal.ingredients && Array.isArray(meal.ingredients)) {
                  ingredients = ingredients.concat(meal.ingredients);
                }
              });
            }

            // Extract from snacks
            if (day.snacks && Array.isArray(day.snacks)) {
              day.snacks.forEach(snack => {
                if (snack.ingredients && Array.isArray(snack.ingredients)) {
                  ingredients = ingredients.concat(snack.ingredients);
                } else if (snack.title) {
                  // Simple snack without ingredients array
                  ingredients.push(snack.title);
                }
              });
            }
          });
        }

        if (ingredients.length > 0) {
          // Convert to standardized format if needed
          const processedIngredients = ingredients.map(ing => {
            if (typeof ing === 'string') return ing;
            return ing.name || ing.ingredient || JSON.stringify(ing);
          });

          return { ingredient_list: processedIngredients };
        }
        console.log("Failed to extract ingredients from menu details");
      } catch (err) {
        console.error("Menu details extraction failed:", err);
      }

      // Last resort: Return an empty list
      console.log("All grocery list fetch attempts failed, returning empty list");
      return { ingredient_list: [] };

    } catch (err) {
      console.error("All grocery list fetch attempts failed with error:", err);
      return {
        ingredient_list: [],
        error: "Failed to fetch grocery list: " + (err.message || "Unknown error")
      };
    }
  },

  async generateMenu(menuRequest, onProgress = null) {
    // Store the latest menu ID before generation to help with recovery
    let latestMenuIdBeforeGeneration = null;

    try {
      console.log('Generating menu with request:', menuRequest);

      // Notify start
      if (onProgress) {
        onProgress({
          phase: 'initializing',
          message: 'Preparing meal plan generation...',
          progress: 5
        });
      }

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

      // Notify AI processing start
      if (onProgress) {
        onProgress({
          phase: 'generating',
          message: 'AI is creating your personalized meal plan...',
          progress: 15
        });
      }

      const resp = await axiosInstance.post('/menu/generate', menuRequest, {
        timeout: 900000, // 15 minutes timeout for menu generation
        onUploadProgress: (progressEvent) => {
          if (onProgress && progressEvent.total) {
            const uploadProgress = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            onProgress({
              phase: 'uploading',
              message: 'Sending your preferences to AI...',
              progress: Math.min(25, 15 + (uploadProgress * 0.1))
            });
          }
        }
      });

      // Notify completion
      if (onProgress) {
        onProgress({
          phase: 'complete',
          message: 'Meal plan generated successfully!',
          progress: 100
        });
      }

      console.log('Menu generation successful');
      return resp.data;
    } catch (err) {
      console.error('Menu generation error:', err);

      // Notify error
      if (onProgress) {
        onProgress({
          phase: 'error',
          message: 'Checking for partial results...',
          progress: 90,
          error: err.message
        });
      }

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

  async generateMenuWithBackgroundJob(menuRequest, onProgress = null) {
    try {
      console.log('Starting background menu generation with request:', menuRequest);

      // Notify start
      if (onProgress) {
        onProgress({
          phase: 'initializing',
          message: 'Starting meal plan generation...',
          progress: 0
        });
      }

      // Start the background job (quick response)
      const startResp = await axiosInstance.post('/menu/generate-async', menuRequest, {
        timeout: 30000 // Only 30 seconds needed to start job
      });

      const jobId = startResp.data.job_id;
      console.log(`Background job started with ID: ${jobId}`);

      if (onProgress) {
        onProgress({
          phase: 'generating',
          message: 'Job started! Checking progress...',
          progress: 5
        });
      }

      // Poll for status updates
      return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const maxDuration = 1200000; // 20 minutes max

        const pollInterval = setInterval(async () => {
          try {
            // Check if we've exceeded max time
            if (Date.now() - startTime > maxDuration) {
              clearInterval(pollInterval);
              reject(new Error('Job exceeded maximum time limit'));
              return;
            }

            // Get job status (fast request)
            const statusResp = await axiosInstance.get(`/menu/job-status/${jobId}`, {
              timeout: 10000 // 10 seconds max for status check
            });

            const status = statusResp.data;
            console.log(`Job ${jobId} status:`, status.status, `(${status.progress}%)`);

            // Update progress
            if (onProgress) {
              onProgress({
                phase: status.status,
                message: status.message,
                progress: status.progress
              });
            }

            // Check if completed
            if (status.status === 'completed') {
              clearInterval(pollInterval);

              if (onProgress) {
                onProgress({
                  phase: 'complete',
                  message: 'Menu generated successfully!',
                  progress: 100
                });
              }

              console.log('Background job completed successfully');
              resolve(status.result);

            } else if (status.status === 'failed') {
              clearInterval(pollInterval);

              if (onProgress) {
                onProgress({
                  phase: 'error',
                  message: 'Generation failed. Checking for recovery...',
                  progress: 0,
                  error: status.error
                });
              }

              // Try recovery before failing completely
              try {
                console.log("Attempting recovery after job failure...");
                await new Promise(resolve => setTimeout(resolve, 3000));

                const recoveredMenu = await this.getLatestMenu(menuRequest.user_id);
                const menuTime = new Date(recoveredMenu.created_at);
                const timeDiff = Date.now() - menuTime;

                if (timeDiff < 1200000) { // Within last 20 minutes
                  console.log("Recovery successful - found recent menu");
                  if (onProgress) {
                    onProgress({
                      phase: 'complete',
                      message: 'Menu recovered successfully!',
                      progress: 100
                    });
                  }
                  resolve(recoveredMenu);
                  return;
                }
              } catch (recoveryErr) {
                console.error("Recovery failed:", recoveryErr);
              }

              reject(new Error(status.error || 'Menu generation failed'));
            }

          } catch (pollError) {
            // Network error during polling - continue trying
            console.warn(`Status check failed for job ${jobId}, retrying...`, pollError);

            // If too many consecutive failures, try recovery
            if (pollError.code === 'ECONNABORTED' || pollError.response?.status >= 500) {
              console.log("Network issues detected, attempting recovery check...");

              try {
                const recoveredMenu = await this.getLatestMenu(menuRequest.user_id);
                const menuTime = new Date(recoveredMenu.created_at);
                const timeDiff = Date.now() - menuTime;

                if (timeDiff < 600000) { // Within last 10 minutes
                  clearInterval(pollInterval);
                  console.log("Recovery successful during polling error");

                  if (onProgress) {
                    onProgress({
                      phase: 'complete',
                      message: 'Menu generated successfully (recovered)!',
                      progress: 100
                    });
                  }

                  resolve(recoveredMenu);
                  return;
                }
              } catch (recoveryErr) {
                console.warn("Recovery check during polling failed:", recoveryErr);
              }
            }
          }
        }, 3000); // Poll every 3 seconds

        // Safety timeout
        setTimeout(() => {
          clearInterval(pollInterval);
          reject(new Error('Job polling timeout'));
        }, maxDuration);
      });

    } catch (err) {
      console.error('Background menu generation error:', err);

      if (onProgress) {
        onProgress({
          phase: 'error',
          message: 'Failed to start background job',
          progress: 0,
          error: err.message
        });
      }

      throw err;
    }
  },

  async checkForActiveJobs(userId) {
    try {
      const resp = await axiosInstance.get(`/menu/active-jobs/${userId}`, {
        timeout: 10000 // 10 seconds max
      });

      return resp.data;
    } catch (err) {
      console.error('Error checking for active jobs:', err);
      return { has_active_jobs: false, active_jobs: [] };
    }
  },

  async checkForPendingMenuJobs(userId) {
    try {
      // Check for active jobs first
      const activeJobsResult = await this.checkForActiveJobs(userId);
      if (activeJobsResult.has_active_jobs) {
        return {
          hasActiveJob: true,
          activeJobs: activeJobsResult.active_jobs,
          hasRecentMenu: false
        };
      }

      // If no active jobs, check for recent completed menu
      const latestMenu = await this.getLatestMenu(userId);
      const menuTime = new Date(latestMenu.created_at);
      const timeDiff = Date.now() - menuTime;

      // If there's a menu created in the last 5 minutes, it might be from a recent background job
      if (timeDiff < 300000) {
        return {
          hasActiveJob: false,
          hasRecentMenu: true,
          menu: latestMenu,
          timeAgo: Math.round(timeDiff / 60000) // minutes ago
        };
      }

      return { hasActiveJob: false, hasRecentMenu: false };
    } catch (err) {
      console.error('Error checking for pending jobs:', err);
      return { hasActiveJob: false, hasRecentMenu: false };
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

  async getGroceryListByMenuId(menuId, useAi = false) {
    try {
      console.log(`Fetching grocery list for menu ${menuId}, useAi=${useAi}`);
      const resp = await axiosInstance.get(`/menu/${menuId}/grocery-list?use_ai=${useAi}`);
      console.log('Grocery list response:', resp.data);
      
      // If we got an AI-enhanced response, return it as is
      if (resp.data && (resp.data.groceryList || resp.data.recommendations)) {
        return resp.data;
      }
      
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

  // Saved Recipe Endpoints
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
  
  getClientSavedRecipes: async (clientId) => {
    try {
      console.log(`Fetching saved recipes for client ${clientId}`);
      const response = await axiosInstance.get(`/saved-recipes/client/${clientId}`);
      return response.data.saved_recipes || [];
    } catch (err) {
      console.error(`Error fetching saved recipes for client ${clientId}:`, err);
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
      return {
        status: 'error',
        message: 'Failed to load cart contents',
        cart: {
          walmart: [],
          kroger: [],
          unassigned: []
        }
      };
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
      
      // Check client-side connection state
      const isConnected = localStorage.getItem('kroger_connected') === 'true';
      
      // Check store selection status
      const storeLocation = localStorage.getItem('kroger_store_location') || 
                           localStorage.getItem('kroger_store_location_id');
      const storeSelected = localStorage.getItem('kroger_store_selected') === 'true' || 
                           localStorage.getItem('kroger_store_configured') === 'true' || 
                           sessionStorage.getItem('kroger_store_selection_complete') === 'true' ||
                           localStorage.getItem('kroger_store_selection_done') === 'true';
      
      // Check if we have a database schema issue
      const hasSchemaIssue = localStorage.getItem('database_schema_issue') === 'true';
      
      console.log("Client-side state:", {
        isConnected,
        storeLocation,
        storeSelected,
        hasSchemaIssue
      });
      
      // If not connected, return need to connect error
      if (!isConnected) {
        console.log("Not connected according to client-side state");
        return {
          success: false,
          needs_reconnect: true,
          message: "Please connect your Kroger account to continue.",
          client_side_error: true
        };
      }
      
      // If connected but no store selected, return need store selection error
      if (!storeLocation || !storeSelected) {
        console.log("Connected but no store selected according to client-side state");
        return {
          success: false,
          needs_setup: true,
          message: "Please select a Kroger store to continue.",
          client_side_error: true
        };
      }
      
      // Clean up search terms - strip quantities and measurements
      const cleanedItems = items.map(item => {
        // Remove common quantity patterns like "4 cups of", "2 tablespoons", etc.
        return item.replace(/^\d+(\.\d+)?\s*(cup|cups|tablespoon|tablespoons|tbsp|tsp|teaspoon|teaspoons|oz|ounce|ounces|lb|pound|pounds|g|gram|grams|ml|liter|liters)\s*(of)?\s*/i, '')
                   .replace(/^(a |an |one |few |some |handful of |bunch of )/i, '')
                   .trim();
      });
      
      console.log("Original search terms:", items);
      console.log("Cleaned search terms:", cleanedItems);
      
      // If we're not aware of a database schema issue, try regular backend first
      if (!hasSchemaIssue) {
        // Try direct POST to backend first
        console.log("Trying direct POST to backend search endpoint");
        try {
          const response = await axiosInstance.post('/kroger/search', { 
            items: cleanedItems 
          });
          
          console.log("Backend search response:", response.data);
          
          if (response.data && response.data.success && response.data.results) {
            return response.data;
          }
          
          if (response.data && response.data.needs_setup) {
            return {
              success: false,
              needs_setup: true,
              message: "Please select a Kroger store to continue."
            };
          }
          
          if (response.data && response.data.needs_reconnect) {
            return {
              success: false,
              needs_reconnect: true,
              message: "Your Kroger session has expired. Please reconnect your account."
            };
          }
          
          // If we get here, we got a response but it wasn't what we expected
          console.log("Unexpected response from backend search:", response.data);
        } catch (postError) {
          console.error("POST to backend search failed:", postError);
          
          // Check if this error indicates a database schema issue
          if (postError.response?.data?.error?.includes('client_id') || 
              postError.response?.data?.error?.includes('column')) {
            console.log("Database schema issue detected, setting flag");
            localStorage.setItem('database_schema_issue', 'true');
          } else {
            // Try GET method next (some backends might use GET for search)
            try {
              const itemsString = cleanedItems.join(',');
              const getResponse = await axiosInstance.get(`/kroger/search?items=${encodeURIComponent(itemsString)}`);
              
              console.log("Backend GET search response:", getResponse.data);
              
              if (getResponse.data && getResponse.data.success && getResponse.data.results) {
                return getResponse.data;
              }
            } catch (getError) {
              console.error("GET to backend search also failed:", getError);
              
              // Check if this error indicates a database schema issue
              if (getError.response?.data?.error?.includes('client_id') || 
                  getError.response?.data?.error?.includes('column')) {
                console.log("Database schema issue detected, setting flag");
                localStorage.setItem('database_schema_issue', 'true');
              }
            }
          }
        }
      } else {
        console.log("Skipping backend search due to known database schema issue");
      }
      
      // If we get here, either the backend search failed or we have a database schema issue
      // Try multiple fallback search endpoints
      console.log("Using fallback Kroger search endpoints");
      
      const allResults = [];
      
      // Loop through each cleaned item and search one by one
      for (const term of cleanedItems) {
        try {
          console.log(`Searching Kroger for: ${term}`);
          
          // Make sure we have a valid store location ID
          if (!storeLocation) {
            throw new Error("No store location ID found");
          }
          
          // Try direct-search endpoint first (we just added this to the backend)
          try {
            console.log(`Trying direct-search endpoint for "${term}"`);
            const searchResponse = await axiosInstance.get(`/kroger/direct-search?term=${encodeURIComponent(term)}&locationId=${encodeURIComponent(storeLocation)}`);
            
            // Handle success case
            if (searchResponse.data && searchResponse.data.success && searchResponse.data.results) {
              console.log(`direct-search success for "${term}"`, searchResponse.data.results.length, "results");
              
              // These results should already be in the correct format from our kroger_search_item function
              allResults.push(...searchResponse.data.results);
              continue; // Skip to next term if this worked
            } 
            // Handle case where we get a response but no results (might happen with token errors)
            else if (searchResponse.data && !searchResponse.data.success) {
              console.log(`direct-search returned error: "${searchResponse.data.message}"`);
              
              // Check if this indicates an authentication error
              if (searchResponse.data.message && 
                  (searchResponse.data.message.includes("token") || 
                   searchResponse.data.message.includes("auth"))) {
                // Don't continue trying - return auth error
                return {
                  success: false,
                  needs_reconnect: true,
                  message: "Authentication error with Kroger. Please try reconnecting."
                };
              }
            }
          } catch (directSearchError) {
            console.error(`direct-search endpoint failed for "${term}":`, directSearchError.message);
          }
          
          // Try search-products endpoint as fallback
          try {
            console.log(`Trying search-products endpoint for "${term}"`);
            const searchProductsResponse = await axiosInstance.get(`/kroger/search-products?query=${encodeURIComponent(term)}&location_id=${encodeURIComponent(storeLocation)}`);
            
            if (searchProductsResponse.data && Array.isArray(searchProductsResponse.data)) {
              console.log(`search-products success for "${term}"`, searchProductsResponse.data.length, "results");
              
              // Format the results
              const results = searchProductsResponse.data.map(item => ({
                upc: item.upc || '',
                description: item.name || '',
                brand: item.brand || '',
                size: item.size || '',
                price: item.price || 0,
                inStock: true,
                image: '',
                quantity: 1
              }));
              
              allResults.push(...results);
              continue; // Skip to next term if this worked
            }
          } catch (searchProductsError) {
            console.log(`search-products endpoint failed for "${term}":`, searchProductsError.message);
          }
          
          // If we get here, both approaches failed
          console.log(`All search attempts failed for "${term}"`);
          
          // Add a placeholder result so the user knows we tried
          allResults.push({
            upc: `placeholder-${Date.now()}`,
            description: `${term} (No exact matches found)`,
            brand: '',
            size: '',
            price: 0,
            inStock: false,
            image: '',
            quantity: 1,
            placeholder: true
          });
        } catch (searchError) {
          console.error(`All search methods failed for "${term}":`, searchError);
          
          // Check if this error indicates auth issues
          if (searchError.response?.status === 401 || 
              searchError.response?.data?.error?.includes('token')) {
            return {
              success: false,
              needs_reconnect: true,
              message: "Your Kroger session has expired. Please reconnect your account."
            };
          }
        }
      }
      
      if (allResults.length > 0) {
        console.log(`Found ${allResults.length} results through direct API`);
        
        return {
          success: true,
          results: allResults
        };
      }
      
      // If we still have no results, return an empty array
      return {
        success: true,
        results: [],
        message: "No matching products found"
      };
    } catch (err) {
      console.error("Kroger search error:", err);
      
      // Handle specific errors
      if (err.response?.status === 401 || 
          err.response?.data?.error?.includes('token')) {
        return {
          success: false,
          needs_reconnect: true,
          message: "Your Kroger session has expired. Please reconnect your account."
        };
      }
      
      // Check for database schema issues
      if (err.response?.data?.error?.includes('client_id') || 
          err.response?.data?.error?.includes('column')) {
        console.log("Database schema issue detected, setting flag");
        localStorage.setItem('database_schema_issue', 'true');
        
        // Return a more helpful error message
        return {
          success: false,
          message: "Database schema issue detected. Please try direct search again."
        };
      }
      
      // Generic error case
      return {
        success: false,
        message: err.message || "Error searching Kroger items"
      };
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
          await refreshKrogerToken();
          
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

  async updateKrogerLocation(locationId) {
    try {
      if (!locationId) {
        console.error('No location ID provided');
        return {
          success: false,
          message: 'No location ID provided'
        };
      }
      
      console.log('Updating Kroger store location to:', locationId);
      
      // FIRST SET OF ACTIONS: Immediately set ALL client-side flags
      // This ensures immediate feedback to the user and persistence 
      // even if backend operations fail
      console.log('Setting ALL client-side flags for maximum consistency');
      localStorage.setItem('kroger_store_location', locationId);
      localStorage.setItem('kroger_store_location_id', locationId);
      localStorage.setItem('kroger_store_selected', 'true');
      localStorage.setItem('kroger_store_configured', 'true');
      localStorage.setItem('kroger_store_timestamp', Date.now().toString());
      localStorage.setItem('kroger_store_selection_done', 'true');
      localStorage.setItem('kroger_store_selection_timestamp', Date.now().toString());
      sessionStorage.setItem('kroger_store_selection_complete', 'true');
      sessionStorage.removeItem('kroger_needs_store_selection');
      
      // Log all the flags we've set for debugging
      console.log('Store selection flags set:', {
        'kroger_store_location': localStorage.getItem('kroger_store_location'),
        'kroger_store_location_id': localStorage.getItem('kroger_store_location_id'),
        'kroger_store_selected': localStorage.getItem('kroger_store_selected'),
        'kroger_store_configured': localStorage.getItem('kroger_store_configured'),
        'kroger_store_selection_done': localStorage.getItem('kroger_store_selection_done'),
        'kroger_store_selection_complete (session)': sessionStorage.getItem('kroger_store_selection_complete'),
        'kroger_needs_store_selection (session)': sessionStorage.getItem('kroger_needs_store_selection')
      });
      
      // SECOND SET OF ACTIONS: Try to update the backend
      // Check if we have a database schema issue 
      const hasSchemaIssue = localStorage.getItem('database_schema_issue') === 'true';
      
      if (hasSchemaIssue) {
        console.log('Database schema issue detected, skipping backend update');
        return {
          success: true,
          client_side_fallback: true,
          message: 'Store location saved locally due to database schema issue'
        };
      }
      
      // Try backend update with multiple approaches for robustness
      console.log('Attempting to update backend with store location');
      
      // Array of all approaches to try
      const updateApproaches = [
        // Approach 1: POST to store-location endpoint (standard)
        async () => {
          console.log('Approach 1: POST to /kroger/store-location');
          const response = await axiosInstance.post('/kroger/store-location', {
            location_id: locationId
          });
          console.log('Approach 1 response:', response.data);
          return response.data;
        },
        
        // Approach 2: GET to store-location endpoint (alternative)
        async () => {
          console.log('Approach 2: GET to /kroger/store-location');
          const response = await axiosInstance.get(`/kroger/store-location?location_id=${locationId}`);
          console.log('Approach 2 response:', response.data);
          return response.data;
        },
        
        // Approach 3: POST with different content type
        async () => {
          console.log('Approach 3: POST with form data');
          const formData = new FormData();
          formData.append('location_id', locationId);
          
          const response = await axiosInstance.post('/kroger/store-location', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          console.log('Approach 3 response:', response.data);
          return response.data;
        },
        
        // Approach 4: Direct fetch API as last resort
        async () => {
          console.log('Approach 4: Direct fetch API');
          const response = await fetch(`${API_BASE_URL}/kroger/store-location`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            },
            body: JSON.stringify({ location_id: locationId })
          });
          
          const data = await response.json();
          console.log('Approach 4 response:', data);
          return data;
        }
      ];
      
      // Try each approach in sequence until one succeeds
      for (let i = 0; i < updateApproaches.length; i++) {
        try {
          const result = await updateApproaches[i]();
          
          // If we got a successful result, return it
          if (result && result.success) {
            console.log(`Backend update succeeded with approach ${i+1}`);
            return result;
          }
        } catch (error) {
          console.error(`Approach ${i+1} failed:`, error);
          
          // Check for database schema issue
          if (error.response?.data?.error?.includes('client_id') || 
              error.response?.data?.error?.includes('column')) {
            console.log("Database schema issue detected, setting flag and skipping remaining approaches");
            localStorage.setItem('database_schema_issue', 'true');
            break;
          }
        }
      }
      
      // If we get here, all approaches failed, but client-side state is already set
      console.log('All backend update approaches failed, but client-side state is set');
      
      return {
        success: true,
        client_side_fallback: true,
        message: 'Store location saved locally despite backend errors'
      };
    } catch (err) {
      console.error("Kroger location update error:", err);
      
      // Client-side flags are already set at the beginning, so just return success
      return {
        success: true,
        client_side_fallback: true,
        message: 'Store location saved locally despite unexpected errors'
      };
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
  
  exchangeKrogerAuthCode: async (code) => {
    try {
      console.log('================================================');
      console.log(`🔄 EXCHANGING KROGER AUTH CODE: ${code.substring(0, 10)}...`);
      console.log('CODE LENGTH:', code.length);
      console.log('================================================');
      
      // First, check current connection status
      try {
        console.log('Checking connection status before code exchange...');
        const statusBefore = await axiosInstance.get('/kroger/connection-status');
        console.log('Connection status before exchange:', statusBefore.data);
      } catch (statusErr) {
        console.error('Error checking status before exchange:', statusErr);
      }
      
      // Try multiple approaches to ensure success
      
      // APPROACH 1: Try the recommended form-urlencoded approach
      try {
        console.log('APPROACH 1: Using application/x-www-form-urlencoded with POST');
        
        // Use URLSearchParams for proper OAuth 2.0 format
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('redirect_uri', 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
        params.append('grant_type', 'authorization_code');
        params.append('state', 'from-frontend');
        
        console.log('Request data:', Object.fromEntries(params.entries()));
        
        const resp = await axiosInstance.post('/kroger/auth-callback', params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          },
          timeout: 15000 // Increase timeout for better reliability
        });
        
        console.log('✅ APPROACH 1 SUCCEEDED');
        console.log('Response data:', resp.data);
        
        // Verify connection after exchange
        try {
          console.log('Verifying connection after code exchange...');
          const statusResp = await axiosInstance.get('/kroger/connection-status');
          console.log('Connection status after exchange:', statusResp.data);
          
          if (statusResp.data && statusResp.data.is_connected) {
            console.log('✅ Connection is valid after exchange');
          } else {
            console.log('❌ Connection is still NOT valid after exchange');
          }
        } catch (verifyErr) {
          console.error('Error verifying connection:', verifyErr);
        }
        
        return resp.data;
      } catch (approach1Err) {
        console.error('❌ APPROACH 1 FAILED');
        console.error('Error details:', {
          message: approach1Err.message,
          response: approach1Err.response?.data,
          status: approach1Err.response?.status
        });
        
        // APPROACH 2: Try alternative endpoint
        try {
          console.log('------------------------------------------------');
          console.log('APPROACH 2: Using process-code endpoint');
          
          const resp = await axiosInstance.post('/kroger/process-code', {
            code,
            redirect_uri: 'https://smart-meal-planner-multi.vercel.app/kroger/callback',
            grant_type: 'authorization_code'
          });
          
          console.log('✅ APPROACH 2 SUCCEEDED');
          console.log('Response data:', resp.data);
          
          // Verify connection after exchange
          try {
            console.log('Verifying connection after code exchange...');
            const statusResp = await axiosInstance.get('/kroger/connection-status');
            console.log('Connection status after exchange:', statusResp.data);
          } catch (verifyErr) {
            console.error('Error verifying connection:', verifyErr);
          }
          
          return resp.data;
        } catch (approach2Err) {
          console.error('❌ APPROACH 2 FAILED');
          console.error('Error details:', {
            message: approach2Err.message,
            response: approach2Err.response?.data,
            status: approach2Err.response?.status
          });
          
          // APPROACH 3: Try GET as a last resort
          try {
            console.log('------------------------------------------------');
            console.log('APPROACH 3: Using GET with query parameters');
            
            const resp = await axiosInstance.get('/kroger/auth-callback', {
              params: { 
                code,
                redirect_uri: 'https://smart-meal-planner-multi.vercel.app/kroger/callback',
                grant_type: 'authorization_code',
                state: 'from-frontend' 
              },
              timeout: 15000
            });
            
            console.log('✅ APPROACH 3 SUCCEEDED');
            console.log('Response data:', resp.data);
            
            return resp.data;
          } catch (approach3Err) {
            console.error('❌ APPROACH 3 FAILED');
            console.error('Error details:', {
              message: approach3Err.message,
              response: approach3Err.response?.data,
              status: approach3Err.response?.status
            });
            
            throw approach1Err; // Throw original error
          }
        }
      }
    } catch (err) {
      console.error('❌ ALL APPROACHES FAILED');
      console.error('Final error:', err);
      throw err;
    }
  },

  async checkKrogerCredentials() {
    try {
      console.log('Checking Kroger credentials via API...');
      const resp = await axiosInstance.get('/kroger/check-credentials');
      console.log('Kroger credentials response:', resp.data);
      return resp.data;
    } catch (err) {
      console.error('Error checking Kroger credentials:', err);
      throw err;
    }
  },
  
  // New method to explicitly store Kroger tokens
  async storeKrogerTokens(tokenData) {
    try {
      console.log('Explicitly storing Kroger tokens...');
      if (!tokenData.access_token || !tokenData.refresh_token) {
        console.error('❌ Missing required token data:', tokenData);
        throw new Error('Missing required token data');
      }
      
      const resp = await axiosInstance.post('/kroger/store-tokens', tokenData);
      console.log('Token storage response:', resp.data);
      
      // Verify tokens were stored
      try {
        console.log('Verifying token storage...');
        const verifyResp = await axiosInstance.get('/kroger/check-credentials');
        console.log('Verification response:', verifyResp.data);
        
        if (verifyResp.data.has_access_token && verifyResp.data.has_refresh_token) {
          console.log('✅ Tokens were successfully stored and verified!');
        } else {
          console.error('❌ Token verification failed - tokens not properly stored');
        }
      } catch (verifyErr) {
        console.error('Token verification error:', verifyErr);
      }
      
      return resp.data;
    } catch (err) {
      console.error('Error storing Kroger tokens:', err);
      console.error('Error details:', {
        message: err.message,
        response: err.response?.data,
        status: err.response?.status
      });
      throw err;
    }
  },

  // Enhanced function to handle reconnection
  async reconnectKroger() {
    try {
      // Get the login URL from the backend
      const loginUrlData = await this.getKrogerLoginUrl();
      
      if (loginUrlData && loginUrlData.url) {
        // Redirect to Kroger auth page
        window.location.href = loginUrlData.url;
        return { success: true };
      } else {
        return { 
          success: false, 
          message: "Couldn't get Kroger login URL" 
        };
      }
    } catch (err) {
      console.error('Error reconnecting to Kroger:', err);
      return { 
        success: false, 
        message: "Error reconnecting to Kroger" 
      };
    }
  },

  // Special endpoint that can process a Kroger auth code
  async handleKrogerAuthCode(code, redirectUri) {
    try {
      console.log(`Handling Kroger auth code: ${code.substring(0, 10)}...`);
      
      // Try multiple approaches to handle the code
      
      // Approach 1: Try the standard process through our endpoint
      try {
        const response = await axiosInstance.post('/kroger/process-code', {
          code,
          redirect_uri: redirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback'
        });
        
        console.log("Code processing response:", response.data);
        return response.data;
      } catch (err1) {
        console.error("First approach failed:", err1);
        
        // Approach 2: Try the direct OAuth token exchange
        try {
          console.log("Trying direct token exchange");
          
          // Prepare form data for the OAuth token exchange
          const formData = new FormData();
          formData.append('grant_type', 'authorization_code');
          formData.append('code', code);
          formData.append('redirect_uri', redirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
          formData.append('client_id', 'smartmealplannerio-243261243034247652497361364a447078555731455949714a464f61656e5a676b444e552e42796961517a4f4576367156464b3564774c3039777a614700745159802496692');
          
          // Make the direct request to Kroger OAuth token endpoint
          const tokenResponse = await axiosInstance.post('/kroger/direct-token', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          console.log("Direct token response:", tokenResponse.data);
          return tokenResponse.data;
        } catch (err2) {
          console.error("Second approach failed:", err2);
          
          // Approach 3: Try the process-auth API which might be equivalent to /kroger/auth-callback
          try {
            console.log("Trying process-auth API");
            
            const params = new URLSearchParams();
            params.append('code', code);
            params.append('redirect_uri', redirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
            params.append('state', 'from-frontend');
            
            const authResponse = await axiosInstance.post('/kroger/process-auth', params, {
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
              }
            });
            
            console.log("Process auth response:", authResponse.data);
            return authResponse.data;
          } catch (err3) {
            console.error("Third approach failed:", err3);
            throw err3;
          }
        }
      }
    } catch (err) {
      console.error('All approaches for handling Kroger auth code failed:', err);
      throw err;
    }
  },
  
  // Add a new function to refresh token explicitly
  async refreshKrogerTokenExplicit() {
    try {
      console.log('Explicitly refreshing Kroger token...');
      
      // Try different refresh endpoints since the API structure might vary
      let response;
      
      // First try the dedicated refresh endpoint
      try {
        response = await axiosInstance.post('/kroger/refresh-token', {}, {
          timeout: 10000 // 10 second timeout for token refresh
        });
        console.log('Kroger token refreshed successfully via dedicated endpoint');
      } catch (err) {
        console.log('Dedicated refresh endpoint failed, trying alternative:', err.message);
        
        // Try the connection status endpoint which might trigger a refresh
        try {
          const statusResponse = await axiosInstance.get('/kroger/connection-status', {
            timeout: 10000
          });
          console.log('Connection status check completed:', statusResponse.data);
          
          // If we got here, at least the connection check worked
          if (statusResponse.data.is_connected) {
            console.log('Kroger connection is valid according to status check');
            return {
              success: true,
              message: "Kroger connection is valid"
            };
          } else {
            // If not connected, try a more direct approach
            throw new Error('Connection status shows not connected');
          }
        } catch (statusErr) {
          console.log('Status check failed, trying auth check:', statusErr.message);
          
          // Last resort - try credentials check which might update tokens
          const credResult = await this.checkKrogerCredentials();
          
          if (credResult.has_access_token) {
            console.log('Credentials check shows we have valid access token');
            return {
              success: true,
              message: "Kroger connection verified via credentials check"
            };
          } else {
            throw new Error('All refresh methods failed');
          }
        }
      }
      
      return {
        success: true,
        message: "Token refreshed successfully"
      };
    } catch (err) {
      console.error('All Kroger token refresh methods failed:', err);
      console.log('Error details:', {
        message: err.message,
        code: err.code,
        status: err.response?.status,
        data: err.response?.data
      });
      
      return {
        success: false,
        message: "Failed to refresh Kroger token",
        error: err.message
      };
    }
  },

  completeKrogerAuth: async (tempToken) => {
    try {
      console.log('Completing Kroger auth with token:', tempToken);
      const response = await axiosInstance.post('/kroger/complete-auth', {
        temp_token: tempToken
      });
      return response.data;
    } catch (err) {
      console.error('Error completing Kroger auth:', err);
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
      
      console.log(`Fetching organization clients for orgId: ${orgId}`);
      
      // Try multiple approaches for maximum compatibility
      // Try POST to the alternative endpoint first
      try {
        console.log(`Trying POST to /organization-clients/${orgId}`);
        const response = await axiosInstance.post(`/organization-clients/${orgId}`);
        console.log('POST response successful:', response.data);
        return response.data;
      } catch (postErr) {
        console.error('POST to alternative endpoint failed:', postErr);
        
        // Try GET method next
        try {
          console.log(`Trying GET to /organization-clients/${orgId}`);
          const getResponse = await axiosInstance.get(`/organization-clients/${orgId}`);
          console.log('GET response successful:', getResponse.data);
          return getResponse.data;
        } catch (getErr) {
          console.error('GET to alternative endpoint failed:', getErr);
          
          // Try the original endpoint format
          try {
            console.log(`Trying original endpoint /organizations/${orgId}/clients`);
            const originalResponse = await axiosInstance.get(`/organizations/${orgId}/clients`);
            console.log('Original endpoint response:', originalResponse.data);
            return originalResponse.data;
          } catch (origErr) {
            console.error('Original endpoint also failed:', origErr);
            
            // Create a mock response with the correct structure in case all endpoints fail
            console.warn('All endpoints failed, returning empty clients array');
            return {
              clients: [],
              total: 0,
              organization_id: orgId
            };
          }
        }
      }
    } catch (err) {
      console.error('Unexpected error fetching organization clients:', err);
      // Return a properly formatted empty response
      return {
        clients: [],
        total: 0,
        organization_id: orgId
      };
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
      const accountType = userData.account_type || null;
      
      console.log('Getting shared menus for user:', {
        userId,
        role,
        organizationId,
        accountType,
        fullUserData: userData
      });
      
      if (!userId) {
        console.warn('User ID not found in local storage');
        return [];
      }
      
      // Try the client dashboard endpoint first for client accounts
      if (accountType === 'client' || organizationId) {
        try {
          console.log('Attempting to fetch client dashboard data');
          const dashboardResponse = await axiosInstance.get('/client/dashboard');
          console.log('Client dashboard response:', dashboardResponse.data);
          
          // If we get a successful response, extract the shared menus
          if (dashboardResponse.data && dashboardResponse.data.shared_menus) {
            if (dashboardResponse.data.shared_menus.length === 0) {
              console.warn('No shared menus found in dashboard response, will try alternative endpoints');
            } else {
              console.log(`Found ${dashboardResponse.data.shared_menus.length} shared menus in dashboard`);
              
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
          } else {
            console.warn('Dashboard response did not contain shared_menus property');
          }
        } catch (dashboardErr) {
          console.warn('Could not fetch client dashboard, falling back to shared menus endpoint:', dashboardErr);
        }
      }
      
      // Try the shared endpoint without userId parameter first
      try {
        console.log('Trying /menu/shared endpoint');
        const generalResponse = await axiosInstance.get('/menu/shared');
        console.log('Shared menus response from general endpoint:', generalResponse.data);
        
        if (Array.isArray(generalResponse.data) && generalResponse.data.length > 0) {
          const processedMenus = generalResponse.data.map(menu => {
            // Add shared_at if missing
            if (!menu.shared_at) {
              menu.shared_at = new Date().toISOString();
            }
            return menu;
          });
          return processedMenus;
        }
      } catch (generalErr) {
        console.warn('General shared endpoint failed, trying with user ID:', generalErr);
      }
      
      // Fall back to the user-specific shared menus endpoint
      console.log(`Trying /menu/shared/${userId} endpoint`);
      const response = await axiosInstance.get(`/menu/shared/${userId}`);
      console.log('Shared menus response from user-specific endpoint:', response.data);
      
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
      
      // Last resort: try to get menu history and filter for shared menus
      try {
        console.log('Trying menu history as last resort');
        const historyResponse = await axiosInstance.get(`/menu/history/${userId}`);
        console.log('Menu history response:', historyResponse.data);
        
        if (Array.isArray(historyResponse.data)) {
          // Look for menus with sharing info or from other users
          return historyResponse.data.filter(menu => 
            menu.is_shared === true || 
            menu.shared_with !== undefined || 
            menu.created_by !== userId
          );
        }
      } catch (historyErr) {
        console.warn('Menu history endpoint also failed:', historyErr);
      }
      
      return response.data || [];
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
      return { recipes: [], total: 0 };
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

  // Share a menu directly with a client
  shareMenuWithClient: async (menuId, clientId, permission = 'read') => {
    try {
      console.log(`Sharing menu ${menuId} with client ${clientId}, permission: ${permission}`);
      const response = await axiosInstance.post(`/menu/share/${menuId}/client/${clientId}`, {
        permission_level: permission
      });
      console.log('Menu sharing response:', response.data);
      return response.data;
    } catch (err) {
      console.error(`Error sharing menu ${menuId} with client ${clientId}:`, err);
      // Log detailed error information
      if (err.response) {
        console.error('Response error details:', {
          status: err.response.status,
          data: err.response.data,
          headers: err.response.headers
        });
      }
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
  },

  // Method to get authentication token
  getToken: () => {
    const token = localStorage.getItem('token');
    return token;
  },

  // Method to poll for shopping list results with error handling
  pollForShoppingListResults: async (menuId, maxAttempts = 20, intervalMs = 2000) => {
    let attempts = 0;

    while (attempts < maxAttempts) {
      attempts++;
      console.log(`Polling for results (attempt ${attempts}/${maxAttempts})...`);

      try {
        const response = await fetch(`${apiUrl}/menu/${menuId}/shopping-list/status`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${apiService.getToken()}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.status === 405) {
          console.log('Polling error: 405');
          // Just return the initial response - the 405 error means the endpoint is not implemented
          // but we already have data from the initial response
          return apiService.lastShoppingListResponse;
        }

        if (!response.ok) {
          throw new Error(`Polling error: ${response.status}`);
        }

        const data = await response.json();

        if (data.status === 'completed') {
          return data;
        }

        // Wait before next attempt
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      } catch (error) {
        console.error('Error during polling:', error.message);
        // If we get an error but have an initial response, use it
        if (apiService.lastShoppingListResponse) {
          return apiService.lastShoppingListResponse;
        }
        throw error;
      }
    }

    // If we time out but have initial data, use that
    if (apiService.lastShoppingListResponse) {
      return apiService.lastShoppingListResponse;
    }

    throw new Error('Polling timed out');
  },

  // Recipe saving methods
  async saveRecipe(saveData, isScraped = false) {
    try {
      const endpoint = isScraped ? '/saved-recipes-alt/scraped' : '/saved-recipes/';
      console.log(`🐛 DEBUG: Saving recipe to ${endpoint}`);
      console.log(`🐛 DEBUG: axiosInstance baseURL:`, axiosInstance.defaults.baseURL);
      console.log(`🐛 DEBUG: Full URL will be:`, `${axiosInstance.defaults.baseURL}${endpoint}`);
      console.log(`🐛 DEBUG: Save data:`, saveData);

      const response = await axiosInstance.post(endpoint, saveData);
      return response.data;
    } catch (error) {
      console.error('Save recipe error:', error);
      throw error;
    }
  },

  async deleteRecipe(savedId) {
    try {
      const response = await axiosInstance.delete(`/saved-recipes/${savedId}`);
      return response.data;
    } catch (error) {
      console.error('Delete recipe error:', error);
      throw error;
    }
  },

  async getScrapedRecipe(scrapedRecipeId) {
    try {
      const response = await axiosInstance.get(`/scraped-recipes/${scrapedRecipeId}`);
      return response.data;
    } catch (error) {
      console.error('Get scraped recipe error:', error);
      throw error;
    }
  }
}; // Close the apiService object here

export { axiosInstance };
export default apiService;
