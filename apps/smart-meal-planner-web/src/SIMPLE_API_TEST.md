# Simple Instacart API Test Instructions

This is a very simple way to directly test the Instacart API without any browser, React, or complex code. This will help determine if there are fundamental issues with:

1. Your API key
2. The authorization format
3. Network connectivity to Instacart
4. The Instacart API itself

## Running the Test

1. Make sure you have Node.js installed on your computer
2. Open a terminal/command prompt
3. Navigate to this directory
4. Run the test with your API key:

```bash
node test-instacart-api.js YOUR_API_KEY
```

To test both API paths at once:

```bash
node test-instacart-api.js YOUR_API_KEY idp
```

## Interpreting Results

### Success Case

If you see a success message like:

```
✅ SUCCESS! API connection works!
Found X retailers near 80538
```

This means your API key and connection are working correctly.

### Failure Cases

#### 401 Unauthorized

```
❌ STATUS CODE: 401
```

This usually means your API key is invalid or the authorization format is incorrect. Make sure:
- Your API key is correct
- The authorization header format is exactly: `Authorization: InstacartAPI YOUR_KEY`

#### 500 Server Error

```
❌ STATUS CODE: 500
```

This could mean:
1. The Instacart API is having internal issues
2. Your request is formatted incorrectly in a way that causes server-side errors
3. The API endpoint has changed

Try the alternate path with:

```bash
node test-instacart-api.js YOUR_API_KEY idp
```

#### Network Error

```
❌ ERROR making request: ...
```

This suggests connectivity issues:
1. Check your internet connection
2. Verify that you can reach other websites
3. Try using a different network or VPN

## Next Steps

If this simple test works but the web app still doesn't, the issue is likely:
1. A CORS configuration issue in the browser
2. A React-specific implementation problem
3. A bug in the way the API calls are formatted in the web app

If neither this test nor the web app works, the issue is more fundamental:
1. Your API key is incorrect or expired
2. You don't have proper access to the Instacart API
3. The Instacart API has changed or is experiencing downtime