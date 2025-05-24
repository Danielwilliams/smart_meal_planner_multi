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
async def get_meal_shopping_lists(menu_id: int, force_refresh: bool = False):
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
                    logger.info(f"Processing day {day_index + 1}")

                    # Log the structure of this day
                    day_structure = {
                        "has_meals": "meals" in day and isinstance(day["meals"], list),
                        "meals_count": len(day.get("meals", [])) if isinstance(day.get("meals"), list) else 0,
                        "has_snacks": "snacks" in day and isinstance(day["snacks"], list),
                        "snacks_count": len(day.get("snacks", [])) if isinstance(day.get("snacks"), list) else 0
                    }
                    logger.info(f"Day structure: {day_structure}")

                    # Process meals (exclude snacks - they'll be processed separately)
                    if "meals" in day and isinstance(day["meals"], list):
                        logger.info(f"Processing {len(day['meals'])} items from meals array")
                        for meal_index, meal in enumerate(day["meals"]):
                            # Skip items that are actually snacks (have snack in title or meal_time)
                            title = meal.get("title", "")
                            meal_time = meal.get("meal_time", "")

                            # Debug log every item in meals array
                            logger.info(f"Checking meal item: title='{title}', meal_time='{meal_time}'")

                            # More comprehensive snack detection
                            title_lower = title.lower()
                            meal_time_lower = meal_time.lower()

                            # AGGRESSIVE snack filtering - must catch snack_1, snack_2, snack_3
                            is_snack = (
                                "snack_1" in meal_time_lower or
                                "snack_2" in meal_time_lower or
                                "snack_3" in meal_time_lower or
                                meal_time_lower == "snack_1" or
                                meal_time_lower == "snack_2" or
                                meal_time_lower == "snack_3" or
                                meal_time_lower == "snack" or
                                "snack" in meal_time_lower or
                                "snack" in title_lower or
                                title_lower.startswith("snack") or
                                "(snack_" in title_lower or
                                "_snack" in title_lower or
                                "_snack" in meal_time_lower
                            )

                            # FILTER OUT snacks from meals array - we only want snacks from the dedicated snacks array
                            # Skip any items where meal_time starts with "snack_"
                            if meal_time.lower().startswith("snack_"):
                                logger.info(f"FILTERING OUT meal with snack meal_time: '{title}' (meal_time: '{meal_time}')")
                                continue

                            # Log what we're processing from meals array
                            logger.info(f"Processing meal from meals array: '{title}' (meal_time: '{meal_time}')")

                            # Extract meal details
                            meal_data = {
                                "day_index": day_index,
                                "day": day.get("dayNumber", day_index + 1),
                                "meal_index": meal_index,
                                "title": title,
                                "meal_time": meal_time,
                                "servings": meal.get("servings", 0),
                                "is_snack": False,  # These are regular meals, not snacks
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
                        logger.info(f"Processing {len(day['snacks'])} items from snacks array")
                        for snack_index, snack in enumerate(day["snacks"]):
                            snack_title = snack.get("title", f"Snack {snack_index + 1}")
                            logger.info(f"Processing snack from snacks array: '{snack_title}'")

                            # Extract snack details
                            snack_data = {
                                "day_index": day_index,
                                "day": day.get("dayNumber", day_index + 1),
                                "meal_index": snack_index,
                                "title": snack_title,
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
            
            # Log what we have before deduplication
            logger.info(f"BEFORE DEDUPLICATION - {len(result['meal_lists'])} items:")
            for i, item in enumerate(result['meal_lists']):
                logger.info(f"  {i+1}. '{item['title']}' (meal_time: '{item['meal_time']}', is_snack: {item.get('is_snack', False)})")

            # Since we now filter out snacks from meals array, there should be no duplicates
            # But let's keep a simple check just in case
            logger.info(f"AFTER PROCESSING - {len(result['meal_lists'])} items (no deduplication needed)")

            # Log summary of what we're returning
            meal_summary = []
            snack_summary = []
            for item in result['meal_lists']:
                if item.get('is_snack', False):
                    snack_summary.append(f"'{item['title']}' (meal_time: '{item['meal_time']}')")
                else:
                    meal_summary.append(f"'{item['title']}' (meal_time: '{item['meal_time']}')")

            logger.info(f"FINAL RESULT SUMMARY:")
            logger.info(f"Total items: {len(result['meal_lists'])}")
            logger.info(f"Regular meals: {len(meal_summary)} - {meal_summary}")
            logger.info(f"Snacks: {len(snack_summary)} - {snack_summary}")

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

        # We'll handle each store differently
        if request.store.lower() not in ["kroger", "instacart"]:
            raise HTTPException(
                status_code=400,
                detail="Invalid store. Must be 'kroger' or 'instacart'"
            )

        # Format all ingredients first
        formatted_items = []
        for ingredient in request.ingredients:
            item_name = ingredient.get("name", "")
            quantity = ingredient.get("quantity", "1")

            if not item_name:
                continue

            # Format the item for the store API
            if quantity and quantity.strip():
                formatted_item = f"{quantity} {item_name}".strip()
            else:
                formatted_item = item_name.strip()
            formatted_items.append(formatted_item)

        if not formatted_items:
            raise HTTPException(
                status_code=400,
                detail="No valid ingredients found to add to cart"
            )

        added_items = []
        failed_items = []

        # Add to cart based on store
        try:
            if request.store.lower() == "kroger":
                # For Kroger, add items individually
                for item in formatted_items:
                    try:
                        result = add_to_cart_func(None, item, 1)  # Simplified for now
                        added_items.append({
                            "item": item,
                            "status": "success",
                            "result": result
                        })
                    except Exception as item_error:
                        logger.error(f"Failed to add Kroger item {item}: {str(item_error)}")
                        failed_items.append({
                            "item": item,
                            "status": "failed",
                            "error": str(item_error)
                        })

            elif request.store.lower() == "instacart":
                # For Instacart, pass all items at once as a list of strings
                try:
                    logger.info(f"Adding {len(formatted_items)} items to Instacart: {formatted_items}")
                    # Use default retailer and postal code for now
                    retailer_id = "publix"  # Default retailer
                    postal_code = "80538"   # Default postal code

                    result = add_to_cart_func(
                        retailer_id=retailer_id,
                        item_names=formatted_items,
                        postal_code=postal_code
                    )
                    # If successful, mark all items as added
                    for item in formatted_items:
                        added_items.append({
                            "item": item,
                            "status": "success",
                            "result": result
                        })
                except Exception as instacart_error:
                    logger.error(f"Failed to add Instacart items: {str(instacart_error)}")
                    # If failed, mark all items as failed
                    for item in formatted_items:
                        failed_items.append({
                            "item": item,
                            "status": "failed",
                            "error": str(instacart_error)
                        })

        except Exception as general_error:
            logger.error(f"General error adding items to {request.store}: {str(general_error)}")
            # Mark all items as failed
            for item in formatted_items:
                failed_items.append({
                    "item": item,
                    "status": "failed",
                    "error": str(general_error)
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