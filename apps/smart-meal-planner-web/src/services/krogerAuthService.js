// src/services/krogerAuthService.js
import axios from 'axios';

// Ensure we're using the correct API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
console.log('KrogerAuthService using API base URL:', API_BASE_URL);

// Direct API URLs for debugging
const DIRECT_KROGER_AUTH_URL = 'https://api.kroger.com/v1/connect/oauth2/authorize';
const DIRECT_KROGER_TOKEN_URL = 'https://api.kroger.com/v1/connect/oauth2/token';

// Standalone axios instance for auth-related requests
const authAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  }
});

// Request interceptor for auth
authAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('access_token');
  if (token) {
    config.headers.Authorization = token.startsWith('Bearer ') 
      ? token 
      : `Bearer ${token}`;
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

// Keep track of if we're refreshing
let isRefreshing = false;
let refreshPromise = null;

// Use this to track if we've attempted direct login
let hasAttemptedReconnect = false;

/**
 * Get a fresh Kroger token - can be called directly when needed
 * This function will ensure we only try to refresh once at a time
 */
const getKrogerToken = async () => {
  // If we're already refreshing, wait for that to complete
  if (isRefreshing) {
    return refreshPromise;
  }

  // Start a new refresh
  isRefreshing = true;
  refreshPromise = refreshKrogerTokenInternal();
  
  try {
    const result = await refreshPromise;
    return result;
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
};

/**
 * Internal implementation of token refresh with multiple fallback strategies
 */
const refreshKrogerTokenInternal = async () => {
  console.log('Attempting to refresh Kroger token...');
  
  // Strategy 0: Direct Token Refresh Attempt
  try {
    const refreshResponse = await authAxios.post('/kroger/refresh-token');
    if (refreshResponse.data && refreshResponse.data.access_token) {
      console.log('Token successfully refreshed via dedicated endpoint');
      return {
        success: true,
        message: 'Token refreshed successfully'
      };
    }
  } catch (refreshError) {
    console.warn('Direct refresh failed:', refreshError.message);
  }
  
  // Strategy 1: Check Connection Status
  try {
    const statusResponse = await authAxios.get('/kroger/connection-status');
    if (statusResponse.data && statusResponse.data.is_connected) {
      console.log('Kroger connection is still valid');
      return {
        success: true,
        message: 'Connection is still valid'
      };
    }
  } catch (statusError) {
    console.warn('Status check failed:', statusError.message);
  }
  
  // Strategy 2: Verify Credentials
  try {
    const credResponse = await authAxios.get('/kroger/check-credentials');
    if (credResponse.data && credResponse.data.has_access_token) {
      console.log('Kroger credentials are valid');
      return {
        success: true,
        message: 'Credentials are valid'
      };
    }
  } catch (credError) {
    console.warn('Credentials check failed:', credError.message);
  }
  
  // Final strategy: Get a new login URL if we haven't tried to reconnect
  if (!hasAttemptedReconnect) {
    try {
      const loginResponse = await authAxios.get('/kroger/login-url');
      if (loginResponse.data && loginResponse.data.login_url) {
        hasAttemptedReconnect = true;
        
        let loginUrl = loginResponse.data.login_url;
        
        // Fix redirect URI if needed
        if (loginUrl.includes('127.0.0.1:8000/callback')) {
          console.log('Fixing redirect URI in login URL during refresh');
          loginUrl = loginUrl.replace(
            'http://127.0.0.1:8000/callback',
            'https://smart-meal-planner-multi.vercel.app/kroger/callback'
          );
        }
        
        return {
          success: false,
          needs_reconnect: true,
          login_url: loginUrl,
          message: 'Reconnection required'
        };
      }
    } catch (loginError) {
      console.error('Failed to get login URL:', loginError.message);
    }
  }
  
  // If all strategies fail
  return {
    success: false,
    message: 'Failed to refresh Kroger token'
  };
};

/**
 * Add items to Kroger cart with automatic token refresh
 */
const addToKrogerCart = async (items) => {
  console.log('Adding items to Kroger cart with auth handling:', items);
  
  // Validate input
  if (!items || !Array.isArray(items) || items.length === 0) {
    return {
      success: false,
      message: 'No valid items provided'
    };
  }
  
  // Format items for the API
  const krogerItems = items.map(item => ({
    upc: item.upc,
    quantity: item.quantity || 1
  }));
  
  // Try to add items to cart directly
  try {
    const response = await authAxios.post('/kroger/cart/add', {
      items: krogerItems
    }, {
      timeout: 60000 // 60 second timeout
    });
    
    return response.data || { success: true };
  } catch (cartError) {
    console.error('Error adding to Kroger cart:', cartError);
    
    // Comprehensive token error detection
    const tokenErrorConditions = [
      cartError.response?.data?.error === "API-401: Invalid Access Token",
      cartError.response?.data?.message?.includes("Invalid Access Token"),
      cartError.response?.status === 401,
      cartError.response?.data?.message?.includes("authentication"),
      cartError.response?.data?.message?.includes("expired token")
    ];
    
    // Check if any token error conditions are met
    if (tokenErrorConditions.some(condition => condition)) {
      console.log('Invalid access token detected, forcing reconnection');
      
      try {
        // Try to get login URL
        const loginResponse = await authAxios.get('/kroger/login-url');
        
        if (loginResponse.data && loginResponse.data.login_url) {
          let loginUrl = loginResponse.data.login_url;
          
          // Fix redirect URI if needed
          if (loginUrl.includes('127.0.0.1:8000/callback')) {
            console.log('Fixing redirect URI in login URL');
            loginUrl = loginUrl.replace(
              'http://127.0.0.1:8000/callback',
              'https://smart-meal-planner-multi.vercel.app/kroger/callback'
            );
          }
          
          return {
            success: false,
            needs_reconnect: true,
            login_url: loginUrl,
            message: 'Kroger authentication required - please reconnect'
          };
        }
      } catch (loginError) {
        console.error('Error getting login URL:', loginError);
      }
      
      // Fallback reconnect response
      return {
        success: false,
        needs_reconnect: true,
        message: 'Your Kroger session has expired. Please reconnect your account.'
      };
    }
    
    // Timeout handling
    if (cartError.code === 'ECONNABORTED' || cartError.message?.includes('timeout')) {
      return {
        success: false,
        timeout: true,
        message: 'Request timed out. Check your Kroger cart to see if items were added.'
      };
    }
    
    // Generic error handling
    return {
      success: false,
      message: cartError.response?.data?.message || 
               cartError.response?.data?.detail || 
               cartError.message || 
               'Failed to add items to Kroger cart'
    };
  }
};

/**
 * Handle Kroger reconnection process
 */
const reconnectKroger = async () => {
  try {
    console.log('Attempting to reconnect Kroger...');
    
    // Set a flag in localStorage to detect if we get redirected properly
    localStorage.setItem('kroger_reconnect_attempted', 'true');
    localStorage.setItem('kroger_reconnect_timestamp', Date.now().toString());
    
    // Try multiple approaches to get a valid Kroger login URL
    
    // Approach 1: Get login URL from backend
    try {
      console.log('Approach 1: Getting login URL from backend');
      const response = await authAxios.get('/kroger/login-url');
      console.log('Login URL response:', response.data);
    
      if (response.data && response.data.login_url) {
        // Reset the reconnect flag since we're starting a new flow
        hasAttemptedReconnect = false;
        
        // Fix redirect URI if needed
        let loginUrl = response.data.login_url;
        if (loginUrl.includes('127.0.0.1:8000/callback')) {
          console.log('Fixing redirect URI in login URL');
          loginUrl = loginUrl.replace(
            'http://127.0.0.1:8000/callback',
            'https://smart-meal-planner-multi.vercel.app/kroger/callback'
          );
          console.log('Fixed URL:', loginUrl);
        }
        
        // Try to use the browser's fetch API to validate the URL first
        try {
          console.log('Validating login URL by making a HEAD request');
          const validation = await fetch(loginUrl, { 
            method: 'HEAD',
            mode: 'no-cors' // This allows us to at least try to connect
          });
          console.log('Login URL validation response:', validation);
        } catch (validationErr) {
          console.warn('Login URL validation failed (this is often expected):', validationErr);
          // This error is expected and can be ignored - we just want to ensure
          // the URL is at least reachable before redirecting
        }
        
        // Navigate to Kroger login page
        console.log('Redirecting to Kroger login...');
        
        // Manually create and click a link for more reliable navigation
        const a = document.createElement('a');
        a.href = loginUrl;
        a.target = '_self'; // Open in current tab
        a.rel = 'noopener noreferrer';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        // As a backup, also try direct location.href assignment
        setTimeout(() => {
          console.log('Backup redirect with location.href');
          window.location.href = loginUrl;
        }, 500);
        
        return { success: true };
      }
      
      console.log('No login URL in response:', response.data);
    } catch (apiError) {
      console.error('Approach 1 failed - Error getting login URL from API:', apiError);
    }
    
    // Approach 2: Use the connection status endpoint as a trigger
    try {
      console.log('Approach 2: Using connection status endpoint as trigger');
      const statusResponse = await authAxios.get('/kroger/connection-status');
      console.log('Connection status response:', statusResponse.data);
      
      // If the backend responded with a login URL or redirect, use it
      if (statusResponse.data && statusResponse.data.login_url) {
        console.log('Got login URL from status endpoint:', statusResponse.data.login_url);
        
        // Fix redirect URI if needed
        let loginUrl = statusResponse.data.login_url;
        if (loginUrl.includes('127.0.0.1:8000/callback')) {
          console.log('Fixing redirect URI in login URL');
          loginUrl = loginUrl.replace(
            'http://127.0.0.1:8000/callback',
            'https://smart-meal-planner-multi.vercel.app/kroger/callback'
          );
        }
        
        // Navigate to Kroger login page
        console.log('Redirecting to Kroger login from status endpoint...');
        window.location.href = loginUrl;
        return { success: true };
      }
    } catch (statusError) {
      console.error('Approach 2 failed:', statusError);
    }
    
    // Approach 3: Manually construct Kroger OAuth URL
    console.log('Approach 3: Manual URL construction - last resort');
    
    // These are the critical Kroger OAuth parameters
    const clientId = 'smartmealplannerio-243261243034247652497361364a447078555731455949714a464f61656e5a676b444e552e42796961517a4f4576367156464b3564774c3039777a614700745159802496692';
    const redirectUri = 'https://smart-meal-planner-multi.vercel.app/kroger/callback';
    const scope = 'product.compact cart.basic:write';
    
    // Generate a random state
    const state = Math.random().toString(36).substring(2, 15);
    
    // Construct the URL manually with all required params
    const manualUrl = `https://api.kroger.com/v1/connect/oauth2/authorize?scope=${encodeURIComponent(scope)}&response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
    
    console.log('Manually constructed URL:', manualUrl);
    
    // Use the most reliable method for navigation - create and click a link
    try {
      const a = document.createElement('a');
      a.href = manualUrl;
      a.target = '_self'; // Open in current tab
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      // As a backup, also try direct location.href assignment
      setTimeout(() => {
        window.location.href = manualUrl;
      }, 500);
      
      return { success: true };
    } catch (navError) {
      console.error('Error during navigation:', navError);
      
      // Last resort approach - direct assignment
      window.location.href = manualUrl;
      return { success: true };
    }
  } catch (error) {
    console.error('Error initiating Kroger reconnection:', error);
    return {
      success: false,
      message: 'Error initiating Kroger reconnection'
    };
  }
};

/**
 * Check if Kroger credentials are valid
 */
const checkKrogerStatus = async () => {
  try {
    const response = await authAxios.get('/kroger/connection-status');
    return response.data;
  } catch (error) {
    console.error('Error checking Kroger status:', error);
    return {
      is_connected: false,
      error: error.message
    };
  }
};

/**
 * Process an authorization code directly
 */
const processAuthCode = async (code, redirectUri) => {
  try {
    console.log(`Processing auth code: ${code.substring(0, 10)}...`);
    
    // Try various approaches to process the code
    
    // Approach 1: Standard backend endpoint
    try {
      console.log('Approach 1: Using backend process-code endpoint');
      const response = await authAxios.post('/kroger/process-code', {
        code,
        redirect_uri: redirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback',
        grant_type: 'authorization_code'
      });
      
      console.log('Process-code response:', response.data);
      return { success: true, data: response.data };
    } catch (err1) {
      console.error('Approach 1 failed:', err1);
      
      // Approach 2: Try the auth-callback endpoint with URL params
      try {
        console.log('Approach 2: Using auth-callback endpoint with URL params');
        const params = new URLSearchParams();
        params.append('code', code);
        params.append('redirect_uri', redirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
        params.append('grant_type', 'authorization_code');
        
        const response = await authAxios.post('/kroger/auth-callback', params, {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        });
        
        console.log('Auth-callback response:', response.data);
        return { success: true, data: response.data };
      } catch (err2) {
        console.error('Approach 2 failed:', err2);
        
        // Approach 3: Try the direct-token endpoint
        try {
          console.log('Approach 3: Using direct-token endpoint');
          const formData = new FormData();
          formData.append('code', code);
          formData.append('redirect_uri', redirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
          formData.append('grant_type', 'authorization_code');
          
          const response = await authAxios.post('/kroger/direct-token', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
          
          console.log('Direct-token response:', response.data);
          return { success: true, data: response.data };
        } catch (err3) {
          console.error('Approach 3 failed:', err3);
          
          // If all approaches fail, throw the original error
          throw err1;
        }
      }
    }
  } catch (error) {
    console.error('All approaches to process auth code failed:', error);
    return { success: false, error: error.message };
  }
};

export default {
  getKrogerToken,
  addToKrogerCart,
  reconnectKroger,
  checkKrogerStatus,
  processAuthCode
};