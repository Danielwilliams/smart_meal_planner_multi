# Kroger OAuth Redirect URI Setup

## Overview

This document provides instructions for configuring the Kroger API redirect URI in the Kroger Developer Portal. The OAuth flow will fail if the redirect URI specified in the authorization request doesn't match what's registered in the portal.

## Current Configuration

The application is configured to use the following redirect URI:

```
https://smartmealplannerio.com/kroger/callback
```

This URI has been hardcoded in both the frontend and backend code to ensure consistency.

## Kroger Developer Portal Configuration Steps

1. Log in to the [Kroger Developer Portal](https://developer.kroger.com/)

2. Navigate to your application settings

3. Find the "Redirect URIs" section

4. Ensure that **EXACTLY** the following URI is registered:
   ```
   https://smartmealplannerio.com/kroger/callback
   ```

5. If this exact URI is not registered, add it

6. Remove any other similar redirect URIs to avoid confusion

7. Save the changes

## Common Issues

If you encounter the following error when authorizing with Kroger:

```
An Error Occurred
invalid request
The redirect_uri did not match the registered redirect_uri for this application
```

This means:

- The redirect URI in the authorization request does not match what's registered in the Kroger Developer Portal
- You need to update the registered URIs in the portal to match the URI used by the application

## Important Notes

- URIs are compared exactly - even small differences like trailing slashes will cause the error
- The URI must match character-for-character, including the protocol (https://)
- Only redirect URIs registered in the portal will be accepted

## Testing

After configuring the redirect URI:

1. Clear your browser cache and cookies for the Kroger website
2. Try the OAuth flow again from the application
3. If configured correctly, the authorization should complete without the redirect URI error