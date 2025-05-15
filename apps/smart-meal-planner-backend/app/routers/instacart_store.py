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
router = APIRouter(prefix="/instacart", tags=["instacart"])

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

# Routes - Update paths to match frontend expectations
@router.get("/retailers", response_model=None)
async def get_instacart_retailers(current_user: dict = Depends(get_current_user)):
    """
    Get a list of available retailers on Instacart.
    Returns a list of retailer objects with id, name, and logo_url.
    """
    try:
        logger.info("Starting request to get Instacart retailers")

        # Get API key information for debugging
        api_key = os.environ.get("INSTACARTAPI_DEV")
        if not api_key:
            logger.error("No Instacart API key configured")
            # Return a proper error response
            return {
                "error": "Instacart API key is not configured",
                "status": "error",
                "details": "The INSTACARTAPI_DEV environment variable must be set with format 'InstacartAPI YOUR_API_KEY'"
            }

        logger.info(f"Using API key: {api_key[:4]}...{api_key[-4:] if len(api_key) > 8 else '***'}")

        # Get client and make the request with detailed logging
        try:
            client = instacart.get_instacart_client()
            logger.info("Client created successfully, getting retailers...")
            retailers = client.get_retailers()
            logger.info(f"Retrieved {len(retailers)} retailers from Instacart API")

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

        except Exception as api_error:
            logger.error(f"Error in API request: {str(api_error)}")

            # Return a proper error response
            logger.info("Returning error response for API error")
            return {
                "error": f"Error in Instacart API request: {str(api_error)}",
                "status": "error",
                "details": {
                    "type": type(api_error).__name__,
                    "message": str(api_error)
                }
            }

    except Exception as e:
        logger.error(f"Error getting Instacart retailers: {str(e)}")
        # Return a proper error response
        logger.info("Returning error response for general error")
        return {
            "error": f"Failed to get Instacart retailers: {str(e)}",
            "status": "error",
            "details": {
                "type": type(e).__name__,
                "message": str(e)
            }
        }

@router.get("/retailers/{retailer_id}/products/search", response_model=None)
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
        # Get API key information for debugging
        api_key = os.environ.get("INSTACARTAPI_DEV")
        if not api_key:
            logger.error("No Instacart API key configured")
            # Return a proper error response
            return {
                "error": "Instacart API key is not configured",
                "status": "error",
                "details": "The INSTACARTAPI_DEV environment variable must be set with format 'InstacartAPI YOUR_API_KEY'",
                "query_info": {
                    "retailer_id": retailer_id,
                    "query": query,
                    "limit": limit
                }
            }

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

        except Exception as api_error:
            logger.error(f"Error in API product search: {str(api_error)}")

            # Return a proper error response
            return {
                "error": f"Error searching Instacart products: {str(api_error)}",
                "status": "error",
                "details": {
                    "type": type(api_error).__name__,
                    "message": str(api_error)
                },
                "query_info": {
                    "retailer_id": retailer_id,
                    "query": query,
                    "limit": limit
                }
            }

    except Exception as e:
        logger.error(f"Error searching Instacart products: {str(e)}")
        # Return a proper error response
        return {
            "error": f"General error searching Instacart products: {str(e)}",
            "status": "error",
            "details": {
                "type": type(e).__name__,
                "message": str(e)
            },
            "query_info": {
                "retailer_id": retailer_id,
                "query": query,
                "limit": limit
            }
        }

@router.get("/retailers/nearby", response_model=None)
async def get_nearby_instacart_retailers(
    zip_code: str = Query(..., description="ZIP code to find nearby retailers"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a list of Instacart retailers near a specified ZIP code.
    Currently uses mock proximity data since the Instacart API doesn't support location-based filtering.
    """
    try:
        logger.info(f"Getting nearby retailers for ZIP code {zip_code}")

        # First try to get all retailers with detailed error handling
        try:
            client = instacart.get_instacart_client()
            all_retailers = client.get_retailers()
            logger.info(f"Retrieved {len(all_retailers)} retailers from Instacart API")

            if not all_retailers:
                logger.warning("No retailers returned from Instacart API")
                return {
                    "retailers": [],
                    "status": "success",
                    "message": "No retailers found",
                    "count": 0
                }
        except Exception as api_error:
            logger.error(f"Error getting retailers: {str(api_error)}")
            # Return a structured error response with empty retailers list
            return {
                "retailers": [],
                "status": "error",
                "message": f"Failed to retrieve retailers: {str(api_error)}",
                "error_details": {
                    "type": type(api_error).__name__,
                    "message": str(api_error)
                }
            }

        # Check if we have any retailers to process
        if not all_retailers:
            return {
                "retailers": [],
                "status": "success",
                "message": "No retailers found",
                "count": 0
            }

        # In the future, Instacart may add a native API for nearby retailers
        # Return an error explaining that the API doesn't support location filtering
        logger.info("Instacart API doesn't currently support location-based filtering")

        return {
            "error": "Location-based filtering not supported",
            "status": "not_implemented",
            "message": "The Instacart API currently doesn't support location-based filtering of retailers",
            "details": {
                "workaround": "The frontend should display all available retailers without filtering by location",
                "future_plans": "This feature may be added by Instacart in future API versions",
                "retailers_count": len(all_retailers)
            },
            "retailers": [], # Return an empty list instead of mock data
            "zip_code": zip_code
        }

        # This section is removed as we're now returning an error response instead of mock data

    except Exception as e:
        logger.error(f"Error getting nearby Instacart retailers: {str(e)}")
        # Return a structured error response
        return {
            "error": f"Failed to get nearby Instacart retailers: {str(e)}",
            "status": "error",
            "details": {
                "type": type(e).__name__,
                "message": str(e)
            },
            "retailers": [],  # Consistent empty list
            "zip_code": zip_code if 'zip_code' in locals() else "unknown"
        }

@router.get("/match/{retailer_id}", response_model=Dict)
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

# No need for legacy routes with the prefix approach
# The framework will handle the /instacart prefix