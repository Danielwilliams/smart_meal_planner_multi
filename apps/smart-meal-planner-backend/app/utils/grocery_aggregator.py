import os
import json
import re
from fractions import Fraction
from typing import Any, Dict

# Load the ingredient_config.json
CURRENT_DIR = os.path.dirname(__file__)
DATA_PATH = os.path.join(CURRENT_DIR, "..", "data", "ingredient_config.json")

with open(DATA_PATH, "r", encoding="utf-8") as f:
    CONFIG = json.load(f)

FILLERS = CONFIG["fillers"]
DESCRIPTORS = CONFIG["descriptors"]
UNIT_MAP = CONFIG["units"]
REGEX_REPLACEMENTS = CONFIG["regex_replacements"]

def safe_convert_to_float(value):
    """
    Safely converts a value to float, handling strings, fractions, and None values.
    """
    if value is None or value == "":
        return None
    try:
        if isinstance(value, float):
            return value
        if isinstance(value, str):
            if "/" in value:
                return float(Fraction(value))
            value = re.sub(r'[^\d./].*$', '', value)
            return float(value)
        return float(value)
    except (ValueError, TypeError):
        return None

def convert_to_base_unit(amount: float, unit: str) -> float:
    """
    Convert quantities to a base unit for consistent aggregation
    """
    # Volume conversions (base unit: cup)
    volume_conversions = {
        'tbsp': 1/16,     # 1 cup = 16 tablespoons
        'tsp': 1/48,      # 1 cup = 48 teaspoons
        'ml': 1/236.588,  # 1 cup = 236.588 ml
        'cup': 1
    }

    # Weight conversions (base unit: lb)
    weight_conversions = {
        'oz': 1/16,       # 1 lb = 16 oz
        'g': 1/453.592,   # 1 lb = 453.592 grams
        'kg': 2.20462,    # 1 kg = 2.20462 lbs
        'lb': 1
    }

    # Count conversions for specific ingredients
    count_conversions = {
        'clove': 1,       # Treat as individual count
        'piece': 1
    }

    # Determine conversion based on unit
    if unit.lower() in volume_conversions:
        return amount * volume_conversions[unit.lower()]
    elif unit.lower() in weight_conversions:
        return amount * weight_conversions[unit.lower()]
    elif unit.lower() in count_conversions:
        return amount
    
    return amount  # Default: no conversion

def sanitize_unit(unit_str: str) -> str:
    """
    Normalize unit strings using UNIT_MAP
    """
    if not unit_str:
        return ""
    clean = unit_str.lower().strip()
    if clean in ['piece', 'pieces']:
        return ""
    return UNIT_MAP.get(clean, clean)

def sanitize_name(raw_name: str) -> str:
    """
    Clean up ingredient names
    """
    clean = raw_name.lower().strip()
    
    # Remove leading digits/fractions
    clean = re.sub(r"^[\d/\.\s]+", "", clean).strip()
    
    # Remove filler phrases
    for fpat in FILLERS:
        clean = re.sub(fpat, "", clean)
    
    # Remove descriptors
    for dpat in DESCRIPTORS:
        clean = re.sub(dpat, "", clean)
    
    # Remove trailing punctuation
    clean = re.sub(r"[,\.\;]+$", "", clean)
    
    # Apply regex replacements
    for pattern, repl in REGEX_REPLACEMENTS.items():
        clean = re.sub(pattern, repl, clean)
    
    # Remove extra spaces
    clean = re.sub(r"\s{2,}", " ", clean).strip()
    
    return clean

def parse_quantity_unit(ingredient_str: str):
    """
    Parse quantity and unit from ingredient string with better handling of amounts
    """
    # Remove any piece/pieces references first
    cleaned = re.sub(r'\b(?:piece|pieces)\b\s*', '', ingredient_str, flags=re.IGNORECASE).strip()
    
    # Match patterns for:
    # 1. "8 chicken breasts"
    # 2. "1/2 cup milk"
    # 3. "1.5 tbsp sugar"
    patterns = [
        # Pattern for number + unit + ingredient
        r'^(\d+(?:/\d+)?|\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$',
        # Pattern for just number + ingredient
        r'^(\d+(?:/\d+)?|\d+(?:\.\d+)?)\s+(.+)$'
    ]
    
    for pattern in patterns:
        match = re.match(pattern, cleaned)
        if match:
            groups = match.groups()
            amount = safe_convert_to_float(groups[0])
            
            if len(groups) == 3:  # First pattern matched (with unit)
                unit = groups[1] if groups[1] else ""
                name = groups[2]
            else:  # Second pattern matched (no unit)
                unit = ""
                name = groups[1]
                
            # Remove any remaining piece references from unit
            if unit.lower() in ['piece', 'pieces']:
                unit = ''
                
            return (amount, unit, name.strip())
    
    # If no patterns match, return original string as name
    return (None, "", cleaned)

def standardize_ingredient(ing: Any):
    """
    Enhanced ingredient standardization with more robust parsing
    """
    def parse_complex_ingredient(ing_str: str):
        """
        Parse ingredients with multiple quantity components
        e.g., "1 cup 2 tablespoons olive oil"
        """
        # Regex to match multiple quantity-unit pairs
        pattern = r'(\d+(?:/\d+)?)\s*(cup|tbsp|tsp|oz|lb|clove)s?\b'
        matches = re.findall(pattern, ing_str, re.IGNORECASE)
        
        total_amount = 0
        for qty, unit in matches:
            amount = safe_convert_to_float(qty)
            if amount is not None:
                total_amount += convert_to_base_unit(amount, unit)
        
        # Remove quantity-unit parts from string
        clean_name = re.sub(pattern, '', ing_str, flags=re.IGNORECASE).strip()
        
        return total_amount, clean_name

    if isinstance(ing, str):
        # Try complex parsing first
        amount, name = parse_complex_ingredient(ing)
        
        # If complex parsing fails, fall back to existing method
        if amount == 0:
            amount, raw_unit, name = parse_quantity_unit(ing)
        
        # Sanitize and return
        unit = sanitize_unit(raw_unit) if 'raw_unit' in locals() else ''
        return (sanitize_name(name), amount, unit)
    
    # Existing dictionary handling remains the same
    elif isinstance(ing, dict):
        name = ing.get('ingredient', '')
        amount = safe_convert_to_float(ing.get('amount', ing.get('quantity')))
        unit = ing.get('unit', '')
        
        # Remove piece units
        if unit.lower() in ['piece', 'pieces']:
            unit = ''
        else:
            unit = sanitize_unit(unit)
            
        return (sanitize_name(name), amount, unit)
    
    return (str(ing).lower(), None, "")


def combine_amount_and_unit(amount_float: float, unit: str, name: str) -> str:
    """
    Combine amount, unit and name into display string without pieces
    """
    if amount_float is None:
        return name
    
    try:
        # Format the amount
        fraction = Fraction(amount_float).limit_denominator(16)
        quantity_str = str(fraction)
        
        # Build the string
        if unit and unit.lower() not in ['piece', 'pieces']:
            return f"{quantity_str} {unit} {name}"
        return f"{quantity_str} {name}"
    except (ValueError, TypeError):
        return name


def aggregate_grocery_list(menu_dict: Dict[str, Any]):
    """
    Enhanced grocery list aggregation with smarter quantity handling
    and improved format detection for different menu types
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Aggregating grocery list from input type: {type(menu_dict)}")
    aggregated = {}
    
    # Parse JSON if it's a string
    if isinstance(menu_dict, str):
        try:
            menu_dict = json.loads(menu_dict)
            logger.info("Successfully parsed menu_dict from JSON string")
        except json.JSONDecodeError:
            logger.error("Failed to parse menu_dict as JSON")
            return []
    
    # Check for nested meal_plan or meal_plan_json fields
    if isinstance(menu_dict, dict):
        if 'meal_plan' in menu_dict:
            menu_dict = menu_dict['meal_plan']
        elif 'meal_plan_json' in menu_dict:
            if isinstance(menu_dict['meal_plan_json'], str):
                try:
                    menu_dict = json.loads(menu_dict['meal_plan_json'])
                except json.JSONDecodeError:
                    logger.error("Failed to parse meal_plan_json as JSON")
                    return []
            else:
                menu_dict = menu_dict['meal_plan_json']
    
    # Verify we have a days array
    if not menu_dict or not isinstance(menu_dict, dict) or not 'days' in menu_dict:
        logger.warning("No 'days' array found in menu_dict")
        return []
    
    days = menu_dict.get("days", [])
    if not days or not isinstance(days, list):
        logger.warning("Days is not a valid list")
        return []
    
    # Process each day, meal, and snack
    for day in days:
        # Process meals with consistent logic
        for section in ['meals', 'snacks']:
            for item in day.get(section, []):
                # Handle different formats of ingredients
                ingredients = item.get("ingredients", [])
                
                # If ingredients isn't a list, try to convert it
                if not isinstance(ingredients, list):
                    if isinstance(ingredients, str):
                        # Try to parse JSON if it's a string
                        try:
                            ingredients = json.loads(ingredients)
                        except json.JSONDecodeError:
                            # If not valid JSON, treat as a single ingredient
                            ingredients = [ingredients]
                    else:
                        # Treat as a single ingredient
                        ingredients = [ingredients]
                
                # Process each ingredient based on its format
                for ing in ingredients:
                    if isinstance(ing, str):
                        # String format like "1 cup flour"
                        name, amount, unit = standardize_ingredient(ing)
                    else:
                        # Dictionary format like {"name": "flour", "quantity": "1 cup"}
                        name, amount, unit = standardize_ingredient(ing)
                    
                    # Skip empty ingredients
                    if not name:
                        continue
                    
                    key = (name, unit)
                    if amount is not None:
                        current = aggregated.get(key, 0.0)
                        aggregated[key] = current + amount
                    elif key not in aggregated:
                        aggregated[key] = None

    # Generate final list with smart formatting
    results = []
    for (name, unit), total_amt in aggregated.items():
        line = combine_amount_and_unit(total_amt, unit, name)
        results.append({"name": line, "quantity": ""})
    
    logger.info(f"Generated grocery list with {len(results)} items")
    return results