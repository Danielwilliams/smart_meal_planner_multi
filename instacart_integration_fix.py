"""
Instacart Integration Fix Script

This script contains all the code changes needed to fix the Instacart integration.
You can use this script to update your files manually.
"""

# 1. instacart_status.py updates
INSTACART_STATUS_UPDATES = """
\"\"\"
Instacart Status Router

This router handles endpoints for checking the Instacart API connection status.
These endpoints are used by the frontend to determine if the Instacart API is properly configured.
\"\"\"

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

class KeyInfoResponse(BaseModel):
    exists: bool
    masked: Optional[str] = None
    length: Optional[int] = None
    format: Optional[str] = None

class StatusResponse(BaseModel):
    is_connected: bool
    message: str
    api_key_info: Optional[APIKeyInfo] = None

# Routes
@router.get("/status", response_model=None)
async def check_instacart_status(current_user: dict = Depends(get_current_user)):
    \"\"\"
    Check if the Instacart API is properly configured and accessible.
    Tests the API key and connectivity to the Instacart API.
    \"\"\"
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

@router.get("/key-info", response_model=None)
async def get_api_key_info(current_user: dict = Depends(get_current_user)):
    \"\"\"
    Get information about the configured Instacart API key.
    Returns details about the API key without exposing the full key.
    \"\"\"
    try:
        # Get API key from environment
        api_key = os.environ.get("INSTACARTAPI_DEV")
        environment = os.environ.get("ENVIRONMENT", "development")

        # Check if API key exists
        if not api_key:
            logger.warning("INSTACARTAPI_DEV environment variable is not set")
            # Show a helpful message about setting the API key
            missing_key_guide = \"\"\"
            The INSTACARTAPI_DEV environment variable is not set. 
            
            To use the Instacart API, you need to:
            1. Get an API key from Instacart Connect
            2. Set it as an environment variable named INSTACARTAPI_DEV
            3. Format it as 'InstacartAPI YOUR_KEY_HERE' (with the prefix)
            
            Example: export INSTACARTAPI_DEV="InstacartAPI abc123def456"
            \"\"\"
            return {
                "exists": False,
                "masked": None,
                "length": 0,
                "format": "Unknown",
                "environment": environment,
                "setup_guide": missing_key_guide.strip()
            }

        # Mask API key for safe display
        key_length = len(api_key)
        masked_key = f"{api_key[:4]}...{api_key[-4:]}" if key_length > 8 else "***masked***"

        # Determine the format of the API key
        api_format = "Unknown"
        actual_length = key_length
        
        if api_key.startswith("InstacartAPI "):
            api_format = "InstacartAPI prefix format"
            # Extract the actual key part (without prefix) for length calculation
            actual_key = api_key[len("InstacartAPI "):]
            actual_length = len(actual_key)  # Length of the actual key part
        else:
            api_format = "Raw key format"

        return {
            "exists": True,
            "masked": masked_key,
            "length": actual_length,
            "format": api_format,
            "environment": environment
        }

    except Exception as e:
        logger.error(f"Error retrieving API key info: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to retrieve API key information: {str(e)}"
        )

@router.get("/environment", response_model=Optional[dict])
async def get_environment_info(current_user: dict = Depends(get_current_user)):
    \"\"\"
    Get information about the backend environment.
    Returns relevant environment variables for debugging.
    \"\"\"
    try:
        # Get relevant environment variables (without exposing sensitive data)
        environment_info = {
            "environment": os.environ.get("ENVIRONMENT", "development"),
            "instacart_api_configured": bool(os.environ.get("INSTACARTAPI_DEV")),
            "python_version": os.environ.get("PYTHON_VERSION", "unknown"),
            "node_env": os.environ.get("NODE_ENV", "development"),
            "debug_mode": os.environ.get("DEBUG", "false").lower() == "true"
        }

        return environment_info

    except Exception as e:
        logger.error(f"Error retrieving environment info: {str(e)}")
        return {
            "error": str(e)
        }

@router.get("/test", response_model=None)
async def test_endpoint():
    \"\"\"
    Simple test endpoint to verify the router is working correctly.
    This endpoint doesn't require authentication to facilitate testing.
    \"\"\"
    return {
        "status": "ok",
        "message": "Instacart API router is working",
        "timestamp": time.time(),
        "routes": [
            "/api/instacart/status",
            "/api/instacart/key-info",
            "/api/instacart/environment",
            "/api/instacart/test",
            "/api/instacart/retailers"
        ]
    }
"""

# 2. instacart.py instacart client initialization update
INSTACART_CLIENT_INIT_UPDATE = """
        # Get the API key from param or environment
        self.api_key = api_key or os.environ.get("INSTACARTAPI_DEV")
        if not self.api_key:
            logger.error("No Instacart API key provided")
            raise ValueError("Instacart API key is required")
        
        # Format the API key properly if it doesn't already have the prefix
        if not self.api_key.startswith("InstacartAPI "):
            logger.info("Adding 'InstacartAPI' prefix to key")
            self.formatted_api_key = f"InstacartAPI {self.api_key}"
        else:
            logger.info("API key already has 'InstacartAPI' prefix")
            self.formatted_api_key = self.api_key
        
        # Create and configure the session
        self.session = requests.Session()
        
        # Set the headers with properly formatted API key
        self.session.headers.update({
            "Instacart-Connect-Api-Key": self.formatted_api_key,
            "Content-Type": "application/json",
            "Accept": "application/json"
        })
        
        logger.info(f"Initialized Instacart client with key: {self.formatted_api_key[:15]}...")
        logger.info(f"Header set: {self.session.headers.get('Instacart-Connect-Api-Key', '')[:15]}...")
"""

# 3. instacart.py make_request method update
INSTACART_MAKE_REQUEST_UPDATE = """
        try:
            # Log the request details for debugging
            logger.info(f"Making {method} request to {url}")
            if params:
                logger.info(f"Request params: {params}")
            if data:
                logger.info(f"Request data: {json.dumps(data)[:100]}...")
                
            # Make the request
            if method.upper() == "GET":
                response = self.session.get(url, params=params)
            elif method.upper() == "POST":
                response = self.session.post(url, json=data)
            elif method.upper() == "PUT":
                response = self.session.put(url, json=data)
            elif method.upper() == "DELETE":
                response = self.session.delete(url, params=params)
            else:
                raise ValueError(f"Unsupported HTTP method: {method}")
                
            # Log response info for debugging
            logger.info(f"Response status: {response.status_code}")
            
            # Check for HTTP errors
            response.raise_for_status()
            
            if response.status_code == 204:  # No content
                return {}
            
            # Parse and return the JSON response    
            json_data = response.json()
            logger.info(f"Response data sample: {str(json_data)[:200]}...")
            return json_data
            
        except requests.exceptions.HTTPError as e:
            logger.error(f"HTTP error: {str(e)}")
            error_info = {}
            
            try:
                error_info = response.json()
            except:
                error_info = {"message": str(e)}
                
            logger.error(f"Error details: {json.dumps(error_info)}")
            
            status_code = response.status_code
            if status_code == 401:
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Unauthorized access to Instacart API - Check API key format and validity"
                )
            elif status_code == 403:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Forbidden access to Instacart API - API key may not have proper permissions"
                )
            elif status_code == 404:
                # Provide more detailed error for 404 responses
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail=f"Resource not found on Instacart API: {endpoint} - Check the API endpoint path"
                )
            else:
                # Include original response data in error for debugging
                error_detail = {
                    "message": f"Instacart API error: {str(e)}",
                    "status_code": status_code,
                    "response_data": error_info
                }
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=json.dumps(error_detail)
                )
"""

# 4. instacart_store.py retailers endpoint update
INSTACART_RETAILERS_ENDPOINT_UPDATE = """
@router.get("/retailers", response_model=None)
async def get_instacart_retailers(current_user: dict = Depends(get_current_user)):
    \"\"\"
    Get a list of available retailers on Instacart.
    Returns a list of retailer objects with id, name, and logo_url.
    \"\"\"
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
"""

# 5. instacart_store.py nearby retailers endpoint update
INSTACART_NEARBY_RETAILERS_ENDPOINT_UPDATE = """
@router.get("/retailers/nearby", response_model=None)
async def get_nearby_instacart_retailers(
    zip_code: str = Query(..., description="ZIP code to find nearby retailers"),
    current_user: dict = Depends(get_current_user)
):
    \"\"\"
    Get a list of Instacart retailers near a specified ZIP code.
    Currently uses mock proximity data since the Instacart API doesn't support location-based filtering.
    \"\"\"
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
"""

print("Instacart Integration Fix Script generated successfully.")
print("To apply these changes, you'll need to update the following files:")
print("1. apps/smart-meal-planner-backend/app/routers/instacart_status.py")
print("2. apps/smart-meal-planner-backend/app/integration/instacart.py")
print("3. apps/smart-meal-planner-backend/app/routers/instacart_store.py")
print("\nAfter making these changes, deploy them to your server.")