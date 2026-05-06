# Add this to your app/routers/menu.py file
# This is a sample implementation for the meal-specific shopping list endpoint

from typing import List, Dict, Any, Optional
from fastapi import HTTPException, status
import json

@router.get("/{menu_id}/meal-shopping-lists", response_model=Dict[str, Any])
async def get_meal_shopping_lists(
    menu_id: int,
    db: Session = Depends(get_db)
):
    """
    Get shopping lists organized by individual meals for a specific menu
    """
    # Retrieve the menu
    menu = menu_crud.get_menu(db, menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu with ID {menu_id} not found"
        )
    
    # Get menu data
    menu_data = {}
    try:
        if menu.meal_plan_json:
            menu_data = json.loads(menu.meal_plan_json)
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error parsing menu data: {str(e)}"
        )
    
    # Initialize result
    result = {
        "title": menu.nickname or f"Menu {menu_id}",
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
                        "day": day.get("day_number", day_index + 1),
                        "meal_index": meal_index,
                        "title": meal.get("title", f"Meal {meal_index + 1}"),
                        "meal_time": meal.get("meal_time", ""),
                        "servings": meal.get("servings", 0),
                        "is_snack": False,
                        "ingredients": []
                    }
                    
                    # Process ingredients for this meal
                    if "ingredients" in meal and isinstance(meal["ingredients"], list):
                        for ingredient in meal["ingredients"]:
                            if isinstance(ingredient, dict) and "name" in ingredient:
                                ing_entry = {
                                    "name": ingredient["name"].capitalize(),
                                    "quantity": ingredient.get("quantity", "")
                                }
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
                        "day": day.get("day_number", day_index + 1),
                        "meal_index": snack_index,
                        "title": snack.get("title", f"Snack {snack_index + 1}"),
                        "meal_time": "Snack",
                        "servings": snack.get("servings", 0),
                        "is_snack": True,
                        "ingredients": []
                    }
                    
                    # Process ingredients for this snack
                    if "ingredients" in snack and isinstance(snack["ingredients"], list):
                        for ingredient in snack["ingredients"]:
                            if isinstance(ingredient, dict) and "name" in ingredient:
                                ing_entry = {
                                    "name": ingredient["name"].capitalize(),
                                    "quantity": ingredient.get("quantity", "")
                                }
                                snack_data["ingredients"].append(ing_entry)
                    
                    # Add to result if it has ingredients
                    if snack_data["ingredients"]:
                        result["meal_lists"].append(snack_data)
    
    return result