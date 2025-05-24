# Instacart API Integration Deployment Instructions

We've made several fixes to the Instacart API integration in the backend. These changes need to be deployed to your server for them to take effect.

## Changes Made

1. Added a proper `/key-info` endpoint in instacart_status.py
2. Added an `/environment` endpoint to provide server environment details
3. Added a `/test` endpoint for easy testing of the router functionality
4. Enhanced error handling in the instacart client class
5. Improved the retailers endpoint with better error handling and response structure
6. Updated the nearby retailers endpoint with robust error handling and fallbacks
7. Enhanced the InstacartClient initialization with proper API key formatting
8. Added detailed logging throughout for better debugging
9. Added helpful guidance messages when the API key is missing

## Deployment Steps

### Option 1: Deploy to Railway

If you're using Railway for deployment, follow these steps:

1. Commit the changes to your git repository:
   ```bash
   git add apps/smart-meal-planner-backend/app/routers/instacart_status.py
   git add apps/smart-meal-planner-backend/app/routers/instacart_store.py
   git add apps/smart-meal-planner-backend/app/integration/instacart.py
   git commit -m "Fix Instacart API integration with better error handling"
   git push
   ```

2. Railway should automatically deploy the changes if you have automatic deployments configured.

3. If not, trigger a manual deployment from the Railway dashboard.

### Option 2: Deploy to a Custom Server

If you're using a different hosting solution, follow these steps:

1. Copy the updated files to your server:
   - `apps/smart-meal-planner-backend/app/routers/instacart_status.py`
   - `apps/smart-meal-planner-backend/app/routers/instacart_store.py`
   - `apps/smart-meal-planner-backend/app/integration/instacart.py`

2. Restart your FastAPI server to apply the changes.

## Environment Setup

Make sure your server has the INSTACARTAPI_DEV environment variable set:

```bash
export INSTACARTAPI_DEV="InstacartAPI YOUR_API_KEY_HERE"
```

Note the format: the value should start with "InstacartAPI" followed by a space and then your actual API key.

## Testing the Deployment

After deploying, you can test if the endpoints are working using the included test script:

```bash
python3 test_instacart_endpoints.py
```

You can also manually test the endpoints:
- `/api/instacart/test` - A simple test endpoint that returns a success message
- `/api/instacart/key-info` - Returns information about the configured API key
- `/api/instacart/environment` - Returns information about the server environment
- `/api/instacart/status` - Checks if the Instacart API is properly configured
- `/api/instacart/retailers` - Gets a list of available retailers
- `/api/instacart/retailers/nearby?zip_code=80538` - Gets a list of nearby retailers

## Troubleshooting

If you're still seeing 404 errors after deployment, check the following:

1. Verify the server logs to see if there are any errors during startup
2. Make sure all the routers are properly registered in `app/main.py`
3. Confirm that the endpoints are accessible with the correct URL path
4. Check if the INSTACARTAPI_DEV environment variable is properly set

For authentication-related issues, try using the `/api/instacart/test` endpoint which doesn't require authentication.

If you need to check if your local FastAPI server is running with the updated code, use this command:
```bash
cd apps/smart-meal-planner-backend
python3 -m pip install uvicorn fastapi
python3 -m uvicorn app.main:app --reload --port 8000
```

Then test a simple endpoint in your browser: http://127.0.0.1:8000/api/instacart/test