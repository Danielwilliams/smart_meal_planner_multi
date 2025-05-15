# Instacart API Environment Setup

To get the Instacart integration working properly, you need to set up the correct environment variable with your API key.

## Setting the Environment Variable

The most important step is to set the `INSTACARTAPI_DEV` environment variable with the correct format:

### Railway Deployment

1. Go to your Railway project dashboard
2. Navigate to the "Variables" section
3. Add a new variable:
   - Key: `INSTACARTAPI_DEV`
   - Value: `InstacartAPI YOUR_API_KEY_HERE`

**Important**: Make sure to add the `InstacartAPI` prefix before your actual API key. This is required by the Instacart Connect API.

### Other Deployment Platforms

For other platforms, follow their respective methods for setting environment variables:

- **Heroku**:
  ```bash
  heroku config:set INSTACARTAPI_DEV="InstacartAPI YOUR_API_KEY_HERE"
  ```

- **Vercel**:
  Add the environment variable in your Vercel project settings.

- **AWS**:
  Set the environment variable in your AWS deployment settings.

## Testing the Configuration

After setting the environment variable, you can verify it's working correctly by accessing these endpoints:

1. `/api/instacart/test` - A simple test endpoint
2. `/api/instacart/key-info` - Checks if the API key is configured properly
3. `/api/instacart/status` - Tests connectivity to the Instacart API

## Debugging

If you're still facing issues after setting up the environment variable:

1. Check the server logs for any errors
2. Verify that the API key has the correct format with the `InstacartAPI` prefix
3. Make sure the backend has been redeployed after the environment variable was set
4. Ensure your API key has the necessary permissions for the Instacart Connect API

## API Key Format Example

Your environment variable should look like this:

```
INSTACARTAPI_DEV=InstacartAPI eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIn0.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U
```

Where the part after "InstacartAPI " is your actual API key.