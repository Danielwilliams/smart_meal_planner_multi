from fastapi import APIRouter, HTTPException, Depends, Request, Query
from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
import jwt
import re
import logging
from app.config import JWT_SECRET, JWT_ALGORITHM
from app.integration.kroger import KrogerIntegration, kroger_search_item, add_to_kroger_cart
from app.integration.kroger_db import get_user_kroger_credentials

router = APIRouter(prefix="/cart", tags=["Cart"])
logger = logging.getLogger(__name__)

async def get_user_from_token(request: Request):
    """Enhanced token validation"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        logger.error("No Authorization header found")
        raise HTTPException(status_code=401, detail="No authorization token")
    
    try:
        # Properly handle 'Bearer ' prefix
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            token = auth_header
            
        # Add logging for debugging
        logger.debug(f"Attempting to decode token: {token[:10]}...")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Validate payload contents
        if not payload.get('user_id'):
            logger.error("Token payload missing user_id")
            raise HTTPException(status_code=401, detail="Invalid token payload")
            
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Unexpected error in token validation: {str(e)}")
        raise HTTPException(status_code=401, detail="Token validation error")

# Internal cart storage (in production this would be a database)
internal_carts = {}

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

class KrogerCartRequest(BaseModel):
    location_id: str
    items: List[Dict[str, Any]]

def clean_search_term(item: str) -> str:
    """
    Clean and standardize search terms
    
    :param item: Original item string
    :return: Cleaned search term
    """
    # Remove quantity and measurement indicators
    item = re.sub(r'^\d+(\.\d+)?\s*(cup|oz|lb|pounds|ounces|ml|g|grams)?\s*', '', item, flags=re.IGNORECASE)
    
    # Remove common prefixes
    item = re.sub(r'^(fresh|organic|whole|low-fat|frozen)\s*', '', item, flags=re.IGNORECASE)
    
    # Trim and convert to title case
    return item.strip()

@router.post("/store/search")
async def search_store_items(
    req: StoreSearchRequest,
    user = Depends(get_user_from_token)
):
    """Search for items in store without adding to cart"""
    try:
        # ... existing code ...

        if req.store.lower() == "kroger":
            search_results = []
            for item in req.items:
                result = kroger_search_item(item)
                
                # Safely handle the result
                if result and result.get('success'):
                    # Add original query to results for tracking
                    for product in result.get('results', []):
                        product['original_query'] = item
                    search_results.extend(result.get('results', []))

            return {
                "status": "success",
                "results": search_results
            }
        
        # ... rest of the existing code ...
    
    except Exception as e:
        logger.error(f"Error searching store items: {str(e)}")
        raise HTTPException(500, f"Error searching store items: {str(e)}")

@router.delete("/internal/{user_id}/clear")
async def clear_internal_cart(
    user_id: str,
    user = Depends(get_user_from_token)
):
    """Clear internal cart"""
    try:
        # Validate user is accessing their own cart
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
        
        logger.debug(f"Accessing cart for user {user_id} from token user {token_user_id}")
        
        # Initialize cart if it doesn't exist
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

@router.post("/add-kroger")
async def add_to_kroger_cart_route(
    req: KrogerCartRequest,
    request: Request
):
    """
    Add items to Kroger cart
    
    :param req: Request containing location_id and items
    :param request: Request object to extract user token
    """
    # Validate user token
    user = await get_user_from_token(request)
    user_id = user.get('user_id')

    try:
        # Retrieve user's Kroger credentials
        credentials = get_user_kroger_credentials(user_id)
        
        # Check for Kroger connection
        if not credentials or not credentials.get('access_token'):
            logger.warning(f"User {user_id} attempted to add to Kroger cart without connected account")
            return {
                "success": False,
                "message": "Kroger account not connected",
                "redirect": "/kroger/login-url",
                "status_code": 401
            }
        
        # Prepare cart items
        cart_items = [
            {
                "upc": item['upc'],
                "quantity": item.get('quantity', 1)
            } for item in req.items
        ]
        
        # Use the standalone function to add items to cart
        cart_addition = add_to_kroger_cart(
            user_id=user_id,
            items=cart_items
        )
        
        return cart_addition
    
    except Exception as e:
        logger.error(f"Error adding to Kroger cart: {str(e)}")
        return {
            "success": False,
            "message": str(e),
            "status_code": 400
        }

        
@router.delete("/kroger")
async def clear_kroger_cart(
    location_id: str,
    request: Request
):
    """
    Clear Kroger cart
    
    :param location_id: Kroger store location ID
    :param request: Request object to extract user token
    """
    # Validate user token
    user = await get_user_from_token(request)
    user_id = user.get('user_id')

    try:
        # Retrieve user's Kroger credentials
        credentials = get_user_kroger_credentials(user_id)
        
        if not credentials.get('access_token'):
            raise HTTPException(status_code=401, detail="Kroger account not connected")
        
        # Initialize Kroger integration
        kroger_integration = KrogerIntegration(access_token=credentials['access_token'])
        
        # Clear cart
        cart_clear = kroger_integration.clear_cart(location_id)
        
        return cart_clear
    
    except Exception as e:
        logger.error(f"Error clearing Kroger cart: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))