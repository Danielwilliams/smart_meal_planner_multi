# Instacart Direct Integration

This file documents the updated approach to the Instacart integration, which now uses direct API calls to the backend similar to the Kroger integration.

## Overview

Instead of relying on the Vercel proxy to route API requests, the frontend now communicates directly with the Railway backend server. This approach aligns with how the Kroger integration works, providing a more consistent architecture.

## Implementation Details

### Frontend Changes

1. **Direct Backend URL**: The frontend now uses the direct Railway backend URL instead of relying on the Vercel proxy:
   ```javascript
   const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
   ```

2. **API Path Updates**: All API calls now use the direct paths without the `/api` prefix:
   ```javascript
   // Old way (with Vercel proxy)
   const response = await instacartBackendAxios.get('/api/instacart/status');
   
   // New way (direct to Railway)
   const response = await instacartBackendAxios.get('/instacart/status');
   ```

### Backend Changes

1. **Enhanced CORS Middleware**: A custom CORS middleware has been implemented to allow direct cross-origin requests from the frontend:
   ```python
   # app/middleware/cors_middleware.py
   def setup_cors_middleware(app: FastAPI) -> None:
       app.add_middleware(
           CORSMiddleware,
           allow_origins=origins,
           allow_credentials=False,
           allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
           allow_headers=[
               "Content-Type", 
               "Authorization", 
               "X-Instacart-API-Key",
               "X-Requested-With",
               "Accept"
           ],
           expose_headers=["Content-Type", "X-Process-Time"],
           max_age=600
       )
   ```

2. **Router Integration**: The existing routers are already properly configured to handle the direct requests.

## Environment Requirements

For this direct integration to work, the following environment variables should be properly set:

1. **Frontend (Vercel)**:
   - `REACT_APP_API_BASE_URL`: Set to your Railway backend URL (e.g., 'https://smartmealplannermulti-production.up.railway.app')

2. **Backend (Railway)**:
   - `INSTACARTAPI_DEV`: Must be set with the format `InstacartAPI YOUR_API_KEY`

## Testing the Integration

1. Ensure the backend is running and accessible
2. Use the InstacartSimpleTester component to verify connectivity
3. Check the browser console for detailed logs about API calls

## Troubleshooting

If you encounter CORS issues:
1. Verify that the backend is running and accessible
2. Check that the enhanced CORS middleware is properly configured
3. Ensure the `INSTACARTAPI_DEV` environment variable is set correctly

If you encounter 404 errors:
1. Verify the backend routes are correctly registered in main.py
2. Check that the API endpoints match the ones expected by the frontend

## Next Steps

- [ ] Remove the Vercel proxy configuration once the direct integration is confirmed working
- [ ] Add more comprehensive error handling in the frontend service
- [ ] Implement a token-based authentication system similar to Kroger for better security