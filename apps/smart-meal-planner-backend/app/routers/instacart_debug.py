"""
Instacart Debug Router

This router contains endpoints for debugging and testing the Instacart API integration.
These endpoints should only be available in development/testing environments.
"""

import os
import logging
import json
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel

from app.utils.auth_utils import get_user_from_token as get_current_user
from app.integration import instacart

# Configure logging
logger = logging.getLogger(__name__)

# Router - with specific tag for debugging endpoints
router = APIRouter(prefix="/instacart", tags=["instacart-debug"])

# Models
class ConfigTestResponse(BaseModel):
    api_key_configured: bool
    api_key_masked: Optional[str] = None
    environment: str
    test_status: str
    message: str

class EnvironmentResponse(BaseModel):
    environment: str
    debug_mode: bool
    api_version: str
    base_url: str

class KeyInfoResponse(BaseModel):
    exists: bool
    masked: Optional[str] = None
    length: Optional[int] = None
    format: Optional[str] = None

# Routes - Update paths to match frontend expectations
@router.get("/config/test", response_model=ConfigTestResponse)
async def test_api_key_configuration(current_user: dict = Depends(get_current_user)):
    """
    Test if the Instacart API key is properly configured.
    Returns masked version of the API key for verification.
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("INSTACARTAPI_DEV")
        environment = os.environ.get("ENVIRONMENT", "development")

        if not api_key:
            return {
                "api_key_configured": False,
                "api_key_masked": None,
                "environment": environment,
                "test_status": "failed",
                "message": "INSTACARTAPI_DEV environment variable is not set"
            }

        # Mask the API key for safe display
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***masked***"

        # Try to initialize client to verify the API key works
        try:
            client = instacart.InstacartClient(api_key)

            # Make a simple request to verify the key works
            test_response = client._make_request("GET", "retailers", params={"limit": 1})

            return {
                "api_key_configured": True,
                "api_key_masked": masked_key,
                "environment": environment,
                "test_status": "success",
                "message": "API key is configured and working"
            }
        except Exception as e:
            logger.error(f"API key validation error: {str(e)}")
            return {
                "api_key_configured": True,
                "api_key_masked": masked_key,
                "environment": environment,
                "test_status": "error",
                "message": f"API key is configured but not working: {str(e)}"
            }

    except Exception as e:
        logger.error(f"Configuration test error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to test configuration: {str(e)}"
        )

@router.get("/environment", response_model=EnvironmentResponse)
async def get_environment_info(current_user: dict = Depends(get_current_user)):
    """
    Get information about the current environment configuration.
    """
    try:
        environment = os.environ.get("ENVIRONMENT", "development")
        debug_mode = os.environ.get("DEBUG", "False").lower() == "true"

        return {
            "environment": environment,
            "debug_mode": debug_mode,
            "api_version": instacart.API_VERSION,
            "base_url": instacart.BASE_URL
        }
    except Exception as e:
        logger.error(f"Error getting environment info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get environment info: {str(e)}"
        )

@router.get("/debug/retailers/nearby")
async def get_nearby_retailers(
    zip_code: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Debug endpoint: Get nearby retailers based on ZIP code with detailed mock data.
    This is a mock endpoint for testing until Instacart API adds native support.
    """
    try:
        # First try to get all retailers
        client = instacart.get_instacart_client()
        all_retailers = client.get_retailers()

        # Filter/sort by proximity to ZIP code (mock implementation)
        # In a real implementation, this would use Instacart's API for nearby retailers
        # For now, we'll return all retailers with extra proximity data

        # Mock nearby retailers based on ZIP code first digit
        # (This is just for testing - a real implementation would use geolocation)
        zip_prefix = zip_code[0] if zip_code and len(zip_code) > 0 else "0"

        # Create a simple deterministic ordering based on ZIP code
        # to simulate different sorting in different locations
        retailers_with_proximity = []
        for i, retailer in enumerate(all_retailers):
            retailer_id = retailer.get("id", "")
            attributes = retailer.get("attributes", {})

            # Simple hash to deterministically assign "distance" based on ZIP and retailer ID
            distance = ((ord(zip_prefix) * 3) + (hash(retailer_id) % 100)) % 50

            # Create a shallow copy of the retailer with proximity data
            retailer_copy = retailer.copy()

            # Add address data for testing
            if "attributes" not in retailer_copy:
                retailer_copy["attributes"] = {}

            if "address" not in retailer_copy["attributes"]:
                retailer_copy["attributes"]["address"] = {
                    "street": f"{(i + 1) * 100} Main St",
                    "city": "Test City",
                    "state": "TS",
                    "zip_code": zip_code,
                    "country": "US",
                }

            # Add proximity data
            retailer_copy["attributes"]["distance"] = distance
            retailers_with_proximity.append(retailer_copy)

        # Sort by distance (ascending)
        retailers_with_proximity.sort(key=lambda r: r["attributes"].get("distance", 999))

        # Limit to only nearby
        nearby_retailers = retailers_with_proximity[:10]

        return nearby_retailers

    except Exception as e:
        logger.error(f"Error getting nearby retailers: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get nearby retailers: {str(e)}"
        )

# Add an endpoint to get key info for the frontend
@router.get("/key-info", response_model=KeyInfoResponse)
async def get_api_key_info(current_user: dict = Depends(get_current_user)):
    """
    Get information about the Instacart API key.
    Returns masked version and other metadata for verification.
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("INSTACARTAPI_DEV")

        if not api_key:
            return {
                "exists": False,
                "masked": None,
                "length": None,
                "format": None
            }

        # Mask the API key for safe display
        key_length = len(api_key)
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if key_length > 8 else "***masked***"

        # Determine the format
        format_type = "Unknown"
        if api_key.startswith("InstacartAPI "):
            format_type = "InstacartAPI prefix format"
            # Remove prefix for length calculation
            key_length = len(api_key) - len("InstacartAPI ")

        return {
            "exists": True,
            "masked": masked_key,
            "length": key_length,
            "format": format_type
        }
    except Exception as e:
        logger.error(f"Error getting API key info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get API key info: {str(e)}"
        )