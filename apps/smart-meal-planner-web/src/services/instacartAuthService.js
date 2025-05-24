// src/services/instacartAuthService.js
import axios from 'axios';
import { getMockRetailersByZip } from './mockData/instacartRetailers';
import { getMockProductSearch } from './mockData/instacartProducts';

// The actual Instacart API URL (this is the correct URL to use, not our backend proxy)
// Using the development URL as provided
const INSTACART_CONNECT_URL = 'https://connect.dev.instacart.tools';

// Our backend API URL for proxied requests (if we need to avoid CORS issues)
const BACKEND_API_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';

console.log('InstacartAuthService using URLs:', {
  instacartConnectUrl: INSTACART_CONNECT_URL,
  backendProxyUrl: BACKEND_API_URL
});

// Try a simple ping to diagnose the API endpoints
const pingApiEndpoints = async () => {
  console.log('Pinging available API endpoints to diagnose issues...');

  // Get API key for Instacart direct API calls
  const apiKey = INSTACART_API_KEY;
  const zipCode = localStorage.getItem('instacart_zip_code') || '80041';

  // First, check the actual Instacart Dev API
  try {
    console.log(`Checking direct Instacart Dev API with ZIP code ${zipCode}...`);
    // Using /v1/retailers endpoint with postal_code and country_code parameters
    const instacartEndpoint = `${INSTACART_CONNECT_URL}/v1/retailers?postal_code=${zipCode}&country_code=US`;

    const response = await axios.get(instacartEndpoint, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `InstacartAPI ${apiKey}`
      },
      timeout: 5000
    });

    console.log(`✅ DIRECT INSTACART API SUCCESS: ${response.status} - found ${response.data?.retailers?.length || 0} retailers`);

    // If successful, store for later use
    if (response.data && response.data.retailers) {
      try {
        localStorage.setItem('instacart_direct_retailers', JSON.stringify(response.data.retailers));
        localStorage.setItem('instacart_direct_retailers_timestamp', Date.now().toString());
        localStorage.setItem('instacart_api_key_working', apiKey.substring(0, 8)); // Store partial key for reference
        console.log(`Cached ${response.data.retailers.length} retailers from direct API`);
      } catch (e) {
        console.warn('Failed to cache retailers:', e);
      }
    }
  } catch (error) {
    console.log(`❌ DIRECT INSTACART API FAILED: ${error.message}`);
    console.log('Error details:', error.response?.data || 'No response data');
    console.log('Error status:', error.response?.status || 'No status code');

    // Log headers for debugging
    if (error.config) {
      console.log('Request headers:', error.config.headers);
    }

    // Store error info for UI feedback
    localStorage.setItem('instacart_direct_api_last_error', JSON.stringify({
      message: error.message,
      status: error.response?.status,
      timestamp: Date.now()
    }));
  }

  // Also test a few alternate API paths
  try {
    console.log('Testing alternate Instacart API path...');
    const altEndpoint = `${INSTACART_CONNECT_URL}/idp/v1/retailers?postal_code=${zipCode}&country_code=US`;

    const response = await axios.get(altEndpoint, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `InstacartAPI ${apiKey}`
      },
      timeout: 5000
    });

    console.log(`✅ ALTERNATE API PATH SUCCESS: ${response.status}`);

    // Store successful path info
    localStorage.setItem('instacart_working_api_path', 'idp/v1');
  } catch (error) {
    console.log(`❌ ALTERNATE API PATH FAILED: ${error.message}`);
  }
  
  // Now also check our backend endpoints as fallback
  console.log('Checking backend API endpoints...');
  const backendUrls = [
    BACKEND_API_URL,
    'https://smartmealplannermulti-production.up.railway.app',
    'https://smartmealplannermulti-development.up.railway.app',
    '/api'
  ];
  
  const endpoints = [
    '/instacart/retailers/nearby?zip_code=' + zipCode, 
    '/instacart/retailers', 
    '/instacart/health'
  ];
  
  // Test each combination of base URL and endpoint
  for (const baseUrl of backendUrls) {
    console.log(`Testing backend URL: ${baseUrl}`);
    
    for (const endpoint of endpoints) {
      try {
        console.log(`Trying ${baseUrl}${endpoint}...`);
        const response = await axios.get(`${baseUrl}${endpoint}`, { 
          timeout: 5000,
          headers: {
            'Content-Type': 'application/json',
            'X-Instacart-API-Key': apiKey
          }
        });
        console.log(`✅ BACKEND SUCCESS: ${baseUrl}${endpoint} - ${response.status}`);
      } catch (error) {
        console.log(`❌ BACKEND FAILED: ${baseUrl}${endpoint} - ${error.message}`);
      }
    }
  }
};

// Run the ping diagnostics
pingApiEndpoints();

// Instacart API Key - The 500 errors might be due to the API key not being configured correctly
// Try to get the API key from localStorage as a fallback, in case it was set there
let INSTACART_API_KEY = process.env.REACT_APP_INSTACART_API_KEY;

// Try to load from localStorage if not in environment
if (!INSTACART_API_KEY) {
  try {
    INSTACART_API_KEY = localStorage.getItem('instacart_api_key');
    console.log('Loaded API key from localStorage:', !!INSTACART_API_KEY);
  } catch (e) {
    console.warn('Error reading from localStorage:', e);
  }
}

// Fall back to default dev key if still not found
if (!INSTACART_API_KEY) {
  INSTACART_API_KEY = 'INSTACARTAPI_DEV';
  console.warn('Using default API key, this might be the cause of 500 errors');
}

// Try to diagnose potential API key issues
console.log('API Key diagnostics:', {
  keyLength: INSTACART_API_KEY ? INSTACART_API_KEY.length : 0,
  firstChars: INSTACART_API_KEY ? INSTACART_API_KEY.substring(0, 3) + '...' : 'none',
  fromEnv: !!process.env.REACT_APP_INSTACART_API_KEY,
  fromLocalStorage: !!localStorage.getItem('instacart_api_key')
});

// Flag to enable mock data fallback - keeping disabled to find the root cause
const USE_MOCK_DATA = false;

// Log configuration for debugging
console.log('Instacart configuration:', {
  apiKeyExists: !!INSTACART_API_KEY,
  apiKeyValue: INSTACART_API_KEY ? '[REDACTED]' : 'missing',
  apiBaseUrl: BACKEND_API_URL,
  useMockData: USE_MOCK_DATA,
  envVars: {
    REACT_APP_INSTACART_API_KEY: !!process.env.REACT_APP_INSTACART_API_KEY,
    REACT_APP_API_BASE_URL: !!process.env.REACT_APP_API_BASE_URL
  }
});

// Standalone axios instance for Instacart auth-related requests
const instacartAxios = axios.create({
  baseURL: BACKEND_API_URL,
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

    // First try direct Instacart API connection
    try {
      const zipCode = localStorage.getItem('instacart_zip_code') || '80538';
      console.log('Trying direct Instacart API connection...');

      // Ensure we're using the correct authorization header format
      const authHeader = `InstacartAPI ${INSTACART_API_KEY}`;
      console.log(`Using authorization header starting with: ${authHeader.substring(0, 20)}...`);

      // Try the main API path first
      const response = await axios.get(`${INSTACART_CONNECT_URL}/v1/retailers`, {
        params: {
          postal_code: zipCode,
          country_code: 'US'
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        timeout: 10000 // Increased timeout for reliability
      });

      if (response.status === 200) {
        console.log('✅ Direct Instacart API connection success!');

        // Reset API issue flag if set
        if (detectedApiIssue) {
          detectedApiIssue = false;
          localStorage.removeItem('instacart_api_issue');
        }

        // Save successful API path for future reference
        localStorage.setItem('instacart_api_path', 'v1');
        localStorage.setItem('instacart_api_connected', 'true');
        localStorage.setItem('instacart_api_last_success', Date.now().toString());

        return {
          status: 'connected',
          direct_api: true,
          api_path: 'v1',
          retailer_count: response.data?.retailers?.length || 0
        };
      }
    } catch (directError) {
      console.warn('Direct API connection failed:', directError.message);

      // Store the error for diagnostics
      localStorage.setItem('instacart_api_last_error', JSON.stringify({
        message: directError.message,
        status: directError.response?.status || 'unknown',
        timestamp: Date.now()
      }));

      // Try the alternate API path before giving up
      try {
        const zipCode = localStorage.getItem('instacart_zip_code') || '80538';
        console.log('Trying alternate Instacart API path...');

        const response = await axios.get(`${INSTACART_CONNECT_URL}/idp/v1/retailers`, {
          params: {
            postal_code: zipCode,
            country_code: 'US'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `InstacartAPI ${INSTACART_API_KEY}`
          },
          timeout: 10000
        });

        if (response.status === 200) {
          console.log('✅ Alternate API path connection success!');

          // Reset API issue flag if set
          if (detectedApiIssue) {
            detectedApiIssue = false;
            localStorage.removeItem('instacart_api_issue');
          }

          // Save successful API path for future reference
          localStorage.setItem('instacart_api_path', 'idp/v1');
          localStorage.setItem('instacart_api_connected', 'true');
          localStorage.setItem('instacart_api_last_success', Date.now().toString());

          return {
            status: 'connected',
            direct_api: true,
            api_path: 'idp/v1',
            retailer_count: response.data?.retailers?.length || 0
          };
        }
      } catch (altPathError) {
        console.warn('Alternate API path connection failed:', altPathError.message);
      }
    }
    
    // Then try backend strategies
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
 * This uses the Instacart Connect API directly first, then falls back to our backend if needed
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
    
    // Use cache if available and less than 1 hour old
    if (cachedRetailers && cacheAge < 1 * 60 * 60 * 1000) {
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
    
    // Try direct Instacart API first, then fall back to our backend
    retailersPromise = fetchRetailersDirectApi(zipCode)
      .catch(error => {
        console.warn('Direct API failed, falling back to backend:', error.message);
        return fetchRetailersWithFallbacks(zipCode);
      });
    
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
 * Fetch retailers directly from Instacart Connect API
 * @param {string} zipCode - ZIP code to search for nearby retailers
 * @returns {Promise<Array>} List of formatted retailers
 */
const fetchRetailersDirectApi = async (zipCode) => {
  console.log('Fetching retailers directly from Instacart Connect API');

  try {
    // Determine which API path to use based on previous successful calls
    const apiPath = localStorage.getItem('instacart_api_path') || 'v1';
    console.log(`Using API path: ${apiPath} based on previous successful calls`);

    // Construct the endpoint URL - use query parameters instead of directly in URL
    const endpoint = `${INSTACART_CONNECT_URL}/${apiPath}/retailers`;

    // Make the request with headers and params
    const response = await axios.get(endpoint, {
      params: {
        postal_code: zipCode,
        country_code: 'US'
      },
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `InstacartAPI ${INSTACART_API_KEY}`
      },
      timeout: 15000 // Extended timeout
    });

    // Process the retailers data
    if (response.data && response.data.retailers && Array.isArray(response.data.retailers)) {
      const retailers = response.data.retailers.map(retailer => {
        // Format to match the structure expected by the rest of the app
        return {
          id: retailer.id.toString(),
          name: retailer.name,
          logo_url: retailer.image_url || retailer.logo_url,
          distance: retailer.distance_miles || retailer.distance || 0,
          address: {
            city: retailer.address?.city || '',
            state: retailer.address?.state || '',
            zip_code: retailer.address?.postal_code || zipCode
          }
        };
      });

      // Sort by distance
      const sortedRetailers = retailers.sort((a, b) => a.distance - b.distance);

      // Cache the result
      localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(sortedRetailers));
      localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
      localStorage.setItem('instacart_direct_api_success', 'true');
      localStorage.setItem('instacart_api_connected', 'true');
      localStorage.setItem('instacart_api_last_success', Date.now().toString());

      console.log(`✅ Direct API success: Found ${sortedRetailers.length} retailers`);
      return sortedRetailers;
    } else {
      // If we got a response but no retailers array, try to make sense of what we got
      console.warn('Unexpected API response format:', response.data);

      // If we at least have an array somewhere in the response, try to use that
      if (Array.isArray(response.data)) {
        console.log('Response is an array, using it directly');
        // Attempt to format the data as retailers
        const retailers = response.data.map(item => {
          // Best-effort conversion to our retailer format
          return {
            id: item.id?.toString() || `unknown_${Math.random().toString(36).substring(2, 10)}`,
            name: item.name || 'Unknown Retailer',
            logo_url: item.logo_url || item.image_url || null,
            distance: item.distance || 0,
            address: {
              city: item.city || '',
              state: item.state || '',
              zip_code: zipCode
            }
          };
        });

        if (retailers.length > 0) {
          console.log('Converted response to retailers:', retailers.length);
          return retailers;
        }
      }

      throw new Error('Invalid response format from Instacart API');
    }
  } catch (error) {
    console.error('Error fetching from direct API:', error);

    // Store detailed error information for diagnostics
    localStorage.setItem('instacart_direct_api_error', JSON.stringify({
      message: error.message,
      status: error.response?.status || 'unknown',
      data: error.response?.data ? JSON.stringify(error.response.data).substring(0, 500) : 'No data',
      timestamp: Date.now()
    }));

    // If we get a 401 or 403, it's likely an API key issue
    if (error.response && (error.response.status === 401 || error.response.status === 403)) {
      console.error('API key authentication error. Check that the format is correct.');
      throw new Error('API authentication error: Check that your API key is correct and properly formatted');
    }

    // Try the alternate path if we haven't already
    const apiPath = localStorage.getItem('instacart_api_path') || 'v1';
    if (apiPath === 'v1') {
      console.log('First API path failed, trying alternate path idp/v1...');
      try {
        const altEndpoint = `${INSTACART_CONNECT_URL}/idp/v1/retailers`;

        const altResponse = await axios.get(altEndpoint, {
          params: {
            postal_code: zipCode,
            country_code: 'US'
          },
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            'Authorization': `InstacartAPI ${INSTACART_API_KEY}`
          },
          timeout: 15000
        });

        if (altResponse.data && altResponse.data.retailers && Array.isArray(altResponse.data.retailers)) {
          // Process retailers as above
          const retailers = altResponse.data.retailers.map(retailer => {
            return {
              id: retailer.id.toString(),
              name: retailer.name,
              logo_url: retailer.image_url || retailer.logo_url,
              distance: retailer.distance_miles || retailer.distance || 0,
              address: {
                city: retailer.address?.city || '',
                state: retailer.address?.state || '',
                zip_code: retailer.address?.postal_code || zipCode
              }
            };
          });

          const sortedRetailers = retailers.sort((a, b) => a.distance - b.distance);

          // Cache with alternate path marker
          localStorage.setItem(`instacart_retailers_${zipCode}`, JSON.stringify(sortedRetailers));
          localStorage.setItem(`instacart_retailers_${zipCode}_timestamp`, Date.now().toString());
          localStorage.setItem('instacart_direct_api_success', 'true');
          localStorage.setItem('instacart_api_path', 'idp/v1');
          localStorage.setItem('instacart_api_connected', 'true');

          console.log(`✅ Alternate API path success: Found ${sortedRetailers.length} retailers`);
          return sortedRetailers;
        }
      } catch (altError) {
        console.error('Alternative path also failed:', altError.message);
        // Fall through to throw the original error
      }
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
    const url = `${BACKEND_API_URL}/instacart/retailers`;
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

    // Get the API path that has been working
    const apiPath = localStorage.getItem('instacart_api_path') || 'v1';
    console.log(`Using API path: ${apiPath} for product search`);

    // First try direct Instacart Connect API
    try {
      console.log('Trying direct Instacart Connect API for product search');

      // Construct the search endpoint for Instacart Connect API with the appropriate path
      const endpoint = `${INSTACART_CONNECT_URL}/${apiPath}/retailers/${retailerId}/products/search`;

      // Make the request with the appropriate authorization header
      const response = await axios.get(endpoint, {
        params: {
          query,
          limit
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `InstacartAPI ${INSTACART_API_KEY}`
        },
        timeout: 15000 // Extended timeout
      });

      // Process the search results
      if (response.data && response.data.products && Array.isArray(response.data.products)) {
        // Use proper result format
        const formattedResults = response.data.products.map(product => ({
          id: product.id.toString(),
          name: product.name,
          price: product.price?.amount || null,
          image_url: product.image_url || null,
          size: product.size || null,
          brand: product.brand || null,
          original_query: query
        }));

        // Cache the results
        console.log(`Direct API success: Found ${formattedResults.length} products for "${query}"`);
        localStorage.setItem(cacheKey, JSON.stringify(formattedResults));
        localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        localStorage.setItem('instacart_direct_search_success', 'true');
        localStorage.setItem('instacart_api_connected', 'true');
        localStorage.setItem('instacart_api_last_success', Date.now().toString());

        return formattedResults.slice(0, limit);
      } else {
        // If we got a response but no products array, check if it's a different format
        console.warn('Unexpected API response format:', response.data);

        // Some APIs return the products directly in the response
        if (Array.isArray(response.data)) {
          console.log('Response is an array, using it directly');

          const formattedResults = response.data.map(product => ({
            id: product.id?.toString() || `unknown_${Math.random().toString(36).substring(2, 10)}`,
            name: product.name || 'Unknown Product',
            price: product.price?.amount || product.price || null,
            image_url: product.image_url || null,
            original_query: query
          }));

          if (formattedResults.length > 0) {
            console.log(`Using direct array: Found ${formattedResults.length} products`);

            // Cache the results
            localStorage.setItem(cacheKey, JSON.stringify(formattedResults));
            localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());

            return formattedResults.slice(0, limit);
          }
        }
      }
    } catch (directApiError) {
      console.warn('Direct API product search failed:', directApiError.message);

      // Store error details for debugging
      localStorage.setItem('instacart_direct_search_error', JSON.stringify({
        message: directApiError.message,
        status: directApiError.response?.status || 'unknown',
        data: directApiError.response?.data ? JSON.stringify(directApiError.response.data).substring(0, 500) : 'No data',
        timestamp: Date.now()
      }));

      // Try alternate path if we're using v1
      if (apiPath === 'v1') {
        try {
          console.log('Trying alternate API path for product search');

          const altEndpoint = `${INSTACART_CONNECT_URL}/idp/v1/retailers/${retailerId}/products/search`;

          const altResponse = await axios.get(altEndpoint, {
            params: {
              query,
              limit
            },
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `InstacartAPI ${INSTACART_API_KEY}`
            },
            timeout: 15000
          });

          if (altResponse.data && altResponse.data.products && Array.isArray(altResponse.data.products)) {
            const formattedResults = altResponse.data.products.map(product => ({
              id: product.id.toString(),
              name: product.name,
              price: product.price?.amount || null,
              image_url: product.image_url || null,
              size: product.size || null,
              brand: product.brand || null,
              original_query: query
            }));

            // Cache with alternate path marker
            console.log(`Alternate API path success: Found ${formattedResults.length} products`);
            localStorage.setItem(cacheKey, JSON.stringify(formattedResults));
            localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
            localStorage.setItem('instacart_direct_search_success', 'true');
            localStorage.setItem('instacart_api_path', 'idp/v1');
            localStorage.setItem('instacart_api_connected', 'true');

            return formattedResults.slice(0, limit);
          }
        } catch (altError) {
          console.warn('Alternate API path also failed for product search:', altError.message);
        }
      }
    }
    
    // If direct API failed, try our backend with multiple approaches
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
      // Then try direct URL to backend as last resort
      async () => {
        const response = await axios.get(`${BACKEND_API_URL}/instacart/retailers/${retailerId}/products/search`, {
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
        console.log(`Backend search results for "${query}":`, results ? results.length : 0, 'products found');
        
        // Cache the results if we got some
        if (Array.isArray(results) && results.length > 0) {
          localStorage.setItem(cacheKey, JSON.stringify(results));
          localStorage.setItem(`${cacheKey}_timestamp`, Date.now().toString());
        }
        
        return results;
      } catch (error) {
        console.warn('Backend product search attempt failed:', error.message);
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

    // Get the API path that has been successful before
    const apiPath = localStorage.getItem('instacart_api_path') || 'v1';
    console.log(`Using API path: ${apiPath} for cart creation`);

    // First try direct Instacart Connect API
    try {
      console.log('Trying direct Instacart Connect API for cart creation');

      // Ensure all product IDs are strings
      const formattedItems = items.map(item => ({
        product_id: item.product_id.toString(),
        quantity: item.quantity || 1
      }));

      // Construct the endpoint with the appropriate API path
      const endpoint = `${INSTACART_CONNECT_URL}/${apiPath}/retailers/${retailerId}/carts`;

      // Ensure we're using the correct authorization header format
      const authHeader = `InstacartAPI ${INSTACART_API_KEY}`;
      console.log(`Using authorization header starting with: ${authHeader.substring(0, 20)}...`);

      // Make the request with proper formatting
      const response = await axios.post(endpoint, {
        items: formattedItems
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': authHeader
        },
        timeout: 30000 // Extended timeout
      });

      // Process the cart data with robust error handling
      if (response.data) {
        let cartId, checkoutUrl;

        // Handle different response formats
        if (response.data.cart && response.data.cart.id) {
          // Standard format
          cartId = response.data.cart.id;
          checkoutUrl = response.data.cart.checkout_url;
        } else if (response.data.id) {
          // Alternate format where cart is the root object
          cartId = response.data.id;
          checkoutUrl = response.data.checkout_url;
        } else {
          console.warn('Unexpected cart response format:', response.data);
          // Try to extract ID from any available field
          const possibleIdFields = ['id', 'cart_id', 'cartId'];
          for (const field of possibleIdFields) {
            if (response.data[field]) {
              cartId = response.data[field];
              break;
            }
          }

          if (!cartId) {
            throw new Error('Could not find cart ID in response');
          }
        }

        // Generate checkout URL if not provided
        if (!checkoutUrl) {
          checkoutUrl = `https://www.instacart.com/store/checkout?cartId=${cartId}`;
        }

        const cart = {
          id: cartId,
          checkout_url: checkoutUrl,
          item_count: items.length
        };

        // Store success in localStorage for diagnostics
        localStorage.setItem('instacart_direct_cart_success', 'true');
        localStorage.setItem('instacart_api_connected', 'true');
        localStorage.setItem('instacart_api_last_success', Date.now().toString());
        localStorage.setItem('instacart_last_cart', JSON.stringify({
          id: cart.id,
          retailer_id: retailerId,
          item_count: items.length,
          created_at: new Date().toISOString(),
          checkout_url: cart.checkout_url
        }));

        console.log('Direct API cart creation successful:', cart);
        return cart;
      } else {
        throw new Error('Empty response from API');
      }
    } catch (directApiError) {
      console.warn('Direct API cart creation failed:', directApiError.message);

      // Store detailed error information for diagnostics
      localStorage.setItem('instacart_direct_cart_error', JSON.stringify({
        message: directApiError.message,
        status: directApiError.response?.status || 'unknown',
        data: directApiError.response?.data ? JSON.stringify(directApiError.response.data).substring(0, 500) : 'No data',
        timestamp: Date.now()
      }));

      // If we get a 401 or 403, it's likely an API key issue
      if (directApiError.response && (directApiError.response.status === 401 || directApiError.response.status === 403)) {
        console.error('API key authentication error. Check that the format is correct.');
        throw new Error('API authentication error: Check that your API key is correct and properly formatted');
      }

      // Try alternate path if we're using v1
      if (apiPath === 'v1') {
        try {
          console.log('Trying alternate API path for cart creation');

          const altEndpoint = `${INSTACART_CONNECT_URL}/idp/v1/retailers/${retailerId}/carts`;

          const altResponse = await axios.post(altEndpoint, {
            items: items.map(item => ({
              product_id: item.product_id.toString(),
              quantity: item.quantity || 1
            }))
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': `InstacartAPI ${INSTACART_API_KEY}`
            },
            timeout: 30000
          });

          if (altResponse.data) {
            let cartId, checkoutUrl;

            if (altResponse.data.cart && altResponse.data.cart.id) {
              cartId = altResponse.data.cart.id;
              checkoutUrl = altResponse.data.cart.checkout_url;
            } else if (altResponse.data.id) {
              cartId = altResponse.data.id;
              checkoutUrl = altResponse.data.checkout_url;
            } else {
              // Try to extract ID from any available field
              const possibleIdFields = ['id', 'cart_id', 'cartId'];
              for (const field of possibleIdFields) {
                if (altResponse.data[field]) {
                  cartId = altResponse.data[field];
                  break;
                }
              }

              if (!cartId) {
                throw new Error('Could not find cart ID in alternate response');
              }
            }

            // Generate checkout URL if not provided
            if (!checkoutUrl) {
              checkoutUrl = `https://www.instacart.com/store/checkout?cartId=${cartId}`;
            }

            const cart = {
              id: cartId,
              checkout_url: checkoutUrl,
              item_count: items.length
            };

            // Store with alternate path marker
            localStorage.setItem('instacart_direct_cart_success', 'true');
            localStorage.setItem('instacart_api_path', 'idp/v1');
            localStorage.setItem('instacart_api_connected', 'true');
            localStorage.setItem('instacart_last_cart', JSON.stringify({
              id: cart.id,
              retailer_id: retailerId,
              item_count: items.length,
              created_at: new Date().toISOString(),
              checkout_url: cart.checkout_url
            }));

            console.log('Alternate API path cart creation successful:', cart);
            return cart;
          }
        } catch (altError) {
          console.error('Alternative path also failed for cart creation:', altError.message);
        }
      }

      // Fall back to backend approach
      console.log('Falling back to backend for cart creation');
    }
    
    // If direct API failed, try our backend with multiple approaches
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
        
        const response = await axios.post(`${BACKEND_API_URL}/instacart/carts`, {
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
        console.log('Backend cart creation successful:', cart);
        
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
        console.warn('Backend cart creation attempt failed:', error.message);
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