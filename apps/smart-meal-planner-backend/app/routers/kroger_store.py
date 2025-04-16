# app/routers/kroger_store.py

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from app.integration.kroger import KrogerIntegration  # Changed to absolute
from app.integration.kroger_db import get_user_kroger_credentials  # Changed to absolute
from app.utils.auth_utils import get_user_from_token  # Changed to absolute
import os

logger = logging.getLogger(__name__)

class KrogerSearchRequest(BaseModel):
    items: List[str]

class KrogerCartRequest(BaseModel):
    items: List[dict]

router = APIRouter(prefix="/kroger", tags=["Kroger"])



# app/routers/kroger_store.py
@router.post("/search")
async def search_kroger_items(
    req: KrogerSearchRequest,
    user = Depends(get_user_from_token)
):
    """Search for items in Kroger store"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Starting Kroger search for user {user_id}")

        # Get store location ID from user preferences - MAKE SURE THIS WORKS
        user_creds = get_user_kroger_credentials(user_id)
        location_id = user_creds.get('store_location_id') if user_creds else None
        
        # Log location ID for debugging
        logger.info(f"User {user_id} location ID: {location_id}")

        if not location_id:
            logger.warning("No Kroger store location ID found")
            return {
                "success": False,
                "message": "Please select a Kroger store location in preferences",
                "needs_setup": True
            }
        
        # Pass user_id to KrogerIntegration to try user-specific credentials
        kroger = KrogerIntegration()

        search_results = []
        
        for item in req.items:
            cleaned_term = item.strip()
            result = kroger.search_products(
                query=cleaned_term,
                location_id=location_id
            )
            
            if not result.get("success"):
                return result  # Return error if token or search fails
            
            # Add original query to each product
            for product in result.get("results", []):
                product["original_query"] = item
            search_results.extend(result.get("results", []))

        return {
            "success": True,
            "results": search_results
        }
            
    except Exception as e:
        logger.error(f"Error searching Kroger items: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/direct-search")
async def direct_kroger_search(
    term: str,
    locationId: str,
    user = Depends(get_user_from_token)
):
    """Direct search for a single term in Kroger"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Direct Kroger search for user {user_id}: term={term}, locationId={locationId}")
        
        # Import the kroger_search_item function directly
        from app.integration.kroger import kroger_search_item
        
        # Use the standalone function
        result = kroger_search_item(term, locationId)
        
        return result
            
    except Exception as e:
        logger.error(f"Error in direct Kroger search: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/search-products")
async def search_products(
    query: str,
    location_id: Optional[str] = None,
    user = Depends(get_user_from_token)
):
    """Search for products in Kroger store"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Product search for user {user_id}: query={query}")

        # If location_id not provided, get from user preferences
        if not location_id:
            user_creds = get_user_kroger_credentials(user_id)
            location_id = user_creds.get('store_location_id') if user_creds else None
            
            if not location_id:
                logger.warning("No Kroger store location ID found")
                return {
                    "success": False,
                    "message": "Please select a Kroger store location in preferences",
                    "needs_setup": True
                }
        
        # Use the existing standalone function
        from app.integration.kroger import kroger_search_item
        result = kroger_search_item(query, location_id)
        
        if result.get("success"):
            return result.get("results", [])
        else:
            # Return empty array if search fails
            return []
            
    except Exception as e:
        logger.error(f"Error searching Kroger products: {str(e)}")
        return []

# In app/routers/kroger_store.py

@router.post("/cart/add")
async def add_to_kroger_cart(
    req: KrogerCartRequest,
    user = Depends(get_user_from_token)
):
    """Add items to Kroger cart with enhanced token handling"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Adding items to Kroger cart for user {user_id}")
        
        # Import at function level for better error tracing
        from app.integration.kroger_db import get_user_kroger_credentials
        from app.integration.kroger import add_to_kroger_cart, refresh_kroger_token
        
        # Get user's Kroger credentials from database
        credentials = get_user_kroger_credentials(user_id)
        
        if not credentials or not credentials.get('access_token'):
            logger.error(f"No Kroger access token found for user {user_id}")
            return {
                "success": False,
                "message": "Please connect your Kroger account",
                "needs_reconnect": True,
                "redirect": "/kroger/login-url"
            }
        
        # Get location ID
        location_id = credentials.get('store_location_id')
        if not location_id:
            logger.warning(f"No store location ID for user {user_id}")
            return {
                "success": False,
                "message": "Please select a Kroger store location",
                "needs_setup": True
            }
        
        # Format items for Kroger API
        kroger_items = []
        for item in req.items:
            # Ensure UPC is properly formatted
            upc = item.get("upc", "")
            if not upc:
                logger.warning(f"Item missing UPC: {item}")
                continue
                
            kroger_items.append({
                "upc": upc,
                "quantity": item.get("quantity", 1)
            })
        
        if not kroger_items:
            return {
                "success": False,
                "message": "No valid items with UPC codes"
            }
        
        # First attempt to add to cart
        result = add_to_kroger_cart(
            access_token=credentials.get('access_token'),
            location_id=location_id,
            items=kroger_items
        )
        
        # If token is invalid, attempt to refresh
        if not result.get('success'):
            token_refresh_error_keywords = ['token', 'authentication', 'expired', 'invalid']
            
            if any(keyword in str(result.get('message', '')).lower() for keyword in token_refresh_error_keywords):
                logger.info(f"Token appears invalid. Attempting to refresh for user {user_id}")
                
                try:
                    # Attempt to refresh the token
                    new_access_token = refresh_kroger_token(user_id)
                    
                    if new_access_token:
                        # Retry cart addition with new token
                        result = add_to_kroger_cart(
                            access_token=new_access_token,
                            location_id=location_id,
                            items=kroger_items
                        )
                        
                        # If retry fails, indicate reconnection needed
                        if not result.get('success'):
                            result.update({
                                "needs_reconnect": True,
                                "message": "Unable to complete cart addition after token refresh"
                            })
                    else:
                        # Token refresh failed
                        result = {
                            "success": False,
                            "needs_reconnect": True,
                            "message": "Token refresh failed. Please reconnect your Kroger account."
                        }
                
                except Exception as refresh_error:
                    logger.error(f"Token refresh error: {str(refresh_error)}")
                    result = {
                        "success": False,
                        "needs_reconnect": True,
                        "message": "Unexpected error during token refresh"
                    }
        
        return result
        
    except Exception as e:
        logger.error(f"Unexpected error adding to Kroger cart: {str(e)}")
        return {
            "success": False,
            "message": "An unexpected error occurred",
            "needs_reconnect": True
        }


@router.get("/stores/near")
async def find_nearby_stores(
    zip_code: Optional[str] = '80538',
    radius: Optional[int] = 10,
    user = Depends(get_user_from_token)
):
    """Find nearby Kroger stores"""
    logger.info(f"Searching stores - Zip: {zip_code}, Radius: {radius}")
    
    try:
        kroger = KrogerIntegration()
        result = kroger.find_nearby_stores(zip_code, radius)

        logger.debug(f"Kroger stores search result: {result}")

        return result
    except Exception as e:
        logger.error(f"Error finding stores: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": str(e)
        }

        
@router.post("/store-location")
async def update_store_location(
    request: Request,
    user = Depends(get_user_from_token)
):
    """Update user's preferred Kroger store location"""
    try:
        user_id = user.get('user_id')
        
        # Parse the request body
        data = await request.json()
        location_id = data.get('location_id')
        
        if not location_id:
            raise HTTPException(400, "location_id is required")
            
        # Use the kroger_db module directly instead of the non-existent method
        from app.integration.kroger_db import update_kroger_store_location
        success = update_kroger_store_location(user_id, location_id)
        
        if not success:
            raise HTTPException(500, "Failed to update store location")
            
        return {"success": True, "message": "Store location updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating store location: {str(e)}")
        raise HTTPException(500, str(e))

@router.get("/check-credentials")
async def check_kroger_credentials(
    user = Depends(get_user_from_token)
):
    """Debug endpoint to check if Kroger credentials exist"""
    try:
        user_id = user.get('user_id')
        
        # Import directly here for clarity
        from app.integration.kroger_db import get_user_kroger_credentials
        
        # Get the credentials
        credentials = get_user_kroger_credentials(user_id)
        
        # Return sanitized info (don't return actual tokens)
        return {
            "has_credentials": credentials is not None,
            "has_access_token": bool(credentials and credentials.get('access_token')),
            "has_refresh_token": bool(credentials and credentials.get('refresh_token')),
            "has_location_id": bool(credentials and credentials.get('store_location_id')),
            "user_id": user_id
        }
    except Exception as e:
        return {
            "success": False,
            "error": str(e)
        }