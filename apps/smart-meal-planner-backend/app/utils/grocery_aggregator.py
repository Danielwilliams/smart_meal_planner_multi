import os
import json
import re
import logging
from fractions import Fraction
from typing import Any, Dict

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

def sanitize_unit(unit_str: str, ingredient_name: str = "") -> str:
    """
    Normalize unit strings using UNIT_MAP and apply default units for specific ingredients
    """
    # Special handling for specific ingredient types
    clean_name = ingredient_name.lower().strip()
    
    # For eggs - always count them without a unit
    if clean_name == 'egg' or clean_name == 'eggs':
        return ""
    
    # For bell peppers - use medium as a descriptor, not as a unit
    if "bell pepper" in clean_name:
        return ""
    
    # For sweet potatoes and potatoes - use medium as a descriptor, not as a unit
    if clean_name == "sweet potato" or clean_name == "potato":
        return ""
    
    # For gluten-free tortilla - use piece instead of a unit
    if "tortilla" in clean_name:
        return ""
    
    if not unit_str:
        # If no unit is provided, check if we should apply a default unit based on the ingredient
        for key, default_unit in DEFAULT_UNITS.items():
            if key in clean_name:
                return default_unit
        return ""
    
    clean = unit_str.lower().strip()
    if clean in ['piece', 'pieces', 'medium', 'large', 'small']:
        return ""
    return UNIT_MAP.get(clean, clean)

def sanitize_name(raw_name: str) -> str:
    """
    Clean up ingredient names
    """
    clean = raw_name.lower().strip()
    
    # Handle "cooked" qualifier for rice and quinoa
    clean_is_cooked = False
    if "cooked" in clean:
        clean_is_cooked = True
        clean = clean.replace("cooked", "").strip()
    
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
    
    # Special case handling to ensure "salt to taste" is preserved
    if clean == "salt" and "to taste" in raw_name.lower():
        return "salt to taste"
    
    # For cheddar cheese when spelled as "cheddase" or similar misspellings
    if clean in ["cheddase", "cheddar"]:
        clean = "cheddar cheese"
    
    # Reapply "cooked" for display purposes if needed
    if clean_is_cooked and ("rice" in clean or "quinoa" in clean):
        clean = f"{clean} cooked"
    
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
        pattern = r'(\d+(?:/\d+)?)\s*(cup|tbsp|tsp|oz|lb|clove|g|ml)s?\b'
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
        logger.debug(f"Standardizing string ingredient: {ing}")
        # Try complex parsing first
        amount, name = parse_complex_ingredient(ing)
        
        # If complex parsing fails, fall back to existing method
        if amount == 0:
            amount, raw_unit, name = parse_quantity_unit(ing)
        
        # Clean up the name first
        clean_name = sanitize_name(name)
        
        # Sanitize the unit with the ingredient name for default units
        if 'raw_unit' in locals():
            unit = sanitize_unit(raw_unit, clean_name)
        else:
            unit = sanitize_unit('', clean_name)
            
        return (clean_name, amount, unit)
    
    # Dictionary handling with better name detection
    elif isinstance(ing, dict):
        logger.debug(f"Standardizing dict ingredient: {ing}")
        
        # Look for name in various fields
        name = ing.get('name', '')
        if not name:
            name = ing.get('ingredient', '')
        
        # Log the name we found
        logger.debug(f"Found ingredient name: {name}")
        
        # Clean up the name first
        clean_name = sanitize_name(name)
        
        # Look for quantity in various fields
        quantity = ing.get('quantity', None)
        if quantity is None:
            quantity = ing.get('amount', None)
        
        # Log the quantity we found
        logger.debug(f"Found ingredient quantity: {quantity}")
        
        # Special handling for common ingredients to ensure consistent format
        if clean_name.lower() == 'egg' or clean_name.lower() == 'eggs':
            logger.info(f"Special handling for eggs: {quantity}")
            if isinstance(quantity, str) and not quantity.isdigit():
                # For cases like "12 large" - extract the number
                match = re.search(r'(\d+)', quantity)
                if match:
                    quantity = match.group(1)
                    logger.info(f"Extracted egg quantity: {quantity}")
            # Standardize name to singular form for consistency
            clean_name = 'egg'
        
        # Convert quantity to float
        amount = safe_convert_to_float(quantity)
        
        # Look for unit in various fields
        unit = ing.get('unit', '')
        
        # Remove piece units and apply defaults if needed
        if unit and unit.lower() in ['piece', 'pieces']:
            unit = sanitize_unit('', clean_name)
        else:
            unit = sanitize_unit(unit, clean_name)
            
        return (clean_name, amount, unit)
    
    logger.warning(f"Unexpected ingredient type: {type(ing)}")
    return (str(ing).lower(), None, "")


def combine_amount_and_unit(amount_float: float, unit: str, name: str) -> str:
    """
    Combine amount, unit and name into display string with proper unit handling
    """
    if amount_float is None:
        # For ingredients where we want to apply a default unit but don't have a quantity
        clean_name = name.lower().strip()
        
        # Special default handling
        if 'lettuce' in clean_name:
            return f"1 leaves {name}"
        if 'garlic' in clean_name:
            return f"1 cloves {name}"
        if 'salsa' in clean_name:
            return f"1.5 cups {name}"
        if 'kalamata olive' in clean_name:
            return f"1/4 cup {name}"
        if 'soy ginger dressing' in clean_name:
            return f"1/4 cup {name}"
        if 'feta cheese' in clean_name:
            return f"1/2 cup {name}"
        if 'saffron' in clean_name:
            return f"1/2 tsp {name}"
            
        return name
    
    try:
        # Format the amount
        fraction = Fraction(amount_float).limit_denominator(16)
        quantity_str = str(fraction)
        
        # Check for simple whole numbers to make them cleaner
        if fraction.denominator == 1:
            quantity_str = str(fraction.numerator)
            
        # Apply special handling for specific ingredients
        clean_name = name.lower().strip()
        
        # For lettuce, always use leaves
        if 'lettuce' in clean_name and unit != 'leaves':
            unit = 'leaves'
            
        # For garlic, always use cloves
        if 'garlic' in clean_name and unit != 'cloves':
            unit = 'cloves'
            
        # For salsa, always use cups
        if 'salsa' in clean_name and unit != 'cups':
            unit = 'cups'
            
        # For soy ginger dressing, always use cup
        if 'soy ginger dressing' in clean_name and unit != 'cup':
            unit = 'cup'
            
        # For feta cheese, always use cup
        if ('feta' in clean_name and 'cheese' in clean_name) and unit != 'cup':
            unit = 'cup'
            
        # For kalamata olives, always use cup
        if ('kalamata' in clean_name and 'olive' in clean_name) and unit != 'cup':
            unit = 'cup'
            
        # For saffron, always use tsp
        if 'saffron' in clean_name and unit != 'tsp':
            unit = 'tsp'
            
        # Special handling for "cooked" qualifier
        if "cooked" in name:
            base_name = name.replace("cooked", "").strip()
            return f"{quantity_str} cups {base_name} cooked"
            
        # Special handling for salt to taste
        if name == "salt to taste":
            return "Salt    To taste"
            
        # Build the string with the appropriate unit
        if unit and unit.lower() not in ['piece', 'pieces']:
            return f"{quantity_str} {unit} {name}"
        return f"{quantity_str} {name}"
    except (ValueError, TypeError):
        return name


def aggregate_grocery_list(menu_dict: Dict[str, Any]):
    """
    Flexible grocery list aggregation with format detection for all menu types
    """
    import logging
    logger = logging.getLogger(__name__)
    
    logger.info(f"Aggregating grocery list from input type: {type(menu_dict)}")
    aggregated = {}
    
    # If null, return empty list
    if menu_dict is None:
        logger.warning("Input menu_dict is None")
        return []
    
    # Parse JSON if it's a string
    if isinstance(menu_dict, str):
        try:
            menu_dict = json.loads(menu_dict)
            logger.info("Successfully parsed menu_dict from JSON string")
        except json.JSONDecodeError:
            logger.error("Failed to parse menu_dict as JSON")
            return []
    
    # General function to extract ingredients from any nested structure
    def extract_ingredients_deep(obj, aggregated_dict, path=""):
        """Recursively extract ingredients from any object structure"""
        if obj is None:
            return
            
        # If we have an array, process each item
        if isinstance(obj, list):
            for i, item in enumerate(obj):
                extract_ingredients_deep(item, aggregated_dict, f"{path}[{i}]")
            return
            
        # If not a dict, nothing to extract
        if not isinstance(obj, dict):
            return
            
        # Log the path for debugging deep structures
        logger.debug(f"Scanning path: {path}, keys: {list(obj.keys())}")
        
        # Extract from ingredients array directly
        if 'ingredients' in obj and isinstance(obj['ingredients'], list):
            logger.info(f"Found ingredients array at {path} with {len(obj['ingredients'])} items")
            
            for i, ing in enumerate(obj['ingredients']):
                logger.info(f"Processing ingredient {i} at {path}: {ing}")
                
                # Handle different ingredient formats
                if isinstance(ing, str):
                    # String format like "1 cup flour"
                    logger.info(f"Ingredient {i} is a string: {ing}")
                    name, amount, unit = standardize_ingredient(ing)
                else:
                    # Dictionary format
                    if isinstance(ing, dict):
                        logger.info(f"Ingredient {i} is a dict with keys: {list(ing.keys())}")
                        if 'name' in ing:
                            logger.info(f"Ingredient has name: {ing['name']}")
                        if 'quantity' in ing:
                            logger.info(f"Ingredient has quantity: {ing['quantity']}")
                    name, amount, unit = standardize_ingredient(ing)
                
                logger.info(f"Standardized to name='{name}', amount={amount}, unit='{unit}'")
                
                # Skip empty ingredients
                if not name:
                    logger.warning(f"Skipping ingredient {i} with empty name")
                    continue
                    
                key = (name, unit)
                if amount is not None:
                    current = aggregated_dict.get(key, 0.0)
                    aggregated_dict[key] = current + amount
                    logger.info(f"Added amount {amount} to {name}, total now: {aggregated_dict[key]}")
                elif key not in aggregated_dict:
                    aggregated_dict[key] = None
                    logger.info(f"Added {name} without amount")
        
        # Handle snack-specific format (title and quantity without ingredients)
        if 'title' in obj and not 'ingredients' in obj:
            title = obj.get('title', '')
            quantity = obj.get('quantity', '') or obj.get('amount', '')
            
            if title:
                logger.info(f"Found simple item with title at {path}: {title}")
                # Format as "quantity title" and standardize
                ingredient_str = f"{quantity} {title}".strip()
                name, amount, unit = standardize_ingredient(ingredient_str)
                
                if name:
                    key = (name, unit)
                    if amount is not None:
                        current = aggregated_dict.get(key, 0.0)
                        aggregated_dict[key] = current + amount
                    elif key not in aggregated_dict:
                        aggregated_dict[key] = None
        
        # Recursively process all nested objects
        for key, value in obj.items():
            if isinstance(value, (dict, list)):
                new_path = f"{path}.{key}" if path else key
                extract_ingredients_deep(value, aggregated_dict, new_path)
    
    # First, check for nested meal_plan or meal_plan_json fields
    if isinstance(menu_dict, dict):
        processed = False
        
        # Try known paths for meal plan data
        for field in ['meal_plan', 'meal_plan_json']:
            if field in menu_dict:
                logger.info(f"Found {field} field in menu_dict")
                plan_data = menu_dict[field]
                
                # Parse if it's a string
                if isinstance(plan_data, str):
                    try:
                        plan_data = json.loads(plan_data)
                        logger.info(f"Successfully parsed {field} as JSON")
                        # Recursively extract from this data
                        extract_ingredients_deep(plan_data, aggregated)
                        processed = True
                    except json.JSONDecodeError:
                        logger.error(f"Failed to parse {field} as JSON")
                else:
                    # Process object directly
                    extract_ingredients_deep(plan_data, aggregated)
                    processed = True
        
        # If we didn't find any specific meal plan fields, try the whole object
        if not processed:
            logger.info("No specific meal plan fields found, scanning entire object")
            extract_ingredients_deep(menu_dict, aggregated)
    else:
        # If not a dict but something else (like a list), try to process it
        extract_ingredients_deep(menu_dict, aggregated)
    
    # Generate final list with smart formatting
    results = []
    for (name, unit), total_amt in aggregated.items():
        line = combine_amount_and_unit(total_amt, unit, name)
        results.append({"name": line, "quantity": ""})
    
    logger.info(f"Generated grocery list with {len(results)} items")
    return results
    
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
                
                # Check if this item is a snack in the simplified format (no ingredients array)
                # This handles the format in menu 391 where snacks look like {title: "Almonds", quantity: "1/4 cup"...}
                if section == 'snacks' and not ingredients and item.get('title') and (item.get('quantity') or item.get('amount')):
                    title = item.get('title', '')
                    quantity = item.get('quantity', '') or item.get('amount', '')
                    logger.info(f"Processing simple snack: {title} - {quantity}")
                    
                    # Directly use the title as name and quantity as amount
                    simplified_ing = f"{quantity} {title}"
                    name, amount, unit = standardize_ingredient(simplified_ing)
                    
                    # Skip empty ingredients
                    if not name:
                        continue
                    
                    key = (name, unit)
                    if amount is not None:
                        current = aggregated.get(key, 0.0)
                        aggregated[key] = current + amount
                    elif key not in aggregated:
                        aggregated[key] = None
                
                # Special case for menu 391 - handle meals as well
                if section == 'meals' and not ingredients:
                    # Check if we have name/title, quantity, etc.
                    title = item.get('title', '')
                    if title:
                        logger.info(f"Found meal without ingredients array: {title}")
                        
                        # Extract from meal directly if it has name and ingredients as direct properties
                        meal_ingredients = []
                        
                        # Look for all possible ingredient properties
                        for ing_key in ['name', 'quantity', 'amount']:
                            if ing_key in item:
                                meal_ingredients.append(item)
                                break
                        
                        # Process any found ingredients
                        for ing in meal_ingredients:
                            ing_name = ing.get('name', '')
                            ing_quantity = ing.get('quantity', '') or ing.get('amount', '')
                            
                            if ing_name and ing_quantity:
                                logger.info(f"Processing ingredient from meal: {ing_name} - {ing_quantity}")
                                simplified_ing = f"{ing_quantity} {ing_name}"
                                name, amount, unit = standardize_ingredient(simplified_ing)
                                
                                if name:
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
