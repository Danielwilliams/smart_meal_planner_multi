from fastapi import APIRouter, HTTPException, Query, Body, BackgroundTasks
from psycopg2.extras import RealDictCursor
# Use the enhanced DB with specialized connection pools
from ..db_enhanced_actual import get_db_cursor, get_db_connection
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
        # Use the read pool for menu retrieval to prevent blocking during menu generation
        with get_db_cursor(dict_cursor=True, pool_type='read') as (cursor, conn):
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
                    # Ensure valid timestamp and format as ISO string
                    timestamp = cached_data.get('timestamp', 0)
                    if timestamp > 0:
                        result['cache_time'] = datetime.fromtimestamp(timestamp).isoformat()
                    else:
                        result['cache_time'] = datetime.now().isoformat()

                # Log what we're returning
                if 'groceryList' in result:
                    logger.info(f"Returning cached AI result with {len(result['groceryList'])} categories")

                return result
            else:
                # Cache expired, remove it
                logger.info(f"Cache expired for menu {menu_id}, removing from cache")
                AI_SHOPPING_LIST_CACHE.pop(cache_key, None)

    # If cache is disabled or invalid, proceed with generating a new shopping list
    logger.info(f"Generating new shopping list for menu {menu_id}")

    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # First verify the menu exists and user has access
            cur.execute("""
                SELECT
                    id,
                    user_id,
                    meal_plan_json
                FROM menus
                WHERE id = %s
            """, (menu_id,))
            menu_data = cur.fetchone()

            if not menu_data:
                logger.warning(f"Menu {menu_id} not found")
                raise HTTPException(status_code=404, detail="Menu not found")

            # Proceed with the data we verified
            row = menu_data

        if not row:
            logger.warning(f"Menu {menu_id} not found after verification")
            raise HTTPException(status_code=404, detail="Menu not found")

        # parse the JSON text into a Python dict
        menu_data = row["meal_plan_json"]

        # Standard aggregation
        grocery_list = aggregate_grocery_list(menu_data)

        # Log the format of the basic grocery list
        logger.info(f"Basic grocery list has {len(grocery_list)} items")
        if grocery_list and len(grocery_list) > 0:
            logger.info(f"First item format: {type(grocery_list[0])}")
            logger.info(f"Sample item: {grocery_list[0]}")

        # If AI is requested, enhance the list
        if use_ai:
            # If the process might take time, first create a categorized version for immediate display
            # Use our fallback categorization mechanism to provide instant categorized results
            categorized_list = create_categorized_fallback(grocery_list)

            # Then call the AI enhancement (which might take longer)
            result = generate_ai_shopping_list(menu_data, grocery_list)

            # Store in cache if successful
            if result and isinstance(result, dict) and "groceryList" in result:
                logger.info(f"Caching AI shopping list for menu {menu_id}")
                logger.info(f"AI result has {len(result.get('groceryList', []))} categories")

                cache_key = f"{menu_id}_no_prefs"
                AI_SHOPPING_LIST_CACHE[cache_key] = {
                    'data': result,
                    'timestamp': time.time(),
                    'status': 'completed'
                }

                # Add cache metadata to the response
                result['cached'] = False
                result['cache_timestamp'] = datetime.now().isoformat()
                result['status'] = 'completed'

                return result
            else:
                # If AI enhancement failed, return our categorized version instead
                logger.info(f"AI enhancement failed, returning categorized fallback with {len(categorized_list)} categories")
                return {
                    "groceryList": categorized_list,
                    "recommendations": ["Using basic categorized list - AI enhancement unavailable"],
                    "nutritionTips": ["For a balanced diet, include items from each food group"],
                    "status": "completed",
                    "cached": False,
                    "fallback": True,
                    "healthyAlternatives": [
                        {"original": "Sour Cream", "alternative": "Non-Fat Plain Greek Yogurt", "benefit": "Higher protein, lower fat"},
                        {"original": "Ground Beef", "alternative": "Ground Turkey", "benefit": "Lower fat content"},
                        {"original": "White Rice", "alternative": "Brown Rice", "benefit": "More fiber and nutrients"}
                    ],
                    "shoppingTips": [
                        "Buy in-season produce for better flavor and nutrition",
                        "Check unit prices to find the best value",
                        "Look for sales on staple items you can stock up on"
                    ]
                }

        # If no AI requested, use our categorization function to provide a better experience than flat list
        categorized_list = create_categorized_fallback(grocery_list)
        logger.info(f"Returning categorized version with {len(categorized_list)} categories")

        return {
            "groceryList": categorized_list,
            "status": "completed",
            "ai_enhanced": False,
            "healthyAlternatives": [
                {"original": "Sour Cream", "alternative": "Non-Fat Plain Greek Yogurt", "benefit": "Higher protein, lower fat"},
                {"original": "Ground Beef", "alternative": "Ground Turkey", "benefit": "Lower fat content"},
                {"original": "White Rice", "alternative": "Brown Rice", "benefit": "More fiber and nutrients"}
            ],
            "shoppingTips": [
                "Buy in-season produce for better flavor and nutrition",
                "Check unit prices to find the best value",
                "Look for sales on staple items you can stock up on"
            ]
        }

    except Exception as e:
        logger.error(f"Error retrieving grocery list: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

def process_ai_shopping_list_background(menu_id: int, menu_data, grocery_list, additional_preferences=None):
    """Background task to process AI shopping list and store in cache"""
    cache_key = f"{menu_id}_{additional_preferences or 'no_prefs'}"

    try:
        logger.info(f"Starting background AI processing for menu {menu_id}")

        # Log status for debugging
        logger.info(f"Cache key: {cache_key}")
        logger.info(f"Grocery list has {len(grocery_list)} items")

        # Update cache to show processing status
        AI_SHOPPING_LIST_CACHE[cache_key] = {
            'data': {
                "groceryList": [{"category": "All Items", "items": grocery_list}],
                "recommendations": ["AI shopping list is being processed..."],
                "nutritionTips": ["Please wait for enhanced list to be completed"],
                "status": "processing",
                "menu_id": menu_id,
                "timestamp": datetime.now().isoformat()
            },
            'timestamp': time.time(),
            'status': 'processing'
        }

        # Process with AI - don't pass the whole menu to avoid overloading the API
        # Just extract meal titles for context
        meal_titles = []
        try:
            if isinstance(menu_data, str):
                menu_dict = json.loads(menu_data)
            else:
                menu_dict = menu_data

            if isinstance(menu_dict, dict) and "days" in menu_dict:
                for day in menu_dict["days"]:
                    if "meals" in day and isinstance(day["meals"], list):
                        for meal in day["meals"]:
                            if "title" in meal:
                                meal_titles.append(meal["title"])
        except Exception as extract_error:
            logger.error(f"Error extracting meal titles: {str(extract_error)}")
            # Continue with empty meal titles

        # Create simplified menu context with just titles
        simplified_menu = {"meal_titles": meal_titles}

        # Process with AI using simplified menu data
        logger.info(f"Calling AI with {len(grocery_list)} ingredients and {len(meal_titles)} meal titles")
        result = generate_ai_shopping_list(
            simplified_menu,
            grocery_list,
            additional_preferences=additional_preferences
        )

        # Log AI result
        logger.info(f"AI processing completed for menu {menu_id}")
        if result:
            # Handle both dictionary and list formats
            if isinstance(result, list):
                # New format - direct list of items
                logger.info(f"Result contains {len(result)} items in an array")

                # Convert to our expected format for backward compatibility
                categorized_result = {
                    "groceryList": [],
                    "recommendations": ["Organized by department for easy shopping"],
                    "status": "completed"
                }

                # Group items by category
                categories = {}
                for item in result:
                    if isinstance(item, dict) and "category" in item:
                        category = item["category"]
                        if category not in categories:
                            categories[category] = []
                        categories[category].append(item)

                # Convert to expected format
                for category, items in categories.items():
                    categorized_result["groceryList"].append({
                        "category": category,
                        "items": items
                    })

                # Replace result with formatted version
                result = categorized_result
                logger.info(f"Converted to {len(result['groceryList'])} categories")
            else:
                # Old format - dictionary with groceryList key
                logger.info(f"Result contains {len(result.get('groceryList', []))} categories")

        # Store the completed result in cache
        if result:
            # Double-check we've converted any list to the expected format
            if isinstance(result, list):
                # Convert list format to dictionary format if it wasn't already done above
                logger.info("Converting list result to dictionary format for cache")
                categorized_result = {
                    "groceryList": [],
                    "recommendations": ["Organized by department for easy shopping"],
                    "status": "completed"
                }

                # Group by category
                categories = {}
                for item in result:
                    if isinstance(item, dict) and "category" in item:
                        category = item["category"]
                        if category not in categories:
                            categories[category] = []
                        categories[category].append(item)

                # Convert to expected format
                for category, items in categories.items():
                    categorized_result["groceryList"].append({
                        "category": category,
                        "items": items
                    })

                result = categorized_result

            # Now result should be a dictionary
            if isinstance(result, dict) and "groceryList" in result:
                result['status'] = 'completed'
                result['cached'] = False
                result['cache_timestamp'] = datetime.now().isoformat()
                result['menu_id'] = menu_id

                AI_SHOPPING_LIST_CACHE[cache_key] = {
                    'data': result,
                    'timestamp': time.time(),
                    'status': 'completed'
                }

                logger.info(f"Completed AI shopping list for menu {menu_id} and stored in cache")
            else:
                # Invalid format even after conversion
                logger.warning(f"Result has invalid format for menu {menu_id}, creating fallback categorized list")
                # If AI processing failed, create a categorized fallback grocery list
                logger.warning(f"AI processing failed for menu {menu_id}, creating fallback categorized list")
        else:
            # No result at all
            logger.warning(f"No result returned for menu {menu_id}, creating fallback categorized list")

            # Generate a categorized fallback list
            categorized_list = create_categorized_fallback(grocery_list)

            fallback_result = {
                "groceryList": categorized_list,
                "recommendations": ["AI enhancement temporarily unavailable, showing categorized list"],
                "nutritionTips": [
                    "For a balanced diet, include items from each food group",
                    "Fresh produce typically offers better nutrition than processed alternatives"
                ],
                "pantryStaples": ["Salt", "Pepper", "Olive Oil", "Flour", "Sugar"],
                "healthyAlternatives": [
                    {"original": "Sour Cream", "alternative": "Non-Fat Plain Greek Yogurt", "benefit": "Higher protein, lower fat"},
                    {"original": "Ground Beef", "alternative": "Ground Turkey", "benefit": "Lower fat content"},
                    {"original": "White Rice", "alternative": "Brown Rice", "benefit": "More fiber and nutrients"}
                ],
                "shoppingTips": [
                    "Buy in-season produce for better flavor and nutrition",
                    "Check unit prices to find the best value",
                    "Look for sales on staple items you can stock up on"
                ],
                "healthySwaps": [],
                "bulkItems": [],
                "status": "completed",  # Mark as completed so UI doesn't stay in loading state
                "menu_id": menu_id,
                "timestamp": datetime.now().isoformat(),
                "fallback": True  # Mark this as a fallback result
            }

            # Update cache with categorized fallback list
            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': fallback_result,
                'timestamp': time.time(),
                'status': 'completed'  # Important: Mark as completed so UI moves past loading state
            }

            logger.info(f"Created fallback categorized list for menu {menu_id} with {len(categorized_list)} categories")
    except Exception as e:
        logger.error(f"Error in background processing for menu {menu_id}: {str(e)}")
        # Update cache with error status but also include a categorized list
        try:
            # Try to create a categorized fallback even when an exception occurs
            categorized_list = create_categorized_fallback(grocery_list)

            fallback_result = {
                "groceryList": categorized_list,
                "recommendations": ["Error during AI processing, showing basic categorized list"],
                "nutritionTips": ["Using basic grocery list with categories"],
                "pantryStaples": ["Salt", "Pepper", "Olive Oil", "Flour", "Sugar"],
                "healthyAlternatives": [
                    {"original": "Sour Cream", "alternative": "Non-Fat Plain Greek Yogurt", "benefit": "Higher protein, lower fat"},
                    {"original": "Ground Beef", "alternative": "Ground Turkey", "benefit": "Lower fat content"},
                    {"original": "White Rice", "alternative": "Brown Rice", "benefit": "More fiber and nutrients"}
                ],
                "shoppingTips": [
                    "Buy in-season produce for better flavor and nutrition",
                    "Check unit prices to find the best value",
                    "Look for sales on staple items you can stock up on"
                ],
                "healthySwaps": [],
                "bulkItems": [],
                "status": "completed",  # Mark as completed so UI doesn't stay in loading state
                "error": str(e),
                "menu_id": menu_id,
                "timestamp": datetime.now().isoformat(),
                "fallback": True
            }

            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': fallback_result,
                'timestamp': time.time(),
                'status': 'completed'  # Important: Mark as completed so UI moves past loading state
            }
            logger.info(f"Created error fallback categorized list with {len(categorized_list)} categories")
        except Exception as fallback_error:
            logger.error(f"Failed to create fallback categorized list: {str(fallback_error)}")
            # Absolute last resort - just return the basic list with "All Items" category
            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': {
                    "groceryList": [{"category": "All Items", "items": grocery_list}],
                    "recommendations": ["Error during AI processing"],
                    "nutritionTips": ["Using basic grocery list instead"],
                    "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                    "healthySwaps": [],
                    "bulkItems": [],
                    "status": "completed",  # Still mark as completed to avoid UI getting stuck
                    "error": str(e),
                    "menu_id": menu_id,
                    "timestamp": datetime.now().isoformat()
                },
                'timestamp': time.time(),
                'status': 'completed'
            }

@router.post("/{menu_id}/ai-shopping-list")
async def post_ai_shopping_list(menu_id: int, background_tasks: BackgroundTasks, request: AiShoppingListRequest = None):
    """
    Generate an AI-enhanced shopping list from a menu.

    Args:
        menu_id: The ID of the menu to generate the list from
        background_tasks: FastAPI background tasks for async processing
        request: The request containing the additional preferences

    Returns:
        An immediate basic response, with AI enhancements processed asynchronously
    """
    # Log incoming request to debug potential issues
    logger.info(f"AI shopping list request for menu ID: {menu_id}")

    # Handle case where request is not provided or AI is not requested
    if request is None:
        logger.info(f"No request body provided, creating default with menu_id={menu_id}")
        request = AiShoppingListRequest(menu_id=menu_id, use_ai=True)

    # Ensure the menu_id from path is used
    if request.menu_id != menu_id:
        logger.warning(f"Request menu_id {request.menu_id} doesn't match path menu_id {menu_id}, using path parameter")
        request.menu_id = menu_id

    # Validate menu ID is positive
    if menu_id <= 0:
        logger.error(f"Invalid menu ID: {menu_id}")
        return {
            "groceryList": [],
            "recommendations": ["Invalid menu ID provided"],
            "error": "Invalid menu ID",
            "status": "error",
            "menu_id": menu_id
        }

    logger.info(f"Processing request: menu_id={request.menu_id}, use_ai={request.use_ai}, use_cache={request.use_cache}")

    if not request.use_ai:
        # If AI is not requested, fall back to standard grocery list
        logger.info("AI not requested, using standard grocery list")
        return get_grocery_list(menu_id, use_ai=False)

    # Check if we should clear the cache before proceeding
    cache_key = f"{menu_id}_{request.additional_preferences or 'no_prefs'}"
    if not request.use_cache:
        logger.info(f"Cache usage disabled for this request, clearing any existing cache for menu {menu_id}")
        # Clear any existing cache data
        if cache_key in AI_SHOPPING_LIST_CACHE:
            logger.info(f"Removing cached data for key: {cache_key}")
            AI_SHOPPING_LIST_CACHE.pop(cache_key, None)

        # Also clear any other cache entries for this menu
        keys_to_remove = [k for k in AI_SHOPPING_LIST_CACHE.keys() if k.startswith(f"{menu_id}_")]
        for k in keys_to_remove:
            logger.info(f"Removing related cached data for key: {k}")
            AI_SHOPPING_LIST_CACHE.pop(k, None)

    # Check cache if enabled - this helps avoid timeouts by using cached results
    elif request.use_cache and cache_key in AI_SHOPPING_LIST_CACHE:
        cached_data = AI_SHOPPING_LIST_CACHE[cache_key]
        # Check if cache is still valid
        if time.time() - cached_data.get('timestamp', 0) < CACHE_EXPIRY:
            logger.info(f"Returning cached AI shopping list for menu {menu_id}")
            result = cached_data.get('data')
            # Mark as cached in response
            if isinstance(result, dict) and "groceryList" in result:
                result['cached'] = True
                # Ensure valid timestamp
                timestamp = cached_data.get('timestamp', 0)
                if timestamp > 0:
                    result['cache_timestamp'] = datetime.fromtimestamp(timestamp).isoformat()
                else:
                    result['cache_timestamp'] = datetime.now().isoformat()
            return result
        else:
            # Cache expired, remove it
            logger.info(f"Cache expired for menu {menu_id}, removing from cache")
            AI_SHOPPING_LIST_CACHE.pop(cache_key, None)
    
    # If we don't have a valid cache entry, process the request
    # First, get the basic grocery list which is faster
    try:
        # Use read pool for fast grocery list operations
        with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cur, conn):
            # Enable autocommit for faster read operations
            conn.autocommit = True

            # Fetch the meal_plan_json field
            cur.execute("SELECT meal_plan_json FROM menus WHERE id=%s", (menu_id,))
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Menu not found")

        # Parse the JSON text into a Python dict
        menu_data = row["meal_plan_json"]

        # Standard aggregation first - wrap in try/except to handle errors
        try:
            grocery_list = aggregate_grocery_list(menu_data)
        except Exception as agg_error:
            logger.error(f"Error aggregating grocery list: {str(agg_error)}")
            # Return a fallback empty list in case of error
            grocery_list = []
        
        # If grocery list is empty, return an error message
        if not grocery_list:
            return {
                "groceryList": [],
                "recommendations": ["Could not extract ingredients from this menu"],
                "nutritionTips": ["Try generating a new menu with recipes to get ingredient information"],
                "error": "No ingredients found in menu",
                "status": "error",
                "menu_id": menu_id
            }
        
        # For timeout prevention, immediately return a basic response with the standard grocery list
        basic_response = {
            "groceryList": [{"category": "All Items", "items": grocery_list}],
            "recommendations": ["Enhanced AI grocery list is being processed..."],
            "nutritionTips": ["Check status endpoint for complete AI list"],
            "status": "processing",
            "menu_id": menu_id,
            "timestamp": datetime.now().isoformat()
        }
        
        # Store the processing status in cache
        AI_SHOPPING_LIST_CACHE[cache_key] = {
            'data': basic_response,
            'timestamp': time.time(),
            'status': 'processing'
        }
        
        # Add background task to process the AI shopping list
        background_tasks.add_task(
            process_ai_shopping_list_background,
            menu_id,
            menu_data,
            grocery_list,
            request.additional_preferences
        )
        
        # Return the basic response immediately to avoid timeout
        return basic_response
        
    except Exception as e:
        logger.error(f"Error generating basic grocery list: {str(e)}")
        # Return an error response that the frontend can handle
        return {
            "groceryList": [],
            "recommendations": ["Error processing shopping list"],
            "error": str(e),
            "status": "error",
            "menu_id": menu_id
        }

@router.get("/{menu_id}/ai-shopping-list/status")
async def get_ai_shopping_list_status(menu_id: int, preferences: Optional[str] = None):
    """
    Check the status of an AI shopping list generation process.

    Args:
        menu_id: The ID of the menu to check
        preferences: Any additional preferences that were used in the original request

    Returns:
        The current status of the AI shopping list generation
    """
    cache_key = f"{menu_id}_{preferences or 'no_prefs'}"
    logger.info(f"Checking AI shopping list status for menu {menu_id}, cache key: {cache_key}")

    # First check for the cache
    if cache_key in AI_SHOPPING_LIST_CACHE:
        cached_data = AI_SHOPPING_LIST_CACHE[cache_key]
        status = cached_data.get('status', 'unknown')
        timestamp = cached_data.get('timestamp', 0)
        logger.info(f"Found cache entry with status: {status}")

        # Check if cache is still valid
        if time.time() - timestamp < CACHE_EXPIRY:
            result = cached_data.get('data', {})

            # Check for timeout on processing jobs (force complete after 5 minutes)
            PROCESSING_TIMEOUT = 300  # 5 minutes in seconds
            if status == 'processing' and time.time() - timestamp > PROCESSING_TIMEOUT:
                # Processing has been stuck too long, force it to complete
                logger.warning(f"Processing timeout reached for menu {menu_id}, forcing status to completed")

                # Create a categorized fallback result
                try:
                    # Extract the basic grocery list from the processing data if available
                    grocery_list = []
                    if isinstance(result, dict) and "groceryList" in result:
                        # Try to extract items from All Items category
                        for category in result["groceryList"]:
                            if category.get("category") == "All Items" and "items" in category:
                                # Get items from the All Items category
                                for item in category["items"]:
                                    if isinstance(item, dict) and "name" in item:
                                        grocery_list.append(item["name"])
                                    elif isinstance(item, str):
                                        grocery_list.append(item)

                    # If we couldn't extract items, try to find a menu to regenerate the list
                    if not grocery_list:
                        conn = get_db_connection()
                        try:
                            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                                # Fetch the meal_plan_json field
                                cur.execute("SELECT meal_plan_json FROM menus WHERE id=%s", (menu_id,))
                                row = cur.fetchone()

                                if row:
                                    menu_data = row["meal_plan_json"]
                                    grocery_list = aggregate_grocery_list(menu_data)
                        except Exception as menu_error:
                            logger.error(f"Error fetching menu data for timeout fallback: {str(menu_error)}")
                        finally:
                            conn.close()

                    # Create a categorized fallback list
                    categorized_list = create_categorized_fallback(grocery_list)

                    # Create a complete fallback result
                    fallback_result = {
                        "groceryList": categorized_list,
                        "recommendations": ["AI processing timed out, showing categorized list"],
                        "nutritionTips": [
                            "For a balanced diet, include items from each food group",
                            "Fresh produce typically offers better nutrition than processed alternatives"
                        ],
                        "pantryStaples": ["Salt", "Pepper", "Olive Oil", "Flour", "Sugar"],
                        "healthyAlternatives": [
                            {"original": "Sour Cream", "alternative": "Non-Fat Plain Greek Yogurt", "benefit": "Higher protein, lower fat"},
                            {"original": "Ground Beef", "alternative": "Ground Turkey", "benefit": "Lower fat content"},
                            {"original": "White Rice", "alternative": "Brown Rice", "benefit": "More fiber and nutrients"}
                        ],
                        "shoppingTips": [
                            "Buy in-season produce for better flavor and nutrition",
                            "Check unit prices to find the best value",
                            "Look for sales on staple items you can stock up on"
                        ],
                        "healthySwaps": [],
                        "bulkItems": [],
                        "status": "completed",  # Mark as completed so UI doesn't stay in loading state
                        "menu_id": menu_id,
                        "timestamp": datetime.now().isoformat(),
                        "timeout": True,  # Mark this as a timeout result
                        "fallback": True   # Mark as fallback result
                    }

                    # Update cache with fallback result
                    AI_SHOPPING_LIST_CACHE[cache_key] = {
                        'data': fallback_result,
                        'timestamp': time.time(),
                        'status': 'completed'  # Important: Mark as completed
                    }

                    # Use the fallback result
                    result = fallback_result
                    status = 'completed'
                    logger.info(f"Created timeout fallback list with {len(categorized_list)} categories")
                except Exception as fallback_error:
                    logger.error(f"Error creating timeout fallback: {str(fallback_error)}")
                    # If fallback creation fails, still update the status but with minimal data
                    simple_fallback = {
                        "groceryList": [{"category": "All Items", "items": [{"name": "Processing timed out", "quantity": "1", "unit": ""}]}],
                        "recommendations": ["AI processing timed out, please try again"],
                        "nutritionTips": ["Using basic grocery list"],
                        "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                        "healthySwaps": [],
                        "bulkItems": [],
                        "status": "completed",  # Mark as completed so UI doesn't stay in loading state
                        "menu_id": menu_id,
                        "error": "Processing timeout",
                        "timestamp": datetime.now().isoformat(),
                        "timeout": True
                    }

                    # Update cache with simple fallback
                    AI_SHOPPING_LIST_CACHE[cache_key] = {
                        'data': simple_fallback,
                        'timestamp': time.time(),
                        'status': 'completed'
                    }

                    # Use the simple fallback
                    result = simple_fallback
                    status = 'completed'

            # Add status metadata
            if isinstance(result, dict):
                result['cached'] = True
                result['cache_timestamp'] = datetime.fromtimestamp(timestamp).isoformat()
                result['status'] = status
                result['menu_id'] = menu_id

                # Ensure required fields exist
                if "pantryStaples" not in result:
                    result["pantryStaples"] = ["Salt", "Pepper", "Olive Oil", "Flour", "Sugar"]
                if "healthySwaps" not in result:
                    result["healthySwaps"] = []
                if "bulkItems" not in result:
                    result["bulkItems"] = []
                if "nutritionTips" not in result:
                    result["nutritionTips"] = ["For a balanced diet, include items from each food group"]
                if "recommendations" not in result:
                    result["recommendations"] = ["Shop in bulk when possible to save money"]

                # If still processing, add more info
                if status == 'processing':
                    elapsed = time.time() - timestamp
                    result['elapsed_seconds'] = round(elapsed)
                    result['message'] = f"AI shopping list is being processed (elapsed time: {round(elapsed)} seconds)"
                    # Calculate remaining time before timeout
                    PROCESSING_TIMEOUT = 300  # 5 minutes in seconds
                    remaining = PROCESSING_TIMEOUT - elapsed
                    if remaining > 0:
                        result['remaining_seconds'] = round(remaining)
                        result['timeout_in'] = f"{round(remaining)} seconds"

                # Log the structure being returned
                if status == 'completed':
                    logger.info(f"Returning completed AI shopping list with structure: {type(result)}")
                    if 'groceryList' in result:
                        logger.info(f"groceryList has {len(result['groceryList'])} categories")
                        # Check first category format
                        if result['groceryList'] and isinstance(result['groceryList'][0], dict):
                            first_cat = result['groceryList'][0]
                            logger.info(f"First category: {first_cat.get('category', 'unknown')}")
                            if 'items' in first_cat and first_cat['items']:
                                logger.info(f"Sample items: {first_cat['items'][:2]}")

            logger.info(f"Returning AI shopping list status: {status}")
            return result
        else:
            # Cache expired
            logger.info(f"Cache expired for menu {menu_id}")
            return {
                "status": "expired",
                "menu_id": menu_id,
                "message": "The AI shopping list request has expired, please make a new request",
                "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                "healthySwaps": [],
                "bulkItems": [],
                "nutritionTips": ["Request expired, please make a new request"],
                "recommendations": ["Request expired, please make a new request"]
            }
    else:
        # No processing found - try listing all active cache keys for debugging
        active_keys = list(AI_SHOPPING_LIST_CACHE.keys())
        menu_keys = [k for k in active_keys if k.startswith(f"{menu_id}_")]
        logger.info(f"No cache entry found for key: {cache_key}")
        logger.info(f"Active cache keys for menu {menu_id}: {menu_keys}")

        # If there are other keys for this menu, return info about them
        if menu_keys:
            return {
                "status": "not_found",
                "menu_id": menu_id,
                "message": f"No AI shopping list processing found with these preferences, but found {len(menu_keys)} other processes for this menu",
                "available_keys": menu_keys,
                "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                "healthySwaps": [],
                "bulkItems": [],
                "nutritionTips": ["No processing found with these preferences"],
                "recommendations": ["Try making a new request"]
            }
        else:
            # Check if a basic grocery list is available
            conn = get_db_connection()
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as cur:
                    # Check if the menu exists
                    cur.execute("SELECT EXISTS(SELECT 1 FROM menus WHERE id=%s)", (menu_id,))
                    exists = cur.fetchone()['exists']

                if exists:
                    return {
                        "status": "not_found",
                        "menu_id": menu_id,
                        "message": "No AI shopping list processing found for this menu, please make a new request using the POST endpoint",
                        "action_required": "POST to /menu/{menu_id}/ai-shopping-list to start processing",
                        "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                        "healthySwaps": [],
                        "bulkItems": [],
                        "nutritionTips": ["No processing found for this menu"],
                        "recommendations": ["Make a new request to generate an AI shopping list"]
                    }
                else:
                    return {
                        "status": "error",
                        "menu_id": menu_id,
                        "message": "Menu not found",
                        "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                        "healthySwaps": [],
                        "bulkItems": [],
                        "nutritionTips": ["Menu not found"],
                        "recommendations": ["Select a valid menu first"]
                    }
            except Exception as e:
                logger.error(f"Error checking menu existence: {str(e)}")
                return {
                    "status": "not_found",
                    "menu_id": menu_id,
                    "message": "No AI shopping list processing found for this menu, please make a new request",
                    "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                    "healthySwaps": [],
                    "bulkItems": [],
                    "nutritionTips": ["No processing found for this menu"],
                    "recommendations": ["Make a new request to generate an AI shopping list"]
                }
            finally:
                conn.close()

def generate_ai_shopping_list(menu_data, basic_grocery_list, additional_preferences=None):
    """
    Enhance a grocery list with AI recommendations.
    
    Args:
        menu_data: The raw menu data containing meal plans
        basic_grocery_list: The basic grocery list generated through aggregation
        additional_preferences: Any additional user preferences to consider
        
    Returns:
        An enhanced grocery list with optimizations and recommendations
    """
    try:
        # Validate and process the basic grocery list
        if not basic_grocery_list:
            logger.warning("Empty grocery list provided to AI enhancement")
            return {
                "groceryList": [],
                "recommendations": ["No ingredients found to enhance"],
                "nutritionTips": ["Try generating a new menu with recipes to get ingredient information"],
                "error": "Empty grocery list"
            }
        
        # Extract items from the basic grocery list
        grocery_items = []
        logger.info(f"Processing grocery list with {len(basic_grocery_list)} items")
        
        # Debug log the structure of the first few items
        if len(basic_grocery_list) > 0:
            sample_items = basic_grocery_list[:3]
            for i, item in enumerate(sample_items):
                logger.info(f"Sample item {i}: Type={type(item)}, Value={item}")
        
        for item in basic_grocery_list:
            if isinstance(item, dict) and "name" in item:
                grocery_items.append(item["name"])
                logger.info(f"Added dict item: {item['name']}")
            elif isinstance(item, str):
                grocery_items.append(item)
                logger.info(f"Added string item: {item}")
            else:
                # More detailed logging of unexpected formats
                logger.warning(f"Unexpected item format in grocery list: {type(item)}")
                try:
                    logger.warning(f"Item content: {repr(item)}")
                    # Try to extract name from any object with string representation
                    item_str = str(item).strip()
                    if item_str and len(item_str) > 1:
                        grocery_items.append(item_str)
                        logger.info(f"Added string representation of item: {item_str}")
                except Exception as ex:
                    logger.error(f"Failed to process item: {ex}")
                
        if not grocery_items:
            logger.warning("Failed to extract any valid items from grocery list")
            
            # Try a more aggressive approach with the raw grocery list
            try:
                # Try to extract any text content from the items
                logger.info("Attempting aggressive extraction from raw items")
                for item in basic_grocery_list:
                    try:
                        # If it's a dictionary with any key, use the first value
                        if isinstance(item, dict) and len(item) > 0:
                            first_key = next(iter(item))
                            value = item[first_key]
                            if isinstance(value, str) and value.strip():
                                grocery_items.append(value.strip())
                                logger.info(f"Extracted from dict using first key: {value}")
                            else:
                                # Use the key itself if it's a meaningful string
                                if isinstance(first_key, str) and len(first_key) > 1:
                                    grocery_items.append(first_key)
                                    logger.info(f"Using dict key as item: {first_key}")
                        # If it's something with a string representation, use that
                        elif item is not None:
                            item_str = str(item).strip()
                            if item_str and len(item_str) > 1 and item_str.lower() != "none":
                                grocery_items.append(item_str)
                                logger.info(f"Using string representation: {item_str}")
                    except Exception as ex:
                        logger.error(f"Error in aggressive extraction: {ex}")
            except Exception as ex:
                logger.error(f"Failed during aggressive item extraction: {ex}")
                
            # If still no items, return a meaningful error
            if not grocery_items:
                logger.warning("All extraction methods failed, no valid items found")
                return {
                    "groceryList": basic_grocery_list,  # Return original list
                    "recommendations": ["Could not process ingredients in expected format"],
                    "error": "No valid items found"
                }
            else:
                logger.info(f"Aggressive extraction found {len(grocery_items)} items")
        
        grocery_text = "\n".join(grocery_items)
        logger.info(f"Prepared {len(grocery_items)} items for AI processing")
        
        # Convert menu_data to string if it's not already
        if not isinstance(menu_data, str):
            try:
                menu_json = json.dumps(menu_data)
            except Exception as json_error:
                logger.error(f"Error converting menu data to JSON: {str(json_error)}")
                menu_json = "{}"
        else:
            menu_json = menu_data
            
        # Try to parse the menu JSON if it's a string
        try:
            menu_dict = json.loads(menu_json) if isinstance(menu_json, str) else menu_json
        except Exception as parse_error:
            logger.error(f"Error parsing menu JSON: {str(parse_error)}")
            menu_dict = {}
        
        # Extract meal information for context in a simple format
        meal_titles = []

        # Handle simplified menu format (from background task)
        if isinstance(menu_dict, dict) and "meal_titles" in menu_dict:
            meal_titles = menu_dict["meal_titles"]
        # Try to find days array and extract meal titles
        elif isinstance(menu_dict, dict) and "days" in menu_dict:
            try:
                for day in menu_dict["days"]:
                    if "meals" in day and isinstance(day["meals"], list):
                        for meal in day["meals"]:
                            if "title" in meal:
                                meal_titles.append(meal["title"])
            except Exception as meal_error:
                logger.error(f"Error extracting meal information: {str(meal_error)}")

        # Create a simple plain text meal plan context
        meal_plan_text = ""
        if meal_titles:
            meal_plan_text = "Meals in this plan:\n- " + "\n- ".join(meal_titles[:10])
            if len(meal_titles) > 10:
                meal_plan_text += "\n- (and more...)"

        # Build the AI prompt with simple text only - no complex JSON
        prompt = "You are a helpful meal planning assistant. I'll provide you with a shopping list and meal plan information.\n"
        prompt += "Please organize this shopping list in a more efficient way with the following enhancements:\n\n"
        prompt += "1. Categorize items by store section (produce, dairy, meat, etc.)\n"
        prompt += "2. Suggest healthy alternatives for common ingredients (like using Greek yogurt instead of sour cream)\n"
        prompt += "3. Note which items might already be in a typical pantry\n"
        prompt += "4. Identify items that can be purchased in bulk to save money\n"
        prompt += "5. Highlight any specialty ingredients that might be hard to find\n"
        prompt += "6. Add nutrition information where relevant\n"
        prompt += "7. Include shopping tips for buying better quality ingredients\n\n"
        prompt += "Shopping List:\n" + grocery_text + "\n\n"

        if meal_plan_text:
            prompt += meal_plan_text + "\n\n"

        if additional_preferences:
            prompt += "Additional Preferences: " + additional_preferences + "\n\n"

        prompt += "Format your response as a simple JSON object. I need the output in this EXACT format with items formatted as 'Item: Quantity-Unit':\n"
        prompt += """
{
  "groceryList": [
    {
      "category": "Produce",
      "items": [
        { "name": "Bell Pepper", "quantity": "2", "unit": "medium", "display_name": "Bell Pepper: 2-medium" },
        { "name": "Spinach", "quantity": "3", "unit": "cups", "display_name": "Spinach: 3-cups" }
      ]
    },
    {
      "category": "Meat and Proteins",
      "items": [
        { "name": "Chicken Breast", "quantity": "1.5", "unit": "lb", "display_name": "Chicken Breast: 1.5-lb" }
      ]
    },
    {
      "category": "Dairy",
      "items": [
        { "name": "Cheddar Cheese", "quantity": "8", "unit": "oz", "display_name": "Cheddar Cheese: 8-oz" }
      ]
    }
  ],
  "recommendations": [
    "Shop for produce first to ensure freshness",
    "Check your pantry for staples before shopping"
  ],
  "nutritionTips": [
    "This meal plan is high in protein and fiber"
  ],
  "healthyAlternatives": [
    {"original": "Sour Cream", "alternative": "Non-Fat Plain Greek Yogurt", "benefit": "Higher protein, lower fat"},
    {"original": "Ground Beef", "alternative": "Ground Turkey", "benefit": "Lower fat content"},
    {"original": "White Rice", "alternative": "Brown Rice", "benefit": "More fiber and nutrients"}
  ],
  "shoppingTips": [
    "Buy in-season produce for better flavor and nutrition",
    "Check unit prices to find the best value",
    "Look for sales on staple items you can stock up on"
  ]
}
"""
        # Extremely direct and strict instructions for quantity preservation
        prompt += "\n\nCRITICAL IMPORTANCE: You MUST preserve the EXACT original quantities from the shopping list. This is the HIGHEST priority requirement."
        prompt += "\n\nDO NOT standardize quantities in ANY way. If an item says '96 oz' of chicken, the quantity MUST be '96' and the unitOfMeasure MUST be 'oz'. DO NOT convert to pounds or any other unit."
        prompt += "\n\nDO NOT round quantities or simplify them. Keep all decimal places and exact numeric values as provided in the original list."
        prompt += "\n\nPlease return a JSON array where each item has these fields:"
        prompt += "\n1. name: The ingredient name WITHOUT quantities in the name"
        prompt += "\n2. quantity: The EXACT original numeric amount from the input list (e.g., '96' for chicken, not '1')"
        prompt += "\n3. unitOfMeasure: The EXACT original unit from the input (e.g., 'oz', 'piece', etc.)"
        prompt += "\n4. category: The department category"

        prompt += "\n\nExample format:"
        prompt += """
[
  {
    "name": "Chicken Breast",
    "quantity": "96",
    "unitOfMeasure": "oz",
    "category": "Meat & Seafood"
  },
  {
    "name": "Spinach",
    "quantity": "1",
    "unitOfMeasure": "bag",
    "category": "Produce"
  }
]
"""
        prompt += "\n\nUse these categories: Produce, Meat & Seafood, Dairy & Eggs, Bakery & Bread, Dry Goods & Pasta, Canned Goods, Frozen Foods, Condiments & Spices, Snacks, Beverages, Baking, Other."
        prompt += "\n\nMake sure quantities and units make sense for each item (e.g. '3 eggs' not '3 lb eggs')."
        prompt += "\n\nDO NOT convert between units or change quantities. If the original says '96 oz' keep it as '96 oz', don't convert to '6 lb'."
        prompt += "\n\nCombine duplicate ingredients, adding up quantities when appropriate, but preserve the original units."

        prompt += "\n\nRETURN ONLY THE JSON ARRAY - no wrapper object or other text."

        logger.info("Making OpenAI API call")
        # Make OpenAI API call with better error handling
        try:
            system_prompt = "You are a helpful meal planning assistant that creates organized shopping lists with standardized units and categories. Return a direct JSON array without any wrapper or extra text."
            message_array = [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": prompt}
            ]
            
            # First try with GPT-4
            try:
                logger.info("Attempting to use GPT-4 for best quality response")
                response = openai.ChatCompletion.create(
                    model="gpt-4",  # Using GPT-4 for better structured data and more accurate item formatting
                    messages=message_array,
                    temperature=0.5,  # Lower temperature for more consistent responses
                    max_tokens=2000
                )
                logger.info("Successfully used GPT-4 model")
            except Exception as model_error:
                # If GPT-4 fails (e.g., user doesn't have access), fall back to GPT-3.5
                logger.warning(f"GPT-4 call failed: {str(model_error)}. Falling back to GPT-3.5-turbo")
                response = openai.ChatCompletion.create(
                    model="gpt-3.5-turbo",
                    messages=message_array,
                    temperature=0.5,  # Lower temperature for more consistent responses
                    max_tokens=2000
                )
                logger.info("Used GPT-3.5-turbo as fallback")
            
            # Extract and parse the response
            ai_content = response.choices[0].message.content.strip()
            logger.info("Received OpenAI response")

            # Try to parse as JSON array
            try:
                # First, check if we need to extract JSON from markdown formatting
                if "```json" in ai_content and "```" in ai_content:
                    # Extract JSON from markdown code block
                    import re
                    match = re.search(r'```(?:json)?\s*([\s\S]*?)\s*```', ai_content)
                    if match:
                        ai_content = match.group(1).strip()

                # Parse the JSON array response
                shopping_list_items = json.loads(ai_content)

                # Make sure we have a valid array
                if isinstance(shopping_list_items, list) and len(shopping_list_items) > 0:
                    # Direct return of the array
                    logger.info(f"Successfully parsed JSON array with {len(shopping_list_items)} items")
                    return shopping_list_items
                else:
                    logger.warning("OpenAI response wasn't a list - falling back to default format")
            except json.JSONDecodeError as je:
                logger.error(f"JSON parsing error: {str(je)}")
                logger.error(f"Raw content: {ai_content[:500]}...")
            except Exception as parse_error:
                logger.error(f"Error parsing OpenAI response: {str(parse_error)}")

            # If we get here, something went wrong with parsing - return fallback format
            return {
                "groceryList": [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}],
                "recommendations": ["AI service unavailable - showing standard list"],
                "error": "Error parsing AI response"
            }

        except Exception as openai_error:
            logger.error(f"Error calling OpenAI API: {str(openai_error)}")
            # Return a graceful error response
            return {
                "groceryList": [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}],
                "recommendations": ["AI service unavailable - showing standard list"],
                "error": "OpenAI API error"
            }

        # Parse the JSON response with enhanced error handling
        try:
            logger.info(f"Attempting to parse AI response, content type: {type(ai_content)}, length: {len(ai_content)}")
            # Log a sample of the content for debugging
            logger.info(f"First 200 chars of AI response: {ai_content[:200]}")

            # Simplified, more robust extraction approach to handle typical GPT responses

            # First, try to extract any JSON block enclosed in triple backticks (common markdown format)
            code_block_pattern = r'```(?:json)?\s*\n?([\s\S]*?)\n?\s*```'
            code_blocks = re.findall(code_block_pattern, ai_content)

            # Check if we found any code blocks
            if code_blocks:
                logger.info(f"Found {len(code_blocks)} code blocks, using the first one")
                json_str = code_blocks[0].strip()

                # Find the outermost JSON object in the code block
                json_obj_match = re.search(r'(\{[\s\S]*\})', json_str, re.DOTALL)
                if json_obj_match:
                    json_str = json_obj_match.group(1).strip()
                    logger.info(f"Extracted JSON object from code block, length: {len(json_str)}")

                # Try to parse the JSON
                try:
                    ai_result = json.loads(json_str)
                    logger.info("Successfully parsed JSON from code block")
                except json.JSONDecodeError as json_err:
                    logger.error(f"JSON parse error from code block: {str(json_err)}")
                    # Fall through to the next approach
                    raise

            # If no code blocks or parsing failed, look for JSON directly in the text
            else:
                logger.info("No code blocks found or parsing failed, looking for JSON objects directly")
                # Look for any JSON object pattern in the content
                json_obj_match = re.search(r'(\{[\s\S]*\})', ai_content, re.DOTALL)

                if json_obj_match:
                    json_str = json_obj_match.group(1).strip()
                    logger.info(f"Found direct JSON object, length: {len(json_str)}")

                    # Try to parse it
                    try:
                        ai_result = json.loads(json_str)
                        logger.info("Successfully parsed JSON object from text")
                    except json.JSONDecodeError as json_err:
                        logger.error(f"JSON parse error from direct object: {str(json_err)}")

                        # Clean the JSON before trying again - fix common GPT formatting issues
                        try:
                            # 1. Standardize quote usage (replace single quotes with double quotes)
                            clean_json = re.sub(r"'([^']*)'", r'"\1"', json_str)
                            # 2. Remove trailing commas in arrays and objects
                            clean_json = re.sub(r',\s*}', '}', clean_json)
                            clean_json = re.sub(r',\s*\]', ']', clean_json)
                            # 3. Ensure property names are quoted
                            clean_json = re.sub(r'(\s*)([a-zA-Z0-9_]+)(\s*):(\s*)', r'\1"\2"\3:\4', clean_json)

                            logger.info("Trying with cleaned JSON")
                            ai_result = json.loads(clean_json)
                            logger.info("Successfully parsed cleaned JSON")
                        except json.JSONDecodeError:
                            logger.error("Failed to parse even with cleaned JSON")
                            # Fall back to manual structure creation
                            raise
                else:
                    logger.error("No JSON object pattern found in response")
                    raise ValueError("No JSON object pattern found in response")
            
            # Validate the response structure
            if "groceryList" not in ai_result:
                logger.warning("AI response missing required groceryList property")
                # Add a default groceryList if missing
                ai_result["groceryList"] = [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}]
            elif not isinstance(ai_result["groceryList"], list):
                logger.warning(f"AI groceryList is not a list, type: {type(ai_result['groceryList'])}")
                # Try to handle object format if it's a dictionary instead of list
                if isinstance(ai_result["groceryList"], dict):
                    logger.info("Converting groceryList from object to array format")
                    ai_result["groceryList"] = [ai_result["groceryList"]]
                else:
                    # Replace with default structure
                    ai_result["groceryList"] = [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}]
            
            # Ensure recommendations and nutritionTips are present
            if "recommendations" not in ai_result or not isinstance(ai_result["recommendations"], list):
                logger.info("Adding default recommendations")
                ai_result["recommendations"] = ["Shop in bulk when possible to save money"]
                
            if "nutritionTips" not in ai_result or not isinstance(ai_result["nutritionTips"], list):
                logger.info("Adding default nutrition tips")
                ai_result["nutritionTips"] = ["Focus on whole food ingredients for better nutrition"]
                
            # Add the original list as a fallback
            ai_result["originalList"] = basic_grocery_list
            
            # Ensure proper structure for grocery list items with correct units
            try:
                # Check structure and format as needed
                for i, category in enumerate(ai_result["groceryList"]):
                    if not isinstance(category, dict):
                        logger.warning(f"Category {i} is not a dictionary, converting to standard format")
                        ai_result["groceryList"][i] = {"category": "Other", "items": [{"name": str(category)}]}
                        continue
                        
                    # Ensure category has a name
                    if "category" not in category:
                        category["category"] = "Other"
                    
                    # Ensure each category has items array
                    if "items" not in category or not isinstance(category["items"], list):
                        category["items"] = []
                    
                    # Normalize items to have name, quantity, and unit properties
                    for j, item in enumerate(category["items"]):
                        # Function to determine appropriate unit based on item type
                        def appropriate_unit(name):
                            name_lower = name.lower()
                            
                            # Meats category - use appropriate units based on quantity
                            if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin", "steak", "ground", "meat"]):
                                # Look at the potential quantity if any
                                qty_match = re.search(r'\d+', name)
                                if qty_match:
                                    qty = int(qty_match.group(0))
                                    if qty > 20:  # Large quantity suggests this should be in ounces
                                        return "oz"

                                return "lb"  # Default to pounds for small quantities
                            
                            # Cheese and dairy
                            elif "cheese" in name_lower:
                                if "cheddar" in name_lower or "mozzarella" in name_lower:
                                    return "oz"
                                elif "feta" in name_lower or "parmesan" in name_lower:
                                    return "cup"
                                else:
                                    return "oz"
                            
                            # Produce and vegetables
                            elif any(veg in name_lower for veg in ["onion", "pepper", "bell pepper", "tomato", "potato", "avocado"]):
                                return "medium"
                            elif any(veg in name_lower for veg in ["carrot", "cucumber", "zucchini"]):
                                return "piece"
                            elif "lettuce" in name_lower or "greens" in name_lower or "spinach" in name_lower or "kale" in name_lower:
                                return "cup"
                            elif "broccoli" in name_lower or "cabbage" in name_lower:
                                return "cup"
                            
                            # Spices, herbs and seasonings
                            elif "garlic" in name_lower:
                                return "clove"
                            elif "basil" in name_lower or "cilantro" in name_lower or "parsley" in name_lower:
                                return "cup"
                            elif any(spice in name_lower for spice in ["spice", "seasoning", "powder", "salt", "pepper"]):
                                return "tsp"
                            
                            # Oils, sauces and condiments
                            elif any(condiment in name_lower for condiment in ["oil", "sauce", "vinegar", "mustard", "mayo"]):
                                return "tbsp"
                            elif "honey" in name_lower or "syrup" in name_lower:
                                return "tbsp"
                            elif "salsa" in name_lower or "dressing" in name_lower:
                                return "cup"
                            
                            # Canned items
                            elif "beans" in name_lower or "chickpeas" in name_lower:
                                return "can"
                            elif "broth" in name_lower or "stock" in name_lower:
                                return "cup"
                            
                            # Grains
                            elif any(grain in name_lower for grain in ["oats", "quinoa", "rice"]):
                                # If it's cooked, use cups
                                if "cooked" in name_lower:
                                    return "cup"
                                # Otherwise use weight
                                else:
                                    return "g"
                            
                            # Baked goods
                            elif "bread" in name_lower or "tortilla" in name_lower or "bagel" in name_lower:
                                return "piece"
                            
                            # Fruits and berries
                            elif "berries" in name_lower or "fruit" in name_lower:
                                return "cup"
                            elif "apple" in name_lower or "orange" in name_lower or "banana" in name_lower:
                                return "medium"
                            
                            # Dairy liquids
                            elif "milk" in name_lower or "cream" in name_lower or "yogurt" in name_lower:
                                return "cup"
                            
                            # Eggs
                            elif "eggs" in name_lower or "egg" in name_lower:
                                return "large"
                            
                            # Baking ingredients
                            elif "flour" in name_lower or "sugar" in name_lower:
                                return "cup"
                            
                            # Nuts and seeds
                            elif any(nut in name_lower for nut in ["almond", "walnut", "peanut", "cashew", "seed"]):
                                return "cup"
                            
                            # Butter and spreads
                            elif "butter" in name_lower:
                                return "tbsp"
                            
                            # Default case
                            else:
                                return "piece"
                        
                        # Function to sanitize quantity values with more reasonable constraints
                        def sanitize_quantity(qty, food_name):
                            name_lower = food_name.lower()
                            
                            # If quantity is missing or invalid, assign a reasonable default
                            if not qty or qty == "N/A":
                                # Meats
                                if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin", "steak", "ground"]):
                                    return "1.5"  # 1.5 lb is a reasonable default for meat
                                
                                # Cheese
                                elif "cheese" in name_lower:
                                    if "cheddar" in name_lower or "mozzarella" in name_lower:
                                        return "8"  # 8 oz
                                    elif "feta" in name_lower or "parmesan" in name_lower:
                                        return "0.25"  # 1/4 cup
                                    else:
                                        return "4"  # 4 oz
                                
                                # Vegetables and produce
                                elif any(veg in name_lower for veg in ["onion", "pepper", "bell pepper", "tomato", "potato", "avocado"]):
                                    return "2"  # 2 medium
                                elif any(veg in name_lower for veg in ["carrot", "cucumber", "zucchini"]):
                                    return "2"  # 2 pieces
                                elif "lettuce" in name_lower or "greens" in name_lower or "spinach" in name_lower:
                                    return "2"  # 2 cups
                                elif "broccoli" in name_lower or "cabbage" in name_lower:
                                    return "2"  # 2 cups
                                
                                # Herbs and spices
                                elif "garlic" in name_lower:
                                    return "3"  # 3 cloves
                                elif "basil" in name_lower or "cilantro" in name_lower:
                                    return "0.25"  # 1/4 cup
                                elif any(spice in name_lower for spice in ["spice", "seasoning", "powder", "salt", "pepper"]):
                                    return "1"  # 1 tsp
                                
                                # Oils and condiments
                                elif "oil" in name_lower or "vinegar" in name_lower:
                                    return "2"  # 2 tbsp
                                elif "sauce" in name_lower:
                                    return "0.25"  # 1/4 cup
                                elif "honey" in name_lower or "syrup" in name_lower:
                                    return "1"  # 1 tbsp
                                
                                # Grains
                                elif any(grain in name_lower for grain in ["rice", "quinoa"]):
                                    if "cooked" in name_lower:
                                        return "2"  # 2 cups cooked
                                    else:
                                        return "200"  # 200g uncooked
                                elif "oats" in name_lower:
                                    return "1"  # 1 cup
                                
                                # Dairy
                                elif "milk" in name_lower or "yogurt" in name_lower:
                                    return "1"  # 1 cup
                                
                                # Other common items
                                elif "eggs" in name_lower or "egg" in name_lower:
                                    return "2"  # 2 eggs
                                elif "beans" in name_lower:
                                    return "1"  # 1 can
                                elif "bread" in name_lower or "tortilla" in name_lower:
                                    return "4"  # 4 pieces
                                elif "berries" in name_lower or "fruit" in name_lower:
                                    return "1"  # 1 cup
                                else:
                                    return "1"  # Default
                            
                            # Convert quantity to string if it's not already
                            qty_str = str(qty)
                            
                            # Handle fractional values written as "X/Y"
                            fraction_match = re.match(r'(\d+)/(\d+)', qty_str)
                            if fraction_match:
                                try:
                                    num = int(fraction_match.group(1))
                                    denom = int(fraction_match.group(2))
                                    
                                    # Check for unrealistic fractions like "205/4"
                                    if num > 100 or denom > 100 or (num > denom * 10):
                                        if "oil" in name_lower or "sauce" in name_lower or "spice" in name_lower:
                                            return "2"  # Default for condiments
                                        elif any(meat in name_lower for meat in ["chicken", "beef", "turkey"]):
                                            return "2"  # 2 lb for meat
                                        else:
                                            return "2"  # General default
                                    
                                    # Calculate decimal value
                                    result = num / denom
                                    # For small values like 1/4, 1/3, etc., keep the full precision
                                    if result < 1:
                                        return str(round(result, 2))
                                    # For larger values, round to 1 decimal place
                                    return str(round(result, 1))
                                except:
                                    return "1"  # Default if conversion fails
                            
                            # Handle other strange fraction formats
                            if re.search(r'\d+/\d+', qty_str) and len(qty_str) > 5:
                                # Use category-specific defaults
                                if any(meat in name_lower for meat in ["chicken", "beef", "turkey"]):
                                    return "1.5"  # 1.5 lb for meat
                                elif "oil" in name_lower or "sauce" in name_lower:
                                    return "2"  # 2 tbsp for condiments
                                else:
                                    return "2"  # General default
                            
                            # Extract the numeric part for validation and range checking
                            number_match = re.match(r'([\d.]+)', qty_str)
                            if number_match:
                                try:
                                    number = float(number_match.group(1))
                                    
                                    # Apply category-specific constraints
                                    
                                    # Meats - use appropriate units based on size
                                    if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin", "steak", "ground", "meat"]):
                                        # Get the unit if we have one
                                        unit_match = re.search(r'(lb|lbs|oz|ounce|pound|g|gram)', qty_str)
                                        unit = unit_match.group(1).lower() if unit_match else ""

                                        # For ounces
                                        if unit in ["oz", "ounce", "ounces"]:
                                            if number > 96:  # Unreasonably large ounce quantity
                                                return "24"  # More reasonable ounce quantity
                                            elif number < 3:  # Too small for meat
                                                return "8"  # Reasonable minimum
                                            else:
                                                return str(number)  # Keep as is if reasonable

                                        # For pounds - convert to ounces if large
                                        elif unit in ["lb", "lbs", "pound", "pounds"]:
                                            if number > 5:  # More than 5 pounds is a lot for a recipe
                                                ounces = int(number * 16)
                                                return str(ounces)  # Return as ounces instead
                                            elif number < 0.25:  # Too small
                                                return "1"  # Minimum 1 lb
                                            else:
                                                return str(number)  # Keep as is if reasonable

                                        # For grams
                                        elif unit in ["g", "gram", "grams"]:
                                            if number > 2000:  # More than 2kg is a lot
                                                ounces = int(number * 0.035274)
                                                return str(ounces)  # Convert to ounces for large quantities
                                            else:
                                                return str(number)  # Keep as is if reasonable

                                        # No unit specified
                                        else:
                                            if number > 20:  # Large numbers likely represent ounces
                                                return str(number) + " oz"
                                            elif number > 5:  # Medium numbers might be pounds
                                                return "3"  # Cap at 3 pounds
                                            elif number < 0.25:  # Too small
                                                return "1"  # Minimum 1 lb
                                            else:
                                                return str(number)  # Keep as is
                                    
                                    # Cheese - typically in ounces or cups
                                    elif "cheese" in name_lower:
                                        if "cheddar" in name_lower or "mozzarella" in name_lower:
                                            if number > 16:  # Too much
                                                return "8"  # 8 oz is reasonable
                                        elif "feta" in name_lower or "parmesan" in name_lower:
                                            if number > 2:  # Too much for these strong cheeses
                                                return "0.25"  # 1/4 cup is reasonable
                                    
                                    # Produce and vegetables
                                    elif any(veg in name_lower for veg in ["onion", "bell pepper", "potato", "avocado"]):
                                        if number > 6:  # Too many
                                            return "3"  # 3 is reasonable
                                        elif number < 0.5:  # Too few
                                            return "1"  # At least 1
                                    elif "tomato" in name_lower:
                                        if number > 8:
                                            return "4"  # 4 tomatoes is reasonable
                                    elif any(veg in name_lower for veg in ["carrot", "cucumber", "zucchini"]):
                                        if number > 6:
                                            return "3"  # 3 pieces is reasonable
                                    elif "lettuce" in name_lower or "greens" in name_lower or "spinach" in name_lower:
                                        if number > 6:  # Too many cups
                                            return "3"  # 3 cups is reasonable
                                    
                                    # Herbs, spices and seasonings
                                    elif "garlic" in name_lower:
                                        if number > 10:  # Too many cloves
                                            return "4"  # 4 cloves is reasonable
                                    elif "basil" in name_lower or "cilantro" in name_lower or "parsley" in name_lower:
                                        if number > 1:  # Too much
                                            return "0.5"  # 1/2 cup is reasonable
                                    elif any(spice in name_lower for spice in ["spice", "seasoning", "powder"]):
                                        if number > 3:  # Too much
                                            return "1"  # 1 tsp/tbsp is reasonable
                                        elif "salt" in name_lower or "pepper" in name_lower:
                                            if number > 2:  # Too much
                                                return "0.5"  # 1/2 tsp is reasonable
                                    
                                    # Oils, sauces and condiments
                                    elif "oil" in name_lower:
                                        if number > 8:  # Too much
                                            return "2"  # 2 tbsp is reasonable
                                    elif "sauce" in name_lower or "dressing" in name_lower:
                                        if number > 2:  # Too much
                                            return "0.5"  # 1/2 cup is reasonable
                                    elif "honey" in name_lower or "syrup" in name_lower:
                                        if number > 6:  # Too much
                                            return "2"  # 2 tbsp is reasonable
                                    
                                    # Grains
                                    elif any(grain in name_lower for grain in ["rice", "quinoa"]):
                                        if "cooked" in name_lower:
                                            if number > 6:  # Too much
                                                return "3"  # 3 cups cooked is reasonable
                                        elif number > 1000:  # Too much in grams
                                            return "350"  # 350g uncooked is reasonable
                                        elif number < 50 and "g" not in qty_str:  # Likely cups, not grams
                                            if number > 3:  # Too many cups
                                                return "1.5"  # 1.5 cups is reasonable
                                    
                                    # Dairy
                                    elif "milk" in name_lower or "yogurt" in name_lower:
                                        if number > 4:  # Too much
                                            return "2"  # 2 cups is reasonable
                                    
                                    # Eggs
                                    elif "egg" in name_lower:
                                        if number > 12:  # Too many
                                            return "6"  # 6 eggs is reasonable
                                        elif number < 1:  # Too few
                                            return "2"  # At least 2
                                    
                                    # Extreme outliers for any category - likely an error
                                    elif number > 100:
                                        # If it's likely a weight in grams
                                        if any(grain in name_lower for grain in ["flour", "sugar", "oats"]):
                                            return "250"  # 250g is reasonable
                                        else:
                                            return "20"  # General cap
                                    
                                    return qty_str
                                except:
                                    return "1"  # Default if conversion fails
                            
                            return qty_str
                        
                        if isinstance(item, str):
                            # Parse string items to extract name, quantity and unit (if present)
                            # Example formats: "Apple: 2" or "Chicken: 2 lb" or just "Garlic"
                            name_parts = item.split(":")
                            name = name_parts[0].strip() if len(name_parts) > 0 else item
                            quantity_part = name_parts[1].strip() if len(name_parts) > 1 else ""
                            
                            # Parse quantity and unit
                            # re is already imported at the module level
                            qty_match = re.match(r'^([\d./]+)\s*(.*)$', quantity_part)
                            qty = qty_match.group(1) if qty_match else "1"
                            unit = qty_match.group(2).strip() if qty_match and qty_match.group(2) else "piece"
                            
                            # Convert string item to object with name, quantity and unit
                            category["items"][j] = {
                                "name": name,
                                "quantity": sanitize_quantity(qty, name),
                                "unit": unit if unit else appropriate_unit(name),
                                "alternatives": "N/A",
                                "healthyAlternatives": "N/A"
                            }
                            
                        elif not isinstance(item, dict):
                            # Convert non-dict item to object with name and default quantity
                            item_str = str(item)
                            category["items"][j] = {
                                "name": item_str,
                                "quantity": "1",
                                "unit": appropriate_unit(item_str),
                                "alternatives": "N/A",
                                "healthyAlternatives": "N/A"
                            }
                        else:
                            # Ensure dict item has all required properties
                            if "name" not in item:
                                item["name"] = "Unknown item"
                                
                            # Clean item name to remove any quantity that might be included
                            if ":" in item["name"]:
                                parts = item["name"].split(":")
                                item["name"] = parts[0].strip()
                                
                                # If quantity is missing but present in name, extract it
                                if ("quantity" not in item or not item["quantity"]) and len(parts) > 1:
                                    qty_part = parts[1].strip()
                                    qty_match = re.match(r'^([\d./]+)\s*(.*)$', qty_part)
                                    
                                    if qty_match:
                                        if "quantity" not in item or not item["quantity"]:
                                            item["quantity"] = qty_match.group(1)
                                        
                                        if "unit" not in item or not item["unit"]:
                                            item["unit"] = qty_match.group(2).strip() or "piece"
                            
                            # Handle missing or undefined quantities
                            if "quantity" not in item or not item["quantity"]:
                                item["quantity"] = sanitize_quantity(None, item["name"])
                            else:
                                item["quantity"] = sanitize_quantity(item["quantity"], item["name"])
                            
                            # Handle missing or undefined units
                            if "unit" not in item or not item["unit"]:
                                item["unit"] = appropriate_unit(item["name"])
                            
                            # Clean up units
                            if item["unit"] in ["", "N/A", "None", "none"]:
                                item["unit"] = appropriate_unit(item["name"])
                            
                            # Ensure alternatives
                            if "alternatives" not in item or not item["alternatives"]:
                                item["alternatives"] = "N/A"
                                
                            # Ensure healthy alternatives
                            if "healthyAlternatives" not in item or not item["healthyAlternatives"]:
                                item["healthyAlternatives"] = "N/A"
                                
                            # Update the item in the category
                            category["items"][j] = item
                            
                # Format all items as "Item Name: Quantity Unit" for display
                for category in ai_result["groceryList"]:
                    for item in category["items"]:
                        # Create a formatted display name that includes quantity and unit
                        item["display_name"] = f"{item['name']}: {item['quantity']} {item['unit']}"
            except Exception as structure_error:
                logger.error(f"Error normalizing grocery list structure: {str(structure_error)}")
                # If structure normalization fails, replace with simple version
                ai_result["groceryList"] = [{
                    "category": "All Items", 
                    "items": [
                        {
                            "name": item, 
                            "quantity": "1", 
                            "unit": "piece", 
                            "display_name": f"{item}: 1 piece"
                        } for item in grocery_items
                    ]
                }]
            
            return ai_result
            
        except json.JSONDecodeError as json_error:
            logger.error(f"Failed to parse AI response as JSON: {str(json_error)}")
            logger.error(f"AI response content: {ai_content[:100]}...")

            # Try to create a manual structure from the text if possible
            try:
                # Create a simple structured response from the raw text
                lines = ai_content.split('\n')
                formatted_items = []

                for item in grocery_items:
                    # Clean up item name and add appropriate unit
                    item_name = item.split(':')[0] if ':' in item else item
                    formatted_items.append({
                        "name": item_name,
                        "quantity": "1",
                        "unit": appropriate_unit(item_name),
                        "display_name": f"{item_name}: 1 {appropriate_unit(item_name)}"
                    })

                # Create a manually structured response
                manual_response = {
                    "groceryList": [
                        {
                            "category": "All Items",
                            "items": formatted_items
                        }
                    ],
                    "recommendations": ["AI response format was invalid - showing standard list"],
                    "nutritionTips": ["Try to include a variety of food groups for balanced nutrition"],
                    "pantryStaples": ["Salt", "Pepper", "Olive Oil", "Flour", "Sugar"],
                    "healthySwaps": [],
                    "bulkItems": [],
                    "ai_text": ai_content[:500],  # Include truncated AI text for reference
                    "originalList": basic_grocery_list,
                    "error": "AI response format was invalid"
                }
                return manual_response
            except Exception as format_error:
                logger.error(f"Failed to create manual structure: {str(format_error)}")
                # If all parsing fails, return a simple response with the original list
                return {
                    "groceryList": [{
                        "category": "All Items",
                        "items": [
                            {
                                "name": item,
                                "quantity": "1",
                                "unit": "piece",
                                "display_name": f"{item}: 1 piece"
                            } for item in grocery_items
                        ]
                    }],
                    "recommendations": ["AI response could not be processed"],
                    "nutritionTips": ["Try to include a variety of food groups for balanced nutrition"],
                    "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                    "healthySwaps": [],
                    "bulkItems": [],
                    "error": "AI response format was invalid"
                }
            
    except Exception as e:
        logger.error(f"Error in AI shopping list generation: {str(e)}")
        # Return a formatted version of the basic grocery list in case of error
        try:
            # Try to create a properly formatted response even in case of error
            default_items = []
            for item in (grocery_items if 'grocery_items' in locals() else []):
                item_name = item.split(':')[0] if ':' in item else item
                unit = "piece"
                
                # Determine appropriate unit
                name_lower = item_name.lower()
                if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin"]):
                    unit = "lb"
                elif "cheese" in name_lower:
                    unit = "oz"
                
                default_items.append({
                    "name": item_name,
                    "quantity": "1",
                    "unit": unit,
                    "display_name": f"{item_name}: 1 {unit}"
                })
                
            return {
                "groceryList": [
                    {
                        "category": "All Items",
                        "items": default_items
                    }
                ],
                "recommendations": ["Error processing AI shopping list"],
                "nutritionTips": ["Try to include a variety of food groups for balanced nutrition"],
                "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                "healthySwaps": [],
                "bulkItems": [],
                "error": str(e)
            }
        except:
            # Absolute failsafe
            return {
                "groceryList": [],
                "recommendations": ["Failed to process shopping list"],
                "nutritionTips": ["Try to include a variety of food groups for balanced nutrition"],
                "pantryStaples": ["Salt", "Pepper", "Olive Oil"],
                "healthySwaps": [],
                "bulkItems": [],
                "error": "Critical error in AI processing"
            }

@router.get("/latest/{user_id}")
def get_latest_grocery_list(user_id: int):
    """
    Generate grocery list from the most recent menu.
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    cursor.execute("""
        SELECT id, meal_plan_json
        FROM menus
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 1;
    """, (user_id,))

    menu = cursor.fetchone()
    cursor.close()
    conn.close()

    if not menu:
        raise HTTPException(status_code=404, detail="No menu found for this user.")

    # Process grocery list from the latest menu
    grocery_list = aggregate_grocery_list(menu["meal_plan_json"])

    # Use our categorization function to provide a better experience
    categorized_list = create_categorized_fallback(grocery_list)
    logger.info(f"Created categorized list for latest menu with {len(categorized_list)} categories")

    return {
        "menu_id": menu["id"],
        "groceryList": categorized_list,
        "status": "completed",
        "ai_enhanced": False
    }


@router.get("/ai-shopping-cache/status", status_code=200)
def get_ai_shopping_cache_status():
    """
    Get status information about the AI shopping list cache.
    
    Returns:
        A summary of what's currently cached
    """
    try:
        cache_info = {}
        for key, value in AI_SHOPPING_LIST_CACHE.items():
            # Try to extract menu ID from key
            parts = key.split('_')
            menu_id = parts[0] if parts else "unknown"
            
            # Add cache entry info
            cache_info[key] = {
                "menu_id": menu_id,
                "timestamp": value.get("timestamp", 0),
                "time": datetime.fromtimestamp(value.get("timestamp", 0)).isoformat(),
                "expires_in": CACHE_EXPIRY - (time.time() - value.get("timestamp", 0)),
                "size": len(str(value.get("data", "")))
            }
        
        return {
            "cache_count": len(AI_SHOPPING_LIST_CACHE),
            "cache_entries": cache_info,
            "cache_expiry_seconds": CACHE_EXPIRY
        }
    except Exception as e:
        logger.error(f"Error getting AI shopping list cache status: {str(e)}")
        raise HTTPException(status_code=500, detail="Error getting cache status")


@router.delete("/ai-shopping-cache", status_code=200)
def clear_ai_shopping_cache():
    """
    Clear the AI shopping list cache for all menus.
    This endpoint is meant for administrators to use when needed.
    
    Returns:
        A message indicating the cache was cleared
    """
    try:
        # Get the number of items in the cache
        count = len(AI_SHOPPING_LIST_CACHE)
        
        # Clear the global cache
        AI_SHOPPING_LIST_CACHE.clear()
        logger.info("AI shopping list cache cleared")
        return {"message": f"AI shopping list cache cleared successfully ({count} items)", "count": count}
    except Exception as e:
        logger.error(f"Error clearing AI shopping list cache: {str(e)}")
        raise HTTPException(status_code=500, detail="Error clearing cache")


def create_categorized_fallback(grocery_list):
    """
    Create a categorized version of the grocery list as a fallback when AI processing fails.

    Args:
        grocery_list: The basic grocery list (list of items)

    Returns:
        A list of categories, each containing items that belong to that category
    """
    # Define common categories and keywords that belong to each
    categories = {
        "Produce": [
            "apple", "banana", "orange", "grape", "berry", "berries", "lemon", "lime",
            "lettuce", "spinach", "kale", "arugula", "tomato", "potato", "onion", "garlic",
            "carrot", "cucumber", "zucchini", "squash", "pepper", "eggplant", "broccoli",
            "cauliflower", "celery", "asparagus", "avocado", "mushroom", "ginger", "herbs",
            "cilantro", "parsley", "mint", "basil", "thyme", "rosemary", "fruit", "vegetable"
        ],
        "Meat and Proteins": [
            "chicken", "beef", "pork", "lamb", "turkey", "fish", "salmon", "tuna", "shrimp",
            "tofu", "tempeh", "seitan", "eggs", "sausage", "bacon", "ground", "steak",
            "tenderloin", "fillet", "meat", "protein", "ribs", "chuck", "sirloin"
        ],
        "Dairy": [
            "milk", "cheese", "yogurt", "cream", "butter", "margarine", "ghee", "cheddar",
            "mozzarella", "parmesan", "ricotta", "cottage", "sour cream", "half and half",
            "creamer", "buttermilk", "whey", "dairy"
        ],
        "Grains and Bread": [
            "bread", "roll", "bun", "bagel", "tortilla", "wrap", "pita", "naan", "rice",
            "quinoa", "pasta", "noodle", "flour", "oats", "oatmeal", "cereal", "grain",
            "barley", "couscous", "cracker", "panko", "breadcrumb", "cornmeal"
        ],
        "Canned and Packaged": [
            "can", "beans", "chickpea", "lentil", "pea", "tomato sauce", "paste", "broth",
            "stock", "soup", "tuna", "salmon", "sardine", "sauce", "salsa", "jam", "jelly",
            "peanut butter", "nutella", "spread", "conserve"
        ],
        "Condiments and Oils": [
            "oil", "olive oil", "vegetable oil", "coconut oil", "vinegar", "mustard",
            "ketchup", "mayonnaise", "hot sauce", "soy sauce", "tamari", "fish sauce",
            "worcestershire", "salad dressing", "dressing", "marinade", "barbecue", "bbq"
        ],
        "Spices and Herbs": [
            "salt", "pepper", "spice", "herb", "seasoning", "paprika", "cumin", "oregano",
            "basil", "thyme", "rosemary", "sage", "cinnamon", "nutmeg", "clove", "cardamom",
            "turmeric", "curry", "powder", "flake", "seed", "anise", "bay leaf", "chili",
            "garlic powder", "onion powder", "vanilla"
        ],
        "Baking Supplies": [
            "sugar", "brown sugar", "powdered sugar", "honey", "maple syrup", "molasses",
            "flour", "baking powder", "baking soda", "yeast", "chocolate chip", "cocoa",
            "vanilla extract", "almond extract", "food coloring", "sprinkle", "frosting"
        ],
        "Snacks and Desserts": [
            "chip", "crisp", "pretzel", "popcorn", "nut", "almond", "cashew", "peanut",
            "walnut", "pecan", "cookie", "cracker", "candy", "chocolate", "ice cream",
            "sweet", "snack", "granola", "bar", "dessert", "treat"
        ],
        "Beverages": [
            "water", "juice", "soda", "pop", "coffee", "tea", "milk", "almond milk",
            "soy milk", "oat milk", "drink", "beverage", "smoothie", "beer", "wine",
            "alcohol", "liquor", "cocktail", "mixer"
        ],
        "Frozen Foods": [
            "frozen", "ice cream", "fries", "pizza", "meal", "veggie burger", "waffle"
        ],
        "Breakfast Items": [
            "cereal", "oatmeal", "pancake", "waffle", "syrup", "breakfast", "bacon", "egg"
        ]
    }

    # Create a function to determine which category an item belongs to
    def determine_category(item_name):
        item_name_lower = item_name.lower()

        # Check each category's keywords
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in item_name_lower:
                    return category

        # Default category if no match found
        return "Other"

    # Initialize result structure with empty categories
    result = [{"category": category, "items": []} for category in categories.keys()]
    result.append({"category": "Other", "items": []})  # Add "Other" category

    # Create a mapping from category name to index in result
    category_indices = {cat["category"]: i for i, cat in enumerate(result)}

    # Process each grocery item
    for item in grocery_list:
        try:
            # Extract the item name from string or dictionary format
            if isinstance(item, dict) and "name" in item:
                # If it's already a dict with a name field, use that
                item_name = item["name"]
                item_obj = item
            elif isinstance(item, str):
                # If it's a string, use it directly and create a dict
                item_name = item
                item_obj = {"name": item, "quantity": "1", "unit": ""}
            else:
                # Convert any other type to string
                item_name = str(item)
                item_obj = {"name": item_name, "quantity": "1", "unit": ""}

            # Clean up item name if it contains quantity info
            if ":" in item_name:
                item_name = item_name.split(":")[0].strip()
                item_obj["name"] = item_name

                # If there's quantity info after the colon, extract it
                if len(item_name.split(":")) > 1:
                    qty_info = item_name.split(":")[1].strip()
                    # Try to extract quantity and unit
                    qty_match = re.match(r'^([\d./]+)\s*(.*)$', qty_info)
                    if qty_match:
                        item_obj["quantity"] = qty_match.group(1)
                        item_obj["unit"] = qty_match.group(2).strip()

            # Determine which category this item belongs to
            category = determine_category(item_name)

            # Ensure each item has a display_name
            if "display_name" not in item_obj:
                unit_str = f" {item_obj.get('unit', '')}" if item_obj.get('unit') else ""
                item_obj["display_name"] = f"{item_name}: {item_obj.get('quantity', '1')}{unit_str}".strip()

            # Add the item to the appropriate category
            result[category_indices[category]]["items"].append(item_obj)

        except Exception as e:
            logger.error(f"Error categorizing item {item}: {str(e)}")
            # If there's an error, add it to the "Other" category
            other_index = category_indices["Other"]
            if isinstance(item, dict) and "name" in item:
                result[other_index]["items"].append(item)
            else:
                result[other_index]["items"].append({"name": str(item), "quantity": "1", "unit": ""})

    # Remove empty categories
    result = [cat for cat in result if len(cat["items"]) > 0]

    # Log the results
    logger.info(f"Created fallback categorized list with {len(result)} non-empty categories")
    for cat in result:
        logger.info(f"  Category: {cat['category']} - {len(cat['items'])} items")

    return result

@router.delete("/ai-shopping-cache/{menu_id}", status_code=200)
def clear_ai_shopping_cache_for_menu(menu_id: int):
    """
    Clear the AI shopping list cache for a specific menu.

    Args:
        menu_id: The ID of the menu to clear cache for

    Returns:
        A message indicating the cache was cleared for the specific menu
    """
    try:
        # Look for any cache entries for this menu ID
        removed = 0
        keys_to_remove = []

        for key in list(AI_SHOPPING_LIST_CACHE.keys()):
            if key.startswith(f"{menu_id}_"):
                keys_to_remove.append(key)

        # Remove the keys
        for key in keys_to_remove:
            del AI_SHOPPING_LIST_CACHE[key]
            removed += 1

        logger.info(f"Cleared {removed} cache entries for menu {menu_id}")
        return {"message": f"AI shopping list cache cleared for menu {menu_id}", "count": removed}
    except Exception as e:
        logger.error(f"Error clearing AI shopping list cache for menu {menu_id}: {str(e)}")
        raise HTTPException(status_code=500, detail="Error clearing cache")