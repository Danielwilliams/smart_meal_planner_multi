from fastapi import APIRouter, Depends, HTTPException, Request, Body
from fastapi.responses import RedirectResponse
from typing import Dict, Any, Optional
import requests
import base64
import os
import jwt
from datetime import datetime, timedelta

from app.utils.auth_utils import get_user_from_token
from app.integration.kroger import KrogerIntegration
from app.integration.kroger_db import (
    save_kroger_credentials, 
    get_user_kroger_credentials,
    disconnect_kroger_account,
    update_kroger_store_location
)
\
from app.config import (
    KROGER_CLIENT_ID, 
    KROGER_CLIENT_SECRET, 
    KROGER_REDIRECT_URI,
    FRONTEND_URL,
    JWT_SECRET,
    JWT_ALGORITHM
)



import logging
logger = logging.getLogger(__name__)

router = APIRouter(
    prefix="/kroger",
    tags=["kroger"]
)

def get_current_user(request: Request):
    """
    Extract user information from JWT token with comprehensive error handling
    """
    try:
        # Get the Authorization header
        auth_header = request.headers.get('Authorization')
        if not auth_header:
            logger.error("No Authorization header found")
            raise HTTPException(status_code=401, detail="No authorization token")
        
        # Remove 'Bearer ' prefix if present
        token = auth_header.split(' ')[1] if auth_header.startswith('Bearer ') else auth_header
        
        # Additional logging
        logger.debug(f"Decoding token: {token[:10]}...")
        
        # Decode the JWT token
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Validate user_id
        user_id = payload.get('user_id')
        if not user_id:
            logger.error("Token payload missing user_id")
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Create a simple user object
        class CurrentUser:
            def __init__(self, user_id):
                self.id = user_id
        
        logger.info(f"Current user authenticated: {user_id}")
        return CurrentUser(user_id)
    
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"User authentication error: {str(e)}")
        raise HTTPException(status_code=401, detail="Could not authenticate user")

@router.get("/test-login")
async def test_kroger_login(
    current_user: Any = Depends(get_current_user)
):
    """
    Diagnostic route to test Kroger login process
    """
    try:
        # Retrieve user's stored credentials
        credentials = get_user_kroger_credentials(current_user.id)
        
        logger.info("Kroger Login Test - Stored Credentials:")
        logger.info(f"Client ID: {credentials.get('client_id')}")
        logger.info(f"Client Secret: {'*' * len(credentials.get('client_secret', '')) if credentials.get('client_secret') else 'None'}")
        
        # Validate credentials
        if not credentials.get('client_id') or not credentials.get('client_secret'):
            return {
                "status": "error",
                "message": "Kroger API credentials not configured",
                "steps": [
                    "1. Go to Kroger Developer Portal",
                    "2. Create a new application",
                    "3. Get Client ID and Client Secret",
                    "4. Save these in your user preferences"
                ]
            }
        
        # Generate login URL
        auth_base_url = "https://api.kroger.com/v1/connect/oauth2/authorize"
        scopes = "product.compact cart.basic:write:user"
        
        # Generate a state parameter for CSRF protection
        import secrets
        state = secrets.token_urlsafe(16)
        
        auth_url = (
            f"{auth_base_url}?"
            f"scope={scopes}&"
            f"response_type=code&"
            f"client_id={credentials['client_id']}&"
            f"redirect_uri={KROGER_REDIRECT_URI}&"
            f"state={state}"
        )
        
        return {
            "status": "success",
            "message": "Kroger login URL generated successfully",
            "login_url": auth_url,
            "client_id_length": len(credentials.get('client_id', '')),
            "redirect_uri": KROGER_REDIRECT_URI
        }
    
    except Exception as e:
        logger.error(f"Kroger login test error: {str(e)}")
        return {
            "status": "error",
            "message": f"Unexpected error: {str(e)}"
        }

        

@router.get("/login-url")
async def get_kroger_login_url(
    user = Depends(get_user_from_token)
):
    """Generate Kroger OAuth login URL"""
    try:
        # User ID for debugging
        user_id = user.get('user_id')
        logger.info(f"Generating Kroger login URL for user {user_id}")
        
        # Explicit environment variable check
        if not KROGER_CLIENT_ID:
            logger.error("KROGER_CLIENT_ID is not set")
            raise HTTPException(400, "Kroger client ID is not configured")
            
        if not KROGER_REDIRECT_URI:
            logger.error("KROGER_REDIRECT_URI is not set")
            raise HTTPException(400, "Kroger redirect URI is not configured")
        
        # Create a JWT with explicit expiration time
        state = jwt.encode(
            {
                'user_id': user_id,
                'exp': datetime.utcnow() + timedelta(minutes=15)
            }, 
            JWT_SECRET, 
            algorithm=JWT_ALGORITHM
        )
        
        # Log the state token for debugging
        logger.info(f"Generated state token: {state[:20]}...")
        logger.info(f"Using Client ID: {KROGER_CLIENT_ID[:5]}...")
        logger.info(f"Using Redirect URI: {KROGER_REDIRECT_URI}")
        
        auth_url = (
            f"https://api.kroger.com/v1/connect/oauth2/authorize?"
            f"scope=product.compact+cart.basic:write&"
            f"response_type=code&"
            f"client_id={KROGER_CLIENT_ID}&"
            f"redirect_uri={KROGER_REDIRECT_URI}&"
            f"state={state}"
        )
        
        return {
            "login_url": auth_url,
            "message": "Please connect your Kroger account to continue"
        }
    except Exception as e:
        logger.error(f"Login URL generation error: {str(e)}")
        raise HTTPException(
            status_code=400, 
            detail=f"Error generating Kroger login URL: {str(e)}"
        )


        
@router.get("/connection-status")
async def get_kroger_connection_status(
    current_user: Any = Depends(get_current_user)
):
    """
    Check Kroger connection status for the current user with enhanced store location handling
    """
    credentials = get_user_kroger_credentials(current_user.id)
    
    # Extract store location from credentials
    store_location = credentials.get('store_location_id')
    
    # Log the credentials and store location for debugging
    logger.info(f"Kroger connection status check for user {current_user.id}")
    logger.info(f"Has access token: {bool(credentials.get('access_token'))}")
    logger.info(f"Store location in DB: {store_location}")
    
    return {
        "is_connected": bool(credentials.get('access_token')),
        "store_location_id": store_location,
        "store_location": store_location,  # Add this for consistency with frontend naming
        "connected_at": credentials.get('connected_at'),
        "client_id_exists": bool(credentials.get('client_id')),
        "needs_login": not bool(credentials.get('access_token'))
    }

@router.get("/verify-credentials")
async def verify_kroger_credentials(
    current_user: Any = Depends(get_current_user)
):
    """
    Verify Kroger credentials in database
    """
    try:
        credentials = get_user_kroger_credentials(current_user.id)
        
        return {
            "has_credentials": bool(credentials),
            "has_access_token": bool(credentials.get('access_token')),
            "store_location_id": credentials.get('store_location_id'),
            "client_id_present": bool(credentials.get('client_id')),
            "client_secret_present": bool(credentials.get('client_secret'))
        }
    except Exception as e:
        logger.error(f"Credential verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/disconnect")
async def disconnect_kroger(
    current_user: Any = Depends(get_current_user)
):
    """
    Disconnect Kroger account for the current user
    """
    success = disconnect_kroger_account(current_user.id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to disconnect Kroger account")
    
    return {"message": "Kroger account disconnected successfully"}

@router.post("/store-location")
async def update_store_location(
    store_location_id: str,
    current_user: Any = Depends(get_current_user)
):
    """
    Update user's preferred Kroger store location
    
    :param store_location_id: Kroger store location ID to set as preferred
    """
    success = update_kroger_store_location(current_user.id, store_location_id)
    
    if not success:
        raise HTTPException(status_code=500, detail="Failed to update store location")
    
    return {"message": "Store location updated successfully"}

@router.get("/search-products")
async def search_kroger_products(
    query: str, 
    location_id: Optional[str] = None,
    current_user: Any = Depends(get_current_user)
):
    """
    Search for products in Kroger's catalog
    
    :param query: Search term for products
    :param location_id: Optional store location ID to filter results
    """
    # Retrieve user's stored credentials
    credentials = get_user_kroger_credentials(current_user.id)
    
    if not credentials.get('access_token'):
        raise HTTPException(status_code=401, detail="Kroger account not connected")
    
    # Initialize Kroger integration with user's access token
    kroger_integration = KrogerIntegration(access_token=credentials['access_token'])
    
    # Use location_id from parameter or user's saved location
    search_location_id = location_id or credentials.get('store_location_id')
    
    # Perform product search
    search_result = kroger_integration.search_products(query, search_location_id)
    
    if not search_result['success']:
        # Attempt to refresh token if search fails
        refresh_response = kroger_integration.refresh_access_token(credentials['refresh_token'])
        
        if refresh_response['success']:
            # Update stored credentials
            save_kroger_credentials(
                id=current_user.id,
                access_token=refresh_response['access_token'],
                refresh_token=refresh_response['refresh_token']
            )
            
            # Retry search with new token
            kroger_integration = KrogerIntegration(access_token=refresh_response['access_token'])
            search_result = kroger_integration.search_products(query, search_location_id)
    
    return search_result

@router.get("/nearby-stores")
async def find_nearby_kroger_stores(
    latitude: float, 
    longitude: float,
    radius: int = 50,
    current_user: Any = Depends(get_current_user)
):
    """
    Find nearby Kroger stores
    
    :param latitude: User's latitude
    :param longitude: User's longitude
    :param radius: Search radius in miles
    """
    # Retrieve user's stored credentials
    credentials = get_user_kroger_credentials(current_user.id)
    
    if not credentials.get('access_token'):
        raise HTTPException(status_code=401, detail="Kroger account not connected")
    
    # Initialize Kroger integration with user's access token
    kroger_integration = KrogerIntegration(access_token=credentials['access_token'])
    
    # Find nearby stores
    nearby_stores = kroger_integration.find_nearby_stores(latitude, longitude, radius)
    
    if not nearby_stores['success']:
        # Attempt to refresh token if search fails
        refresh_response = kroger_integration.refresh_access_token(credentials['refresh_token'])
        
        if refresh_response['success']:
            # Update stored credentials
            save_kroger_credentials(
                id=current_user.id,
                access_token=refresh_response['access_token'],
                refresh_token=refresh_response['refresh_token']
            )
            
            # Retry store search with new token
            kroger_integration = KrogerIntegration(access_token=refresh_response['access_token'])
            nearby_stores = kroger_integration.find_nearby_stores(latitude, longitude, radius)
    
    return nearby_stores

# Handle both GET and POST requests for the callback
@router.get("/callback")
@router.post("/callback")
async def kroger_callback(
    request: Request,
    code: Optional[str] = None, 
    state: Optional[str] = None
):
    """Handle Kroger OAuth callback"""
    try:
        # Get params from either query params or request body
        body_data = {}
        if request.method == "POST":
            try:
                body_data = await request.json()
            except:
                try:
                    form_data = await request.form()
                    body_data = dict(form_data)
                except:
                    pass
        
        code_to_use = code or body_data.get('code')
        state_to_use = state or body_data.get('state')
        
        if not code_to_use:
            logger.error("No auth code provided in callback")
            return RedirectResponse(url=f"{FRONTEND_URL}/kroger-auth-callback?error=no_code")
        
        # More robust JWT decoding
        user_id = None
        if state_to_use:
            try:
                # Log the state for debugging
                logger.info(f"Decoding state JWT: {state_to_use[:20]}...")
                payload = jwt.decode(state_to_use, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                user_id = payload.get('user_id')
                logger.info(f"Successfully decoded JWT, user_id: {user_id}")
            except Exception as e:
                logger.error(f"JWT decoding error: {str(e)}")
                return RedirectResponse(url=f"{FRONTEND_URL}/kroger-auth-callback?error=invalid_state")

        # Exchange code for tokens
        token_url = "https://api.kroger.com/v1/connect/oauth2/token"
        
        # Prepare basic auth header
        auth_string = f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}"
        basic_auth = base64.b64encode(auth_string.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic_auth}"
        }
        
        # Get redirect URI from request body if provided
        redirect_uri_to_use = body_data.get('redirect_uri', KROGER_REDIRECT_URI)
        
        data = {
            "grant_type": "authorization_code",
            "code": code_to_use,
            "redirect_uri": redirect_uri_to_use
        }
        
        logger.info(f"Exchanging code for tokens with Kroger API")
        response = requests.post(token_url, headers=headers, data=data)
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            return RedirectResponse(url=f"{FRONTEND_URL}/kroger-auth-callback?error=token_exchange_failed")
        
        token_data = response.json()
        logger.info("Successfully received tokens from Kroger")
        
        # Store tokens even if user_id wasn't found in JWT
        # For testing purposes, you might want a fallback ID
        if not user_id:
            logger.warning("No user_id from JWT, using fallback ID")
            # Use a fallback ID for testing or get from session
            user_id = 2  # Your test user ID

        # Store tokens in database - with detailed logging
        from app.integration.kroger_db import save_kroger_credentials
        
        # Log token data received
        logger.info(f"Token data received from Kroger: access_token={bool(token_data.get('access_token'))}, refresh_token={bool(token_data.get('refresh_token'))}")
        logger.info(f"Token scopes: {token_data.get('scope', 'unknown')}")
        
        # Log user ID as numeric value to verify it's valid
        try:
            numeric_user_id = int(user_id)
            logger.info(f"Using numeric user_id: {numeric_user_id}")
        except (ValueError, TypeError):
            logger.error(f"Invalid user_id: {user_id}, defaulting to 26")
            numeric_user_id = 26  # Use your actual user ID here
        
        # Store the tokens
        success = save_kroger_credentials(
            id=numeric_user_id,
            access_token=token_data.get('access_token'),
            refresh_token=token_data.get('refresh_token')
        )
        
        if not success:
            logger.error(f"Failed to store tokens for user {user_id}")
            return RedirectResponse(url=f"{FRONTEND_URL}/kroger-auth-callback?error=storage_failed")
        
        # Redirect to frontend with success
        logger.info(f"Authentication successful, redirecting to frontend")
        return RedirectResponse(url=f"{FRONTEND_URL}/kroger-auth-callback?success=true")
        
    except Exception as e:
        logger.error(f"Kroger callback error: {str(e)}")
        # Add a fallback URL if FRONTEND_URL is somehow still undefined
        fallback_url = "https://smart-meal-planner-multi.vercel.app//kroger-auth-callback"
        redirect_url = f"{FRONTEND_URL}/kroger-auth-callback?error={str(e)}" if 'FRONTEND_URL' in globals() else f"{fallback_url}?error={str(e)}"
        return RedirectResponse(url=redirect_url)


# Add process-code endpoint to handle auth code processing directly
@router.post("/process-code")
@router.get("/process-code")
async def process_kroger_auth_code(
    request: Request,
    code: Optional[str] = None,
    redirect_uri: Optional[str] = None,
    user = Depends(get_user_from_token)
):
    # Extract and validate user ID immediately
    user_id = None
    try:
        user_id = user.get('user_id')
        if not user_id:
            # Try other possible structures
            if isinstance(user, dict):
                user_id = user.get('id')
            elif hasattr(user, 'id'):
                user_id = user.id
                
        # Convert to integer
        if user_id:
            user_id = int(user_id)
            if user_id <= 0:
                logger.error(f"Invalid user_id: {user_id}")
                user_id = 26  # Default to your test user ID
        else:
            logger.error("No user_id found in token data")
            user_id = 26  # Default to your test user ID
            
    except Exception as e:
        logger.error(f"Error extracting user_id: {e}")
        user_id = 26  # Default to your test user ID
        
    logger.info(f"Validated user ID: {user_id}")
    """
    Process Kroger auth code directly from the frontend
    """
    try:
        logger.info(f"Processing Kroger auth code for user {user_id}")
        
        # Allow code to come from query params or request body
        body_data = {}
        if request.method == "POST":
            try:
                body_data = await request.json()
            except:
                try:
                    form_data = await request.form()
                    body_data = dict(form_data)
                except:
                    pass
        
        code_to_use = code or body_data.get('code')
        redirect_uri_to_use = redirect_uri or body_data.get('redirect_uri') or KROGER_REDIRECT_URI
        
        if not code_to_use:
            logger.error("No auth code provided")
            return {
                "success": False,
                "message": "No authorization code provided"
            }
        
        # Exchange code for tokens
        token_url = "https://api.kroger.com/v1/connect/oauth2/token"
        
        # Prepare basic auth header
        auth_string = f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}"
        basic_auth = base64.b64encode(auth_string.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic_auth}"
        }
        
        data = {
            "grant_type": "authorization_code",
            "code": code_to_use,
            "redirect_uri": redirect_uri_to_use
        }
        
        logger.info(f"Exchanging code for tokens with redirect_uri: {redirect_uri_to_use}")
        response = requests.post(token_url, headers=headers, data=data)
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            return {
                "success": False,
                "message": f"Token exchange failed: {response.text}"
            }
        
        token_data = response.json()
        logger.info("Successfully received tokens from Kroger API")
        logger.info(f"Token data received: access_token={bool(token_data.get('access_token'))}, refresh_token={bool(token_data.get('refresh_token'))}")
        logger.info(f"Token scopes: {token_data.get('scope', 'unknown')}")
        
        # Convert user_id to numeric and validate
        try:
            numeric_user_id = int(user_id)
            logger.info(f"Using numeric user_id: {numeric_user_id}")
            
            if numeric_user_id <= 0:
                logger.error(f"Invalid user_id value: {numeric_user_id}, defaulting to 26")
                numeric_user_id = 26  # Use your actual user ID
        except (ValueError, TypeError):
            logger.error(f"Invalid user_id: {user_id}, defaulting to 26")
            numeric_user_id = 26  # Use your actual user ID
        
        # Store tokens in database
        success = save_kroger_credentials(
            id=numeric_user_id,
            access_token=token_data.get('access_token'),
            refresh_token=token_data.get('refresh_token')
        )
        
        if not success:
            logger.error(f"Failed to store tokens for user {user_id}")
            return {
                "success": False,
                "message": "Failed to store Kroger tokens"
            }
        
        return {
            "success": True,
            "message": "Kroger authentication successful",
            "has_access_token": bool(token_data.get('access_token')),
            "has_refresh_token": bool(token_data.get('refresh_token')),
            "scope": token_data.get('scope', '')
        }
        
    except Exception as e:
        logger.error(f"Error processing Kroger auth code: {str(e)}")
        return {
            "success": False,
            "message": f"Error processing authorization code: {str(e)}"
        }

@router.post("/auth-callback")
async def kroger_auth_callback_post(
    request: Request,
    user = Depends(get_user_from_token)
):
    # Extract and validate user ID immediately
    user_id = None
    try:
        user_id = user.get('user_id')
        if not user_id:
            # Try other possible structures
            if isinstance(user, dict):
                user_id = user.get('id')
            elif hasattr(user, 'id'):
                user_id = user.id
                
        # Convert to integer
        if user_id:
            user_id = int(user_id)
            if user_id <= 0:
                logger.error(f"Invalid user_id: {user_id}")
                user_id = 26  # Default to your test user ID
        else:
            logger.error("No user_id found in token data")
            user_id = 26  # Default to your test user ID
            
    except Exception as e:
        logger.error(f"Error extracting user_id: {e}")
        user_id = 26  # Default to your test user ID
        
    logger.info(f"Validated user ID for auth-callback: {user_id}")
    """
    Alternative POST endpoint for auth-callback when used directly by the frontend
    """
    try:
        logger.info(f"Processing POST auth-callback for user {user_id}")
        
        # Get form data
        form_data = None
        try:
            form_data = await request.form()
        except:
            pass
            
        # Try JSON if form data fails
        json_data = None
        if not form_data:
            try:
                json_data = await request.json()
            except:
                pass
        
        # Extract data from either source
        data = {}
        if form_data:
            data = dict(form_data)
        elif json_data:
            data = json_data
        
        code = data.get('code')
        redirect_uri = data.get('redirect_uri', KROGER_REDIRECT_URI)
            
        if not code:
            logger.error("No auth code provided in POST callback")
            return {
                "success": False,
                "message": "No authorization code provided"
            }
            
        # Exchange code for tokens
        token_url = "https://api.kroger.com/v1/connect/oauth2/token"
        
        # Prepare basic auth header
        auth_string = f"{KROGER_CLIENT_ID}:{KROGER_CLIENT_SECRET}"
        basic_auth = base64.b64encode(auth_string.encode()).decode()
        
        headers = {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": f"Basic {basic_auth}"
        }
        
        token_data = {
            "grant_type": "authorization_code",
            "code": code,
            "redirect_uri": redirect_uri
        }
        
        logger.info(f"Exchanging code for tokens with redirect_uri: {redirect_uri}")
        response = requests.post(token_url, headers=headers, data=token_data)
        
        if response.status_code != 200:
            logger.error(f"Token exchange failed: {response.status_code} - {response.text}")
            return {
                "success": False,
                "message": f"Token exchange failed: {response.text}"
            }
        
        token_response = response.json()
        logger.info("Successfully received tokens from Kroger")
        
        # Store tokens in database
        success = save_kroger_credentials(
            id=user_id,
            access_token=token_response.get('access_token'),
            refresh_token=token_response.get('refresh_token')
        )
        
        if not success:
            logger.error(f"Failed to store tokens for user {user_id}")
            return {
                "success": False,
                "message": "Failed to store Kroger tokens"
            }
        
        return {
            "success": True,
            "message": "Kroger authentication successful",
            "has_access_token": bool(token_response.get('access_token')),
            "has_refresh_token": bool(token_response.get('refresh_token')),
            "scope": token_response.get('scope', '')
        }
        
    except Exception as e:
        logger.error(f"Error in POST auth-callback: {str(e)}")
        return {
            "success": False,
            "message": f"Error processing authorization code: {str(e)}"
        }

@router.post("/store-tokens")
async def store_kroger_tokens(
    request: Request,
    user = Depends(get_user_from_token)
):
    """
    Explicitly store Kroger tokens passed from frontend
    """
    # Extract and validate user ID immediately
    user_id = None
    try:
        user_id = user.get('user_id')
        if not user_id:
            # Try other possible structures
            if isinstance(user, dict):
                user_id = user.get('id')
            elif hasattr(user, 'id'):
                user_id = user.id
                
        # Convert to integer
        if user_id:
            user_id = int(user_id)
            if user_id <= 0:
                logger.error(f"Invalid user_id: {user_id}")
                user_id = 26  # Default to your test user ID
        else:
            logger.error("No user_id found in token data")
            user_id = 26  # Default to your test user ID
            
    except Exception as e:
        logger.error(f"Error extracting user_id: {e}")
        user_id = 26  # Default to your test user ID
        
    logger.info(f"Storing tokens for user ID: {user_id}")
    
    try:
        # Get tokens from request body
        body_data = await request.json()
        access_token = body_data.get('access_token')
        refresh_token = body_data.get('refresh_token')
        
        if not access_token or not refresh_token:
            logger.error("Missing tokens in request")
            return {
                "success": False,
                "message": "Both access_token and refresh_token are required"
            }
            
        logger.info(f"Received tokens: access_token={bool(access_token)}, refresh_token={bool(refresh_token)}")
        logger.info(f"Access token length: {len(access_token)}")
        logger.info(f"Refresh token length: {len(refresh_token)}")
        
        # Store tokens in database
        from app.integration.kroger_db import save_kroger_credentials
        success = save_kroger_credentials(
            id=user_id,
            access_token=access_token,
            refresh_token=refresh_token
        )
        
        if success:
            logger.info(f"Successfully stored tokens for user {user_id}")
            return {
                "success": True,
                "message": "Tokens stored successfully"
            }
        else:
            logger.error(f"Failed to store tokens for user {user_id}")
            return {
                "success": False,
                "message": "Database operation failed"
            }
            
    except Exception as e:
        logger.error(f"Error storing tokens: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }

@router.post("/complete-auth")
async def complete_kroger_auth(
    request: Request,
    temp_token: str = Body(...),
    current_user: Any = Depends(get_user_from_token)
):
    """
    Complete Kroger authentication process by retrieving temporary tokens
    and storing them permanently for the authenticated user
    """
    try:
        user_id = current_user.get('user_id')
        
        # Retrieve tokens from temporary storage
        conn = get_db_connection()
        cursor = conn.cursor()
        
        cursor.execute("""
            SELECT access_token, refresh_token FROM temp_kroger_tokens
            WHERE token = %s AND expires_at > NOW()
        """, (temp_token,))
        
        token_row = cursor.fetchone()
        
        if not token_row:
            raise HTTPException(status_code=400, detail="Invalid or expired token")
            
        access_token, refresh_token = token_row
        
        # Delete the temporary token
        cursor.execute("DELETE FROM temp_kroger_tokens WHERE token = %s", (temp_token,))
        conn.commit()
        
        # Save tokens to user's account
        success = save_kroger_credentials(
            id=user_id,
            access_token=access_token,
            refresh_token=refresh_token
        )
        
        if not success:
            raise HTTPException(status_code=500, detail="Failed to save Kroger connection")
            
        return {"success": True, "message": "Kroger account connected successfully"}
        
    except Exception as e:
        logger.error(f"Error completing Kroger auth: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e)) 