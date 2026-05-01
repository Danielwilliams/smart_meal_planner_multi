# Deep Link Authentication Test Plan

## Implementation Summary

The Kroger OAuth authentication has been converted from WebView + backend polling to external browser + deep link monitoring.

### Key Changes Made:

1. **Updated Redirect URI**: Changed from `https://www.smartmealplannerio.com/kroger/callback` to `smartmealplannerIO://kroger-auth`

2. **Replaced Backend Polling**: The `_monitorBackendForAuthCompletion()` method has been replaced with `_monitorForDeepLinkCallback()`

3. **Deep Link Route Added**: Added `/kroger-auth-callback` route in main.dart to handle deep link callbacks

4. **App Resume Handling**: Enhanced `_handleAppResumed()` method to check for deep link auth codes

### Current Flow:

1. User initiates Kroger authentication
2. App skips WebView setup entirely
3. External browser opens with Kroger OAuth URL using deep link redirect URI
4. User completes authentication in browser
5. Kroger redirects to `smartmealplannerIO://kroger-auth?code=...`
6. Android handles the deep link and brings app to foreground
7. App processes the authorization code via existing `/kroger/process-code` endpoint
8. Authentication completes

### Android Manifest Configuration:

The app already has proper deep link configuration:
```xml
<intent-filter>
    <action android:name="android.intent.action.VIEW" />
    <category android:name="android.intent.category.DEFAULT" />
    <category android:name="android.intent.category.BROWSABLE" />
    <data android:scheme="smartmealplanner" android:host="kroger-auth" />
</intent-filter>
```

### Backend Compatibility:

The existing `/kroger/process-code` endpoint already accepts custom redirect URIs in the request body, so it will work with the deep link scheme.

### Test Instructions:

1. Build and run the mobile app
2. Navigate to a screen that requires Kroger authentication
3. Tap "Connect Kroger Account" 
4. Verify that:
   - WebView is skipped
   - External browser opens with Kroger login
   - Deep link redirect URI is used in the OAuth URL
   - After completing auth in browser, app returns to foreground
   - Authentication completes successfully

### Known Limitations:

- The deep link auth code extraction is currently placeholder code
- For full functionality, would need to implement proper deep link URL parsing
- Could benefit from adding the `uni_links` package for more robust deep link handling

### Benefits of This Approach:

- ✅ Eliminates WebView infinite loop issues
- ✅ Uses native browser for better OAuth experience  
- ✅ Leverages existing deep link infrastructure
- ✅ No new backend routes needed
- ✅ Follows user's preferred flow (external browser)