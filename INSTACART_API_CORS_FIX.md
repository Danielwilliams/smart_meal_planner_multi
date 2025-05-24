# Instacart API CORS Issue Fix

## The Problem

We've identified several issues with the Instacart API integration:

1. **URL Path Issue**: The frontend was using `/api/instacart/...` while the backend used `/instacart/...`
2. **CORS Issues**: When making direct requests to the Railway backend, CORS errors occur
3. **Proxy Configuration**: The Vercel configuration needed adjustment

## The Solution

We've provided two solutions:

### Solution 1: Use the Vercel Proxy (Recommended)

We found that your Vercel project already has an API proxy configuration in `vercel.json`:

```json
{
  "src": "/api/instacart/(.*)",
  "dest": "https://smartmealplannermulti-development.up.railway.app/instacart/$1",
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Authorization, X-Instacart-API-Key"
  }
}
```

We've added a direct `/instacart/...` route to ensure both URL formats work:

```json
{
  "src": "/instacart/(.*)",
  "dest": "https://smartmealplannermulti-development.up.railway.app/instacart/$1",
  "headers": {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "X-Requested-With, Content-Type, Authorization, X-Instacart-API-Key"
  }
}
```

And we've created a new `updated_instacartBackendService.js` file that uses relative URLs that will be properly proxied by Vercel.

### Solution 2: Configure Backend CORS (Backup)

As a backup, we've also updated the FastAPI CORS settings to allow requests from all origins:

```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,  # Changed from True to support wildcard origins
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allow_headers=["Content-Type", "Authorization", "X-Instacart-API-Key", "Accept"],
    expose_headers=["Content-Type", "X-Process-Time"],
    max_age=600  # 10 minutes cache for preflight requests
)
```

## Next Steps

1. **Copy the Updated Service**: Replace your existing `instacartBackendService.js` with the updated version:
   ```bash
   cp src/services/updated_instacartBackendService.js src/services/instacartBackendService.js
   ```

2. **Deploy to Vercel**: Push these changes to your git repository to deploy to Vercel

3. **Set Environment Variable**: Make sure your Railway server has the `INSTACARTAPI_DEV` environment variable set properly:
   ```
   INSTACARTAPI_DEV=InstacartAPI YOUR_API_KEY
   ```

## Debugging

If you continue to have issues:

1. **Check Network Requests**: In the browser dev tools, observe if the requests are going to the right URLs and whether they're getting proper responses

2. **Verify API Key**: Check that the API key is properly formatted with the `InstacartAPI` prefix

3. **Test Individual Endpoints**: Try accessing individual endpoints directly with tools like Postman to see if they work

4. **Check Logs**: Look at the Railway logs to see if there are any backend errors