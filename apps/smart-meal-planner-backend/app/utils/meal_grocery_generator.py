"""
Meal-specific grocery list generator

This module provides functions to generate shopping lists for individual meals 
instead of aggregating all ingredients together. This allows for more flexibility 
in meal planning and shopping.
"""

import os
import json
import re
import logging
from fractions import Fraction
from typing import Any, Dict, List, Tuple

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Load the ingredient_config.json
CURRENT_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(CURRENT_DIR, "..", "data", "ingredient_config.json")

with open(DATA_PATH, "r", encoding="utf-8") as f:
    CONFIG = json.load(f)

FILLERS = CONFIG["fillers"]
DESCRIPTORS = CONFIG["descriptors"]
UNIT_MAP = CONFIG["units"]
DEFAULT_UNITS = CONFIG.get("default_units", {})
REGEX_REPLACEMENTS = CONFIG["regex_replacements"]

# Import shared functionality from the main grocery_aggregator module
from .grocery_aggregator import (
    safe_convert_to_float,
    sanitize_unit,
    sanitize_name,
    standardize_ingredient,
)

def extract_meal_ingredients(meal_data: Dict) -> List[Dict]:
    """
    Extract standardized ingredients from a single meal
    
    Args:
        meal_data: Dict containing the meal data with ingredients
        
    Returns:
        List of standardized ingredient dictionaries with name, quantity, and unit
    """
    results = []
    
    # Check if we have ingredients
    if not meal_data or not isinstance(meal_data, dict):
        return results
        
    ingredients = meal_data.get('ingredients', [])
    if not ingredients or not isinstance(ingredients, list):
        return results
    
    # Process each ingredient
    for ing in ingredients:
        # Skip empty ingredients
        if not ing:
            continue
            
        # Standardize the ingredient
        name, amount, unit = standardize_ingredient(ing)
        
        # Skip ingredients with no name
        if not name:
            continue
            
        # Apply defaults for ingredients missing quantities
        if amount is None:
            # Special handling for specific ingredient types
            if "chicken" in name.lower() and "breast" in name.lower():
                amount = 6.0  # Default to 6 oz per chicken breast
                unit = "oz"
            elif "beef" in name.lower() or "steak" in name.lower():
                amount = 8.0
                unit = "oz"
            elif "oil" in name.lower():
                amount = 2.0
                unit = "tbsp"
            elif "spice" in name.lower() or "powder" in name.lower() or "seasoning" in name.lower():
                amount = 1.0
                unit = "tsp"
            elif "sauce" in name.lower():
                amount = 2.0
                unit = "tbsp"
            elif "vinegar" in name.lower():
                amount = 1.0
                unit = "tbsp"
            elif "salsa" in name.lower():
                amount = 1.5
                unit = "cups"
            elif "garlic" in name.lower() and "powder" not in name.lower():
                amount = 2.0
                unit = "cloves"
            elif "cheese" in name.lower():
                if "cheddar" in name.lower():
                    amount = 8.0  # Cheddar cheese typically in 8oz blocks
                    unit = "oz"
                elif "mozzarella" in name.lower():
                    amount = 8.0  # Mozzarella often comes in 8oz packages
                    unit = "oz"
                else:
                    amount = 4.0  # Default for other cheeses
                    unit = "oz"
        
        # Format the quantity as a string
        quantity_str = ""
        if amount is not None:
            # Format as fraction if appropriate
            if isinstance(amount, float):
                fraction = Fraction(amount).limit_denominator(16)
                if fraction.denominator == 1:
                    # Whole number
                    amount_str = str(fraction.numerator)
                else:
                    # Fraction
                    amount_str = str(fraction)
            else:
                amount_str = str(amount)
                
            # Combine with unit
            if unit:
                quantity_str = f"{amount_str} {unit}"
            else:
                quantity_str = amount_str
        else:
            # Default quantities for certain items
            if name.lower() == "salt" or name.lower() == "salt to taste":
                quantity_str = "To taste"
            elif name.lower() == "black pepper" or name.lower() == "pepper":
                quantity_str = "To taste"
            else:
                quantity_str = "As needed"
        
        # Format the name with capitalization
        formatted_name = ' '.join(word.capitalize() for word in name.strip().split())
        
        # Special handling for certain ingredients
        if "cheddar" in name.lower() and "cheese" in name.lower():
            item = {
                "name": "Cheddar Cheese",
                "quantity": "8 oz",
                "unit": "oz",
                "amount": 8.0
            }
        elif "mozzarella" in name.lower() and "cheese" in name.lower():
            item = {
                "name": "Mozzarella Cheese",
                "quantity": "8 oz",
                "unit": "oz",
                "amount": 8.0
            }
        else:
            # Standard format
            item = {
                "name": formatted_name,
                "quantity": quantity_str,
                "unit": unit if unit else "",
                "amount": amount
            }
            
        results.append(item)
    
    return results

def generate_meal_shopping_list(meal_data: Dict) -> Dict:
    """
    Generate a shopping list for a single meal
    
    Args:
        meal_data: Dict containing the meal data
        
    Returns:
        Dictionary with meal details and ingredients list
    """
    if not meal_data or not isinstance(meal_data, dict):
        return {"error": "Invalid meal data"}
    
    # Extract meal metadata
    meal_title = meal_data.get('title', 'Untitled Meal')
    meal_time = meal_data.get('meal_time', '')
    servings = meal_data.get('servings', 1)
    
    # Get ingredients
    ingredients = extract_meal_ingredients(meal_data)
    
    return {
        "title": meal_title,
        "meal_time": meal_time,
        "servings": servings,
        "ingredients": ingredients
    }

def generate_menu_shopping_lists(menu_data: Dict) -> List[Dict]:
    """
    Generate separate shopping lists for each meal in the menu
    
    Args:
        menu_data: Dict containing the full menu data
        
    Returns:
        List of dictionaries, each containing a meal's shopping list
    """
    results = []
    
    # Handle string input
    if isinstance(menu_data, str):
        try:
            menu_data = json.loads(menu_data)
        except json.JSONDecodeError:
            logger.error("Failed to parse menu_data as JSON")
            return []
    
    # Handle null input
    if not menu_data:
        return []
    
    # Extract days array from different possible locations
    days = []
    
    if isinstance(menu_data, dict):
        # Direct days array
        if 'days' in menu_data and isinstance(menu_data['days'], list):
            days = menu_data['days']
        # Days in meal_plan
        elif 'meal_plan' in menu_data and isinstance(menu_data['meal_plan'], dict) and 'days' in menu_data['meal_plan']:
            days = menu_data['meal_plan']['days']
        # Days in meal_plan_json
        elif 'meal_plan_json' in menu_data:
            try:
                plan_data = menu_data['meal_plan_json']
                if isinstance(plan_data, str):
                    plan_data = json.loads(plan_data)
                if isinstance(plan_data, dict) and 'days' in plan_data:
                    days = plan_data['days']
            except json.JSONDecodeError:
                logger.error("Failed to parse meal_plan_json")
    
    # Process each day
    for day_index, day in enumerate(days):
        if not isinstance(day, dict):
            continue
            
        day_number = day.get('dayNumber', day_index + 1)
        
        # Process meals
        meals = day.get('meals', [])
        if isinstance(meals, list):
            for meal_index, meal in enumerate(meals):
                if not isinstance(meal, dict):
                    continue

                # FILTER OUT snacks from meals array - we only want snacks from the dedicated snacks array
                # Skip any items where meal_time starts with "snack_"
                meal_time = meal.get('meal_time', '')
                if meal_time.lower().startswith("snack_"):
                    logger.info(f"FILTERING OUT meal with snack meal_time: '{meal.get('title', '')}' (meal_time: '{meal_time}')")
                    continue

                # Generate shopping list for this meal
                meal_list = generate_meal_shopping_list(meal)

                # Add day information
                meal_list['day'] = day_number
                meal_list['day_index'] = day_index
                meal_list['meal_index'] = meal_index

                results.append(meal_list)
        
        # Process snacks
        snacks = day.get('snacks', [])
        if isinstance(snacks, list):
            for snack_index, snack in enumerate(snacks):
                if not isinstance(snack, dict):
                    continue
                
                # Generate shopping list for this snack
                snack_list = generate_meal_shopping_list(snack)
                
                # Add day information and mark as snack
                snack_list['day'] = day_number
                snack_list['day_index'] = day_index
                snack_list['meal_index'] = snack_index
                snack_list['is_snack'] = True
                
                results.append(snack_list)
    
    return results

def get_meal_shopping_list(menu_id: int, meal_data: Dict = None):
    """
    Get shopping lists for individual meals in a menu
    
    Args:
        menu_id: The ID of the menu
        meal_data: Optional menu data dict (if already loaded)
        
    Returns:
        Dict with meal-specific shopping lists and menu metadata
    """
    # If meal_data is not provided, it should be loaded from the database using menu_id
    # This implementation assumes meal_data is provided
    
    if not meal_data:
        logger.warning(f"No meal data provided for menu {menu_id}")
        return {"error": "No meal data provided"}
    
    # Generate shopping lists for all meals
    meal_lists = generate_menu_shopping_lists(meal_data)
    
    # Extract menu metadata
    menu_title = ""
    if isinstance(meal_data, dict):
        if 'nickname' in meal_data:
            menu_title = meal_data['nickname']
    
    return {
        "menu_id": menu_id,
        "title": menu_title or f"Menu {menu_id}",
        "meal_lists": meal_lists
    }