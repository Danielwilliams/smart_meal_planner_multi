// src/services/krogerAuthService.js
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://www.smartmealplannerio.com';

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
    const response = await authAxios.get('/kroger/login-url');
    
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
      }
      
      // Navigate to Kroger login page
      window.location.href = loginUrl;
      return { success: true };
    }
    
    return {
      success: false,
      message: 'Failed to get Kroger login URL'
    };
  } catch (error) {
    console.error('Error getting Kroger login URL:', error);
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

export default {
  getKrogerToken,
  addToKrogerCart,
  reconnectKroger,
  checkKrogerStatus
};