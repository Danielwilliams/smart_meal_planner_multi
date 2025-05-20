# app/routers/meal_shopping_lists.py

import json
import logging
from typing import Dict, Any, List
from fastapi import APIRouter, HTTPException, Query, Body
from psycopg2.extras import RealDictCursor
from pydantic import BaseModel
from ..db import get_db_connection

# Set up logging
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/menu", tags=["Menu"])

# Model for meal cart request
class MealCartRequest(BaseModel):
    ingredients: List[Dict[str, str]]  # List of {"name": "...", "quantity": "..."}
    store: str  # "kroger" or "instacart"
    meal_title: str

@router.get("/{menu_id}/meal-shopping-lists")
async def get_meal_shopping_lists(menu_id: int):
    """
    Get shopping lists organized by individual meals for a specific menu
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Get the menu data
            cursor.execute("""
                SELECT id, meal_plan_json, nickname
                FROM menus
                WHERE id = %s
            """, (menu_id,))
            
            menu = cursor.fetchone()
            
            if not menu:
                raise HTTPException(
                    status_code=404,
                    detail=f"Menu with ID {menu_id} not found"
                )
            
            # Parse menu data
            menu_data = {}
            try:
                if menu['meal_plan_json']:
                    if isinstance(menu['meal_plan_json'], str):
                        menu_data = json.loads(menu['meal_plan_json'])
                    else:
                        menu_data = menu['meal_plan_json']
            except json.JSONDecodeError as e:
                logger.error(f"Error parsing menu data for menu {menu_id}: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error parsing menu data: {str(e)}"
                )
            
            # Initialize result
            result = {
                "title": menu['nickname'] or f"Menu {menu_id}",
                "meal_lists": []
            }
            
            # Process menu plan data if available
            if menu_data and "days" in menu_data and isinstance(menu_data["days"], list):
                # Process each day
                for day_index, day in enumerate(menu_data["days"]):
                    # Process meals
                    if "meals" in day and isinstance(day["meals"], list):
                        for meal_index, meal in enumerate(day["meals"]):
                            # Extract meal details
                            meal_data = {
                                "day_index": day_index,
                                "day": day.get("dayNumber", day_index + 1),
                                "meal_index": meal_index,
                                "title": meal.get("title", f"Meal {meal_index + 1}"),
                                "meal_time": meal.get("meal_time", ""),
                                "servings": meal.get("servings", 0),
                                "is_snack": False,
                                "ingredients": []
                            }
                            
                            # Process ingredients for this meal - use raw ingredients without aggregation
                            if "ingredients" in meal and isinstance(meal["ingredients"], list):
                                for ingredient in meal["ingredients"]:
                                    if isinstance(ingredient, dict) and "name" in ingredient:
                                        # Use the raw ingredient data directly from the meal
                                        ing_entry = {
                                            "name": ingredient.get("name", "").strip(),
                                            "quantity": ingredient.get("quantity", "").strip()
                                        }
                                        # Only add if we have a name
                                        if ing_entry["name"]:
                                            meal_data["ingredients"].append(ing_entry)
                            
                            # Add to result if it has ingredients
                            if meal_data["ingredients"]:
                                result["meal_lists"].append(meal_data)
                    
                    # Process snacks
                    if "snacks" in day and isinstance(day["snacks"], list):
                        for snack_index, snack in enumerate(day["snacks"]):
                            # Extract snack details
                            snack_data = {
                                "day_index": day_index,
                                "day": day.get("dayNumber", day_index + 1),
                                "meal_index": snack_index,
                                "title": snack.get("title", f"Snack {snack_index + 1}"),
                                "meal_time": "Snack",
                                "servings": snack.get("servings", 0),
                                "is_snack": True,
                                "ingredients": []
                            }
                            
                            # Process ingredients for this snack - use raw ingredients without aggregation
                            if "ingredients" in snack and isinstance(snack["ingredients"], list):
                                for ingredient in snack["ingredients"]:
                                    if isinstance(ingredient, dict) and "name" in ingredient:
                                        # Use the raw ingredient data directly from the snack
                                        ing_entry = {
                                            "name": ingredient.get("name", "").strip(),
                                            "quantity": ingredient.get("quantity", "").strip()
                                        }
                                        # Only add if we have a name
                                        if ing_entry["name"]:
                                            snack_data["ingredients"].append(ing_entry)
                            
                            # Add to result if it has ingredients
                            if snack_data["ingredients"]:
                                result["meal_lists"].append(snack_data)
            
            return result

        finally:
            cursor.close()
            conn.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching meal shopping lists for menu {menu_id}: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.post("/{menu_id}/meal-to-cart")
async def add_meal_ingredients_to_cart(
    menu_id: int,
    request: MealCartRequest
):
    """
    Add ingredients from a specific meal to a store cart
    """
    try:
        logger.info(f"Adding meal '{request.meal_title}' ingredients to {request.store} cart")

        # Import the store integration functions
        if request.store.lower() == "kroger":
            from ..integration.kroger import add_to_kroger_cart
            add_to_cart_func = add_to_kroger_cart
        elif request.store.lower() == "instacart":
            from ..integration.instacart import create_instacart_shopping_list
            add_to_cart_func = create_instacart_shopping_list
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid store. Must be 'kroger' or 'instacart'"
            )

        added_items = []
        failed_items = []

        # Process each ingredient
        for ingredient in request.ingredients:
            try:
                item_name = ingredient.get("name", "")
                quantity = ingredient.get("quantity", "1")

                if not item_name:
                    continue

                # Format the item for the store API
                formatted_item = f"{quantity} {item_name}".strip()

                # Add to cart based on store
                if request.store.lower() == "kroger":
                    # For Kroger, we'll need a user token - this should be passed from frontend
                    result = add_to_cart_func(None, formatted_item, 1)  # Simplified for now
                elif request.store.lower() == "instacart":
                    # For Instacart, create a shopping list URL
                    result = add_to_cart_func([formatted_item])

                added_items.append({
                    "item": formatted_item,
                    "status": "success",
                    "result": result
                })

            except Exception as item_error:
                logger.error(f"Failed to add item {ingredient}: {str(item_error)}")
                failed_items.append({
                    "item": ingredient.get("name", "Unknown"),
                    "status": "failed",
                    "error": str(item_error)
                })

        return {
            "message": f"Processed {len(request.ingredients)} ingredients from '{request.meal_title}'",
            "store": request.store,
            "meal_title": request.meal_title,
            "added_items": added_items,
            "failed_items": failed_items,
            "success_count": len(added_items),
            "failure_count": len(failed_items)
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding meal ingredients to cart: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )