# Instacart Production API Migration

## Overview
Migrated Instacart integration from development API to production API with your production API keys.

## Changes Made

### Backend Updates

#### 1. **Core Integration (`app/integration/instacart.py`)**
- ✅ **Base URL**: Changed from `https://connect.dev.instacart.tools` to `https://connect.instacart.com`
- ✅ **Environment Variable**: Changed from `INSTACARTAPI_DEV` to `INSTACART_API_KEY`
- ✅ **API Configuration**: Updated to use production endpoints

#### 2. **Router Files Updated**
- ✅ **`app/routers/instacart_store.py`**: Updated API key reference (4 locations)
- ✅ **`app/routers/instacart_debug.py`**: Updated API key reference (4 locations)
- ✅ **`app/routers/instacart_status.py`**: Updated API key reference (10 locations)

### Environment Configuration Required

#### **Production Environment Variable**
```bash
# Replace this environment variable in your deployment:
INSTACART_API_KEY=your_production_api_key_here
```

#### **Remove Old Variable**
```bash
# This is no longer needed:
# INSTACARTAPI_DEV=old_dev_key
```

## API Endpoint Changes

### **Before (Development)**
```
Base URL: https://connect.dev.instacart.tools
Environment Variable: INSTACARTAPI_DEV
```

### **After (Production)**
```
Base URL: https://connect.instacart.com  
Environment Variable: INSTACART_API_KEY
```

## Testing Checklist

### **Backend Endpoints to Test**
1. **Store/Retailer Search**: `GET /instacart/retailers`
2. **Product Search**: `GET /instacart/products/search`
3. **API Status**: `GET /instacart/status`
4. **Debug Info**: `GET /instacart/debug/config`

### **Frontend Integration**
- ✅ **Frontend unchanged**: The frontend service files call backend endpoints, which now use production API
- ✅ **No frontend API key needed**: All API calls go through your secure backend

## Deployment Steps

### **1. Update Environment Variables**
```bash
# In your production environment (Railway, etc.):
export INSTACART_API_KEY="your_production_api_key_here"

# Remove old variable:
unset INSTACARTAPI_DEV
```

### **2. Deploy Backend Changes**
- Deploy the updated backend code
- Verify the new environment variable is set

### **3. Test Integration**
```bash
# Test API connectivity:
curl -X GET "https://your-api-domain.com/instacart/status"

# Test retailer search:
curl -X GET "https://your-api-domain.com/instacart/retailers?zip_code=80424"
```

## Expected Benefits

### **Production Features**
- ✅ **Real Data**: Access to actual Instacart retailer and product data
- ✅ **Higher Limits**: Production API typically has higher rate limits
- ✅ **Better Reliability**: Production infrastructure is more stable
- ✅ **Full Features**: Access to all production API capabilities

### **Rate Limits**
- Production API typically allows more requests per minute
- Better suited for real user traffic
- More reliable uptime

## Monitoring

### **Log What to Watch**
```python
# Backend logs will show:
logger.info("Using production Instacart API at https://connect.instacart.com")
logger.info("API key configured successfully")
```

### **Error Patterns**
- **401 Unauthorized**: Check if `INSTACART_API_KEY` is set correctly
- **403 Forbidden**: Verify your production API key has proper permissions
- **404 Not Found**: Ensure you're using the correct production endpoints

## Rollback Plan
If issues occur, you can quickly rollback by:

1. **Restore Development Settings**:
   ```python
   BASE_URL = "https://connect.dev.instacart.tools"
   api_key = os.environ.get("INSTACARTAPI_DEV")
   ```

2. **Set Development Environment Variable**:
   ```bash
   export INSTACARTAPI_DEV="your_dev_key"
   ```

## Security Notes

### **API Key Security**
- ✅ **Environment Variable**: API key stored securely in environment variables
- ✅ **Backend Only**: API key never exposed to frontend/browser
- ✅ **No Logging**: API key is masked in debug logs

### **Production Considerations**
- Monitor API usage to stay within limits
- Set up alerts for API errors
- Consider implementing caching for frequently accessed data

---

**Status**: ✅ Ready for Production  
**Next Step**: Set `INSTACART_API_KEY` environment variable and deploy