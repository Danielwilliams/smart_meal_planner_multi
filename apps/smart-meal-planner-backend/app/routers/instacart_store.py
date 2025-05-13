"""
Instacart Store Router

This router handles all endpoints related to Instacart retailers and product search.
"""

import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel

from app.utils.auth_utils import get_user_from_token as get_current_user
from app.integration import instacart

# Configure logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(tags=["instacart"])

# Models
class RetailerResponse(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None

class ProductResponse(BaseModel):
    id: str
    name: str
    price: Optional[float] = None
    image_url: Optional[str] = None
    size: Optional[str] = None

# Routes
@router.get("/instacart/retailers", response_model=List[RetailerResponse])
async def get_instacart_retailers(current_user: dict = Depends(get_current_user)):
    """
    Get a list of available retailers on Instacart.
    """
    try:
        client = instacart.get_instacart_client()
        retailers = client.get_retailers()
        
        # Transform to response model
        formatted_retailers = []
        for retailer in retailers:
            attributes = retailer.get("attributes", {})
            formatted_retailers.append({
                "id": retailer.get("id", ""),
                "name": attributes.get("name", ""),
                "logo_url": attributes.get("logo_url", "")
            })
            
        return formatted_retailers
        
    except Exception as e:
        logger.error(f"Error getting Instacart retailers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Instacart retailers: {str(e)}"
        )

@router.get("/instacart/retailers/{retailer_id}/products/search", response_model=List[ProductResponse])
async def search_instacart_products(
    retailer_id: str,
    query: str,
    limit: int = Query(10, ge=1, le=50),
    current_user: dict = Depends(get_current_user)
):
    """
    Search for products at a specific Instacart retailer.
    """
    try:
        client = instacart.get_instacart_client()
        products = client.search_products(retailer_id, query, limit)
        
        # Transform to response model
        formatted_products = []
        for product in products:
            attributes = product.get("attributes", {})
            formatted_products.append({
                "id": product.get("id", ""),
                "name": attributes.get("name", ""),
                "price": attributes.get("price", {}).get("value"),
                "image_url": attributes.get("image_url", ""),
                "size": attributes.get("size", "")
            })
            
        return formatted_products
        
    except Exception as e:
        logger.error(f"Error searching Instacart products: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to search Instacart products: {str(e)}"
        )

@router.get("/instacart/match/{retailer_id}", response_model=Dict)
async def match_grocery_list(
    retailer_id: str,
    menu_id: int,
    current_user: dict = Depends(get_current_user)
):
    """
    Match a grocery list to Instacart products.
    This endpoint gets the grocery list for a menu and finds matching products.
    """
    try:
        # This would need to integrate with your existing grocery list endpoint
        # For now, returning a placeholder
        
        # TODO: Implement grocery list matching with Instacart products
        
        return {
            "menu_id": menu_id,
            "retailer_id": retailer_id,
            "matches": [],
            "unmatched": []
        }
        
    except Exception as e:
        logger.error(f"Error matching grocery list: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to match grocery list: {str(e)}"
        )