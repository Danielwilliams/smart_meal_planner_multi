# app/routers/kroger_store.py

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional
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
    location_id: str,
    user = Depends(get_user_from_token)
):
    """Update user's preferred Kroger store location"""
    try:
        user_id = user.get('user_id')
        kroger = KrogerIntegration()
        result = await kroger.set_store_location(user_id, location_id)
        
        if not result["success"]:
            raise HTTPException(500, result["message"])
            
        return result
        
    except Exception as e:
        logger.error(f"Error updating store location: {str(e)}")
        raise HTTPException(500, str(e))