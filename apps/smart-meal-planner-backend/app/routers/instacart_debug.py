"""
Instacart Debug Router

This router contains endpoints for debugging and testing the Instacart API integration.
These endpoints should only be available in development/testing environments.
"""

import os
import logging
import json
import time
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
        api_key = os.environ.get("INSTACART_API_KEY")
        environment = os.environ.get("ENVIRONMENT", "development")

        if not api_key:
            return {
                "api_key_configured": False,
                "api_key_masked": None,
                "environment": environment,
                "test_status": "failed",
                "message": "INSTACART_API_KEY environment variable is not set"
            }

        # Mask the API key for safe display
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***masked***"

        # Try to initialize client to verify the API key works
        try:
            client = instacart.InstacartClient(api_key)

            # Make a simple request to verify the key works
            # Include required parameters for IDP API
            test_response = client._make_request("GET", "retailers", params={
                "limit": 1,
                "postal_code": "80538",  # Default to Loveland, CO
                "country_code": "US"
            })

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
    Debug endpoint for nearby retailers based on ZIP code.
    Now returns an error explaining that location-based filtering is not supported by the Instacart API.
    """
    try:
        # First try to get all retailers to verify the API is working
        client = instacart.get_instacart_client()
        all_retailers = client.get_retailers()

        # Return information about the lack of location filtering in the Instacart API
        return {
            "error": "Location-based filtering not supported",
            "status": "not_implemented",
            "message": "The Instacart API currently doesn't support location-based filtering of retailers",
            "details": {
                "retailers_available": len(all_retailers),
                "zip_code_requested": zip_code,
                "api_limitation": "The Instacart API does not currently support filtering by location",
                "recommendation": "Display all available retailers to the user without location filtering"
            }
        }

    except Exception as e:
        logger.error(f"Error getting nearby retailers debug info: {str(e)}")
        return {
            "error": f"Failed to get retailer information: {str(e)}",
            "status": "error",
            "details": {
                "type": type(e).__name__,
                "message": str(e)
            },
            "zip_code": zip_code
        }

# Add an endpoint to get key info for the frontend
@router.get("/key-info", response_model=None)
async def get_api_key_info(current_user: dict = Depends(get_current_user)):
    """
    Get information about the Instacart API key.
    Returns comprehensive details about the API configuration.
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("INSTACART_API_KEY")

        # Get all environment variables that might be related to Instacart
        instacart_env_vars = {}
        for key, value in os.environ.items():
            if 'INSTACART' in key.upper() or 'API' in key.upper():
                if 'KEY' in key.upper() or 'TOKEN' in key.upper() or 'SECRET' in key.upper():
                    # Mask sensitive values
                    if value and len(value) > 8:
                        masked = f"{value[:4]}...{value[-4:]}"
                    else:
                        masked = "***masked***"
                    instacart_env_vars[key] = masked
                else:
                    instacart_env_vars[key] = value

        # Check if API key exists and is properly formatted
        api_key_details = {
            "exists": api_key is not None,
            "env_var": "INSTACART_API_KEY",
            "masked": None,
            "actual_value": None,  # Only for development/debugging
            "length": None,
            "format": None,
            "headers": None
        }

        if api_key:
            # Mask the API key for safe display
            key_length = len(api_key)
            masked_key = f"{api_key[:4]}...{api_key[-4:]}" if key_length > 8 else "***masked***"
            api_key_details["masked"] = masked_key
            api_key_details["length"] = key_length

            # IMPORTANT: This is only for debugging and should be removed in production
            # Show the full API key for debugging purposes
            api_key_details["actual_value"] = api_key

            # Determine the format
            format_type = "Unknown"
            if api_key.startswith("InstacartAPI "):
                format_type = "InstacartAPI prefix format"
                # Remove prefix for length calculation
                api_key_details["length"] = len(api_key) - len("InstacartAPI ")
            api_key_details["format"] = format_type

            # Show what headers would be sent to Instacart API
            api_key_details["headers"] = {
                "Instacart-Connect-Api-Key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            }

        # Test making a basic request to the API
        test_request_info = None
        if api_key:
            try:
                client = instacart.get_instacart_client()

                # Record the request details
                test_request_info = {
                    "url": f"{instacart.BASE_URL}/{instacart.API_VERSION}/retailers",
                    "headers": {
                        "Authorization": f"Bearer {masked_key}" if 'masked_key' in locals() else "Bearer ***masked***",
                        "Content-Type": "application/json",
                        "Accept": "application/json"
                    },
                    "method": "GET",
                    "params": {
                        "limit": 1,
                        "postal_code": "80538",  # Default to Loveland, CO
                        "country_code": "US"
                    },
                    "timestamp": time.time()
                }

                # Make a test request
                test_response = client._make_request("GET", "retailers", params={
                    "limit": 1,
                    "postal_code": "80538",  # Default to Loveland, CO
                    "country_code": "US"
                })

                # Record response details
                test_request_info["success"] = True
                test_request_info["response"] = {
                    "status": 200,
                    "data_sample": test_response
                }

            except Exception as e:
                if test_request_info:
                    test_request_info["success"] = False
                    test_request_info["error"] = {
                        "message": str(e),
                        "type": type(e).__name__
                    }

        return {
            "api_key_details": api_key_details,
            "instacart_environment_variables": instacart_env_vars,
            "api_configuration": {
                "base_url": instacart.BASE_URL,
                "api_version": instacart.API_VERSION,
                "client_implementation": "app.integration.instacart.InstacartClient"
            },
            "test_request": test_request_info,
            "environment": os.environ.get("ENVIRONMENT", "development")
        }
    except Exception as e:
        logger.error(f"Error getting API key info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get API key info: {str(e)}"
        )

@router.get("/mock-retailers", response_model=None)
async def get_mock_retailers():
    """
    Deprecated mock endpoint for Instacart retailers.
    Now returns an error response explaining that mock data is not supported.
    """
    logger.info("Request for mock retailers data - returning error")

    return {
        "error": "Mock data endpoints have been deprecated",
        "status": "error",
        "details": "Per project requirements, mock data endpoints have been removed. Please use the real API endpoints with proper API key configuration.",
        "recommended_endpoint": "/instacart/retailers"
    }

@router.get("/mock-retailers/nearby", response_model=None)
async def get_mock_nearby_retailers(zip_code: str = "80538"):
    """
    Deprecated mock endpoint for nearby Instacart retailers.
    Now returns an error response explaining that mock data is not supported.
    """
    logger.info(f"Request for mock nearby retailers for ZIP {zip_code} - returning error")

    return {
        "error": "Mock data endpoints have been deprecated",
        "status": "error",
        "details": "Per project requirements, mock data endpoints have been removed. Please use the real API endpoints with proper API key configuration.",
        "recommended_endpoint": "/instacart/retailers/nearby",
        "zip_code": zip_code
    }

@router.get("/mock-products/search", response_model=None)
async def search_mock_products(
    retailer_id: str = "publix",
    query: str = "milk",
    limit: int = 10
):
    """
    Deprecated mock endpoint for Instacart product search.
    Now returns an error response explaining that mock data is not supported.
    """
    logger.info(f"Request for mock product search for '{query}' at '{retailer_id}' - returning error")

    return {
        "error": "Mock data endpoints have been deprecated",
        "status": "error",
        "details": "Per project requirements, mock data endpoints have been removed. Please use the real API endpoints with proper API key configuration.",
        "recommended_endpoint": f"/instacart/retailers/{retailer_id}/products/search",
        "query_info": {
            "retailer_id": retailer_id,
            "query": query,
            "limit": limit
        }
    }