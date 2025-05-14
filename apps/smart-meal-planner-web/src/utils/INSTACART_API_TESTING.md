# Instacart API Testing Tools

This directory contains several tools to test and troubleshoot Instacart API connectivity.

## 1. In-Browser Testing Component

We've added a React component for in-browser testing at:
- `/debug/instacart-test` route

This component allows you to:
- Test different Instacart API endpoints
- Enter your API key securely
- See detailed error information
- Check both `/v1` and `/idp/v1` endpoints

**Note:** When using this in-browser tool, you may encounter CORS errors. This is expected and normal when making direct API calls from a browser to the Instacart API.

## 2. Node.js CORS Proxy

To bypass CORS restrictions for testing, we've included a simple proxy server:

```bash
# Install dependencies (if not already installed)
npm install express cors axios

# Run the proxy with your API key
node src/utils/instacart-cors-proxy.js YOUR_API_KEY
```

This will start a local server at http://localhost:3005 with:
- A proxy endpoint at `/proxy` that forwards requests to Instacart
- A test page at `/test.html` for easy testing in the browser
- Detailed error messages and debugging information

## 3. Node.js Direct API Tester

For the most reliable testing without browser restrictions, use the direct Node.js tester:

```bash
# Run with your API key and optional zip code
node src/utils/test-instacart-api.js YOUR_API_KEY [ZIP_CODE]
```

This will:
- Test both `/v1` and `/idp/v1` endpoints
- Show detailed response data
- Test the health endpoint
- Provide a recommendation on which endpoint to use
- Work regardless of CORS restrictions (since it runs in Node.js)

## Using the Test Results

After testing, you'll know:

1. If your API key is valid
2. Which API path works for your account (`/v1` or `/idp/v1`)
3. Any specific error messages from the Instacart API

Use this information to update your code accordingly. In `instacartService.js`, make sure you're using the working API path.

## Common Issues and Solutions

1. **CORS Errors in Browser**: 
   - This is normal and expected
   - Use the Node.js direct tester or CORS proxy for accurate testing

2. **401 Unauthorized**:
   - Check your API key is correct
   - Ensure you're using the correct header format: `Authorization: InstacartAPI YOUR_API_KEY`

3. **404 Not Found**:
   - Try both `/v1` and `/idp/v1` paths
   - Make sure you're using the correct endpoint URL
   
4. **ENOTFOUND or Connection Error**:
   - Check your internet connection
   - Verify the Instacart API URL is correct

## Implementation in Your Code

After determining the working endpoint, update the baseUrl in your `instacartService.js`:

```javascript
// If /v1 works:
const INSTACART_CONNECT_URL = 'https://connect.dev.instacart.tools/v1';

// Or if /idp/v1 works:
const INSTACART_CONNECT_URL = 'https://connect.dev.instacart.tools/idp/v1';
```

And ensure the authorization header is formatted correctly:

```javascript
const headers = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
  'Authorization': `InstacartAPI ${apiKey}`
};
```