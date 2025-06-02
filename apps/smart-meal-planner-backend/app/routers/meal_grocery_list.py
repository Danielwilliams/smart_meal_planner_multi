"""
Module for per-meal shopping list generation and retrieval.

This module provides API endpoints to generate shopping lists for individual meals
in a menu, rather than aggregating all ingredients into a single list.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from psycopg2.extras import RealDictCursor
# Use the enhanced DB with specialized connection pools
from ..db_super_simple import get_db_cursor
from ..utils.meal_grocery_generator import get_meal_shopping_list
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import logging
import time
from datetime import datetime

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Cache for meal shopping lists
MEAL_SHOPPING_LIST_CACHE = {}
CACHE_EXPIRY = 24 * 60 * 60  # 24 hours in seconds

class MealShoppingListRequest(BaseModel):
    menu_id: int
    use_cache: bool = True

router = APIRouter(prefix="/menu", tags=["MealGrocery"])

@router.get("/{menu_id}/meal-shopping-lists")
def get_meal_shopping_lists(
    menu_id: int,
    use_cache: Optional[bool] = Query(True)
):
    """
    Generate shopping lists for individual meals in a menu.

    Args:
        menu_id: The ID of the menu to generate lists from
        use_cache: Whether to use cached results if available (default: True)

    Returns:
        A dictionary containing shopping lists for each meal in the menu
    """
    logger.info(f"Meal shopping lists request for menu {menu_id}: use_cache={use_cache}")

    # Check cache if enabled
    cache_key = f"meals_{menu_id}"
    if use_cache and cache_key in MEAL_SHOPPING_LIST_CACHE:
        cached_data = MEAL_SHOPPING_LIST_CACHE[cache_key]
        # Check if cache is still valid
        if time.time() - cached_data.get('timestamp', 0) < CACHE_EXPIRY:
            logger.info(f"Returning cached meal shopping lists for menu {menu_id}")
            result = cached_data.get('data')
            # Mark as cached in the response
            if isinstance(result, dict):
                result['cached'] = True
                # Add timestamp information
                timestamp = cached_data.get('timestamp', 0)
                if timestamp > 0:
                    result['cache_time'] = datetime.fromtimestamp(timestamp).isoformat()
                else:
                    result['cache_time'] = datetime.now().isoformat()
            return result

    # If cache is disabled or invalid, proceed with generating new shopping lists
    logger.info(f"Generating new meal shopping lists for menu {menu_id}")

    try:
        # Use autocommit for shopping list operations to prevent blocking during menu generation
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Autocommit is enabled at connection creation time

            # Verify the menu exists and get the data
            cur.execute("""
                SELECT
                    id,
                    user_id,
                    meal_plan_json,
                    nickname
                FROM menus
                WHERE id = %s
            """, (menu_id,))
            menu_data = cur.fetchone()

            if not menu_data:
                logger.warning(f"Menu {menu_id} not found")
                raise HTTPException(status_code=404, detail="Menu not found")

            # Generate meal-specific shopping lists
            result = get_meal_shopping_list(menu_id, menu_data)
            
            # Store in cache
            MEAL_SHOPPING_LIST_CACHE[cache_key] = {
                'data': result,
                'timestamp': time.time()
            }
            
            # Add metadata to the response
            result['cached'] = False
            result['cache_timestamp'] = datetime.now().isoformat()
            
            return result
        
    except Exception as e:
        logger.error(f"Error generating meal shopping lists: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.post("/{menu_id}/meal-shopping-lists")
async def post_meal_shopping_lists(menu_id: int, request: MealShoppingListRequest = None):
    """
    Generate shopping lists for individual meals with options for caching.

    Args:
        menu_id: The ID of the menu to generate lists from
        request: Request options including cache preference

    Returns:
        A dictionary containing shopping lists for each meal in the menu
    """
    # Handle case where request is not provided
    if request is None:
        logger.info(f"No request body provided, creating default with menu_id={menu_id}")
        request = MealShoppingListRequest(menu_id=menu_id, use_cache=True)

    # Ensure the menu_id from path is used
    if request.menu_id != menu_id:
        logger.warning(f"Request menu_id {request.menu_id} doesn't match path menu_id {menu_id}, using path parameter")
        request.menu_id = menu_id

    # Check if we should clear the cache before proceeding
    cache_key = f"meals_{menu_id}"
    if not request.use_cache and cache_key in MEAL_SHOPPING_LIST_CACHE:
        logger.info(f"Cache usage disabled for this request, clearing existing cache for menu {menu_id}")
        MEAL_SHOPPING_LIST_CACHE.pop(cache_key, None)

    # Use the GET endpoint to handle the actual processing
    return get_meal_shopping_lists(menu_id, use_cache=request.use_cache)

@router.get("/{menu_id}/meal-shopping-lists/{meal_index}")
def get_single_meal_shopping_list(
    menu_id: int,
    meal_index: int,
    day_index: Optional[int] = Query(None),
    is_snack: Optional[bool] = Query(False)
):
    """
    Get shopping list for a single specific meal in a menu.

    Args:
        menu_id: The ID of the menu containing the meal
        meal_index: The index of the meal within its day
        day_index: The index of the day (optional, will search all days if not provided)
        is_snack: Whether the item is a snack (default: False)

    Returns:
        A shopping list for the specific meal
    """
    logger.info(f"Single meal shopping list request for menu {menu_id}, meal {meal_index}, day {day_index}, is_snack={is_snack}")

    # First get all meal shopping lists
    all_lists = get_meal_shopping_lists(menu_id)
    
    if not all_lists or 'meal_lists' not in all_lists:
        logger.warning(f"No meal lists found for menu {menu_id}")
        raise HTTPException(status_code=404, detail="No meal shopping lists found")
    
    # Find the specific meal
    meal_lists = all_lists['meal_lists']
    for meal_list in meal_lists:
        # Check for match based on provided parameters
        meal_matches = meal_list['meal_index'] == meal_index
        day_matches = day_index is None or meal_list['day_index'] == day_index
        snack_matches = meal_list.get('is_snack', False) == is_snack
        
        if meal_matches and day_matches and snack_matches:
            return meal_list
    
    logger.warning(f"Specific meal not found: meal_index={meal_index}, day_index={day_index}, is_snack={is_snack}")
    raise HTTPException(status_code=404, detail="Specific meal not found")