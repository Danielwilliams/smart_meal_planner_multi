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
def post_ai_shopping_list(request: AiShoppingListRequest):
    """
    Generate an AI-enhanced shopping list from a menu.
    
    Args:
        request: The request containing the menu ID and additional preferences
        
    Returns:
        An AI-enhanced shopping list with recommendations and optimizations
    """
    if not request.use_ai:
        # If AI is not requested, fall back to standard grocery list
        return get_grocery_list(request.menu_id, use_ai=False)
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the meal_plan_json field
            cur.execute("SELECT meal_plan_json FROM menus WHERE id=%s", (request.menu_id,))
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Menu not found")

        # Parse the JSON text into a Python dict
        menu_data = row["meal_plan_json"]

        # Standard aggregation first
        grocery_list = aggregate_grocery_list(menu_data)
        
        # Generate AI-enhanced shopping list
        return generate_ai_shopping_list(
            menu_data, 
            grocery_list, 
            additional_preferences=request.additional_preferences
        )

    except Exception as e:
        logger.error(f"Error generating AI shopping list: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
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
        # Extract items from the basic grocery list
        grocery_items = []
        for item in basic_grocery_list:
            if isinstance(item, dict) and "name" in item:
                grocery_items.append(item["name"])
            elif isinstance(item, str):
                grocery_items.append(item)
        
        grocery_text = "\n".join(grocery_items)
        
        # Convert menu_data to string if it's not already
        if not isinstance(menu_data, str):
            menu_json = json.dumps(menu_data)
        else:
            menu_json = menu_data
            
        # Try to parse the menu JSON if it's a string
        try:
            menu_dict = json.loads(menu_json) if isinstance(menu_json, str) else menu_json
        except:
            menu_dict = {}
        
        # Extract meal information for context
        meal_info = []
        
        # Try to find days array and extract meal titles
        if isinstance(menu_dict, dict) and "days" in menu_dict:
            for day in menu_dict["days"]:
                if "meals" in day and isinstance(day["meals"], list):
                    for meal in day["meals"]:
                        if "title" in meal:
                            meal_info.append(meal["title"])
        
        # Build the AI prompt
        prompt = f"""You are a helpful meal planning assistant. I'll provide you with a shopping list and meal plan information.
Please organize this shopping list in a more efficient way with the following enhancements:

1. Categorize items by store section (produce, dairy, meat, etc.)
2. Suggest brand alternatives or substitutions where appropriate
3. Note which items might already be in a typical pantry
4. Identify items that can be purchased in bulk to save money
5. Highlight any specialty ingredients that might be hard to find
6. Add nutrition information where relevant

Shopping List:
{grocery_text}

Meal Plan Overview:
{', '.join(meal_info[:10])}

"""
        if additional_preferences:
            prompt += f"\nAdditional Preferences: {additional_preferences}\n"
            
        prompt += "\nFormat your response as a JSON object with the following structure:"
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
        
        # Make OpenAI API call
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
        
        try:
            # Try to parse the JSON response
            ai_result = json.loads(ai_content)
            logger.info("Successfully generated AI shopping list")
            
            # Add the original list as a fallback
            ai_result["originalList"] = basic_grocery_list
            return ai_result
            
        except json.JSONDecodeError:
            logger.error("Failed to parse AI response as JSON")
            # If parsing fails, return the original list with the AI text as a message
            return {
                "groceryList": basic_grocery_list,
                "ai_recommendations": ai_content,
                "error": "AI response format was invalid"
            }
            
    except Exception as e:
        logger.error(f"Error in AI shopping list generation: {str(e)}")
        # Return the basic grocery list in case of error
        return {"groceryList": basic_grocery_list, "error": str(e)}

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


        
