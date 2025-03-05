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
                'walmart': [],
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
                'walmart': [],
                'kroger': [],
                'unassigned': []
            }

        # Add items to appropriate store list
        for item in req.items:
            store = req.store or item.store_preference or 'unassigned'
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
                'walmart': [],
                'kroger': [],
                'unassigned': []
            }
        return {"status": "success"}
    except Exception as e:
        logger.error(f"Error clearing internal cart: {str(e)}")
        raise HTTPException(500, f"Error clearing internal cart: {str(e)}")

@router.delete("/internal/{user_id}/{store}")
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
                'walmart': [],
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