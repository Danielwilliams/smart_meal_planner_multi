/**
 * Simple Instacart API Test Script
 * 
 * Run this with Node.js to test the Instacart API directly:
 * node test-instacart-api.js YOUR_API_KEY
 */

const https = require('https');

// Get API key from command line
const apiKey = process.argv[2];
if (!apiKey) {
  console.error('❌ ERROR: Please provide an API key as a command line argument');
  console.log('Usage: node test-instacart-api.js YOUR_API_KEY');
  process.exit(1);
}

// Constants
const INSTACART_CONNECT_URL = 'connect.dev.instacart.tools';
const ZIP_CODE = '80538';
const COUNTRY_CODE = 'US';
const API_PATH = '/v1/retailers'; // Also try '/idp/v1/retailers' if this fails

// Options for the HTTPS request
const options = {
  hostname: INSTACART_CONNECT_URL,
  path: `${API_PATH}?postal_code=${ZIP_CODE}&country_code=${COUNTRY_CODE}`,
  method: 'GET',
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Authorization': `InstacartAPI ${apiKey}`
  }
};

console.log('\n🔍 TESTING INSTACART API CONNECTION');
console.log('==================================');
console.log(`API Key (first 3 chars): ${apiKey.substring(0, 3)}...`);
console.log(`Endpoint: https://${INSTACART_CONNECT_URL}${options.path}`);
console.log(`Using Authorization Header: InstacartAPI ${apiKey.substring(0, 3)}...`);
console.log('==================================\n');

const req = https.request(options, (res) => {
  console.log(`🔄 STATUS CODE: ${res.statusCode}`);
  console.log(`🔄 HEADERS: ${JSON.stringify(res.headers)}\n`);
  
  let data = '';
  
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    if (res.statusCode === 200) {
      console.log('✅ SUCCESS! API connection works!');
      try {
        const parsedData = JSON.parse(data);
        const retailers = parsedData.retailers || [];
        console.log(`Found ${retailers.length} retailers near ${ZIP_CODE}`);
        
        if (retailers.length > 0) {
          console.log('\nSample retailers:');
          retailers.slice(0, 3).forEach(retailer => {
            console.log(`- ${retailer.name} (ID: ${retailer.id})`);
          });
        }
      } catch (e) {
        console.log('⚠️ Warning: Could not parse response JSON');
        console.log('Raw response:', data.substring(0, 500) + '...');
      }
    } else {
      console.log('❌ API request failed');
      console.log('Response body:');
      console.log(data);
      
      // Provide troubleshooting guidance based on status code
      if (res.statusCode === 401) {
        console.log('\n🔧 TROUBLESHOOTING: Authentication failed (401)');
        console.log('Your API key may be invalid or the authorization format is incorrect');
        console.log('Make sure your authorization header is exactly: "Authorization: InstacartAPI YOUR_KEY"');
      } else if (res.statusCode === 403) {
        console.log('\n🔧 TROUBLESHOOTING: Authorization denied (403)');
        console.log('Your API key does not have permission to access this resource');
      } else if (res.statusCode === 404) {
        console.log('\n🔧 TROUBLESHOOTING: Endpoint not found (404)');
        console.log('Try the alternate endpoint path: /idp/v1/retailers');
        console.log('Run: node test-instacart-api.js YOUR_API_KEY idp');
      } else if (res.statusCode === 500) {
        console.log('\n🔧 TROUBLESHOOTING: Server error (500)');
        console.log('The Instacart API server encountered an internal error');
        console.log('This could be due to:');
        console.log('1. Malformed request data');
        console.log('2. Server-side issues');
        console.log('3. Temporary service disruption');
        console.log('\nTry the alternate endpoint path: /idp/v1/retailers');
      }
    }
  });
});

req.on('error', (e) => {
  console.error('❌ ERROR making request:', e.message);
  console.log('\n🔧 TROUBLESHOOTING:');
  console.log('1. Check your internet connection');
  console.log('2. Verify that the hostname is correct');
  console.log('3. Try using a VPN if your network blocks outgoing HTTPS requests');
  console.log('4. Ensure you have Node.js version 12 or higher');
});

// End the request
req.end();

// If argument 'idp' is provided, also test the alternative API path
if (process.argv[3] === 'idp') {
  setTimeout(() => {
    console.log('\n\n🔍 TESTING ALTERNATE API PATH (idp/v1)');
    console.log('=======================================');
    
    const altOptions = {...options};
    altOptions.path = `/idp/v1/retailers?postal_code=${ZIP_CODE}&country_code=${COUNTRY_CODE}`;
    
    console.log(`Endpoint: https://${INSTACART_CONNECT_URL}${altOptions.path}`);
    console.log('=======================================\n');
    
    const altReq = https.request(altOptions, (res) => {
      console.log(`🔄 STATUS CODE: ${res.statusCode}`);
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        if (res.statusCode === 200) {
          console.log('✅ SUCCESS! Alternate API path works!');
          try {
            const parsedData = JSON.parse(data);
            const retailers = parsedData.retailers || [];
            console.log(`Found ${retailers.length} retailers near ${ZIP_CODE}`);
          } catch (e) {
            console.log('⚠️ Warning: Could not parse response JSON');
          }
        } else {
          console.log('❌ Alternate API path request failed');
          console.log('Response body:');
          console.log(data);
        }
      });
    });
    
    altReq.on('error', (e) => {
      console.error('❌ ERROR making request to alternate path:', e.message);
    });
    
    altReq.end();
  }, 1000);
}