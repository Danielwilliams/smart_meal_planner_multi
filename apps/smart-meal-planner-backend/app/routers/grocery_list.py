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

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenAI API
openai.api_key = OPENAI_API_KEY

class AiShoppingListRequest(BaseModel):
    menu_id: int
    use_ai: bool = True
    additional_preferences: Optional[str] = None

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
def get_grocery_list(menu_id: int, use_ai: Optional[bool] = Query(False)):
    """
    Generate a grocery list from a menu, with optional AI enhancement.
    
    Args:
        menu_id: The ID of the menu to generate the list from
        use_ai: Whether to use AI to enhance the grocery list (default: False)
    
    Returns:
        A dictionary containing the grocery list and AI recommendations if requested
    """
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
            return generate_ai_shopping_list(menu_data, grocery_list)
        
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
    # Handle case where request is not provided or AI is not requested
    if request is None:
        request = AiShoppingListRequest(menu_id=menu_id, use_ai=True)
    
    if not request.use_ai:
        # If AI is not requested, fall back to standard grocery list
        return get_grocery_list(menu_id, use_ai=False)
    
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
            return generate_ai_shopping_list(
                menu_data, 
                grocery_list, 
                additional_preferences=request.additional_preferences
            )
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
        for item in basic_grocery_list:
            if isinstance(item, dict) and "name" in item:
                grocery_items.append(item["name"])
            elif isinstance(item, str):
                grocery_items.append(item)
            else:
                # Log unexpected item format
                logger.warning(f"Unexpected item format in grocery list: {type(item)}")
                
        if not grocery_items:
            logger.warning("Failed to extract any valid items from grocery list")
            return {
                "groceryList": basic_grocery_list,  # Return original list
                "recommendations": ["Could not process ingredients in expected format"],
                "error": "No valid items found"
            }
        
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
        prompt += "6. Add nutrition information where relevant\n\n"
        prompt += "Shopping List:\n" + grocery_text + "\n\n"
        
        if meal_info:
            prompt += "Meal Plan Overview:\n" + ', '.join(meal_info[:10]) + "\n\n"
        
        if additional_preferences:
            prompt += "Additional Preferences: " + additional_preferences + "\n\n"
            
        prompt += "Format your response as a JSON object with the following structure:\n"
        prompt += """
{
  "groceryList": [
    {"category": "Produce", "items": [{"name": "Item Name", "notes": "Optional notes", "alternatives": "Optional alternatives"}]},
    {"category": "Dairy", "items": [...]},
    ...
  ],
  "recommendations": ["Recommendation 1", "Recommendation 2", ...],
  "nutritionTips": ["Tip 1", "Tip 2", ...],
  "bulkItems": ["Item 1", "Item 2", ...],
  "pantryStaples": ["Item 1", "Item 2", ...]
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
            # First try to extract JSON if it's embedded in markdown or other text
            json_match = re.search(r'```json\n(.*?)\n```', ai_content, re.DOTALL)
            if json_match:
                json_str = json_match.group(1)
                ai_result = json.loads(json_str)
                logger.info("Successfully extracted JSON from markdown code block")
            else:
                # Try to parse the whole response as JSON
                ai_result = json.loads(ai_content)
                logger.info("Successfully parsed AI response as JSON")
            
            # Validate the response structure
            if "groceryList" not in ai_result or not isinstance(ai_result["groceryList"], list):
                logger.warning("AI response missing required groceryList array")
                # Add a default groceryList if missing
                ai_result["groceryList"] = [{"category": "All Items", "items": [{"name": item} for item in grocery_items]}]
            
            # Ensure recommendations and nutritionTips are present
            if "recommendations" not in ai_result or not isinstance(ai_result["recommendations"], list):
                ai_result["recommendations"] = ["Shop in bulk when possible to save money"]
                
            if "nutritionTips" not in ai_result or not isinstance(ai_result["nutritionTips"], list):
                ai_result["nutritionTips"] = ["Focus on whole food ingredients for better nutrition"]
                
            # Add the original list as a fallback
            ai_result["originalList"] = basic_grocery_list
            
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


        
