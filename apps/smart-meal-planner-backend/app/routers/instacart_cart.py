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

# No need for legacy routes with the prefix approach
# The framework will handle the /instacart prefix