"""
Instacart Store Router

This router handles all endpoints related to Instacart retailers and product search.
"""

import logging
import os
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel, Field

from app.utils.auth_utils import get_user_from_token as get_current_user
from app.integration import instacart

# Configure logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(tags=["instacart"])

# Models
class Address(BaseModel):
    street: Optional[str] = None
    city: Optional[str] = None
    state: Optional[str] = None
    zip_code: Optional[str] = None
    country: Optional[str] = None

class RetailerResponse(BaseModel):
    id: str
    name: str
    logo_url: Optional[str] = None
    address: Optional[Address] = None
    distance: Optional[float] = None

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

@router.get("/instacart/retailers/nearby", response_model=List[RetailerResponse])
async def get_nearby_instacart_retailers(
    zip_code: str = Query(..., description="ZIP code to find nearby retailers"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a list of Instacart retailers near a specified ZIP code.
    """
    try:
        # Create a proper client
        client = instacart.get_instacart_client()

        # Get all retailers as a base
        all_retailers = client.get_retailers()

        # In the future, Instacart may add a native API for nearby retailers
        # For now, we'll return all available retailers with mock proximity data

        # Generate mock distance data based on the zip code
        # This is just a placeholder until Instacart API supports location-based filtering
        retailers_with_proximity = []
        for i, retailer in enumerate(all_retailers):
            # Create a copy to avoid modifying the original
            enhanced_retailer = retailer.copy()
            attributes = enhanced_retailer.get("attributes", {})

            # Create a deterministic "distance" based on ZIP code and retailer ID
            # (This is just for demonstration until real proximity data is available)
            zip_prefix = zip_code[0] if zip_code and len(zip_code) > 0 else "0"
            distance = ((ord(zip_prefix) * 3) + (hash(retailer.get("id", "")) % 100)) % 50

            # Add address and distance information
            if "attributes" not in enhanced_retailer:
                enhanced_retailer["attributes"] = {}

            enhanced_retailer["attributes"]["distance"] = float(distance)
            enhanced_retailer["attributes"]["address"] = {
                "city": f"Test City {i % 10}",
                "state": "TS",
                "zip_code": zip_code
            }

            retailers_with_proximity.append(enhanced_retailer)

        # Sort by the mock distance
        retailers_with_proximity.sort(key=lambda r: r["attributes"].get("distance", 999))

        # Format for response
        formatted_retailers = []
        for retailer in retailers_with_proximity[:10]:  # Limit to 10 "nearest"
            attributes = retailer.get("attributes", {})

            formatted_retailers.append({
                "id": retailer.get("id", ""),
                "name": attributes.get("name", ""),
                "logo_url": attributes.get("logo_url", ""),
                "distance": attributes.get("distance"),
                "address": attributes.get("address", {})
            })

        return formatted_retailers

    except Exception as e:
        logger.error(f"Error getting nearby Instacart retailers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get nearby Instacart retailers: {str(e)}"
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