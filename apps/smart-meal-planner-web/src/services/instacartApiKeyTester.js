/**
 * Instacart API Key Tester
 * 
 * This utility helps verify that your API key and authorization headers are formatted correctly
 * for the Instacart Connect API.
 * 
 * IMPORTANT: This file is for testing purposes only and should not be included in production.
 */

import axios from 'axios';

// Constants
const INSTACART_CONNECT_URL = 'https://connect.dev.instacart.tools';

/**
 * Tests an Instacart API key by making a request to the retailers endpoint
 * @param {string} apiKey - The Instacart Connect API key to test
 * @param {string} zipCode - ZIP code to use for the test (optional, defaults to 80538)
 * @returns {Promise<Object>} Test results with success/failure and details
 */
export const testApiKey = async (apiKey, zipCode = '80538') => {
  if (!apiKey) {
    return {
      success: false,
      error: 'No API key provided',
      details: 'Please provide an API key to test'
    };
  }

  console.log(`Testing Instacart API key (first 3 chars: ${apiKey.substring(0, 3)}...)`);

  // Results object
  const results = {
    timestamp: new Date().toISOString(),
    apiKey: {
      length: apiKey.length,
      prefix: apiKey.substring(0, 3),
      masked: `${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}`,
    },
    authHeader: {},
    requests: []
  };

  // Test different authorization header formats
  const headerFormats = [
    {
      name: 'Standard Format',
      header: `InstacartAPI ${apiKey}`,
      description: 'The recommended format: "InstacartAPI" followed by a space, then the key'
    },
    {
      name: 'Bearer Format',
      header: `Bearer ${apiKey}`,
      description: 'Common but incorrect format for Instacart API'
    },
    {
      name: 'No Prefix Format',
      header: apiKey,
      description: 'API key without any prefix'
    }
  ];

  // Test each header format
  for (const format of headerFormats) {
    try {
      console.log(`Testing authorization header format: ${format.name}`);
      
      const response = await axios.get(`${INSTACART_CONNECT_URL}/v1/retailers`, {
        params: {
          postal_code: zipCode,
          country_code: 'US'
        },
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': format.header
        },
        timeout: 10000 // 10 seconds timeout
      });

      results.requests.push({
        format: format.name,
        header: format.header.replace(apiKey, '[API_KEY]'),
        success: true,
        status: response.status,
        data: {
          retailerCount: response.data?.retailers?.length || 0,
          hasRetailersArray: !!response.data?.retailers,
        }
      });

      // If this format worked, mark it as the working format
      results.authHeader.workingFormat = format.name;
      results.authHeader.exampleHeader = format.header.replace(apiKey, '[YOUR_API_KEY]');
      results.success = true;
      
      // No need to try other formats if this one worked
      break;
    } catch (error) {
      console.error(`Error with ${format.name}:`, error.message);
      
      results.requests.push({
        format: format.name,
        header: format.header.replace(apiKey, '[API_KEY]'),
        success: false,
        error: error.message,
        status: error.response?.status,
        data: error.response?.data
      });
    }
  }

  // Check if any format succeeded
  if (!results.authHeader.workingFormat) {
    results.success = false;
    results.error = 'No authorization header format worked with this API key';
    
    // Try to determine the most likely issue
    const authErrors = results.requests.filter(r => r.status === 401 || r.status === 403);
    const networkErrors = results.requests.filter(r => !r.status);
    const serverErrors = results.requests.filter(r => r.status >= 500);
    
    if (authErrors.length === headerFormats.length) {
      results.errorType = 'authentication';
      results.errorDetails = 'API key appears to be invalid or unauthorized';
    } else if (networkErrors.length === headerFormats.length) {
      results.errorType = 'network';
      results.errorDetails = 'Could not connect to Instacart API - check network connectivity';
    } else if (serverErrors.length === headerFormats.length) {
      results.errorType = 'server';
      results.errorDetails = 'Instacart API servers are experiencing issues';
    } else {
      results.errorType = 'mixed';
      results.errorDetails = 'Multiple types of errors occurred';
    }
  }

  return results;
};

/**
 * Extracts the recommended authorization header format from test results
 * @param {Object} testResults - Results from testApiKey function
 * @returns {string} Recommended header format or error message
 */
export const getRecommendedHeaderFormat = (testResults) => {
  if (!testResults) {
    return 'No test results available';
  }
  
  if (testResults.success && testResults.authHeader.workingFormat) {
    return `Use this header format: Authorization: ${testResults.authHeader.exampleHeader}`;
  }
  
  // If no format worked, recommend the standard format anyway
  return 'Recommended format: Authorization: InstacartAPI YOUR_API_KEY';
};

export default {
  testApiKey,
  getRecommendedHeaderFormat
};