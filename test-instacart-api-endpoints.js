/**
 * Instacart API Endpoint Tester
 * 
 * This script directly tests the Instacart API endpoints on the backend server.
 * Run this with Node.js to check if the endpoints are available and working.
 */

const axios = require('axios');
const https = require('https');

// Configure the backend base URL
const BACKEND_URL = 'https://smartmealplannermulti-development.up.railway.app';

// Create an Axios instance with longer timeout and SSL verification disabled
const apiClient = axios.create({
  baseURL: BACKEND_URL,
  timeout: 30000,
  httpsAgent: new https.Agent({
    rejectUnauthorized: false // Ignore SSL certificate errors - only for testing!
  })
});

// Array of endpoints to test
const endpoints = [
  { 
    name: 'API Status', 
    method: 'GET', 
    path: '/instacart/status',
    description: 'Checks if the Instacart API is properly configured and accessible'
  },
  { 
    name: 'API Key Info', 
    method: 'GET', 
    path: '/instacart/key-info',
    description: 'Gets detailed information about the API key configuration'
  },
  { 
    name: 'API Environment', 
    method: 'GET', 
    path: '/instacart/environment',
    description: 'Gets information about the environment configuration'
  },
  { 
    name: 'Get Retailers', 
    method: 'GET', 
    path: '/instacart/retailers',
    description: 'Gets a list of available retailers on Instacart'
  },
  { 
    name: 'Get Nearby Retailers', 
    method: 'GET', 
    path: '/instacart/retailers/nearby?zip_code=80538',
    description: 'Gets a list of retailers near a specified ZIP code'
  }
];

// Test a single endpoint
async function testEndpoint(endpoint) {
  console.log(`\n🧪 Testing: ${endpoint.name} (${endpoint.method} ${endpoint.path})`);
  console.log(`📝 Description: ${endpoint.description}`);
  
  try {
    const startTime = Date.now();
    const response = await apiClient.request({
      method: endpoint.method,
      url: endpoint.path,
      validateStatus: () => true // Accept any status code
    });
    const duration = Date.now() - startTime;
    
    console.log(`⏱️ Response time: ${duration}ms`);
    console.log(`🔢 Status code: ${response.status} (${response.statusText})`);
    
    if (response.status >= 200 && response.status < 300) {
      console.log('✅ SUCCESS: Endpoint is available');
      
      // Print a sample of the response data
      if (response.data) {
        const dataStr = JSON.stringify(response.data, null, 2);
        console.log(`📊 Response preview: ${dataStr.length > 500 ? dataStr.substring(0, 500) + '...' : dataStr}`);
      }
    } else {
      console.log(`❌ FAILED: Endpoint returned error status ${response.status}`);
      
      if (response.data) {
        console.log('🔍 Error details:');
        console.log(JSON.stringify(response.data, null, 2));
      }
    }
    
    return {
      success: response.status >= 200 && response.status < 300,
      status: response.status,
      data: response.data,
      duration
    };
  } catch (error) {
    console.log('❌ ERROR: Failed to connect to endpoint');
    console.log(`🔍 Error message: ${error.message}`);
    
    if (error.response) {
      console.log(`🔢 Status code: ${error.response.status}`);
      if (error.response.data) {
        console.log('🔍 Error details:');
        console.log(JSON.stringify(error.response.data, null, 2));
      }
    }
    
    return {
      success: false,
      error: error.message,
      response: error.response
    };
  }
}

// Test all endpoints
async function testAllEndpoints() {
  console.log('========================================');
  console.log('🔄 INSTACART API ENDPOINT TESTER');
  console.log('========================================');
  console.log(`🌐 Testing against: ${BACKEND_URL}`);
  console.log('📅 Test time:', new Date().toLocaleString());
  console.log('========================================');
  
  let results = [];
  
  for (const endpoint of endpoints) {
    const result = await testEndpoint(endpoint);
    results.push({
      endpoint,
      result
    });
  }
  
  // Print summary
  console.log('\n========================================');
  console.log('📊 TEST SUMMARY');
  console.log('========================================');
  
  const successCount = results.filter(r => r.result.success).length;
  console.log(`✅ Successful: ${successCount}/${endpoints.length}`);
  console.log(`❌ Failed: ${endpoints.length - successCount}/${endpoints.length}`);
  
  if (successCount === 0) {
    console.log('\n⚠️  ALL TESTS FAILED');
    console.log('This suggests the backend server might not be accessible or the Instacart endpoints are not implemented yet.');
    console.log('\nPossible reasons:');
    console.log('1. The backend server is down or not accessible');
    console.log('2. The endpoints have not been deployed to the production server');
    console.log('3. The API routes are registered with different paths');
    console.log('4. There might be authentication issues with the API');
  } else if (successCount < endpoints.length) {
    console.log('\n⚠️  SOME TESTS FAILED');
    console.log('This suggests some endpoints are available but others are not.');
  } else {
    console.log('\n🎉 ALL TESTS PASSED');
    console.log('The Instacart API endpoints are available and working correctly.');
  }
  
  return results;
}

// Run the tests
testAllEndpoints()
  .then(() => {
    console.log('\n========================================');
    console.log('✅ Test run completed');
    console.log('========================================');
  })
  .catch(error => {
    console.error('❌ ERROR: Test run failed:', error);
  });