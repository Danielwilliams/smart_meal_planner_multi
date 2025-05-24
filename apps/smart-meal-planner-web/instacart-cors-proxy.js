/**
 * Simple CORS Proxy for Instacart API Testing
 * 
 * This proxy allows you to test the Instacart API from a browser by bypassing CORS restrictions.
 * 
 * Usage:
 * 1. Run this script with Node.js: node instacart-cors-proxy.js YOUR_API_KEY
 * 2. Open your browser to http://localhost:3005/test.html
 * 
 * Requirements:
 * npm install express cors axios
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const path = require('path');
const fs = require('fs');

// Get API key from command line argument
const apiKey = process.argv[2];
if (!apiKey) {
  console.error('❌ ERROR: API key is required');
  console.log('Usage: node instacart-cors-proxy.js YOUR_API_KEY');
  process.exit(1);
}

// Create Express app
const app = express();
const PORT = 3005;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(express.json());

// Target Instacart API
const INSTACART_API = 'https://connect.dev.instacart.tools';

// Create a simple HTML test page
const testHtml = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Instacart API Tester</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; }
    .form-group { margin-bottom: 15px; }
    label { display: block; margin-bottom: 5px; font-weight: bold; }
    input, select { width: 100%; padding: 8px; box-sizing: border-box; }
    button { padding: 10px 15px; background: #4CAF50; color: white; border: none; cursor: pointer; }
    button:hover { background: #45a049; }
    pre { background: #f5f5f5; padding: 15px; overflow: auto; border-radius: 4px; }
    .error { color: red; }
    .success { color: green; }
    .loading { opacity: 0.5; }
  </style>
</head>
<body>
  <h1>Instacart API Tester</h1>
  <p>This page helps test the Instacart API through a local CORS proxy.</p>
  
  <div class="form-group">
    <label for="zipCode">ZIP Code:</label>
    <input type="text" id="zipCode" value="80538" />
  </div>
  
  <div class="form-group">
    <label for="endpoint">API Endpoint:</label>
    <select id="endpoint">
      <option value="/v1/retailers">Get Retailers (v1)</option>
      <option value="/idp/v1/retailers">Get Retailers (idp/v1)</option>
    </select>
  </div>
  
  <div class="form-group">
    <button id="testBtn">Test API</button>
  </div>
  
  <h2>Results:</h2>
  <div id="status"></div>
  <pre id="results"></pre>
  
  <script>
    const statusEl = document.getElementById('status');
    const resultsEl = document.getElementById('results');
    const testBtn = document.getElementById('testBtn');
    
    testBtn.addEventListener('click', async () => {
      const zipCode = document.getElementById('zipCode').value;
      const endpoint = document.getElementById('endpoint').value;
      
      statusEl.innerHTML = '<p>Testing API...</p>';
      statusEl.className = 'loading';
      resultsEl.textContent = '';
      testBtn.disabled = true;
      
      try {
        const response = await fetch(\`/proxy\${endpoint}?postal_code=\${zipCode}&country_code=US\`);
        const data = await response.json();
        
        if (response.ok) {
          statusEl.innerHTML = \`<p class="success">✅ Success! Status: \${response.status}</p>\`;
          
          // Count retailers
          const retailers = data.retailers || [];
          statusEl.innerHTML += \`<p>Found \${retailers.length} retailers near \${zipCode}</p>\`;
          
          // Display sample retailers
          if (retailers.length > 0) {
            let retailerHtml = '<ul>';
            retailers.slice(0, 5).forEach(r => {
              retailerHtml += \`<li>\${r.name} (ID: \${r.id})</li>\`;
            });
            retailerHtml += '</ul>';
            statusEl.innerHTML += retailerHtml;
          }
        } else {
          statusEl.innerHTML = \`<p class="error">❌ Error! Status: \${response.status}</p>\`;
        }
        
        resultsEl.textContent = JSON.stringify(data, null, 2);
      } catch (err) {
        statusEl.innerHTML = \`<p class="error">❌ Error: \${err.message}</p>\`;
        resultsEl.textContent = err.toString();
      } finally {
        statusEl.className = '';
        testBtn.disabled = false;
      }
    });
  </script>
</body>
</html>
`;

// Write the test HTML file
fs.writeFileSync(path.join(__dirname, 'test.html'), testHtml);

// Proxy endpoint
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
    console.log(`Success! Status: ${response.status}`);
    res.json(response.data);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    
    // Forward error response
    if (error.response) {
      console.error(`Status: ${error.response.status}`);
      console.error(`Data:`, error.response.data);
      
      res.status(error.response.status).json({
        error: error.message,
        details: error.response.data,
        status: error.response.status
      });
    } else {
      res.status(500).json({
        error: error.message,
        details: 'No response from Instacart API'
      });
    }
  }
});

// Serve the test HTML page
app.get('/test.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'test.html'));
});

// Start the server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════════════════╗
║               INSTACART API CORS PROXY             ║
╚════════════════════════════════════════════════════╝

✅ Server running at http://localhost:${PORT}/test.html
  - Using API key: ${apiKey.substring(0, 3)}...${apiKey.substring(apiKey.length - 3)}
  - Proxying to: ${INSTACART_API}
  
👉 To test the API:
  1. Open your browser to http://localhost:${PORT}/test.html
  2. Enter a ZIP code and select an endpoint
  3. Click "Test API"
  
⚠️ Important: Keep this terminal window open while testing
`);
});