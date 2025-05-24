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
async def get_instacart_retailers(
    zip_code: str = Query(None, description="Optional ZIP code to find retailers"),
    current_user: dict = Depends(get_current_user)
):
    """
    Get a list of available retailers on Instacart.
    Returns a list of retailer objects with id, name, and logo_url.
    If zip_code is not provided, it will try to use the user's profile ZIP code.
    """
    # Check if zip_code was not provided but exists in user profile
    if not zip_code or zip_code == "undefined" or zip_code == "null":
        if current_user and "zip_code" in current_user and current_user["zip_code"]:
            logger.info(f"Using user profile ZIP code: {current_user['zip_code']}")
            zip_code = current_user["zip_code"]
        else:
            # Default to Loveland, CO if no ZIP code available
            logger.info("No ZIP code provided or found in user profile, using default")
            zip_code = "80538"
    try:
        logger.info("Starting request to get Instacart retailers")

        # Get API key information for debugging
        api_key = os.environ.get("INSTACART_API_KEY")
        if not api_key:
            logger.error("No Instacart API key configured")
            # Return a proper error response
            return {
                "error": "Instacart API key is not configured",
                "status": "error",
                "details": "The INSTACART_API_KEY environment variable must be set with format 'InstacartAPI YOUR_API_KEY'"
            }

        logger.info(f"Using API key: {api_key[:4]}...{api_key[-4:] if len(api_key) > 8 else '***'}")

        # Get client and make the request with detailed logging
        try:
            client = instacart.get_instacart_client()
            logger.info("Client created successfully, getting retailers...")
            retailers = client.get_retailers(postal_code=zip_code, country_code="US")
            logger.info(f"Retrieved {len(retailers)} retailers from Instacart API")

            # Transform to response model
            formatted_retailers = []
            for retailer in retailers:
                # Handle different response formats depending on API version
                if "attributes" in retailer:
                    # Connect API format
                    attributes = retailer.get("attributes", {})
                    formatted_retailers.append({
                        "id": retailer.get("id", ""),
                        "name": attributes.get("name", ""),
                        "logo_url": attributes.get("logo_url", "")
                    })
                else:
                    # IDP API format
                    formatted_retailers.append({
                        "id": retailer.get("retailer_key", ""),
                        "name": retailer.get("name", ""),
                        "logo_url": retailer.get("retailer_logo_url", "")
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
        api_key = os.environ.get("INSTACART_API_KEY")
        if not api_key:
            logger.error("No Instacart API key configured")
            # Return a proper error response
            return {
                "error": "Instacart API key is not configured",
                "status": "error",
                "details": "The INSTACART_API_KEY environment variable must be set with format 'InstacartAPI YOUR_API_KEY'",
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
    Uses the Instacart Developer Platform API to find nearby retailers.
    If no zip_code is provided but user has one in their profile, use that.
    """
    # Check if zip_code was not provided but exists in user profile
    if not zip_code or zip_code == "undefined" or zip_code == "null":
        if current_user and "zip_code" in current_user and current_user["zip_code"]:
            logger.info(f"Using user profile ZIP code: {current_user['zip_code']}")
            zip_code = current_user["zip_code"]
        else:
            # Default to Loveland, CO if no ZIP code available
            logger.info("No ZIP code provided or found in user profile, using default")
            zip_code = "80538"
    try:
        logger.info(f"Getting nearby retailers for ZIP code {zip_code}")

        # Use the new method for getting nearby retailers
        try:
            client = instacart.get_instacart_client()
            nearby_retailers = client.get_nearby_retailers(postal_code=zip_code, country_code="US")
            logger.info(f"Retrieved {len(nearby_retailers) if nearby_retailers else 0} nearby retailers from Instacart API")

            if not nearby_retailers:
                logger.warning(f"No nearby retailers found for ZIP code {zip_code}")
                return {
                    "retailers": [],
                    "status": "success",
                    "message": f"No retailers found near ZIP code {zip_code}",
                    "count": 0,
                    "zip_code": zip_code
                }
                
            # Format the retailers to match expected response structure
            formatted_retailers = []
            for retailer in nearby_retailers:
                # Handle different response formats depending on API version
                if "attributes" in retailer:
                    # Connect API format
                    attributes = retailer.get("attributes", {})
                    formatted_retailers.append({
                        "id": retailer.get("id", ""),
                        "name": attributes.get("name", "Unknown Retailer"),
                        "logo_url": attributes.get("logo_url", ""),
                        "distance": attributes.get("distance", 999),
                        "address": attributes.get("address", {
                            "city": "Unknown",
                            "state": "XX",
                            "zip_code": zip_code
                        })
                    })
                else:
                    # IDP API format
                    # For IDP API, we don't get distance directly, so we simulate it
                    # This is just for compatibility with the frontend
                    formatted_retailers.append({
                        "id": retailer.get("retailer_key", ""),
                        "name": retailer.get("name", "Unknown Retailer"),
                        "logo_url": retailer.get("retailer_logo_url", ""),
                        "distance": 0.1,  # Default close distance
                        "address": {
                            "city": "Nearby",
                            "state": "CO",
                            "zip_code": zip_code
                        }
                    })
                
            logger.info(f"Returning {len(formatted_retailers)} nearby retailers")
            return {
                "retailers": formatted_retailers,
                "status": "success",
                "count": len(formatted_retailers),
                "zip_code": zip_code
            }
                
        except Exception as api_error:
            logger.error(f"Error getting nearby retailers: {str(api_error)}")
            # Return a structured error response with empty retailers list
            return {
                "retailers": [],
                "status": "error",
                "message": f"Failed to retrieve nearby retailers: {str(api_error)}",
                "error_details": {
                    "type": type(api_error).__name__,
                    "message": str(api_error)
                },
                "zip_code": zip_code
            }

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