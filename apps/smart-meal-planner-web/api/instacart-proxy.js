/**
 * Instacart API Proxy
 * 
 * This serverless function allows the frontend to access the Railway backend
 * without encountering CORS issues.
 * 
 * To use this:
 * 1. Deploy it to Vercel (it will be available at /api/instacart-proxy)
 * 2. Update the frontend to use /api/proxy/instacart/... endpoints instead of /instacart/...
 */

const fetch = require('node-fetch');

// Railway backend URL (update this to your actual backend URL)
const RAILWAY_BACKEND_URL = 'https://smartmealplannermulti-development.up.railway.app';

/**
 * Proxy handler for Instacart API requests
 */
module.exports = async (req, res) => {
  // CORS headers to allow the frontend to access this proxy
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'X-Requested-With,content-type,Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract the Instacart endpoint path from the request
    // Example: /api/proxy/instacart/status -> /instacart/status
    const urlPath = req.url.replace(/^\/api\/proxy/, '');
    const targetUrl = `${RAILWAY_BACKEND_URL}${urlPath}`;
    
    console.log(`Proxying request to: ${targetUrl}`);
    
    // Forward the request to the backend
    const fetchOptions = {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      }
    };
    
    // Forward the request body for POST/PUT methods
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
      fetchOptions.body = JSON.stringify(req.body);
    }
    
    // Make the request to the backend
    const response = await fetch(targetUrl, fetchOptions);
    const data = await response.json();
    
    // Return the backend response to the frontend
    return res.status(response.status).json(data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      error: 'Proxy error',
      message: error.message
    });
  }
};