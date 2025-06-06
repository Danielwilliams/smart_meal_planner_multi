# app/routers/cart.py

from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import logging
from app.utils.auth_utils import get_user_from_token

logger = logging.getLogger(__name__)

# Models
class CartItem(BaseModel):
    name: str
    quantity: int = 1
    store_preference: Optional[str] = None  # 'walmart' or 'kroger'
    details: Optional[Dict] = None

class InternalCartRequest(BaseModel):
    items: List[CartItem]
    store: Optional[str] = None

class StoreSearchRequest(BaseModel):
    items: List[str]
    store: str

# Internal cart storage (in production this would be a database)
internal_carts = {}

router = APIRouter(prefix="/cart", tags=["Cart"])

@router.get("/internal/{user_id}/contents")
async def get_internal_cart(
    user_id: str,
    user = Depends(get_user_from_token)
):
    """Get internal cart contents"""
    try:
        # Convert user_id to string for comparison
        user_id = str(user_id)
        token_user_id = str(user.get('user_id'))
        
        if user_id != token_user_id:
            raise HTTPException(403, "Not authorized to access this cart")
        
        logger.debug(f"Accessing cart for user {user_id} from token user {token_user_id}")
        
        # Initialize cart if needed
        if user_id not in internal_carts:
            internal_carts[user_id] = {
                'instacart': [],
                'kroger': [],
                'unassigned': []
            }

        return {
            "status": "success",
            "cart": internal_carts[user_id]
        }
    except Exception as e:
        logger.error(f"Error getting internal cart: {str(e)}")
        raise HTTPException(500, f"Error getting internal cart: {str(e)}")

@router.post("/internal/add_items")
async def add_to_internal_cart(
    req: InternalCartRequest,
    user = Depends(get_user_from_token)
):
    """Add items to internal cart"""
    try:
        user_id = str(user.get('user_id'))
        logger.debug(f"Adding items to cart for user {user_id}")
        logger.debug(f"Request items: {req.items}")
        
        # Initialize cart if needed
        if user_id not in internal_carts:
            internal_carts[user_id] = {
                'instacart': [],
                'kroger': [],
                'unassigned': []
            }

        # Add items to appropriate store list
        for item in req.items:
            store = req.store or item.store_preference or 'unassigned'

            # Ensure the store key exists in the cart
            if store not in internal_carts[user_id]:
                logger.info(f"Creating new store section in cart: {store}")
                internal_carts[user_id][store] = []

            internal_carts[user_id][store].append(item)

        return {
            "status": "success",
            "cart": internal_carts[user_id]
        }
    except Exception as e:
        logger.error(f"Error adding to internal cart: {str(e)}")
        raise HTTPException(500, f"Error adding to internal cart: {str(e)}")

@router.patch("/internal/{user_id}/assign_store")
async def assign_store_to_items(
    user_id: str,
    items: List[CartItem],
    store: str,
    user = Depends(get_user_from_token)
):
    """Assign items to a specific store"""
    try:
        # Convert user_id to string
        user_id = str(user_id)
        
        if user_id != str(user.get('user_id')):
            raise HTTPException(403, "Not authorized to access this cart")
        
        logger.debug(f"Assigning items to store for user {user_id}")
        logger.debug(f"Items: {items}, Store: {store}")
        
        if user_id not in internal_carts:
            raise HTTPException(404, "Cart not found")
            
        # Move items from unassigned to specified store
        updated_unassigned = []
        for item in internal_carts[user_id]['unassigned']:
            if item.name in [i.name for i in items]:
                item.store_preference = store
                internal_carts[user_id][store].append(item)
            else:
                updated_unassigned.append(item)
                
        internal_carts[user_id]['unassigned'] = updated_unassigned
        
        return {
            "status": "success",
            "cart": internal_carts[user_id]
        }
    except Exception as e:
        logger.error(f"Error assigning store: {str(e)}")
        raise HTTPException(500, f"Error assigning store: {str(e)}")

@router.delete("/internal/{user_id}/clear")
async def clear_internal_cart(
    user_id: str,
    user = Depends(get_user_from_token)
):
    """Clear internal cart"""
    try:
        if str(user.get('user_id')) != str(user_id):
            raise HTTPException(403, "Not authorized to access this cart")
            
        if user_id in internal_carts:
            internal_carts[user_id] = {
                'instacart': [],
                'kroger': [],
                'unassigned': []
            }
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing internal cart: {str(e)}")
        raise HTTPException(500, f"Error clearing internal cart: {str(e)}")

@router.delete("/internal/{user_id}/clear_store/{store}")
async def clear_store_items(
    user_id: str,
    store: str,
    user = Depends(get_user_from_token)
):
    """Clear items for a specific store"""
    try:
        if str(user.get('user_id')) != str(user_id):
            raise HTTPException(403, "Not authorized to access this cart")
            
        if user_id in internal_carts:
            if store not in internal_carts[user_id]:
                raise HTTPException(400, f"Invalid store: {store}")
                
            internal_carts[user_id][store] = []
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing store items: {str(e)}")
        raise HTTPException(500, f"Error clearing store items: {str(e)}")

@router.get("/internal/{user_id}/store/{store}")
async def get_store_items(
    user_id: str,
    store: str,
    user = Depends(get_user_from_token)
):
    """Get items for a specific store"""
    try:
        if str(user.get('user_id')) != str(user_id):
            raise HTTPException(403, "Not authorized to access this cart")

        if user_id not in internal_carts:
            internal_carts[user_id] = {
                'instacart': [],
                'kroger': [],
                'unassigned': []
            }

        if store not in internal_carts[user_id]:
            raise HTTPException(400, f"Invalid store: {store}")

        return {
            "status": "success",
            "items": internal_carts[user_id][store]
        }
    except Exception as e:
        logger.error(f"Error getting store items: {str(e)}")
        raise HTTPException(500, f"Error getting store items: {str(e)}")

class RemoveItemRequest(BaseModel):
    item_name: str
    store: str

@router.delete("/internal/{user_id}/remove_item")
async def remove_cart_item(
    user_id: str,
    request: Request,
    user = Depends(get_user_from_token)
):
    """Remove a specific item from the cart"""
    try:
        # Convert user_id to string for consistent comparison
        user_id = str(user_id)
        token_user_id = str(user.get('user_id'))

        logger.info(f"Remove item request - URL user_id: '{user_id}', token user_id: '{token_user_id}'")

        if token_user_id != user_id:
            raise HTTPException(403, "Not authorized to access this cart")

        # Parse the request body
        try:
            data = await request.json()
            logger.info(f"Raw request data: {data}")
        except Exception as json_error:
            logger.error(f"Failed to parse JSON from request: {json_error}")
            raise HTTPException(400, f"Invalid JSON in request body: {str(json_error)}")

        item_name = data.get('item_name')
        store = data.get('store')

        logger.info(f"Parsed - item_name: '{item_name}', store: '{store}'")

        if not item_name or not store:
            raise HTTPException(400, "item_name and store are required")

        logger.info(f"Removing item '{item_name}' from '{store}' for user {user_id}")
        logger.info(f"Current internal_carts keys: {list(internal_carts.keys())}")

        if user_id in internal_carts:
            if store not in internal_carts[user_id]:
                raise HTTPException(400, f"Invalid store: {store}")

            # Debug: Log current cart contents before removal
            logger.info(f"Current cart for user {user_id}, store {store}: {internal_carts[user_id][store]}")

            # Find and remove the item with better error handling
            original_count = len(internal_carts[user_id][store])
            try:
                # Filter items, handling both dictionary and object formats
                filtered_items = []
                for item in internal_carts[user_id][store]:
                    # Get item name - handle both dict and object formats
                    if isinstance(item, dict):
                        current_item_name = item.get('name')
                    else:
                        current_item_name = getattr(item, 'name', None)

                    # Keep item if name doesn't match
                    if current_item_name != item_name:
                        filtered_items.append(item)

                internal_carts[user_id][store] = filtered_items
                new_count = len(internal_carts[user_id][store])
                logger.info(f"Items removed: {original_count - new_count}")
            except Exception as filter_error:
                logger.error(f"Error during item filtering: {str(filter_error)}")
                logger.error(f"Cart item types: {[type(item) for item in internal_carts[user_id][store]]}")
                raise
        else:
            logger.warning(f"User {user_id} not found in internal_carts")
            
        return {"status": "success"}
    except HTTPException:
        # Re-raise HTTP exceptions as-is
        raise
    except Exception as e:
        logger.error(f"Unexpected error removing cart item: {type(e).__name__}: {str(e)}")
        logger.error(f"Full exception details:", exc_info=True)
        raise HTTPException(500, f"Unexpected error removing cart item: {type(e).__name__}: {str(e)}")

@router.patch("/internal/{user_id}/update_quantity")
async def update_cart_item_quantity(
    user_id: str,
    request: Request,
    user = Depends(get_user_from_token)
):
    """Update the quantity of a specific item in the cart"""
    try:
        if str(user.get('user_id')) != str(user_id):
            raise HTTPException(403, "Not authorized to access this cart")
            
        # Parse the request body
        data = await request.json()
        item_name = data.get('item_name')
        store = data.get('store')
        quantity = data.get('quantity')
        
        if not item_name or not store or quantity is None:
            raise HTTPException(400, "item_name, store, and quantity are required")
            
        try:
            quantity = int(quantity)
            if quantity <= 0:
                raise ValueError("Quantity must be positive")
        except ValueError:
            raise HTTPException(400, "Invalid quantity value")
            
        logger.info(f"Updating quantity for '{item_name}' in '{store}' to {quantity}")
            
        if user_id in internal_carts:
            if store not in internal_carts[user_id]:
                raise HTTPException(400, f"Invalid store: {store}")
                
            # Find and update the item
            item_found = False
            for item in internal_carts[user_id][store]:
                # Handle both dictionary and object formats
                if isinstance(item, dict):
                    current_item_name = item.get('name')
                    if current_item_name == item_name:
                        item['quantity'] = quantity
                        item_found = True
                        break
                else:
                    if getattr(item, 'name', None) == item_name:
                        item.quantity = quantity
                        item_found = True
                        break
                    
            if not item_found:
                raise HTTPException(404, f"Item '{item_name}' not found in '{store}'")
            
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error updating cart item quantity: {str(e)}")
        raise HTTPException(500, f"Error updating cart item quantity: {str(e)}")

# For backward compatibility with old clients - MUST be at the end due to route matching
@router.delete("/internal/{user_id}/{store}")
async def legacy_clear_store_items(
    user_id: str,
    store: str,
    user = Depends(get_user_from_token)
):
    """Legacy endpoint to clear items for a specific store"""
    return await clear_store_items(user_id, store, user)
