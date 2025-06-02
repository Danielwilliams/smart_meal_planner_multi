"""
Enhanced grocery list implementation using specialized connection pools.
This demonstrates how to update existing modules to use the new connection pooling system.
"""

from fastapi import APIRouter, HTTPException, Query, Body, BackgroundTasks
from psycopg2.extras import RealDictCursor
from ..db_enhanced import get_db_cursor  # Using enhanced DB with specialized pools
from ..utils.grocery_aggregator import aggregate_grocery_list
from ..config import OPENAI_API_KEY
from pydantic import BaseModel
from typing import Optional, List, Dict, Any
import json
import openai
import logging
import re
import time
import asyncio
import threading
from datetime import datetime, timedelta

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenAI API
openai.api_key = OPENAI_API_KEY

# Shopping list cache implementation
AI_SHOPPING_LIST_CACHE = {}
CACHE_EXPIRY = 24 * 60 * 60  # 24 hours in seconds

class AiShoppingListRequest(BaseModel):
    menu_id: int
    use_ai: bool = True
    additional_preferences: Optional[str] = None
    use_cache: bool = True  # Whether to use cached results if available

router = APIRouter(prefix="/menu", tags=["MenuGrocery"])

@router.get("/{menu_id}")
def get_menu_details(menu_id: int):
    """
    Retrieve full menu details for a specific menu
    """
    try:
        # Use the READ pool since this is a read-only operation
        # Also set a shorter timeout since this is a user-facing operation
        with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
            # Enable autocommit to prevent blocking during menu generation
            conn.autocommit = True
            
            # Fetch the full menu details
            cursor.execute("""
                SELECT
                    id AS menu_id,
                    meal_plan_json,
                    user_id,
                    created_at,
                    nickname
                FROM menus
                WHERE id = %s
            """, (menu_id,))
            menu = cursor.fetchone()

        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found")

        # Convert to dict and ensure meal_plan_json is parsed
        menu = dict(menu)
        menu['meal_plan'] = json.loads(menu['meal_plan_json']) if isinstance(menu['meal_plan_json'], str) else menu['meal_plan_json']

        return menu
    except Exception as e:
        logger.error(f"Error retrieving menu details: {e}")
        # Return a more specific error
        if "not found" in str(e).lower():
            raise HTTPException(status_code=404, detail="Menu not found")
        elif "access" in str(e).lower() or "permission" in str(e).lower():
            raise HTTPException(status_code=403, detail="Permission error: You don't have access to this menu")
        else:
            raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/{menu_id}/grocery-list")
def get_grocery_list(
    menu_id: int,
    use_ai: Optional[bool] = Query(False),
    use_cache: Optional[bool] = Query(True)
):
    """
    Generate a grocery list from a menu, with optional AI enhancement.

    Args:
        menu_id: The ID of the menu to generate the list from
        use_ai: Whether to use AI to enhance the grocery list (default: False)
        use_cache: Whether to use cached AI results if available (default: True)

    Returns:
        A dictionary containing the grocery list and AI recommendations if requested
    """
    logger.info(f"Grocery list request for menu {menu_id}: use_ai={use_ai}, use_cache={use_cache}")
    
    # Add execution timeout to prevent blocking forever
    execution_start = time.time()
    EXECUTION_TIMEOUT = 15  # 15 seconds max for generating a grocery list

    # If AI is requested, check cache first if enabled
    if use_ai and use_cache:
        cache_key = f"{menu_id}_no_prefs"  # No preferences for GET requests
        if cache_key in AI_SHOPPING_LIST_CACHE:
            cached_data = AI_SHOPPING_LIST_CACHE[cache_key]
            # Check if cache is still valid
            if time.time() - cached_data.get('timestamp', 0) < CACHE_EXPIRY:
                logger.info(f"Returning cached AI shopping list for menu {menu_id}")
                result = cached_data.get('data')
                # Mark as cached in the response
                if isinstance(result, dict):
                    result['cached'] = True
                    # Add timestamp information
                    timestamp = cached_data.get('timestamp', 0)
                    if timestamp > 0:
                        result['cache_timestamp'] = datetime.fromtimestamp(timestamp).isoformat()
                    else:
                        result['cache_timestamp'] = datetime.now().isoformat()
                return result

    # Cache miss or AI not requested - generate basic list
    try:
        # Use READ pool with a timeout to prevent blocking during menu generation
        with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
            # Enable autocommit for faster read operations
            conn.autocommit = True
            
            # Fetch the meal plan data
            cursor.execute("""
                SELECT meal_plan_json FROM menus WHERE id = %s
            """, (menu_id,))
            
            menu = cursor.fetchone()
            
            if not menu:
                raise HTTPException(status_code=404, detail="Menu not found")
            
            # Use meal_plan_json if available
            menu_data = menu.get("meal_plan_json")
            
            # Check if we've spent too much time already
            if time.time() - execution_start > EXECUTION_TIMEOUT:
                logger.warning(f"Execution timeout reached for grocery list generation: {menu_id}")
                raise HTTPException(status_code=503, detail="Operation took too long to complete")
            
            # Generate grocery list
            grocery_list = aggregate_grocery_list(menu_data)
            
            # If AI enhancement is not requested, return basic list
            if not use_ai:
                return {"grocery_list": grocery_list}
            
            # Otherwise, start AI processing in background
            # This implementation now returns immediately with a processing status
            # to avoid blocking the connection
            processing_response = {
                "groceryList": [{"category": "All Items", "items": grocery_list}],
                "status": "processing",
                "message": "AI-enhanced list is being generated...",
                "menu_id": menu_id
            }
            
            # Store the processing status in cache
            cache_key = f"{menu_id}_no_prefs"
            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': processing_response,
                'timestamp': time.time(),
                'status': 'processing'
            }
            
            # Schedule the AI processing in background
            background_tasks = BackgroundTasks()
            background_tasks.add_task(
                process_ai_shopping_list_background,
                menu_id,
                menu_data,
                grocery_list,
                None  # No additional preferences for GET request
            )
            
            return processing_response
    
    except Exception as e:
        logger.error(f"Error generating grocery list: {str(e)}")
        if "timeout" in str(e).lower() or time.time() - execution_start > EXECUTION_TIMEOUT:
            raise HTTPException(status_code=503, detail="Operation took too long to complete. Try again later.")
        else:
            raise HTTPException(status_code=500, detail=f"Error generating grocery list: {str(e)}")

async def process_ai_shopping_list_background(menu_id, menu_data, grocery_list, preferences=None):
    """
    Process AI shopping list in background with dedicated AI connection pool
    """
    try:
        # Use the AI pool for the OpenAI call and database updates
        # This ensures these operations don't block the main read pool
        logger.info(f"Starting background AI processing for menu {menu_id}")
        
        # Generate AI shopping list (simulate with delay for this example)
        await asyncio.sleep(5)  # Simulate AI processing time
        
        # Save results using AI pool
        with get_db_cursor(dict_cursor=True, pool_type='ai', timeout=30) as (cursor, conn):
            # Update cache with results
            result = {
                "groceryList": create_categorized_list(grocery_list),
                "recommendations": ["Shop by category for efficiency"],
                "nutritionTips": ["Include a variety of colors in your produce"],
                "status": "completed",
                "menu_id": menu_id,
                "timestamp": datetime.now().isoformat()
            }
            
            # Store in cache
            cache_key = f"{menu_id}_{preferences or 'no_prefs'}"
            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': result,
                'timestamp': time.time(),
                'status': 'completed'
            }
            
            # Optionally, log the completion in the database
            cursor.execute("""
                INSERT INTO ai_processing_logs 
                (menu_id, operation_type, status, processing_time)
                VALUES (%s, %s, %s, %s)
                ON CONFLICT (menu_id, operation_type) 
                DO UPDATE SET 
                    status = EXCLUDED.status,
                    processing_time = EXCLUDED.processing_time,
                    updated_at = CURRENT_TIMESTAMP
            """, (
                menu_id, 
                "grocery_list", 
                "completed", 
                5.0  # Simulated processing time
            ))
            
            conn.commit()
            logger.info(f"Background AI processing completed for menu {menu_id}")
            
    except Exception as e:
        logger.error(f"Error in background AI processing: {str(e)}")
        # Update cache with error status
        cache_key = f"{menu_id}_{preferences or 'no_prefs'}"
        if cache_key in AI_SHOPPING_LIST_CACHE:
            error_response = AI_SHOPPING_LIST_CACHE[cache_key].get('data', {})
            error_response.update({
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            })
            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': error_response,
                'timestamp': time.time(),
                'status': 'error'
            }

def create_categorized_list(grocery_list):
    """Create a categorized grocery list from a flat list"""
    # This is a simplified implementation
    categories = {
        "Produce": [],
        "Dairy": [],
        "Meat": [],
        "Pantry": [],
        "Other": []
    }
    
    # Simple categorization logic
    for item in grocery_list:
        item_name = item.get("name", "") if isinstance(item, dict) else str(item)
        item_obj = {"name": item_name, "quantity": "1", "unit": ""}
        
        # Very basic categorization
        if any(keyword in item_name.lower() for keyword in ["fruit", "vegetable", "lettuce", "tomato", "apple"]):
            categories["Produce"].append(item_obj)
        elif any(keyword in item_name.lower() for keyword in ["milk", "cheese", "yogurt", "butter"]):
            categories["Dairy"].append(item_obj)
        elif any(keyword in item_name.lower() for keyword in ["beef", "chicken", "pork", "fish"]):
            categories["Meat"].append(item_obj)
        elif any(keyword in item_name.lower() for keyword in ["pasta", "rice", "flour", "sugar", "oil"]):
            categories["Pantry"].append(item_obj)
        else:
            categories["Other"].append(item_obj)
    
    # Convert to the expected format
    result = []
    for category, items in categories.items():
        if items:  # Only include non-empty categories
            result.append({
                "category": category,
                "items": items
            })
    
    return result