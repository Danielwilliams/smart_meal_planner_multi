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

@router.post("/search-and-suggest")
async def search_and_suggest_kroger_items(
    req: KrogerSearchRequest,
    user = Depends(get_user_from_token)
):
    """Search for items and return suggestions with UPC codes for cart operations"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Searching and suggesting Kroger items for user {user_id}")

        # Get store location ID from user preferences
        user_creds = get_user_kroger_credentials(user_id)
        location_id = user_creds.get('store_location_id') if user_creds else None
        
        if not location_id:
            return {
                "success": False,
                "message": "Please select a Kroger store location first",
                "needs_setup": True
            }
        
        # Search for each item and return suggestions
        suggestions = []
        for item_name in req.items:
            try:
                # Use the existing search function
                search_result = kroger_search_item(item_name, location_id)
                
                if search_result.get("success") and search_result.get("results"):
                    # Take the top 3 results for user selection
                    item_suggestions = search_result["results"][:3]
                    suggestions.append({
                        "original_item": item_name,
                        "suggestions": item_suggestions
                    })
                else:
                    # No results found
                    suggestions.append({
                        "original_item": item_name,
                        "suggestions": [],
                        "message": f"No results found for '{item_name}'"
                    })
                    
            except Exception as search_error:
                logger.error(f"Error searching for item '{item_name}': {search_error}")
                suggestions.append({
                    "original_item": item_name,
                    "suggestions": [],
                    "error": str(search_error)
                })
        
        return {
            "success": True,
            "suggestions": suggestions
        }
        
    except Exception as e:
        logger.error(f"Error in search and suggest: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.post("/cart/add")
async def add_to_kroger_cart(
    req: KrogerCartRequest,
    user = Depends(get_user_from_token)
):
    """Add items to Kroger cart with enhanced token handling"""
    try:
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
            
        logger.info(f"Adding items to Kroger cart for user {user_id}")
        
        # Import at function level for better error tracing
        from app.integration.kroger_db import get_user_kroger_credentials, save_kroger_credentials
        from app.integration.kroger import add_to_kroger_cart, refresh_kroger_token
        
        # Get user's Kroger credentials from database
        credentials = get_user_kroger_credentials(user_id)
        logger.info(f"Credentials from DB: {credentials}")
        
        # Get location ID - try from credentials then default
        location_id = credentials.get('store_location_id')
        if not location_id:
            logger.warning(f"No store location ID for user {user_id}, using default")
            # Default store if not found
            location_id = "62000044"  # Use your store ID
            
        # Check if we have an access token in the DB or request
        access_token = credentials.get('access_token')
        if not access_token:
            logger.error(f"No Kroger access token found in database for user {user_id}")
            
            # Check if token was provided in the request
            try:
                req_data = req.dict()
                if req_data.get('access_token'):
                    logger.info("Access token provided in request")
                    access_token = req_data.get('access_token')
                    
                    # If we have a token from request, try to save it to DB
                    if access_token:
                        refresh_token = req_data.get('refresh_token')
                        success = save_kroger_credentials(
                            id=user_id,
                            access_token=access_token,
                            refresh_token=refresh_token,
                            store_location_id=location_id
                        )
                        logger.info(f"Saved tokens from request: {success}")
                    
            except Exception as req_error:
                logger.error(f"Error checking request for token: {req_error}")
            
            # If we still don't have a token, need reconnect
            if not access_token:
                return {
                    "success": False,
                    "message": "Please connect your Kroger account",
                    "needs_reconnect": True,
                    "redirect": "/kroger/login-url"
                }
        
        # Format items for Kroger API
        kroger_items = []
        items_without_upc = []
        
        for item in req.items:
            # Ensure UPC is properly formatted
            upc = item.get("upc", "")
            if not upc:
                logger.warning(f"Item missing UPC: {item}")
                # Store items without UPC for search-first workflow
                items_without_upc.append({
                    "name": item.get("name", ""),
                    "quantity": item.get("quantity", 1)
                })
                continue
                
            kroger_items.append({
                "upc": upc,
                "quantity": item.get("quantity", 1)
            })
        
        # If no items have UPC codes, return a needs_search response instead of error
        if not kroger_items:
            if items_without_upc:
                return {
                    "success": False,
                    "needs_search": True,
                    "items_to_search": items_without_upc,
                    "message": "Items need to be searched for and selected before adding to cart"
                }
            else:
                return {
                    "success": False,
                    "message": "No valid items provided"
                }
        
        # First attempt to add to cart
        logger.info(f"Attempting cart operation with access token length: {len(access_token) if access_token else 0}")
        logger.info(f"Using store location ID: {location_id}")
        
        result = add_to_kroger_cart(
            access_token=access_token,
            location_id=location_id,
            items=kroger_items
        )
        
        # If token is invalid, attempt to refresh
        if not result.get('success'):
            token_refresh_error_keywords = ['token', 'authentication', 'expired', 'invalid']
            
            logger.info(f"Cart operation failed: {result.get('message', '')}")
            
            if any(keyword in str(result.get('message', '')).lower() for keyword in token_refresh_error_keywords):
                logger.info(f"Token appears invalid. Attempting to refresh for user {user_id}")
                
                try:
                    # Attempt to refresh the token
                    try:
                        new_access_token = refresh_kroger_token(user_id)
                    except Exception as refresh_err:
                        logger.error(f"Refresh function error: {refresh_err}")
                        new_access_token = None
                    
                    if new_access_token:
                        # Retry cart addition with new token
                        logger.info("Retrying cart operation with refreshed token")
                        result = add_to_kroger_cart(
                            access_token=new_access_token,
                            location_id=location_id,
                            items=kroger_items
                        )
                        
                        # If retry fails, indicate reconnection needed
                        if not result.get('success'):
                            logger.error("Retry with refreshed token also failed")
                            result.update({
                                "needs_reconnect": True,
                                "message": "Unable to complete cart addition after token refresh"
                            })
                    else:
                        # Token refresh failed
                        logger.error("Token refresh failed")
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
        
    except ImportError as imp_err:
        # Handle specific import error case with better diagnostics
        logger.error(f"Import error in Kroger cart function: {str(imp_err)}")
        
        # Check if this is the refresh_kroger_token import error which we just fixed
        if "refresh_kroger_token" in str(imp_err):
            logger.info("This is the refresh_kroger_token import error - should be fixed now")
            return {
                "success": False,
                "message": "Server needs restarting with latest code changes.",
                "error": str(imp_err),
                "needs_reconnect": True
            }
        return {
            "success": False,
            "message": f"Server configuration error: {str(imp_err)}",
            "needs_reconnect": True
        }
    except Exception as e:
        logger.error(f"Unexpected error adding to Kroger cart: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"An unexpected error occurred: {str(e)}",
            "error_type": type(e).__name__,
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
@router.get("/store-location")  # Add GET support for more client compatibility
async def update_store_location(
    request: Request,
    user = Depends(get_user_from_token)
):
    """Update user's preferred Kroger store location with enhanced error handling"""
    try:
        # Extract and validate user ID
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
        
        # Get location_id from different sources based on request method
        location_id = None
        
        if request.method == "POST":
            # For POST, try to parse JSON body
            try:
                data = await request.json()
                location_id = data.get('location_id')
                logger.info(f"Got location_id from POST body: {location_id}")
            except Exception as json_err:
                logger.error(f"Error parsing JSON body: {json_err}")
                # Try form data as fallback
                try:
                    form_data = await request.form()
                    location_id = form_data.get('location_id')
                    logger.info(f"Got location_id from form data: {location_id}")
                except Exception as form_err:
                    logger.error(f"Error parsing form data: {form_err}")
        else:
            # For GET, check query parameters
            location_id = request.query_params.get('location_id')
            logger.info(f"Got location_id from query params: {location_id}")
        
        if not location_id:
            raise HTTPException(400, "location_id is required")
        
        logger.info(f"Updating store location for user {user_id} to {location_id}")
            
        # Use the kroger_db module directly for the update
        from app.integration.kroger_db import update_kroger_store_location
        success = update_kroger_store_location(user_id, location_id)
        
        if not success:
            raise HTTPException(500, "Failed to update store location")
        
        # Get the user's credentials to verify the update
        from app.integration.kroger_db import get_user_kroger_credentials
        updated_creds = get_user_kroger_credentials(user_id)
        logger.info(f"Verified store location after update: {updated_creds.get('store_location_id')}")
            
        return {
            "success": True, 
            "message": "Store location updated successfully",
            "user_id": user_id,
            "location_id": location_id,
            "store_location": location_id,  # Add for consistency with frontend naming
            "verified": updated_creds.get('store_location_id') == location_id
        }
        
    except Exception as e:
        logger.error(f"Error updating store location: {str(e)}")
        return {
            "success": False,
            "error": str(e),
            "message": "Error updating store location"
        }

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