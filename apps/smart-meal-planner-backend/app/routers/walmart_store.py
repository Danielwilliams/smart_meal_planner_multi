from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel
from typing import List, Optional
import logging
from app.integration.walmart import WalmartIntegration
from app.utils.auth_utils import get_user_from_token

logger = logging.getLogger(__name__)

class WalmartSearchRequest(BaseModel):
    items: List[str]

class WalmartCartRequest(BaseModel):
    items: List[dict]

router = APIRouter(prefix="/walmart", tags=["Walmart"])

@router.post("/search")
async def search_walmart_items(
    req: WalmartSearchRequest,
    user = Depends(get_user_from_token)
):
    """Search for items in Walmart store"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Starting Walmart search for user {user_id}")

        walmart = WalmartIntegration()
        
        search_results = []
        for item in req.items:
            cleaned_term = item.strip()
            result = walmart.search_products(query=cleaned_term)
            
            if result.get("success"):
                # Add the original query to each product result
                for product in result.get('results', []):
                    product['original_query'] = item
                search_results.extend(result.get('results', []))
            else:
                logger.warning(f"Search failed for '{item}': {result.get('message')}")

        return {
            "success": True,
            "results": search_results
        }
            
    except Exception as e:
        logger.error(f"Error searching Walmart items: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.post("/cart/add")
async def add_to_walmart_cart(
    req: WalmartCartRequest,
    user = Depends(get_user_from_token)
):
    """Add items to Walmart cart"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Adding items to Walmart cart for user {user_id}")
        
        walmart = WalmartIntegration()
        result = walmart.add_to_cart(req.items)
        
        return result
        
    except Exception as e:
        logger.error(f"Error adding to Walmart cart: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/stores/near")
async def find_nearby_stores(
    zip_code: Optional[str] = '94040',
    radius: Optional[int] = 15,
    user = Depends(get_user_from_token)
):
    """Find nearby Walmart stores"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Finding Walmart stores near {zip_code} for user {user_id}")
        
        walmart = WalmartIntegration()
        result = walmart.find_nearby_stores(zip_code, radius)
        
        return result
        
    except Exception as e:
        logger.error(f"Error finding Walmart stores: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/product/{product_id}")
async def get_product_details(
    product_id: str,
    user = Depends(get_user_from_token)
):
    """Get details for a specific Walmart product"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Getting product details for {product_id} - user {user_id}")
        
        integration = WalmartIntegration().integration
        result = integration.get_product_details(product_id)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting product details: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }