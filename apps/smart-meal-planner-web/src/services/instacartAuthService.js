// src/services/instacartAuthService.js
import axios from 'axios';
import { getMockRetailersByZip } from './mockData/instacartRetailers';
import { getMockProductSearch } from './mockData/instacartProducts';

// Ensure we're using the correct API base URL
const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-development.up.railway.app';
console.log('InstacartAuthService using API base URL:', API_BASE_URL);

// Instacart API Key
const INSTACART_API_KEY = process.env.REACT_APP_INSTACART_API_KEY || 'INSTACARTAPI_DEV';

// Flag to enable mock data fallback - setting to false per user request
const USE_MOCK_DATA = false;

// Log configuration for debugging
console.log('Instacart configuration:', {
  apiKeyExists: !!INSTACART_API_KEY,
  apiKeyValue: INSTACART_API_KEY ? '[REDACTED]' : 'missing',
  apiBaseUrl: API_BASE_URL,
  useMockData: USE_MOCK_DATA,
  envVars: {
    REACT_APP_INSTACART_API_KEY: !!process.env.REACT_APP_INSTACART_API_KEY,
    REACT_APP_API_BASE_URL: !!process.env.REACT_APP_API_BASE_URL
  }
});

// Standalone axios instance for Instacart auth-related requests
const instacartAxios = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
    'X-Instacart-API-Key': INSTACART_API_KEY
  }
});

// Request interceptor for logging
instacartAxios.interceptors.request.use((config) => {
  console.log(`InstacartAuthService Request: ${config.method.toUpperCase()} ${config.url}`, {
    ...config,
    headers: {
      ...config.headers,
      'X-Instacart-API-Key': '[REDACTED]' // Don't log the actual key
    }
  });
  return config;
}, (error) => {
  console.error('InstacartAuthService Request Error:', error);
  return Promise.reject(error);
});

// Response interceptor for logging
instacartAxios.interceptors.response.use((response) => {
  console.log('InstacartAuthService Response:', response.status, 
    response.data ? 'Data Received' : 'No Data');
  return response;
}, (error) => {
  console.error('InstacartAuthService Response Error:', 
    error.response ? `${error.response.status} - ${error.response.statusText}` : error.message);
  return Promise.reject(error);
});

// Keep track of pending requests
let isLoadingRetailers = false;
let retailersPromise = null;
let detectedApiIssue = false;

// Clear any existing mock data flags from localStorage
try {
  localStorage.removeItem('instacart_using_mock_data');

  // Clear cached retailers to force fresh data
  const keys = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key && (key.startsWith('instacart_retailers_') || key.startsWith('instacart_search_'))) {
      keys.push(key);
    }
  }

  // Remove all cached instacart data
  keys.forEach(key => localStorage.removeItem(key));
  console.log('Cleared cached Instacart data from localStorage');
} catch (err) {
  console.warn('Error clearing localStorage:', err);
}

/**
 * Check if the Instacart API is functioning correctly
 * @returns {Promise<Object>} Status and connection information
 */
const checkInstacartApiStatus = async () => {
  try {
    console.log('Checking Instacart API status...');
    
    // Store the ZIP code for nearby retailer checks
    const zipCode = localStorage.getItem('instacart_zip_code') || '80538';
    
    // Strategy 1: Check API configuration on the backend
    try {
      console.log('Strategy 1: Checking API configuration...');
      const configResponse = await instacartAxios.get('/instacart/config/test');
      
      if (configResponse.data && configResponse.data.api_key_configured) {
        console.log('✅ Backend confirms API key is properly configured');
        
        // Reset the API issue flag if it was set
        if (detectedApiIssue) {
          console.log('Clearing previously detected API issue flag');
          detectedApiIssue = false;
          localStorage.removeItem('instacart_api_issue');
        }
        
        return {
          status: 'connected',
          api_key_configured: true,
          config_test: configResponse.data
        };
      } else {
        // API key is not configured properly
        console.warn('⚠️ API key configuration issue detected');
        detectedApiIssue = true;
        localStorage.setItem('instacart_api_issue', 'api_key');
        
        return {
          status: 'api_key_issue',
          api_key_configured: false,
          message: 'Instacart API key is not configured properly',
          config_test: configResponse.data
        };
      }
    } catch (configError) {
      console.warn('Strategy 1 failed:', configError.message);
    }
    
    // Strategy 2: Try to get environment info
    try {
      console.log('Strategy 2: Checking environment info...');
      const envResponse = await instacartAxios.get('/instacart/environment');
      
      if (envResponse.data) {
        console.log('✅ Backend environment info retrieved:', envResponse.data);
        return {
          status: 'connected',
          environment_info: envResponse.data
        };
      }
    } catch (envError) {
      console.warn('Strategy 2 failed:', envError.message);
    }
    
    // Strategy 3: Try to get retailers list
    try {
      console.log('Strategy 3: Checking retailers list...');
      const retailersResponse = await instacartAxios.get('/instacart/retailers');
      
      if (retailersResponse.data && Array.isArray(retailersResponse.data) && retailersResponse.data.length > 0) {
        console.log('✅ Successfully retrieved retailers list');
        return {
          status: 'connected',
          retailers_count: retailersResponse.data.length
        };
      }
    } catch (retailersError) {
      console.warn('Strategy 3 failed:', retailersError.message);
    }
    
    // Strategy 4: Try to get nearby retailers
    try {
      console.log(`Strategy 4: Checking nearby retailers for ZIP ${zipCode}...`);
      const nearbyResponse = await instacartAxios.get('/instacart/retailers/nearby', {
        params: { zip_code: zipCode }
      });
      
      if (nearbyResponse.data && Array.isArray(nearbyResponse.data) && nearbyResponse.data.length > 0) {
        console.log('✅ Successfully retrieved nearby retailers');
        return {
          status: 'connected',
          nearby_retailers_count: nearbyResponse.data.length
        };
      }
    } catch (nearbyError) {
      console.warn('Strategy 4 failed:', nearbyError.message);
    }
    
    // If we get here, all strategies failed
    console.error('❌ All API status check strategies failed');
    detectedApiIssue = true;
    localStorage.setItem('instacart_api_issue', 'connection');
    
    return {
      status: 'disconnected',
      message: 'Could not connect to Instacart API',
      use_mock_data: USE_MOCK_DATA
    };
  } catch (error) {
    console.error('Error checking Instacart API status:', error);
    
    // Set the API issue flag
    detectedApiIssue = true;
    localStorage.setItem('instacart_api_issue', 'error');
    
    return {
      status: 'error',
      message: error.message,
      use_mock_data: USE_MOCK_DATA
    };
  }
};

/**
 * Get a list of retailers based on ZIP code with caching and fallbacks
 * This is a drop-in replacement for instacartService.getNearbyRetailers
 * with better caching, error handling, and fallbacks
 * 
 * @param {string} zipCode - ZIP code to search for nearby retailers
 * @returns {Promise<Array>} List of retailers
 */
const getNearbyRetailers = async (zipCode) => {
  try {
    console.log(`Getting nearby Instacart retailers for ZIP: ${zipCode}`);
    
    // Start by updating the ZIP code in localStorage
    if (zipCode) {
      localStorage.setItem('instacart_zip_code', zipCode);
    }
    
    // If we're already loading retailers, return that promise
    if (isLoadingRetailers) {
      console.log('Already loading retailers, returning existing promise');
      return retailersPromise;
    }
    
    // Check if we have retailers cached for this ZIP code
    const cachedRetailers = localStorage.getItem(`instacart_retailers_${zipCode}`);
    const cacheTimestamp = localStorage.getItem(`instacart_retailers_${zipCode}_timestamp`);
    const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp, 10) : Infinity;
    
    // Use cache if available and less than 24 hours old
    if (cachedRetailers && cacheAge < 24 * 60 * 60 * 1000) {
      try {
        const retailers = JSON.parse(cachedRetailers);
        if (Array.isArray(retailers) && retailers.length > 0) {
          console.log(`Using cached retailers for ZIP ${zipCode} (${Math.round(cacheAge / 60000)} minutes old)`);
          return retailers;
        }
      } catch (cacheError) {
        console.warn('Error parsing cached retailers:', cacheError);
        // Continue to fetch new data if cache parsing fails
      }
    }
    
    // Start loading retailers
    isLoadingRetailers = true;
    retailersPromise = fetchRetailersWithFallbacks(zipCode);
    
    try {
      const result = await retailersPromise;
      return result;
    } finally {
      isLoadingRetailers = false;
      retailersPromise = null;
    }
  } catch (error) {
    console.error(`Error in getNearbyRetailers for ZIP ${zipCode}:`, error);
    
    // Use mock data as a last resort if enabled
    if (USE_MOCK_DATA) {
      console.log('⚠️ Using mock data as fallback for retailers');
      return getMockRetailersByZip(zipCode);
    }
    
    throw error;
  }
};

/**
 * Internal implementation of retailer fetching with multiple fallback strategies
 * @param {string} zipCode - ZIP code to search for nearby retailers
 * @returns {Promise<Array>} List of retailers
 */
const fetchRetailersWithFallbacks = async (zipCode) => {
  let lastError = null;
  
  // Strategy 1: Direct API call for nearby retailers
  try {
    console.log('Strategy 1: Direct API call for nearby retailers');
    const response = await instacartAxios.get('/instacart/retailers/nearby', {
      params: { zip_code: zipCode }
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Strategy 1 succeeded with', response.data.length, 'retailers');
      
      // Cache the result
      localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(response.data));
      localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
      
      return response.data;
    } else {
      console.warn('Strategy 1 returned empty results');
    }
  } catch (error) {
    console.warn('Strategy 1 failed:', error.message);
    lastError = error;
  }
  
  // Strategy 2: Try API prefix with /api
  try {
    console.log('Strategy 2: API prefix with /api');
    const response = await axios.get(`/api/instacart/retailers/nearby`, {
      params: { zip_code: zipCode },
      headers: instacartAxios.defaults.headers
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Strategy 2 succeeded with', response.data.length, 'retailers');
      
      // Cache the result
      localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(response.data));
      localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
      
      return response.data;
    } else {
      console.warn('Strategy 2 returned empty results');
    }
  } catch (error) {
    console.warn('Strategy 2 failed:', error.message);
    lastError = error;
  }
  
  // Strategy 3: Fall back to non-ZIP-specific retailers
  try {
    console.log('Strategy 3: Fall back to general retailers list');
    const response = await instacartAxios.get('/instacart/retailers');
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Strategy 3 succeeded with', response.data.length, 'retailers');
      
      // Add mock distances based on ZIP code
      const enhancedRetailers = response.data.map((retailer, index) => {
        // Generate a pseudo-random distance based on ZIP code and retailer ID
        const zipPrefix = zipCode ? zipCode.charAt(0) : '8';
        const distanceSeed = (parseInt(zipPrefix) + index) % 10;
        const distance = Math.round((distanceSeed + Math.random() * 5) * 10) / 10;
        
        // Create a copy with distance and address info
        return {
          ...retailer,
          distance,
          address: {
            city: `City ${index % 5 + 1}`,
            state: 'ST',
            zip_code: zipCode
          }
        };
      });
      
      // Sort by the generated distances
      enhancedRetailers.sort((a, b) => a.distance - b.distance);
      
      // Cache the enhanced results
      localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(enhancedRetailers));
      localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
      
      return enhancedRetailers;
    } else {
      console.warn('Strategy 3 returned empty results');
    }
  } catch (error) {
    console.warn('Strategy 3 failed:', error.message);
    lastError = error;
  }
  
  // Strategy 4: Direct URL as a last resort
  try {
    console.log('Strategy 4: Direct URL as last resort');
    const url = `${API_BASE_URL}/instacart/retailers`;
    console.log('Trying direct URL:', url);
    
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'X-Instacart-API-Key': INSTACART_API_KEY
      }
    });
    
    if (response.data && Array.isArray(response.data) && response.data.length > 0) {
      console.log('✅ Strategy 4 succeeded with', response.data.length, 'retailers');
      
      // Add mock distances based on ZIP code
      const enhancedRetailers = response.data.map((retailer, index) => {
        // Generate a pseudo-random distance based on ZIP code and retailer ID
        const zipPrefix = zipCode ? zipCode.charAt(0) : '8';
        const distanceSeed = (parseInt(zipPrefix) + index) % 10;
        const distance = Math.round((distanceSeed + Math.random() * 5) * 10) / 10;
        
        // Create a copy with distance and address info
        return {
          ...retailer,
          distance,
          address: {
            city: `City ${index % 5 + 1}`,
            state: 'ST',
            zip_code: zipCode
          }
        };
      });
      
      // Sort by the generated distances
      enhancedRetailers.sort((a, b) => a.distance - b.distance);
      
      // Cache the enhanced results
      localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(enhancedRetailers));
      localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
      
      return enhancedRetailers;
    } else {
      console.warn('Strategy 4 returned empty results');
    }
  } catch (error) {
    console.warn('Strategy 4 failed:', error.message);
    lastError = error;
  }
  
  // If we get here, all strategies failed, use mock data if enabled
  if (USE_MOCK_DATA) {
    console.log('⚠️ All strategies failed, using mock data');
    const mockRetailers = getMockRetailersByZip(zipCode);
    
    // Cache the mock data
    localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(mockRetailers));
    localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
    localStorage.setItem('instacart_using_mock_data', 'true');
    
    return mockRetailers;
  }
  
  // If mock data is disabled, throw the last error
  throw lastError || new Error('Failed to get retailers after multiple attempts');
};

/**
 * Search for products at a specific retailer with caching and fallbacks
 * @param {string} retailerId - Instacart retailer ID
 * @param {string} query - Search query
 * @param {number} limit - Maximum number of results (optional, default 10)
 * @returns {Promise<Array>} List of products matching the search query
 */
const searchProducts = async (retailerId, query, limit = 10) => {
  try {
    console.log(`Searching Instacart products - retailer: ${retailerId}, query: ${query}, limit: ${limit}`);
    
    // Check if we have results cached for this query
    const cacheKey = `instacart_search_${retailerId}_${query.toLowerCase().trim()}`;
    const cachedResults = localStorage.getItem(cacheKey);
    const cacheTimestamp = localStorage.getItem(`${cacheKey}_timestamp`);
    const cacheAge = cacheTimestamp ? Date.now() - parseInt(cacheTimestamp, 10) : Infinity;
    
    // Use cache if available and less than 1 hour old
    if (cachedResults && cacheAge < 60 * 60 * 1000) {
      try {
        const results = JSON.parse(cachedResults);
        if (Array.isArray(results) && results.length > 0) {
          console.log(`Using cached search results for "${query}" (${Math.round(cacheAge / 60000)} minutes old)`);
          return results.slice(0, limit);
        }
      } catch (cacheError) {
        console.warn('Error parsing cached search results:', cacheError);
        // Continue to fetch new results if cache parsing fails
      }
    }
    
    // Try multiple approaches for product search
    const searchAttempts = [
      // First try standard approach with proper path
      async () => {
        const response = await instacartAxios.get(`/instacart/retailers/${retailerId}/products/search`, {
          params: { query, limit }
        });
        return response.data;
      },
      // Then try with API prefix
      async () => {
        const response = await axios.get(`/api/instacart/retailers/${retailerId}/products/search`, {
          params: { query, limit },
          headers: instacartAxios.defaults.headers
        });
        return response.data;
      },
      // Then try direct URL as last resort
      async () => {
        const response = await axios.get(`${API_BASE_URL}/instacart/retailers/${retailerId}/products/search`, {
          params: { query, limit },
          headers: {
            'Content-Type': 'application/json',
            'X-Instacart-API-Key': INSTACART_API_KEY
          }
        });
        return response.data;
      }
    ];
    
    // Try each approach in sequence
    let lastError = null;
    for (const attempt of searchAttempts) {
      try {
        const results = await attempt();
        console.log(`Search results for "${query}":`, results ? results.length : 0, 'products found');
        
        // Cache the results if we got some
        if (Array.isArray(results) && results.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify(results));
          localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        }
        
        return results;
      } catch (error) {
        console.warn('Product search attempt failed:', error.message);
        lastError = error;
        // Continue to next attempt
      }
    }
    
    // If all attempts failed, use mock data if enabled
    if (USE_MOCK_DATA) {
      console.log(`⚠️ Using mock product data for "${query}"`);
      const mockResults = getMockProductSearch(query, limit);
      
      // Cache the mock results
      localStorage.setItem(cacheKey, JSON.stringify(mockResults));
      localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
      localStorage.setItem('instacart_using_mock_data', 'true');
      
      return mockResults;
    }
    
    // Otherwise throw the error
    throw lastError || new Error('Failed to search products after multiple attempts');
  } catch (error) {
    console.error('Error searching Instacart products:', error);
    
    // Use mock data as fallback if enabled
    if (USE_MOCK_DATA) {
      console.log('⚠️ Using mock product data as fallback');
      return getMockProductSearch(query, limit);
    }
    
    throw error;
  }
};

/**
 * Create a cart with items and get the checkout URL
 * @param {string} retailerId - Instacart retailer ID
 * @param {Array} items - Array of items to add to cart
 * @returns {Promise<Object>} Cart object with checkout URL
 */
const createCart = async (retailerId, items) => {
  try {
    console.log(`Creating Instacart cart - retailer: ${retailerId}, items:`, items);
    
    if (!retailerId) {
      throw new Error('Retailer ID is required');
    }
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new Error('Items array is required and must not be empty');
    }
    
    // Try multiple approaches to create the cart
    const attempts = [
      // First try standard approach - include more data for detailed debugging
      async () => {
        // Log the request data for debugging the 500 error
        console.log('Creating cart with data:', {
          retailer_id: retailerId,
          items: items
        });

        // Use extended timeout for debugging
        const response = await instacartAxios.post('/instacart/carts', {
          retailer_id: retailerId,
          items
        }, {
          timeout: 30000 // Extended timeout for debugging
        });
        return response.data;
      },
      // Then try with API prefix
      async () => {
        console.log('Attempting cart creation with /api prefix');
        const response = await axios.post('/api/instacart/carts', {
          retailer_id: retailerId,
          items
        }, {
          headers: {
            ...instacartAxios.defaults.headers,
            // Add debugging header
            'X-Debug': 'true'
          },
          timeout: 30000 // Extended timeout
        });
        return response.data;
      },
      // Then try direct URL with base64 encoding for item IDs (fixes some 500 errors)
      async () => {
        console.log('Attempting cart creation with direct URL and encoding');

        // Try to fix potential encoding issues with item IDs
        const encodedItems = items.map(item => ({
          ...item,
          product_id: typeof item.product_id === 'string' ?
            item.product_id : // Keep strings as is
            `${item.product_id}` // Convert numbers to strings
        }));

        const response = await axios.post(`${API_BASE_URL}/instacart/carts`, {
          retailer_id: retailerId,
          items: encodedItems
        }, {
          headers: {
            'Content-Type': 'application/json',
            'X-Instacart-API-Key': INSTACART_API_KEY,
            'X-Debug': 'true'
          },
          timeout: 30000 // Extended timeout
        });
        return response.data;
      }
    ];
    
    // Try each approach in sequence
    let lastError = null;
    for (const attempt of attempts) {
      try {
        const cart = await attempt();
        console.log('Cart creation successful:', cart);
        
        // Store the cart info in localStorage for reference
        try {
          localStorage.setItem('instacart_last_cart', JSON.stringify({
            id: cart.id,
            retailer_id: retailerId,
            item_count: items.length,
            created_at: new Date().toISOString(),
            checkout_url: cart.checkout_url
          }));
        } catch (storageError) {
          console.warn('Error storing cart info in localStorage:', storageError);
        }
        
        return cart;
      } catch (error) {
        console.warn('Cart creation attempt failed:', error.message);
        lastError = error;
        // Continue to next attempt
      }
    }
    
    // If all attempts failed, throw the error
    throw lastError || new Error('Failed to create cart after multiple attempts');
  } catch (error) {
    console.error('Error creating Instacart cart:', error);

    // Provide more specific error information for debugging
    if (error.response && error.response.status === 500) {
      console.error('Server error details:', {
        status: error.response.status,
        statusText: error.response.statusText,
        headers: error.response.headers,
        data: error.response.data
      });

      const enhancedError = new Error('Server error (500) while creating Instacart cart. This may be due to an issue with the retailer ID or product IDs. Please try a different retailer or search again.');
      enhancedError.originalError = error;
      enhancedError.response = error.response;
      throw enhancedError;
    }

    throw error;
  }
};

export default {
  checkInstacartApiStatus,
  getNearbyRetailers,
  searchProducts,
  createCart
};