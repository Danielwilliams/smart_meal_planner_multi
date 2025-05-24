const https = require('https');

// Get API key from command line argument
const apiKey = process.argv[2];
const zipCode = process.argv[3] || '80538';

if (!apiKey) {
  console.error('Please provide an API key as a command line argument');
  console.error('Usage: node test-instacart-api.js YOUR_API_KEY [ZIP_CODE]');
  process.exit(1);
}

// Common options for all requests
const getOptions = (path) => ({
  hostname: 'connect.dev.instacart.tools',
  port: 443,
  path,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `InstacartAPI ${apiKey}`
  }
});

// Function to make a request and return a promise
const makeRequest = (options) => {
  return new Promise((resolve, reject) => {
    const req = https.request(options, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        try {
          const jsonData = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            statusMessage: res.statusMessage,
            headers: res.headers,
            data: jsonData
          });
        } catch (error) {
          reject({
            error: true,
            message: 'Failed to parse JSON response',
            rawData: data,
            details: error.message
          });
        }
      });
    });
    
    req.on('error', (error) => {
      reject({
        error: true,
        message: error.message
      });
    });
    
    req.end();
  });
};

// Function to test an endpoint
const testEndpoint = async (path, description) => {
  console.log(`\n===== Testing ${description} =====`);
  console.log(`Path: ${path}`);
  
  try {
    const response = await makeRequest(getOptions(path));
    
    console.log(`Status: ${response.status} ${response.statusMessage}`);
    
    if (response.status >= 200 && response.status < 300) {
      console.log('SUCCESS! Response data:');
      console.log(JSON.stringify(response.data, null, 2));
    } else {
      console.log('ERROR! Response data:');
      console.log(JSON.stringify(response.data, null, 2));
    }
    
    return response.status >= 200 && response.status < 300;
  } catch (error) {
    console.log('ERROR!');
    console.log(error);
    return false;
  }
};

// Main function to run all tests
const runTests = async () => {
  console.log('\n=============================================');
  console.log(' Instacart API Connection Test');
  console.log(` API Key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}`);
  console.log(` Zip Code: ${zipCode}`);
  console.log('=============================================\n');
  
  let successCount = 0;
  let totalTests = 0;
  
  // Test health endpoint
  totalTests++;
  if (await testEndpoint('/v1/health', 'health endpoint')) {
    successCount++;
  }
  
  // Test v1/retailers endpoint
  totalTests++;
  if (await testEndpoint(`/v1/retailers?postal_code=${zipCode}&country_code=US`, 'v1/retailers endpoint')) {
    successCount++;
  }
  
  // Test idp/v1/retailers endpoint
  totalTests++;
  if (await testEndpoint(`/idp/v1/retailers?postal_code=${zipCode}&country_code=US`, 'idp/v1/retailers endpoint')) {
    successCount++;
  }
  
  // Print summary
  console.log('\n=============================================');
  console.log(` Test Summary: ${successCount}/${totalTests} tests passed`);
  console.log('=============================================\n');
  
  // Analysis and guidance
  console.log('ANALYSIS:');
  if (successCount === 0) {
    console.log('- All tests failed. This likely indicates an invalid API key or API access issue.');
    console.log('- Check if your API key is correct and has the proper permissions.');
  } else if (successCount < totalTests) {
    console.log('- Some tests passed while others failed.');
    console.log('- Your API key works but may not have access to all endpoints.');
    console.log('- Use the endpoints that succeeded in your application.');
  } else {
    console.log('- All tests passed! Your API key works correctly with all tested endpoints.');
  }
  
  console.log('\nRECOMMENDATION:');
  if (await testEndpoint(`/v1/retailers?postal_code=${zipCode}&country_code=US`, 'v1/retailers endpoint')) {
    console.log('- Use the /v1/ path for your API calls.');
  } else if (await testEndpoint(`/idp/v1/retailers?postal_code=${zipCode}&country_code=US`, 'idp/v1/retailers endpoint')) {
    console.log('- Use the /idp/v1/ path for your API calls.');
  } else {
    console.log('- Neither retailer endpoint worked. Contact Instacart support for assistance.');
  }
};

// Run the tests
runTests().catch(error => {
  console.error('Unexpected error:', error);
});