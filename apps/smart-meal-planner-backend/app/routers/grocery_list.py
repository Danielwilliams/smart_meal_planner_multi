from fastapi import APIRouter, HTTPException, Query, Body, BackgroundTasks
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection
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
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the full menu details
            cur.execute("""
                SELECT 
                    id AS menu_id, 
                    meal_plan_json, 
                    user_id, 
                    created_at, 
                    nickname
                FROM menus 
                WHERE id = %s
            """, (menu_id,))
            menu = cur.fetchone()
        
        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found")
        
        # Ensure meal_plan_json is parsed
        menu['meal_plan'] = json.loads(menu['meal_plan_json']) if isinstance(menu['meal_plan_json'], str) else menu['meal_plan_json']
        
        return menu
    except Exception as e:
        print("Error retrieving menu details:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


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
                    result['cache_time'] = datetime.fromtimestamp(cached_data.get('timestamp', 0)).isoformat()
                return result
            else:
                # Cache expired, remove it
                logger.info(f"Cache expired for menu {menu_id}, removing from cache")
                AI_SHOPPING_LIST_CACHE.pop(cache_key, None)
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the meal_plan_json field
            cur.execute("SELECT meal_plan_json FROM menus WHERE id=%s", (menu_id,))
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Menu not found")

        # parse the JSON text into a Python dict
        menu_data = row["meal_plan_json"]

        # Standard aggregation
        grocery_list = aggregate_grocery_list(menu_data)
        
        # If AI is requested, enhance the list
        if use_ai:
            result = generate_ai_shopping_list(menu_data, grocery_list)
            
            # Store in cache if successful
            if result and isinstance(result, dict) and "groceryList" in result:
                logger.info(f"Caching AI shopping list for menu {menu_id}")
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
        
        return {"groceryList": grocery_list}

    except Exception as e:
        logger.error(f"Error retrieving grocery list: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

def process_ai_shopping_list_background(menu_id: int, menu_data, grocery_list, additional_preferences=None):
    """Background task to process AI shopping list and store in cache"""
    cache_key = f"{menu_id}_{additional_preferences or 'no_prefs'}"
    
    try:
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
        
        # Process with AI
        result = generate_ai_shopping_list(
            menu_data, 
            grocery_list, 
            additional_preferences=additional_preferences
        )
        
        # Store the completed result in cache
        if result and isinstance(result, dict) and "groceryList" in result:
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
            # If AI processing failed, update cache with basic list
            logger.error(f"AI processing failed for menu {menu_id}")
            AI_SHOPPING_LIST_CACHE[cache_key] = {
                'data': {
                    "groceryList": [{"category": "All Items", "items": grocery_list}],
                    "recommendations": ["AI processing failed, showing basic list"],
                    "nutritionTips": ["Try again later for enhanced AI recommendations"],
                    "status": "failed",
                    "menu_id": menu_id,
                    "timestamp": datetime.now().isoformat()
                },
                'timestamp': time.time(),
                'status': 'failed'
            }
    except Exception as e:
        logger.error(f"Error in background processing for menu {menu_id}: {str(e)}")
        # Update cache with error status
        AI_SHOPPING_LIST_CACHE[cache_key] = {
            'data': {
                "groceryList": [{"category": "All Items", "items": grocery_list}],
                "recommendations": ["Error during AI processing"],
                "nutritionTips": ["Using basic grocery list instead"],
                "status": "error",
                "error": str(e),
                "menu_id": menu_id,
                "timestamp": datetime.now().isoformat()
            },
            'timestamp': time.time(),
            'status': 'error'
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
    
    # Check cache if enabled - this helps avoid timeouts by using cached results
    cache_key = f"{menu_id}_{request.additional_preferences or 'no_prefs'}"
    if request.use_cache and cache_key in AI_SHOPPING_LIST_CACHE:
        cached_data = AI_SHOPPING_LIST_CACHE[cache_key]
        # Check if cache is still valid
        if time.time() - cached_data.get('timestamp', 0) < CACHE_EXPIRY:
            logger.info(f"Returning cached AI shopping list for menu {menu_id}")
            result = cached_data.get('data')
            # Mark as cached in response
            if isinstance(result, dict) and "groceryList" in result:
                result['cached'] = True
                result['cache_timestamp'] = datetime.fromtimestamp(cached_data.get('timestamp', 0)).isoformat()
            return result
        else:
            # Cache expired, remove it
            logger.info(f"Cache expired for menu {menu_id}, removing from cache")
            AI_SHOPPING_LIST_CACHE.pop(cache_key, None)
    
    # If we don't have a valid cache entry, process the request
    # First, get the basic grocery list which is faster
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
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
    finally:
        conn.close()

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
    
    if cache_key in AI_SHOPPING_LIST_CACHE:
        cached_data = AI_SHOPPING_LIST_CACHE[cache_key]
        
        # Check if cache is still valid
        if time.time() - cached_data.get('timestamp', 0) < CACHE_EXPIRY:
            status = cached_data.get('status', 'unknown')
            result = cached_data.get('data', {})
            
            # Add status metadata
            if isinstance(result, dict):
                result['cached'] = True
                result['cache_timestamp'] = datetime.fromtimestamp(cached_data.get('timestamp', 0)).isoformat()
                result['status'] = status
                result['menu_id'] = menu_id
            
            return result
        else:
            # Cache expired
            return {
                "status": "expired",
                "menu_id": menu_id,
                "message": "The AI shopping list request has expired, please make a new request"
            }
    else:
        # No processing found
        return {
            "status": "not_found",
            "menu_id": menu_id,
            "message": "No AI shopping list processing found for this menu, please make a new request"
        }

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
        
        # Extract meal information for context
        meal_info = []
        
        # Try to find days array and extract meal titles
        if isinstance(menu_dict, dict) and "days" in menu_dict:
            try:
                for day in menu_dict["days"]:
                    if "meals" in day and isinstance(day["meals"], list):
                        for meal in day["meals"]:
                            if "title" in meal:
                                meal_info.append(meal["title"])
            except Exception as meal_error:
                logger.error(f"Error extracting meal information: {str(meal_error)}")
        
        # Build the AI prompt with simple string concatenation to avoid potential f-string errors
        prompt = "You are a helpful meal planning assistant. I'll provide you with a shopping list and meal plan information.\n"
        prompt += "Please organize this shopping list in a more efficient way with the following enhancements:\n\n"
        prompt += "1. Categorize items by store section (produce, dairy, meat, etc.)\n"
        prompt += "2. Suggest brand alternatives or substitutions where appropriate\n"
        prompt += "3. Note which items might already be in a typical pantry\n"
        prompt += "4. Identify items that can be purchased in bulk to save money\n"
        prompt += "5. Highlight any specialty ingredients that might be hard to find\n"
        prompt += "6. Add nutrition information where relevant\n"
        prompt += "7. Suggest healthy alternatives to ingredients where applicable\n\n"
        prompt += "Shopping List:\n" + grocery_text + "\n\n"
        
        if meal_info:
            prompt += "Meal Plan Overview:\n" + ', '.join(meal_info[:10]) + "\n\n"
        
        if additional_preferences:
            prompt += "Additional Preferences: " + additional_preferences + "\n\n"
            
        prompt += "Format your response as a JSON object with the following structure, paying special attention to the format of each item:\n"
        prompt += """
{
  "groceryList": [
    {
      "category": "Produce", 
      "items": [
        {
          "name": "Bell Pepper", 
          "quantity": "2", 
          "unit": "medium", 
          "alternatives": "Red or yellow bell peppers", 
          "healthyAlternatives": "Organic bell peppers"
        },
        {
          "name": "Spinach", 
          "quantity": "3", 
          "unit": "cups", 
          "alternatives": "Baby spinach", 
          "healthyAlternatives": "Organic spinach"
        }
      ]
    },
    {
      "category": "Meat and Proteins", 
      "items": [
        {
          "name": "Chicken Breast", 
          "quantity": "1.5", 
          "unit": "lb", 
          "alternatives": "Chicken tenders", 
          "healthyAlternatives": "Free-range organic chicken"
        }
      ]
    },
    {
      "category": "Dairy", 
      "items": [
        {
          "name": "Cheddar Cheese", 
          "quantity": "8", 
          "unit": "oz", 
          "alternatives": "Monterey Jack", 
          "healthyAlternatives": "Low-fat cheddar"
        }
      ]
    },
    {
      "category": "Grains", 
      "items": [
        {
          "name": "Brown Rice", 
          "quantity": "300", 
          "unit": "g", 
          "alternatives": "White rice", 
          "healthyAlternatives": "Quinoa"
        }
      ]
    },
    {
      "category": "Condiments and Oils", 
      "items": [
        {
          "name": "Olive Oil", 
          "quantity": "2", 
          "unit": "tbsp", 
          "alternatives": "Vegetable oil", 
          "healthyAlternatives": "Avocado oil"
        }
      ]
    },
    {
      "category": "Spices and Herbs", 
      "items": [
        {
          "name": "Garlic", 
          "quantity": "3", 
          "unit": "cloves", 
          "alternatives": "Garlic powder", 
          "healthyAlternatives": "Fresh organic garlic"
        }
      ]
    }
  ],
  "recommendations": ["Shop for produce first to ensure freshness", "Check your pantry for staples before shopping"],
  "nutritionTips": ["This meal plan is high in protein and fiber", "Includes plenty of vegetables for essential vitamins"],
  "bulkItems": ["Brown Rice", "Chicken Breast"],
  "pantryStaples": ["Olive Oil", "Salt", "Pepper"],
  "healthySwaps": ["White Rice -> Brown Rice", "Regular Pasta -> Whole Grain Pasta"]
}
"""
        prompt += "\n\nVERY IMPORTANT: For every item, you MUST separate the item name, quantity, and unit of measure into separate fields. DO NOT include the quantity in the item name field. Every item MUST have a sensible unit of measure (pieces, lb, cups, oz, etc.)."
        prompt += "\n\nFor example, instead of: \"name\": \"Chicken Breast: 2 lb\", use: \"name\": \"Chicken Breast\", \"quantity\": \"2\", \"unit\": \"lb\""
        prompt += "\n\nAlso, correct any unrealistic quantities like \"Bell Peppers: 205/4 medium\" or \"Chicken Breast: 22 lb\" to reasonable values."
        prompt += "\n\nUse these guidelines for units and quantities:"
        prompt += "\n1. For meats (chicken, beef, etc.): Use lb or oz, with reasonable quantities (1-5 lb typically)"
        prompt += "\n2. For produce (onions, peppers, etc.): Use either 'medium' or count by piece"
        prompt += "\n3. For spices: Use tsp or tbsp (not large quantities like cups)"
        prompt += "\n4. For grains (rice, quinoa): Use cups or g (200-400g is typical)"
        prompt += "\n5. For oils and sauces: Use tbsp or cup (avoid very large quantities)"
        prompt += "\n6. For dairy: Use cups, oz, or g depending on the item"
        prompt += "\n7. NEVER use fractional formats like '205/4' - convert these to decimal"
        prompt += "\n\nEnsure every item has reasonable quantities appropriate for a meal plan (not restaurant quantities). Double-check all values before including them."
        
        logger.info("Making OpenAI API call")
        # Make OpenAI API call with better error handling
        try:
            system_prompt = "You are a helpful meal planning assistant that helps organize shopping lists efficiently. You always return well-structured JSON with consistent formatting for grocery items. Follow the format example precisely."
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
            
            # First check if response starts with a Markdown code block
            if ai_content.strip().startswith("```"):
                logger.info("Response starts with code block markers")
                # First try extracting content from code block with language specifier
                json_match = re.search(r'```(?:json)?\s*\n([\s\S]*?)\n\s*```', ai_content, re.DOTALL)
                
                if json_match:
                    json_str = json_match.group(1).strip()
                    logger.info(f"Extracted code block content, length: {len(json_str)}")
                    try:
                        # Make sure we have a complete JSON object
                        if json_str.startswith("{") and json_str.endswith("}"):
                            ai_result = json.loads(json_str)
                            logger.info("Successfully parsed JSON from code block")
                        else:
                            # Sometimes there might be extra newlines or formatting issues
                            # Try to extract just the JSON object
                            object_match = re.search(r'(\{[\s\S]*\})', json_str, re.DOTALL)
                            if object_match:
                                json_object = object_match.group(1).strip()
                                ai_result = json.loads(json_object)
                                logger.info("Successfully extracted and parsed JSON object from code block")
                            else:
                                raise ValueError("No valid JSON object found in code block")
                    except (json.JSONDecodeError, ValueError) as block_error:
                        logger.error(f"Error parsing JSON from code block: {str(block_error)}")
                        
                        # Try alternative approaches - first, clean up the JSON string
                        minified_json = re.sub(r'\s+', ' ', json_str)  # Replace all whitespace with single spaces
                        minified_json = re.sub(r',\s*}', '}', minified_json)  # Remove trailing commas
                        
                        # Try again with manually reconstructed JSON
                        try:
                            # Manually reconstruct a JSON object from the content if we detect the structure
                            if "groceryList" in json_str and "category" in json_str and "items" in json_str:
                                logger.info("Attempting to manually reconstruct JSON from content")
                                
                                # Extract categories and items using regex
                                categories = []
                                category_matches = re.finditer(r'"category":\s*"([^"]+)"', json_str)
                                items_matches = re.finditer(r'"items":\s*\[([\s\S]*?)\]', json_str)
                                
                                for cat_match, items_match in zip(category_matches, items_matches):
                                    category_name = cat_match.group(1)
                                    items_content = items_match.group(1)
                                    
                                    # Extract items as name-value pairs
                                    items = []
                                    item_matches = re.finditer(r'\{\s*"name":\s*"([^"]+)"', items_content)
                                    for item_match in item_matches:
                                        items.append({"name": item_match.group(1)})
                                    
                                    categories.append({
                                        "category": category_name,
                                        "items": items
                                    })
                                
                                # Create a structured response
                                ai_result = {
                                    "groceryList": categories,
                                    "recommendations": ["Shop by category to save time in the store"],
                                    "nutritionTips": ["Focus on whole foods for better nutrition"]
                                }
                                logger.info(f"Manually reconstructed JSON with {len(categories)} categories")
                            else:
                                raise ValueError("Could not manually reconstruct JSON")
                        except Exception as rebuild_error:
                            logger.error(f"Failed to manually reconstruct JSON: {str(rebuild_error)}")
                            
                            # As a last resort, try to extract any JSON-like object
                            try:
                                object_match = re.search(r'(\{[\s\S]*\})', ai_content, re.DOTALL)
                                if object_match:
                                    json_object = object_match.group(1).strip()
                                    ai_result = json.loads(json_object)
                                    logger.info("Successfully extracted JSON from raw response")
                                else:
                                    raise ValueError("No JSON object found in response")
                            except Exception:
                                raise  # Fall through to the next approach
                else:
                    # No proper code block match found
                    logger.warning("Code block markers present but content not properly formatted")
                    # Try extracting anything that looks like a JSON object
                    object_match = re.search(r'(\{[\s\S]*\})', ai_content, re.DOTALL)
                    if object_match:
                        try:
                            json_object = object_match.group(1).strip()
                            ai_result = json.loads(json_object)
                            logger.info("Successfully extracted JSON from response")
                        except json.JSONDecodeError:
                            raise  # Fall through to the next approach
                    else:
                        raise ValueError("No JSON object found in response")
            else:
                # No code block markers, try to extract any JSON object from the response
                logger.info("No code block markers found, looking for JSON objects directly")
                object_match = re.search(r'(\{[\s\S]*\})', ai_content, re.DOTALL)
                if object_match:
                    try:
                        json_object = object_match.group(1).strip()
                        ai_result = json.loads(json_object)
                        logger.info("Successfully extracted and parsed JSON object from response")
                    except json.JSONDecodeError:
                        # Try to parse the whole response as JSON as a last resort
                        ai_result = json.loads(ai_content)
                        logger.info("Successfully parsed entire AI response as JSON")
                else:
                    # Try to parse the whole response as JSON as a last resort
                    ai_result = json.loads(ai_content)
                    logger.info("Successfully parsed entire AI response as JSON")
            
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
                            
                            # Meats category
                            if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin", "steak", "ground"]):
                                return "lb"
                            
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
                                        return "0.5"  # 1/2 cup
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
                                    
                                    # Meats - typically in pounds, not more than 5lb for a recipe
                                    if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin", "steak", "ground"]):
                                        if number > 5:
                                            return "3"  # Cap at 3 pounds - more realistic for a recipe
                                        elif number < 0.25:  # Too small
                                            return "1"  # Minimum 1 lb
                                    
                                    # Cheese - typically in ounces or cups
                                    elif "cheese" in name_lower:
                                        if "cheddar" in name_lower or "mozzarella" in name_lower:
                                            if number > 16:  # Too much
                                                return "8"  # 8 oz is reasonable
                                        elif "feta" in name_lower or "parmesan" in name_lower:
                                            if number > 2:  # Too much for these strong cheeses
                                                return "0.5"  # 1/2 cup is reasonable
                                    
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
                            import re
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
                "error": str(e)
            }
        except:
            # Absolute failsafe
            return {
                "groceryList": [],
                "recommendations": ["Failed to process shopping list"],
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
    return {"menu_id": menu["id"], "groceryList": grocery_list}


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