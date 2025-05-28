# Kroger OAuth Debugging Guide

## Understanding the Error

If you're encountering the following error:
```
An Error Occurred
invalid request
The redirect_uri did not match the registered redirect_uri for this application
```

This means that the redirect URI in your OAuth request doesn't match any of the redirect URIs registered in the Kroger Developer Portal.

## Registered Redirect URIs

According to your information, the following redirect URIs are registered in the Kroger Developer Portal:
1. `https://smart-meal-planner-multi.vercel.app/kroger/callback`
2. `https://smartmealplannerio.com/kroger/callback`
3. `https://smartmealplannerio.vercel.app/kroger/callback`
4. `https://www.smartmealplannerio.com/kroger/callback`

## How to Debug

1. **Check the actual redirect URI being used**:
   - Inspect the error URL in your browser
   - Look for the `redirect_uri=` parameter value
   - Make sure it exactly matches one of the registered URIs above

2. **Check environment variables**:
   - Verify that `REACT_APP_KROGER_REDIRECT_URI` is set correctly in the frontend environment
   - Verify that `KROGER_REDIRECT_URI` is set correctly in the backend environment

3. **Browser Console Logs**:
   - Open your browser's developer console
   - Look for logs starting with "KrogerAuthService" or "Kroger configuration"
   - Check the "redirectUri" value being reported

4. **Using Chrome Network Tab**:
   - Open Chrome Developer Tools
   - Go to the Network tab
   - Filter for "authorize" requests
   - Examine the query parameters

## Debugging the OAuth Flow

The Kroger OAuth flow consists of several steps:
1. User clicks "Connect to Kroger"
2. App redirects to Kroger authorization URL with redirect_uri parameter
3. User authenticates with Kroger
4. Kroger redirects back to the specified redirect_uri with an authorization code
5. App exchanges the code for access tokens

The error occurs in step 2 when the redirect_uri doesn't match any registered URI.

## Matching Registered URIs

The redirect URI comparison is exact - even small differences will cause failure:
- Protocol must match (`https://` vs `http://`)
- Domain must match exactly (`smartmealplannerio.com` vs `www.smartmealplannerio.com`)
- Path must match exactly (`/kroger/callback` vs `/kroger/callback/`)
- No query parameters should be added unless registered

## Common Issues and Solutions

1. **Multiple Environments**: If you're testing in different environments (local, staging, production), make sure each environment uses the correct redirect URI that is registered.

2. **Client ID Mismatch**: Each Kroger app registration has its own set of redirect URIs. Make sure you're using the correct client ID with its corresponding registered redirect URIs.

3. **Manual URL Construction**: Avoid manually constructing the OAuth URL. Use the provided libraries or services.

4. **Frontend/Backend Mismatch**: Ensure both frontend and backend are using the same redirect URI.

## Next Steps

1. **Check Environment Variables**:
   ```bash
   # Frontend
   echo $REACT_APP_KROGER_REDIRECT_URI
   
   # Backend
   echo $KROGER_REDIRECT_URI
   ```

2. **Add Debug Logging**:
   - Add more detailed logging to the `reconnectKroger` function
   - Log the full authorization URL before redirecting

3. **Try Direct URI**:
   As a test, try directly setting the redirect URI to one of the registered values:
   ```javascript
   const redirectUri = 'https://smart-meal-planner-multi.vercel.app/kroger/callback';
   ```

4. **Check Kroger Developer Portal**:
   - Login to the developer portal and verify the registered URIs
   - Make sure the application is active and approved

5. **Check for URI Encoding Issues**:
   - Ensure the redirect URI is properly URL-encoded in the request

## Contact Kroger Support

If you've verified all of the above and are still experiencing issues, contact Kroger Developer Support with:
- Your client ID
- The error message
- The full OAuth URL you're attempting to use