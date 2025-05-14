const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Get API key from command line argument or environment variable
const apiKey = process.argv[2] || process.env.INSTACART_API_KEY;

if (!apiKey) {
  console.error('Please provide an API key as a command line argument or set INSTACART_API_KEY environment variable');
  console.error('Usage: node instacart-cors-proxy.js YOUR_API_KEY');
  process.exit(1);
}

const app = express();
const port = process.env.PORT || 3005;
const INSTACART_API = 'https://connect.dev.instacart.tools';

// Enable CORS for all routes
app.use(cors());

// Simple status endpoint
app.get('/status', (req, res) => {
  res.json({ status: 'ok', message: 'Instacart CORS proxy is running' });
});

// Create a simple HTML test page
const testHtml = `
<!DOCTYPE html>
<html>
<head>
  <title>Instacart API Test</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    pre { background: #f4f4f4; padding: 10px; overflow: auto; max-height: 400px; }
    button { padding: 8px 16px; margin-right: 10px; cursor: pointer; }
    input { padding: 8px; width: 300px; }
    .result { margin-top: 20px; }
    .error { color: red; }
    .success { color: green; }
  </style>
</head>
<body>
  <h1>Instacart API Test</h1>
  <p>This page tests the connection to the Instacart API through the local proxy.</p>
  
  <div>
    <label for="zipCode">Zip Code:</label>
    <input type="text" id="zipCode" value="80538" />
  </div>
  
  <div style="margin-top: 20px;">
    <button onclick="testEndpoint('/v1/retailers')">Test /v1/retailers</button>
    <button onclick="testEndpoint('/idp/v1/retailers')">Test /idp/v1/retailers</button>
    <button onclick="testEndpoint('/v1/health')">Test Health Endpoint</button>
  </div>
  
  <div id="result" class="result"></div>
  
  <script>
    async function testEndpoint(endpoint) {
      const resultDiv = document.getElementById('result');
      const zipCode = document.getElementById('zipCode').value;
      
      resultDiv.innerHTML = '<p>Testing...</p>';
      resultDiv.className = 'result';
      
      try {
        let url = '/proxy' + endpoint;
        
        // Add zip code param for retailers endpoints
        if (endpoint.includes('retailers')) {
          url += '?postal_code=' + zipCode + '&country_code=US';
        }
        
        console.log('Testing:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        resultDiv.innerHTML = '<p class="success">Success! Status: ' + response.status + '</p>' +
                             '<pre>' + JSON.stringify(data, null, 2) + '</pre>';
      } catch (error) {
        console.error('Error:', error);
        resultDiv.innerHTML = '<p class="error">Error: ' + error.message + '</p>';
        resultDiv.className = 'result error';
      }
    }
  </script>
</body>
</html>
`;

// Serve the test page
app.get('/test.html', (req, res) => {
  res.send(testHtml);
});

// Proxy all requests to Instacart API
app.get('/proxy/*', async (req, res) => {
  try {
    // Extract the path and query parameters
    const pathPart = req.params[0];
    const queryString = new URLSearchParams(req.query).toString();
    const url = `${INSTACART_API}/${pathPart}${queryString ? '?' + queryString : ''}`;
    
    console.log(`Proxying request to: ${url}`);
    
    // Make request to Instacart API
    const response = await axios.get(url, {
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `InstacartAPI ${apiKey}`
      }
    });
    
    // Return the response data
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying to Instacart API:', error.message);
    
    // Return error response with original status code
    if (error.response) {
      res.status(error.response.status).json({
        error: true,
        status: error.response.status,
        statusText: error.response.statusText,
        message: error.message,
        data: error.response.data
      });
    } else {
      res.status(500).json({
        error: true,
        message: error.message
      });
    }
  }
});

// Start the server
app.listen(port, () => {
  console.log(`
===============================================
  Instacart CORS Proxy Running!
  
  Proxy URL: http://localhost:${port}/proxy
  Test page: http://localhost:${port}/test.html
  
  API Key: ${apiKey.slice(0, 4)}...${apiKey.slice(-4)}
===============================================
  `);
});