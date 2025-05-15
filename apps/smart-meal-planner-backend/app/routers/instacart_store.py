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
            return {
                "error": "Instacart API key is not configured",
                "status": "error",
                "retailers": []
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
            error_details = {
                "message": str(api_error),
                "type": type(api_error).__name__
            }

            if hasattr(api_error, "response") and hasattr(api_error.response, "status_code"):
                error_details["status_code"] = api_error.response.status_code

            return {
                "error": f"Instacart API request failed: {str(api_error)}",
                "error_details": error_details,
                "retailers": []
            }

    except Exception as e:
        logger.error(f"Error getting Instacart retailers: {str(e)}")
        # Return a structured error response instead of raising an exception
        # This helps the frontend handle the error more gracefully
        return {
            "error": f"Failed to get Instacart retailers: {str(e)}",
            "status": "error",
            "retailers": []
        }

@router.get("/retailers/{retailer_id}/products/search", response_model=List[ProductResponse])
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

        # In the future, Instacart may add a native API for nearby retailers
        # For now, we'll return all available retailers with mock proximity data
        logger.info(f"Generating proximity data for {len(all_retailers)} retailers")

        # Generate mock distance data based on the zip code
        # This is just a placeholder until Instacart API supports location-based filtering
        retailers_with_proximity = []

        # Sanitize zip code input
        if not zip_code or not isinstance(zip_code, str) or len(zip_code) == 0:
            zip_code = "80538"  # Use default if invalid

        zip_prefix = zip_code[0] if len(zip_code) > 0 else "8"

        for i, retailer in enumerate(all_retailers):
            try:
                # Create a copy to avoid modifying the original
                enhanced_retailer = retailer.copy() if retailer else {}
                retailer_id = enhanced_retailer.get("id", f"unknown-{i}")

                # Add attributes dict if missing
                if "attributes" not in enhanced_retailer:
                    enhanced_retailer["attributes"] = {}

                attributes = enhanced_retailer.get("attributes", {})

                # Create a deterministic "distance" based on ZIP code and retailer ID
                # (This is just for demonstration until real proximity data is available)
                try:
                    # Use a hash-based approach that creates consistent but varied distances
                    # based on the retailer ID and ZIP code
                    combined_hash = hash(f"{retailer_id}-{zip_code}")
                    distance = abs(combined_hash % 500) / 10  # Generate a distance between 0 and 50 miles
                except Exception as hash_error:
                    logger.warning(f"Error generating hash-based distance: {str(hash_error)}")
                    # Fallback to simpler approach
                    distance = ((ord(zip_prefix) * 3) + (i % 100)) % 50

                # Add distance information
                enhanced_retailer["attributes"]["distance"] = float(distance)

                # Add mock address data if missing
                if "address" not in enhanced_retailer["attributes"]:
                    enhanced_retailer["attributes"]["address"] = {
                        "city": f"City {(i % 10) + 1}",
                        "state": "CO",
                        "zip_code": zip_code,
                        "street": f"{(i * 100) + 100} Main St"
                    }

                retailers_with_proximity.append(enhanced_retailer)
            except Exception as retailer_error:
                logger.warning(f"Error processing retailer {i}: {str(retailer_error)}")
                # Skip this retailer and continue
                continue

        # Sort by the mock distance
        logger.info(f"Sorting {len(retailers_with_proximity)} retailers by distance")
        try:
            retailers_with_proximity.sort(key=lambda r: r.get("attributes", {}).get("distance", 999))
        except Exception as sort_error:
            logger.error(f"Error sorting retailers: {str(sort_error)}")
            # Continue with unsorted list rather than failing

        # Format for response - limit to 10 nearest
        formatted_retailers = []
        nearby_limit = min(10, len(retailers_with_proximity))

        for retailer in retailers_with_proximity[:nearby_limit]:
            try:
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
            except Exception as format_error:
                logger.warning(f"Error formatting retailer: {str(format_error)}")
                # Skip this retailer and continue
                continue

        logger.info(f"Returning {len(formatted_retailers)} nearby retailers")
        return {
            "retailers": formatted_retailers,
            "status": "success",
            "count": len(formatted_retailers),
            "zip_code": zip_code
        }

    except Exception as e:
        logger.error(f"Error getting nearby Instacart retailers: {str(e)}")
        # Return a structured error response instead of raising an exception
        return {
            "retailers": [],
            "status": "error",
            "message": f"Failed to get nearby Instacart retailers: {str(e)}",
            "error_details": {
                "type": type(e).__name__,
                "message": str(e)
            }
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