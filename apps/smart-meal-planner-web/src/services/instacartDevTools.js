/**
 * Instacart Development Tools
 * 
 * Utility functions for debugging Instacart API integration
 * Only to be used during development, not in production
 */

import axios from 'axios';

// Create a dedicated instance for testing API key configuration
const testInstance = axios.create({
  timeout: 10000, // 10 seconds
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }
});

/**
 * Test if the Instacart API key is configured correctly
 * 
 * @param {string} baseUrl - The base URL of the API server
 * @returns {Promise<Object>} - Test results object with status and details
 */
export const testApiKeyConfig = async (baseUrl) => {
  try {
    console.log('Testing Instacart API key configuration at:', baseUrl);
    
    // Make a request to check the API key configuration
    const response = await testInstance.get(`${baseUrl}/instacart/config/test`);
    
    return {
      success: true,
      details: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error testing Instacart API key:', error);
    
    return {
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null,
      status: error.response ? error.response.status : null,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Get the API environment information
 * 
 * @param {string} baseUrl - The base URL of the API server
 * @returns {Promise<Object>} - Environment info or error
 */
export const getApiEnvironmentInfo = async (baseUrl) => {
  try {
    console.log('Getting API environment info from:', baseUrl);
    
    // Request environment information (safely)
    const response = await testInstance.get(`${baseUrl}/instacart/environment`);
    
    return {
      success: true,
      environment: response.data,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('Error getting environment info:', error);
    
    return {
      success: false,
      error: error.message,
      details: error.response ? error.response.data : null,
      timestamp: new Date().toISOString()
    };
  }
};

/**
 * Check if a specific backend endpoint exists
 * Used to verify API routes without requiring authentication
 * 
 * @param {string} baseUrl - The base URL of the API server
 * @param {string} endpoint - The endpoint path to check
 * @returns {Promise<Object>} - Result with endpoint status
 */
export const checkEndpointExists = async (baseUrl, endpoint) => {
  try {
    console.log(`Checking if endpoint exists: ${baseUrl}${endpoint}`);
    
    // Use HEAD request to check if endpoint exists without fetching data
    const response = await testInstance.head(`${baseUrl}${endpoint}`);
    
    return {
      success: true,
      exists: true,
      status: response.status,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    // 404 means endpoint doesn't exist, but request was processed
    if (error.response && error.response.status === 404) {
      return {
        success: true,
        exists: false,
        status: 404,
        timestamp: new Date().toISOString()
      };
    }
    
    // Any other error is a connection/server issue
    return {
      success: false,
      error: error.message,
      status: error.response ? error.response.status : null,
      timestamp: new Date().toISOString()
    };
  }
};

export default {
  testApiKeyConfig,
  getApiEnvironmentInfo,
  checkEndpointExists
};