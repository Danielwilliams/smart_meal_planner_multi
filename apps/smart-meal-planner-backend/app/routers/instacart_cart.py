"""
Instacart Cart Router

This router handles all endpoints related to Instacart cart management.
"""

import logging
from typing import List, Dict, Optional
from fastapi import APIRouter, Depends, HTTPException, Body, status
from pydantic import BaseModel

from app.utils.auth_utils import get_user_from_token as get_current_user
from app.integration import instacart

# Configure logging
logger = logging.getLogger(__name__)

# Router
router = APIRouter(prefix="/instacart", tags=["instacart"])

# Models
class CartItemRequest(BaseModel):
    product_id: str
    quantity: int = 1

class CartCreationRequest(BaseModel):
    retailer_id: str
    items: List[CartItemRequest]

class CartItemResponse(BaseModel):
    id: str
    product_id: str
    name: str
    quantity: int
    price: Optional[float] = None
    image_url: Optional[str] = None

class CartResponse(BaseModel):
    id: str
    retailer_id: str
    items: List[CartItemResponse]
    checkout_url: Optional[str] = None
    total: Optional[float] = None

# Routes - Update paths to match frontend expectations
@router.post("/carts", response_model=CartResponse)
async def create_instacart_cart(
    request: CartCreationRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a new Instacart cart with items.
    """
    try:
        # Format items for the helper function
        items = [{"product_id": item.product_id, "quantity": item.quantity} for item in request.items]

        # Create cart with items
        cart = instacart.create_cart_with_items(request.retailer_id, items)

        # Transform to response model
        cart_data = {}
        cart_attributes = cart.get("attributes", {})

        items_data = []
        for item in cart_attributes.get("items", []):
            item_attributes = item.get("attributes", {})
            items_data.append({
                "id": item.get("id", ""),
                "product_id": item_attributes.get("product_id", ""),
                "name": item_attributes.get("name", ""),
                "quantity": item_attributes.get("quantity", 0),
                "price": item_attributes.get("price", {}).get("value"),
                "image_url": item_attributes.get("image_url", "")
            })

        response = {
            "id": cart.get("id", ""),
            "retailer_id": cart_attributes.get("retailer_id", ""),
            "items": items_data,
            "checkout_url": cart.get("checkout_url", ""),
            "total": cart_attributes.get("total", {}).get("value")
        }

        return response

    except Exception as e:
        logger.error(f"Error creating Instacart cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create Instacart cart: {str(e)}"
        )

@router.post("/carts/{cart_id}/items", response_model=CartResponse)
async def add_item_to_instacart_cart(
    cart_id: str,
    item: CartItemRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Add an item to an existing Instacart cart.
    """
    try:
        client = instacart.get_instacart_client()

        # Add item to cart
        client.add_item_to_cart(cart_id, item.product_id, item.quantity)

        # Get updated cart
        cart = client.get_cart(cart_id)
        checkout_url = client.checkout_url(cart_id)

        # Transform to response model
        cart_data = {}
        cart_attributes = cart.get("attributes", {})

        items_data = []
        for item in cart_attributes.get("items", []):
            item_attributes = item.get("attributes", {})
            items_data.append({
                "id": item.get("id", ""),
                "product_id": item_attributes.get("product_id", ""),
                "name": item_attributes.get("name", ""),
                "quantity": item_attributes.get("quantity", 0),
                "price": item_attributes.get("price", {}).get("value"),
                "image_url": item_attributes.get("image_url", "")
            })

        response = {
            "id": cart.get("id", ""),
            "retailer_id": cart_attributes.get("retailer_id", ""),
            "items": items_data,
            "checkout_url": checkout_url,
            "total": cart_attributes.get("total", {}).get("value")
        }

        return response

    except Exception as e:
        logger.error(f"Error adding item to Instacart cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to add item to Instacart cart: {str(e)}"
        )

@router.get("/carts/{cart_id}", response_model=CartResponse)
async def get_instacart_cart(
    cart_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Get details of an Instacart cart.
    """
    try:
        client = instacart.get_instacart_client()

        # Get cart
        cart = client.get_cart(cart_id)
        checkout_url = client.checkout_url(cart_id)

        # Transform to response model
        cart_data = {}
        cart_attributes = cart.get("attributes", {})

        items_data = []
        for item in cart_attributes.get("items", []):
            item_attributes = item.get("attributes", {})
            items_data.append({
                "id": item.get("id", ""),
                "product_id": item_attributes.get("product_id", ""),
                "name": item_attributes.get("name", ""),
                "quantity": item_attributes.get("quantity", 0),
                "price": item_attributes.get("price", {}).get("value"),
                "image_url": item_attributes.get("image_url", "")
            })

        response = {
            "id": cart.get("id", ""),
            "retailer_id": cart_attributes.get("retailer_id", ""),
            "items": items_data,
            "checkout_url": checkout_url,
            "total": cart_attributes.get("total", {}).get("value")
        }

        return response

    except Exception as e:
        logger.error(f"Error getting Instacart cart: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to get Instacart cart: {str(e)}"
        )

# Shopping List Routes
class ShoppingListRequest(BaseModel):
    retailer_id: str
    items: List[str]
    postal_code: Optional[str] = "80538"
    country_code: Optional[str] = "US"

class ShoppingListResponse(BaseModel):
    url: str
    item_count: int

@router.post("/shopping-list", response_model=ShoppingListResponse)
async def create_shopping_list(
    request: ShoppingListRequest,
    current_user: dict = Depends(get_current_user)
):
    """
    Create a shopping list URL that will open directly in Instacart.

    This uses the 'Create Shopping List Page' endpoint from Instacart's API.
    It takes a list of item names/descriptions and creates a URL that will
    open a pre-populated shopping list in Instacart.

    This is more efficient than searching for each item individually.

    Example request:
    ```json
    {
        "retailer_id": "publix",
        "items": ["Milk", "Eggs", "Bread", "Chicken breast", "Apples"],
        "postal_code": "33101",
        "country_code": "US"
    }
    ```
    """
    try:
        # Extract request parameters with fallbacks
        retailer_id = request.retailer_id
        items = request.items
        postal_code = request.postal_code or "80538"
        country_code = request.country_code or "US"

        # Try to get user's postal code from their profile if available
        if current_user and "zip_code" in current_user and not request.postal_code:
            postal_code = current_user["zip_code"]
            logger.info(f"Using user profile ZIP code: {postal_code}")

        # Basic validation
        if not retailer_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Retailer ID is required"
            )

        if not items or len(items) == 0:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="At least one item is required"
            )

        # Create shopping list URL
        url = instacart.create_shopping_list_url_from_items(
            retailer_id=retailer_id,
            item_names=items,
            postal_code=postal_code,
            country_code=country_code
        )

        # Return the URL and item count
        return {
            "url": url,
            "item_count": len(items)
        }

    except HTTPException as e:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error creating shopping list URL: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to create shopping list URL: {str(e)}"
        )

# No need for legacy routes with the prefix approach
# The framework will handle the /instacart prefix