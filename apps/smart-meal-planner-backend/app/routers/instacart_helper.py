import logging
from typing import Dict, List, Any, Optional
from app.integration.instacart import InstacartIntegration
from app.routers.cart import internal_carts

logger = logging.getLogger(__name__)

async def transfer_to_instacart_shopping_list(
    user_id: str,
    shopping_list_name: str = "Meal Plan Shopping List"
) -> Dict[str, Any]:
    """
    Transfer items from internal cart to an Instacart shopping list
    
    Args:
        user_id: User ID
        shopping_list_name: Name of the shopping list to create
        
    Returns:
        Dict with success status and result details
    """
    try:
        logger.info(f"Transferring cart items to Instacart for user {user_id}")
        
        # Check if user has a cart
        if user_id not in internal_carts:
            return {
                "success": False,
                "message": "No cart found for this user"
            }
        
        # Get the instacart items from the cart
        instacart_items = internal_carts[user_id].get('instacart', [])
        
        if not instacart_items:
            return {
                "success": False,
                "message": "No Instacart items in cart"
            }
        
        # Format items for Instacart API
        formatted_items = []
        for item in instacart_items:
            # If there's an id in the details, use it
            if item.details and 'id' in item.details:
                formatted_item = {
                    "id": item.details['id'],
                    "quantity": item.quantity
                }
                formatted_items.append(formatted_item)
            else:
                # For items without product IDs, we'll need to 
                # search for them first - but for now we'll skip
                logger.warning(f"Skipping item without product ID: {item.name}")
        
        if not formatted_items:
            return {
                "success": False,
                "message": "No valid Instacart items with product IDs found"
            }
        
        # Create the shopping list with the formatted items
        instacart = InstacartIntegration()
        result = instacart.create_shopping_list(
            name=shopping_list_name,
            items=formatted_items
        )
        
        if result.get("success"):
            # Clear the instacart items from the internal cart
            internal_carts[user_id]['instacart'] = []
            
            return {
                "success": True,
                "message": "Items successfully transferred to Instacart shopping list",
                "shopping_list": result.get("shopping_list")
            }
        else:
            return {
                "success": False,
                "message": f"Failed to create Instacart shopping list: {result.get('message')}"
            }
    
    except Exception as e:
        logger.error(f"Error transferring to Instacart shopping list: {str(e)}")
        return {
            "success": False,
            "message": f"Error: {str(e)}"
        }