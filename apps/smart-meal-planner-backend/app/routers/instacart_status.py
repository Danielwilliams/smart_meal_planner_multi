"""
Instacart Status Router

This router handles endpoints for checking the Instacart API connection status.
These endpoints are used by the frontend to determine if the Instacart API is properly configured.
"""

import os
import logging
import time
import traceback
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.utils.auth_utils import get_user_from_token as get_current_user
from app.integration import instacart

# Configure logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/instacart", tags=["instacart"])

# Models
class APIKeyInfo(BaseModel):
    exists: bool
    masked: Optional[str] = None
    environment: str

class StatusResponse(BaseModel):
    is_connected: bool
    message: str
    api_key_info: Optional[APIKeyInfo] = None

# Routes
@router.get("/status", response_model=None)
async def check_instacart_status(current_user: dict = Depends(get_current_user)):
    """
    Check if the Instacart API is properly configured and accessible.
    Tests the API key and connectivity to the Instacart API.
    """
    try:
        # Get API key from environment
        api_key = os.environ.get("INSTACARTAPI_DEV")
        environment = os.environ.get("ENVIRONMENT", "development")

        # Check if API key exists
        if not api_key:
            logger.warning("INSTACARTAPI_DEV environment variable is not set")
            return {
                "is_connected": False,
                "message": "Instacart API key is not configured",
                "api_key_info": {
                    "exists": False,
                    "masked": None,
                    "environment": environment
                },
                "debug_info": {
                    "env_variable": "INSTACARTAPI_DEV",
                    "api_key_present": False,
                    "timestamp": time.time(),
                    "module_info": str(instacart.__name__),
                    "base_url": instacart.BASE_URL,
                    "api_version": instacart.API_VERSION
                }
            }

        # Mask API key for safe display
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***masked***"

        # Determine the format and presence of header prefix
        api_format = "Unknown"
        api_value = api_key
        expected_header = api_key

        if api_key.startswith("InstacartAPI "):
            api_format = "InstacartAPI prefix format"
            # Extract the actual key part
            api_value = api_key[len("InstacartAPI "):]
            expected_header = api_key  # We keep the prefix for the header

        # Debug info
        debug_info = {
            "env_variable": "INSTACARTAPI_DEV",
            "api_key_present": True,
            "api_key": api_key,  # ONLY FOR DEBUGGING
            "format": api_format,
            "length": len(api_key),
            "value_length": len(api_value),
            "expected_headers": {
                "Instacart-Connect-Api-Key": api_key,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            "timestamp": time.time(),
            "module_info": str(instacart.__name__),
            "base_url": instacart.BASE_URL,
            "api_version": instacart.API_VERSION,
            "client_class": instacart.InstacartClient.__name__
        }

        # Try to initialize client and make a test request
        try:
            client = instacart.get_instacart_client()

            # Log the actual client configuration
            debug_info["client_config"] = {
                "headers": dict(client.session.headers),
                "session_type": str(type(client.session))
            }

            # Record request details
            request_details = {
                "url": f"{instacart.BASE_URL}/{instacart.API_VERSION}/retailers?limit=1",
                "method": "GET",
                "headers": {k: (v if k.lower() not in ['authorization', 'instacart-connect-api-key']
                              else masked_key) for k, v in client.session.headers.items()},
                "params": {"limit": 1}
            }
            debug_info["request"] = request_details

            # Make a simple request to verify the API key works
            test_response = client._make_request("GET", "retailers", params={"limit": 1})

            # Record response details
            debug_info["response"] = {
                "status": 200,
                "success": True,
                "data_sample": test_response
            }

            # If we got here, the API is properly configured and accessible
            return {
                "is_connected": True,
                "message": "Instacart API is connected and working properly",
                "api_key_info": {
                    "exists": True,
                    "masked": masked_key,
                    "environment": environment
                },
                "debug_info": debug_info
            }
        except Exception as e:
            logger.error(f"API connection error: {str(e)}")

            # Record error details
            debug_info["error"] = {
                "message": str(e),
                "type": type(e).__name__,
                "trace": traceback.format_exc()
            }

            return {
                "is_connected": False,
                "message": f"Instacart API key is configured but not working: {str(e)}",
                "api_key_info": {
                    "exists": True,
                    "masked": masked_key,
                    "environment": environment
                },
                "debug_info": debug_info
            }

    except Exception as e:
        logger.error(f"Error checking Instacart status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check Instacart API status: {str(e)}"
        )