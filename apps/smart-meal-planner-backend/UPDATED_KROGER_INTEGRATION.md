# Updated Kroger Integration

## Overview
This document outlines the updated Kroger integration for Smart Meal Planner, explaining the transition from stored credentials to the OAuth-based authentication flow.

## Key Changes

### Credential Storage Removal
- All Kroger credential fields have been removed from the database:
  - `kroger_username`
  - `kroger_password`
  - `kroger_password_hash`
  - `kroger_password_salt`
- The migration script (`011_remove_kroger_credentials.py`) safely removes these fields

### OAuth-Based Authentication
- Kroger integration now exclusively uses OAuth 2.0 flow
- Users authenticate directly with Kroger's official login page
- No credentials are stored in the Smart Meal Planner database
- Tokens are managed securely for API access

## How It Works

### Connection Flow
1. User initiates Kroger connection from the application
2. User is redirected to Kroger's official login page
3. After successful login, Kroger sends a code to our callback endpoint
4. Backend exchanges the code for access and refresh tokens
5. Tokens are stored securely for future API requests
6. User is redirected back to the application

### Token Management
- Access tokens are valid for short periods (typically 1 hour)
- Refresh tokens allow obtaining new access tokens without re-authentication
- Tokens are automatically refreshed when needed

### Security Benefits
- ✅ No passwords stored in our database
- ✅ Users authenticate directly with Kroger
- ✅ Industry-standard OAuth 2.0 protocol
- ✅ Reduced liability for credential management
- ✅ Follows Kroger's official integration guidelines

## User Experience

### Connecting Kroger Account
1. Navigate to the Cart or Shopping List page
2. Click "Connect Kroger Account"
3. Log in on Kroger's official login page
4. Authorize Smart Meal Planner to access your Kroger account
5. Select your preferred Kroger store

### Adding Items to Cart
1. View your shopping list
2. Click "Add to Kroger Cart"
3. If not connected, you'll be prompted to connect your account first
4. Items are added to your Kroger cart automatically
5. Continue shopping on Kroger's website or app

## For Developers

### Key Endpoints
- `/kroger/login-url` - Generates the OAuth authorization URL
- `/kroger/callback` - Processes the OAuth callback from Kroger
- `/kroger/connection-status` - Checks if a user has connected their account
- `/kroger/disconnect` - Removes Kroger connection
- `/kroger/search-products` - Searches Kroger products
- `/kroger/store-location` - Updates preferred store location

### Required Environment Variables
```
KROGER_CLIENT_ID=your_client_id
KROGER_CLIENT_SECRET=your_client_secret
KROGER_REDIRECT_URI=https://your-domain.com/kroger/callback
KROGER_BASE_URL=https://api.kroger.com/v1
```

### Implementation Files
- `app/routers/kroger_auth.py` - OAuth endpoints and token management
- `app/integration/kroger.py` - Kroger API integration
- `app/integration/kroger_db.py` - Token storage and retrieval

## Troubleshooting

### Common Issues

#### Connection Fails
- Ensure Kroger API credentials are properly configured
- Verify redirect URI matches the one registered with Kroger
- Check that required scopes are requested (`product.compact cart.basic:write`)

#### API Requests Fail
- Verify access token is valid and not expired
- Ensure store location ID is provided for product searches
- Check for proper error handling in API responses

#### Store Location Issues
- Make sure user has selected a store location
- Default location may need to be set for initial searches

## Future Enhancements

### Planned Improvements
1. **Enhanced Reconnection** - Smoother handling of expired connections
2. **Multiple Store Support** - Allow selecting from recently used stores
3. **Custom Item Mapping** - Better matching of shopping list items to Kroger products
4. **Order History** - View and reorder previous Kroger purchases
5. **Enhanced Analytics** - Track savings and shopping patterns

## Migration Path

### For Existing Users
- Existing users will need to reconnect their Kroger account
- The first time they attempt to use Kroger features, they'll be prompted to connect
- No action is required for users who didn't use Kroger integration

### Database Migration
- The migration script automatically handles removal of credential columns
- No manual action is required by users
- All OAuth tokens remain intact for users who were already using OAuth

## Support and Documentation

For additional support or questions about the Kroger integration:
- Visit the [Kroger Developer Portal](https://developer.kroger.com/documentation/)
- Contact [Smart Meal Planner Support](mailto:support@example.com)
- Review the [OAuth Integration Guide](https://developer.kroger.com/documentation/getting-started-oauth2/)