"""
Instacart Status Router

This router handles endpoints for checking the Instacart API connection status.
These endpoints are used by the frontend to determine if the Instacart API is properly configured.
"""

import os
import logging
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from typing import Optional

from app.utils.auth_utils import get_user_from_token as get_current_user
from app.integration import instacart

# Configure logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(tags=["instacart"])

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
@router.get("/api/instacart/status", response_model=StatusResponse)
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
                }
            }
        
        # Mask API key for safe display
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if len(api_key) > 8 else "***masked***"
        
        # Try to initialize client and make a test request
        try:
            client = instacart.get_instacart_client()
            
            # Make a simple request to verify the API key works
            test_response = client._make_request("GET", "retailers", params={"limit": 1})
            
            # If we got here, the API is properly configured and accessible
            return {
                "is_connected": True,
                "message": "Instacart API is connected and working properly",
                "api_key_info": {
                    "exists": True,
                    "masked": masked_key,
                    "environment": environment
                }
            }
        except Exception as e:
            logger.error(f"API connection error: {str(e)}")
            return {
                "is_connected": False, 
                "message": f"Instacart API key is configured but not working: {str(e)}",
                "api_key_info": {
                    "exists": True,
                    "masked": masked_key,
                    "environment": environment
                }
            }
            
    except Exception as e:
        logger.error(f"Error checking Instacart status: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to check Instacart API status: {str(e)}"
        )