# smart_meal_planner/meal_planner_backend/app/routers/grocery_list.py

from fastapi import APIRouter, HTTPException, Query, Body
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
                    'timestamp': time.time()
                }
                
                # Add cache metadata to the response
                result['cached'] = False
                result['cache_timestamp'] = datetime.now().isoformat()
            
            return result
        
        return {"groceryList": grocery_list}

    except Exception as e:
        logger.error(f"Error retrieving grocery list: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

@router.post("/{menu_id}/ai-shopping-list")
def post_ai_shopping_list(menu_id: int, request: AiShoppingListRequest = None):
    """
    Generate an AI-enhanced shopping list from a menu.
    
    Args:
        menu_id: The ID of the menu to generate the list from
        request: The request containing the additional preferences
        
    Returns:
        An AI-enhanced shopping list with recommendations and optimizations
    """
    # Log incoming request to debug potential issues
    logger.info(f"AI shopping list request for menu ID: {menu_id}")
    logger.info(f"Request body: {request}")
    
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
            "error": "Invalid menu ID"
        }
    
    logger.info(f"Processing request: menu_id={request.menu_id}, use_ai={request.use_ai}, preferences={request.additional_preferences}, use_cache={request.use_cache}")
    
    if not request.use_ai:
        # If AI is not requested, fall back to standard grocery list
        logger.info("AI not requested, using standard grocery list")
        return get_grocery_list(menu_id, use_ai=False)
    
    # Check cache if enabled
    cache_key = f"{menu_id}_{request.additional_preferences or 'no_prefs'}"
    if request.use_cache and cache_key in AI_SHOPPING_LIST_CACHE:
        cached_data = AI_SHOPPING_LIST_CACHE[cache_key]
        # Check if cache is still valid
        if time.time() - cached_data.get('timestamp', 0) < CACHE_EXPIRY:
            logger.info(f"Returning cached AI shopping list for menu {menu_id}")
            return cached_data.get('data')
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
                "error": "No ingredients found in menu"
            }
        
        # Generate AI-enhanced shopping list with robust error handling
        try:
            result = generate_ai_shopping_list(
                menu_data, 
                grocery_list, 
                additional_preferences=request.additional_preferences
            )
            
            # Store in cache if successful
            if result and isinstance(result, dict) and "groceryList" in result:
                logger.info(f"Caching AI shopping list for menu {menu_id}")
                AI_SHOPPING_LIST_CACHE[cache_key] = {
                    'data': result,
                    'timestamp': time.time()
                }
                
                # Add cache metadata to the response
                result['cached'] = False
                result['cache_timestamp'] = datetime.now().isoformat()
            
            return result
        except Exception as ai_error:
            logger.error(f"Error in AI processing: {str(ai_error)}")
            # Return the standard grocery list with error message
            return {
                "groceryList": grocery_list,
                "recommendations": ["AI enhancement failed, showing standard list instead"],
                "error": "AI processing error"
            }

    except Exception as e:
        logger.error(f"Error generating AI shopping list: {str(e)}")
        # Return an error response that the frontend can handle
        return {
            "groceryList": [],
            "recommendations": ["Error processing shopping list"],
            "error": str(e)
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
            
        prompt += "Format your response as a JSON object with the following structure:\n"
        prompt += """
{
  "groceryList": [
    {"category": "Produce", "items": [{"name": "Item Name", "notes": "Optional notes", "alternatives": "Optional alternatives", "healthyAlternatives": "Optional healthy alternatives"}]},
    {"category": "Dairy", "items": [...]},
    ...
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "nutritionTips": ["Tip 1", "Tip 2", ...],
  "bulkItems": ["Item 1", "Item 2", ...],
  "pantryStaples": ["Item 1", "Item 2", ...],
  "healthySwaps": ["Regular Item -> Healthy Alternative", ...]
}
"""
        
        logger.info("Making OpenAI API call")
        # Make OpenAI API call with better error handling
        try:
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=[
                    {"role": "system", "content": "You are a helpful meal planning assistant that helps organize shopping lists efficiently."},
                    {"role": "user", "content": prompt}
                ],
                temperature=0.7,
                max_tokens=2000
            )
            
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
            
            # Ensure proper structure for grocery list items
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
                    
                    # Normalize items to have name property and ensure quantities
                    for j, item in enumerate(category["items"]):
                        if isinstance(item, str):
                            # Convert string item to object with name and default quantity
                            category["items"][j] = {
                                "name": item,
                                "quantity": "1",
                                "alternatives": "N/A",
                                "healthyAlternatives": "N/A"
                            }
                        elif not isinstance(item, dict):
                            # Convert non-dict item to object with name and default quantity
                            category["items"][j] = {
                                "name": str(item),
                                "quantity": "1",
                                "alternatives": "N/A",
                                "healthyAlternatives": "N/A"
                            }
                        else:
                            # Ensure dict item has all required properties
                            if "name" not in item:
                                item["name"] = "Unknown item"
                                
                            # Function to sanitize quantity values
                            def sanitize_quantity(qty, food_name):
                                name_lower = food_name.lower()
                                
                                # If quantity is missing or invalid, assign a default
                                if not qty or qty == "N/A":
                                    # Common food items with typical quantities
                                    if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin"]):
                                        return "1 lb"
                                    elif "cheese" in name_lower:
                                        return "8 oz"
                                    elif any(veg in name_lower for veg in ["onion", "pepper", "tomato", "carrot", "cucumber", "zucchini"]):
                                        return "1"
                                    elif "garlic" in name_lower:
                                        return "1 clove"
                                    elif "spice" in name_lower or "seasoning" in name_lower:
                                        return "1 tsp"
                                    elif "oil" in name_lower or "sauce" in name_lower:
                                        return "1 tbsp"
                                    elif "beans" in name_lower:
                                        return "1 can"
                                    elif "oats" in name_lower or "quinoa" in name_lower or "rice" in name_lower:
                                        return "1 cup"
                                    elif "bread" in name_lower or "tortilla" in name_lower:
                                        return "1 package"
                                    elif "berries" in name_lower:
                                        return "1 cup"
                                    else:
                                        return "1"
                                
                                # Convert quantity to string if it's not already
                                qty_str = str(qty)
                                
                                # Check for reasonable units and quantities
                                # Extract numeric part and unit
                                import re
                                match = re.match(r'(\d+(?:\.\d+)?)\s*(\w+)?', qty_str)
                                if match:
                                    number = float(match.group(1))
                                    unit = match.group(2) if match.group(2) else ""
                                    
                                    # Check for unreasonable quantities and adjust
                                    # Handle meat items (keep quantities reasonable)
                                    if any(meat in name_lower for meat in ["chicken", "beef", "turkey", "salmon", "pork", "sirloin"]):
                                        if unit in ["lb", "pound", "pounds"] and number > 5:
                                            # Cap at 5 pounds for meats
                                            return "5 lb"
                                        elif not unit and number > 5:
                                            # Add pounds if missing
                                            return "5 lb"
                                    
                                    # Handle cheese quantities
                                    elif "cheese" in name_lower:
                                        if unit in ["lb", "pound", "pounds"] and number > 2:
                                            return "2 lb"
                                        elif unit in ["g", "gram", "grams"] and number > 500:
                                            return "500 g"
                                        elif unit in ["oz", "ounce"] and number > 16:
                                            return "16 oz"
                                        elif not unit and number > 16:
                                            return "16 oz"
                                    
                                    # Handle produce and vegetables
                                    elif any(veg in name_lower for veg in ["onion", "pepper", "tomato", "carrot", "cucumber", "zucchini"]):
                                        if not unit and number > 10:
                                            return "10"  # Limit to reasonable number
                                    
                                    # Handle oils and sauces
                                    elif "oil" in name_lower or "sauce" in name_lower:
                                        if unit in ["cup", "cups"] and number > 2:
                                            return "2 cups"
                                        elif not unit and number > 2:
                                            return "2 cups"
                                    
                                    # Default case: if it's a very large number without unit, cap it
                                    elif not unit and number > 20:
                                        return "20"
                                
                                return qty_str
                            
                            # Handle missing or undefined quantities
                            if "quantity" not in item or not item["quantity"]:
                                # Set a default quantity
                                item["quantity"] = sanitize_quantity(None, item["name"])
                            else:
                                # Sanitize existing quantity
                                item["quantity"] = sanitize_quantity(item["quantity"], item["name"])
                            
                            # Ensure alternatives
                            if "alternatives" not in item or not item["alternatives"]:
                                item["alternatives"] = "N/A"
                                
                            # Ensure healthy alternatives
                            if "healthyAlternatives" not in item or not item["healthyAlternatives"]:
                                item["healthyAlternatives"] = "N/A"
                                
                            # Update the item in the category
                            category["items"][j] = item
            except Exception as structure_error:
                logger.error(f"Error normalizing grocery list structure: {str(structure_error)}")
                # If structure normalization fails, replace with simple version
                ai_result["groceryList"] = [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}]
            
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
                    formatted_items.append({"name": item})
                
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
                    "groceryList": [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}],
                    "recommendations": ["AI response could not be processed"],
                    "error": "AI response format was invalid"
                }
            
    except Exception as e:
        logger.error(f"Error in AI shopping list generation: {str(e)}")
        # Return a formatted version of the basic grocery list in case of error
        try:
            # Try to create a properly formatted response even in case of error
            return {
                "groceryList": [
                    {
                        "category": "All Items",
                        "items": [{"name": item} for item in (grocery_items if 'grocery_items' in locals() else [])]
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
        
