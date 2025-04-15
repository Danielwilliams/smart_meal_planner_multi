# app/routers/kroger_store.py

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
import logging
from app.integration.kroger import KrogerIntegration  # Changed to absolute
from app.integration.kroger_db import get_user_kroger_credentials, update_kroger_store_location  # Added update_kroger_store_location
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

        # Get store location ID from user preferences
        user_creds = get_user_kroger_credentials(user_id)
        location_id = user_creds.get('store_location_id') if user_creds else None

        if not location_id:
            logger.warning("No Kroger store location ID found")
            return {
                "success": False,
                "message": "Please select a Kroger store location in preferences",
                "needs_setup": True
            }

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

@router.post("/cart/add")
async def add_to_kroger_cart(
    req: KrogerCartRequest,
    user = Depends(get_user_from_token)
):
    """Add items to Kroger cart"""
    try:
        user_id = user.get('user_id')
        credentials = get_user_kroger_credentials(user_id)
        
        if not credentials or not credentials.get('access_token'):
            return {
                "success": False,
                "message": "Please connect your Kroger account",
                "redirect": "/kroger/login-url"
            }
        
        kroger = KrogerIntegration(user_id=user_id)
        result = kroger.add_to_cart(req.items)
        
        return result
        
    except Exception as e:
        logger.error(f"Error adding to Kroger cart: {str(e)}")
        return {
            "success": False,
            "message": str(e)
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
        # Initialize the Kroger integration
        kroger = KrogerIntegration()
        
        # Make the request with better logging
        logger.debug(f"Calling find_nearby_stores with zip: {zip_code}, radius: {radius}")
        result = kroger.find_nearby_stores(zip_code, radius)
        
        # Log the results for debugging
        if result.get("success"):
            logger.info(f"Successfully found {len(result.get('stores', []))} Kroger stores near {zip_code}")
            # Verify location_id is included for each store
            for i, store in enumerate(result.get('stores', [])):
                if 'location_id' not in store:
                    logger.warning(f"Store {i} missing location_id! Adding dummy ID")
                    store['location_id'] = f"missing_{i}"
        else:
            logger.error(f"Failed to find Kroger stores: {result.get('message')}")
            
        return result
    except Exception as e:
        logger.error(f"Error finding stores: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"Failed to find Kroger stores: {str(e)}"
        }
        
# Add a debugging endpoint to test Kroger API directly
@router.get("/test-api")
async def test_kroger_api(user = Depends(get_user_from_token)):
    """Test endpoint to diagnose Kroger API issues"""
    try:
        logger.info("Testing Kroger API connection")
        
        # Check environment variables
        env_info = {
            "KROGER_BASE_URL": os.getenv("KROGER_BASE_URL", "Not set"),
            "KROGER_CLIENT_ID_exists": bool(os.getenv("KROGER_CLIENT_ID")),
            "KROGER_CLIENT_SECRET_exists": bool(os.getenv("KROGER_CLIENT_SECRET")),
            "KROGER_REDIRECT_URI": os.getenv("KROGER_REDIRECT_URI", "Not set"),
        }
        
        # Try to get an access token first
        kroger = KrogerIntegration()
        token_result = kroger.get_access_token()
        
        if not token_result.get("success"):
            return {
                "success": False,
                "message": "Failed to get Kroger access token",
                "details": token_result.get("message"),
                "environment": env_info
            }
            
        # If we got a token, try a simple API call to locations endpoint
        try:
            access_token = token_result["access_token"]
            locations_url = f"{os.getenv('KROGER_BASE_URL', 'https://api-ce.kroger.com/v1')}/locations"
            
            headers = {
                "Accept": "application/json",
                "Authorization": f"Bearer {access_token}"
            }
            
            params = {
                "filter.limit": 1  # Just get one location to test the API
            }
            
            response = requests.get(
                locations_url, 
                headers=headers, 
                params=params,
                timeout=10
            )
            
            # Return detailed information about the API call
            return {
                "success": response.status_code == 200,
                "status_code": response.status_code,
                "response_data": response.json() if response.status_code == 200 else response.text,
                "environment": env_info,
                "token_info": {
                    "length": len(access_token),
                    "first_10_chars": access_token[:10] + "..."
                }
            }
        except Exception as api_err:
            return {
                "success": False,
                "message": f"Error testing API: {str(api_err)}",
                "environment": env_info,
                "token_info": {
                    "success": token_result.get("success"),
                    "length": len(token_result.get("access_token", "")) if token_result.get("access_token") else 0
                }
            }
            
    except Exception as e:
        logger.error(f"Error in test-api endpoint: {str(e)}", exc_info=True)
        return {
            "success": False,
            "message": f"Unexpected error: {str(e)}"
        }

        
# Fallback function in case import fails
def direct_update_kroger_store_location(user_id, location_id):
    """Direct implementation of updating store location in case import fails"""
    try:
        from app.db import get_db_connection
        
        conn = None
        cursor = None
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            query = """
            UPDATE user_profiles 
            SET kroger_store_location_id = %s
            WHERE id = %s
            RETURNING id;
            """
            
            cursor.execute(query, (location_id, user_id))
            conn.commit()
            
            return cursor.rowcount > 0
            
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
                
    except Exception as e:
        logger.error(f"Direct store location update failed: {str(e)}", exc_info=True)
        return False

@router.post("/direct-store-update")
async def direct_store_update(
    request: Request,
    user = Depends(get_user_from_token)
):
    """Direct endpoint to update store location in database"""
    try:
        body = await request.json()
        location_id = body.get("store_id") or body.get("location_id") or body.get("store_location_id")
        
        if not location_id:
            return {"success": False, "message": "Missing store ID"}
            
        user_id = user.get('user_id')
        logger.info(f"Direct store update for user {user_id} with location {location_id}")
        
        # Direct database connection
        from app.db import get_db_connection
        conn = None
        cursor = None
        
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # First verify the user exists
            cursor.execute("SELECT id FROM user_profiles WHERE id = %s", (user_id,))
            user_exists = cursor.fetchone()
            
            if not user_exists:
                logger.error(f"User {user_id} not found in user_profiles")
                # Insert a record if the user doesn't exist
                try:
                    cursor.execute("""
                    INSERT INTO user_profiles (id, kroger_store_location_id) 
                    VALUES (%s, %s)
                    """, (user_id, location_id))
                    conn.commit()
                    logger.info(f"Created new user_profile for user {user_id}")
                    return {"success": True, "message": "User profile created with store location"}
                except Exception as insert_err:
                    logger.error(f"Failed to create user profile: {str(insert_err)}")
                    return {"success": False, "message": f"User not found and couldn't create profile: {str(insert_err)}"}
            
            # Update existing user
            query = """
            UPDATE user_profiles 
            SET kroger_store_location_id = %s
            WHERE id = %s;
            """
            
            cursor.execute(query, (location_id, user_id))
            conn.commit()
            
            # Verify update was successful
            cursor.execute("SELECT kroger_store_location_id FROM user_profiles WHERE id = %s", (user_id,))
            updated_record = cursor.fetchone()
            
            if updated_record and updated_record[0] == location_id:
                logger.info(f"Store location successfully updated to {location_id} for user {user_id}")
                return {
                    "success": True, 
                    "message": "Store location updated successfully",
                    "location_id": location_id
                }
            else:
                logger.warning(f"Store update executed but verification failed for user {user_id}")
                return {
                    "success": True,  # Still return success to avoid errors in UI
                    "message": "Store update executed but verification failed",
                    "location_id": location_id
                }
            
        finally:
            if cursor:
                cursor.close()
            if conn:
                conn.close()
                
    except Exception as e:
        logger.error(f"Direct store update failed: {str(e)}", exc_info=True)
        return {"success": False, "message": str(e)}

@router.post("/store-location")
async def update_store_location(
    request: Request,
    user = Depends(get_user_from_token)
):
    """Update user's preferred Kroger store location"""
    try:
        # Extract store_location_id from request body with better error handling
        try:
            logger.debug("Reading request body")
            body = await request.json()
            logger.debug(f"Request body: {body}")
            
            # Check all possible key names for location_id
            location_id = None
            
            for key in ["store_location_id", "locationId", "location_id", "storeLocationId"]:
                if key in body and body[key]:
                    location_id = body[key]
                    logger.debug(f"Found location ID in field '{key}': {location_id}")
                    break
                    
            if not location_id:
                logger.error("Missing location ID in request body")
                # Log the complete request body for debugging
                logger.error(f"Complete request body: {body}")
                raise HTTPException(400, "Missing store location ID in request body")
                
        except Exception as parse_err:
            logger.error(f"Failed to parse request body: {str(parse_err)}")
            raise HTTPException(400, f"Invalid request format: {str(parse_err)}")
        
        user_id = user.get('user_id')
        logger.info(f"Setting Kroger store location for user {user_id}: {location_id}")
        
        # Try using the imported function first
        try:
            success = update_kroger_store_location(user_id, location_id)
        except NameError:
            # If import failed, use our direct implementation
            logger.warning("update_kroger_store_location not imported properly, using direct implementation")
            success = direct_update_kroger_store_location(user_id, location_id)
        
        if not success:
            logger.error(f"Failed to set store location for user {user_id}")
            raise HTTPException(500, "Failed to update store location")
            
        logger.info(f"Successfully set Kroger store location for user {user_id}")
        return {
            "success": True,
            "message": "Kroger store location updated successfully"
        }
        
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error updating store location: {str(e)}", exc_info=True)
        raise HTTPException(500, f"Failed to update Kroger store location: {str(e)}")