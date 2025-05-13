"""
Simplified AI Categorized Shopping List Generator
This module provides a direct approach to generate categorized shopping lists 
using OpenAI's API, with standardized item formatting.
"""

from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from pydantic import BaseModel
import json
import os
import openai
from app.utils.auth_utils import get_user_from_token

# Create router
router = APIRouter()

# Set OpenAI API key from environment
openai.api_key = os.getenv("OPENAI_API_KEY")

# Models for request and response
class ShoppingListRequest(BaseModel):
    menu_id: int
    menu_text: Optional[str] = None
    use_cache: bool = True

class ShoppingListItem(BaseModel):
    name: str
    quantity: str
    unit: Optional[str] = ""
    category: str

class ShoppingListResponse(BaseModel):
    items: List[ShoppingListItem]
    categories: List[str]
    status: str = "completed"
    cached: bool = False

@router.post("/menu/{menu_id}/categorized-shopping-list", response_model=ShoppingListResponse)
async def generate_categorized_shopping_list(
    menu_id: int,
    request: ShoppingListRequest,
    current_user = Depends(get_user_from_token)
):
    """
    Generate a categorized shopping list from menu ingredients using OpenAI.
    This is a simplified approach that:
    1. Takes menu data (either as ID or direct text)
    2. Requests OpenAI to parse and categorize ingredients
    3. Returns standardized JSON with categories included
    """
    try:
        # First check if we need to fetch the menu data
        menu_text = request.menu_text
        
        if not menu_text:
            # Need to fetch menu data from database
            from app.db import get_db_connection
            conn = get_db_connection()
            
            try:
                with conn.cursor() as cur:
                    # Get the menu data
                    cur.execute(
                        "SELECT data FROM menus WHERE id = %s", 
                        (menu_id,)
                    )
                    result = cur.fetchone()
                    
                    if not result:
                        raise HTTPException(
                            status_code=404,
                            detail=f"Menu with ID {menu_id} not found"
                        )
                    
                    # Extract menu data and convert to text
                    menu_data = result[0]
                    
                    # Process menu data into text format
                    menu_text = "MENU INGREDIENTS:\n\n"
                    
                    # Process days and meals if present
                    if "days" in menu_data:
                        for i, day in enumerate(menu_data["days"]):
                            menu_text += f"DAY {i + 1}:\n"
                            
                            # Process meals
                            if "meals" in day:
                                for meal in day["meals"]:
                                    menu_text += f"{meal.get('name', 'Meal')}:\n"
                                    
                                    # Extract ingredients
                                    if "ingredients" in meal:
                                        for ingredient in meal["ingredients"]:
                                            if isinstance(ingredient, dict):
                                                menu_text += f"- {ingredient.get('name', '')}: {ingredient.get('quantity', '')}\n"
                                            else:
                                                menu_text += f"- {ingredient}\n"
                                    
                                    menu_text += "\n"
                            
                            # Process snacks if present
                            if "snacks" in day:
                                menu_text += "Snacks:\n"
                                for snack in day["snacks"]:
                                    if "ingredients" in snack:
                                        for ingredient in snack["ingredients"]:
                                            if isinstance(ingredient, dict):
                                                menu_text += f"- {ingredient.get('name', '')}: {ingredient.get('quantity', '')}\n"
                                            else:
                                                menu_text += f"- {ingredient}\n"
                                                
                            menu_text += "\n"
            finally:
                conn.close()
        
        # Check if we have menu text to work with
        if not menu_text:
            raise HTTPException(
                status_code=400,
                detail="No menu text provided or available"
            )
            
        # Define the system prompt for OpenAI
        system_prompt = """You are a helpful assistant that creates grocery shopping lists. 
        Your task is to take a meal plan and convert it into a well-organized, categorized shopping list.
        
        Follow these requirements:
        1. Combine duplicate ingredients, adding up quantities when appropriate
        2. Standardize units of measure to common kitchen units (cups, tbsp, tsp, oz, lb, etc.)
        3. Ensure quantities make sense for the ingredient (e.g., "3 eggs" not "3 lb eggs")
        4. Categorize each item into one of these store departments:
           - Produce (fruits, vegetables)
           - Meat & Seafood
           - Dairy & Eggs
           - Bakery & Bread
           - Canned Goods
           - Dry Goods & Pasta
           - Frozen Foods
           - Condiments & Spices
           - Snacks
           - Beverages
           - Baking
           - Other
        
        5. Return ONLY a JSON array with this exact structure:
        {
          "items": [
            {
              "name": "Clear, specific ingredient name",
              "quantity": "Numeric amount",
              "unit": "Standardized unit",
              "category": "Department category from the list above"
            },
            ...more items
          ]
        }
        
        Do not include any explanations, just the JSON array. Make sure the JSON is valid and properly formatted."""

        # Create messages for OpenAI API
        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": menu_text}
        ]

        # Call OpenAI API
        try:
            # Try newer OpenAI API version
            client = openai.OpenAI(api_key=openai.api_key)
            response = client.chat.completions.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.1,  # Low temperature for consistency
                max_tokens=2000,
                n=1,
                stop=None,
            )
            response_content = response.choices[0].message.content.strip()
        except (AttributeError, TypeError):
            # Fall back to older API version
            response = openai.ChatCompletion.create(
                model="gpt-3.5-turbo",
                messages=messages,
                temperature=0.1,
                max_tokens=2000,
                n=1,
                stop=None,
            )
            response_content = response.choices[0].message.content.strip()
        
        # Parse JSON from response
        try:
            # Try to extract JSON from markdown if present
            import re
            json_match = re.search(r'```json\n(.*?)\n```', response_content, re.DOTALL)
            if json_match:
                response_content = json_match.group(1)
            
            # Parse JSON content
            data = json.loads(response_content)
            
            # Extract items array
            if isinstance(data, dict) and "items" in data:
                items = data["items"]
            elif isinstance(data, list):
                items = data
            else:
                raise ValueError("Response doesn't contain valid items array")
                
            # Extract unique categories from items
            categories = list(set(item.get("category", "Other") for item in items))
            
            # Return formatted response
            return {
                "items": items,
                "categories": categories,
                "status": "completed",
                "cached": False
            }
            
        except (json.JSONDecodeError, ValueError) as e:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Failed to parse response as JSON: {str(e)}"
            )
            
    except HTTPException as http_ex:
        # Re-raise HTTP exceptions
        raise http_ex
    except Exception as e:
        # Log the error and return a general error message
        print(f"Error generating shopping list: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error generating shopping list: {str(e)}"
        )