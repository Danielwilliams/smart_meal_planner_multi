from fastapi import APIRouter, HTTPException, Depends, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import logging
from app.integration.instacart import InstacartIntegration
from app.utils.auth_utils import get_user_from_token
from app.routers.instacart_helper import transfer_to_instacart_shopping_list

logger = logging.getLogger(__name__)

class InstacartSearchRequest(BaseModel):
    items: List[str]
    retailer_id: Optional[str] = None

class InstacartShoppingListRequest(BaseModel):
    name: str
    items: List[Dict[str, Any]]

class AddToShoppingListRequest(BaseModel):
    shopping_list_id: str
    items: List[Dict[str, Any]]
    
class CartToShoppingListRequest(BaseModel):
    name: Optional[str] = "Meal Plan Shopping List"

router = APIRouter(prefix="/instacart", tags=["Instacart"])

@router.post("/search")
async def search_instacart_items(
    req: InstacartSearchRequest,
    user = Depends(get_user_from_token)
):
    """Search for items on Instacart"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Starting Instacart search for user {user_id}")

        instacart = InstacartIntegration()
        
        search_results = []
        for item in req.items:
            cleaned_term = item.strip()
            result = instacart.search_products(
                query=cleaned_term,
                retailer_id=req.retailer_id
            )
            
            if result.get("success"):
                # Add the original query to each product result
                for product in result.get('results', []):
                    product['original_query'] = item
                search_results.extend(result.get('results', []))
            else:
                logger.warning(f"Search failed for '{item}': {result.get('message')}")

        return {
            "success": True,
            "results": search_results
        }
            
    except Exception as e:
        logger.error(f"Error searching Instacart items: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/retailers/{zip_code}")
async def get_available_retailers(
    zip_code: str,
    user = Depends(get_user_from_token)
):
    """Get available retailers in a zip code"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Getting available Instacart retailers for user {user_id} in {zip_code}")
        
        instacart = InstacartIntegration()
        result = instacart.get_available_retailers(zip_code)
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting retailers: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.post("/shopping-list/create")
async def create_shopping_list(
    req: InstacartShoppingListRequest,
    user = Depends(get_user_from_token)
):
    """Create a shopping list on Instacart"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Creating Instacart shopping list for user {user_id}")
        
        instacart = InstacartIntegration()
        result = instacart.create_shopping_list(
            name=req.name,
            items=req.items
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error creating shopping list: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.post("/shopping-list/{shopping_list_id}/add")
async def add_to_shopping_list(
    shopping_list_id: str,
    req: AddToShoppingListRequest,
    user = Depends(get_user_from_token)
):
    """Add items to an existing shopping list"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Adding items to Instacart shopping list for user {user_id}")
        
        instacart = InstacartIntegration()
        result = instacart.add_to_existing_shopping_list(
            shopping_list_id=shopping_list_id,
            items=req.items
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error adding to shopping list: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.get("/shopping-lists")
async def get_shopping_lists(
    user = Depends(get_user_from_token)
):
    """Get all shopping lists"""
    try:
        user_id = user.get('user_id')
        logger.info(f"Getting Instacart shopping lists for user {user_id}")
        
        instacart = InstacartIntegration()
        result = instacart.get_shopping_lists()
        
        return result
        
    except Exception as e:
        logger.error(f"Error getting shopping lists: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }

@router.post("/cart-to-shopping-list")
async def cart_to_shopping_list(
    req: CartToShoppingListRequest,
    user = Depends(get_user_from_token)
):
    """Transfer cart items to Instacart shopping list"""
    try:
        user_id = str(user.get('user_id'))
        logger.info(f"Transferring cart to Instacart shopping list for user {user_id}")
        
        result = await transfer_to_instacart_shopping_list(
            user_id=user_id,
            shopping_list_name=req.name
        )
        
        return result
        
    except Exception as e:
        logger.error(f"Error transferring cart to shopping list: {str(e)}")
        return {
            "success": False,
            "message": str(e)
        }