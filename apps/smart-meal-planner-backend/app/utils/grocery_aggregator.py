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
    
    # Category-based unit handling for common ingredient types
    
    # COUNTABLE ITEMS - no units needed
    countable_items = [
        'egg', 'eggs',
        'avocado', 'avocados',
        'cucumber', 'cucumbers',
        'apple', 'apples',
        'banana', 'bananas',
        'orange', 'oranges',
        'lemon', 'lemons',
        'lime', 'limes',
        'tortilla', 'tortillas',
        'bagel', 'bagels',
        'muffin', 'muffins',
        'pita', 'pitas'
    ]
    
    for item in countable_items:
        if item == clean_name or (len(item) > 3 and item in clean_name):
            return ""
    
    # SIZE-DESCRIPTOR ITEMS - medium/large/small should be descriptors, not units
    descriptor_items = [
        'bell pepper', 'pepper', 
        'potato', 'sweet potato', 
        'onion', 'shallot',
        'zucchini', 'squash',
        'eggplant',
        'tomato'
    ]
    
    for item in descriptor_items:
        if item == clean_name or (len(item) > 3 and item in clean_name):
            return ""
    
    # "CAN" ITEMS - typically sold in cans
    can_items = [
        'black bean', 'kidney bean', 'pinto bean', 'garbanzo bean', 'chickpea',
        'tomato sauce', 'tomato paste', 'coconut milk', 'tuna'
    ]
    
    for item in can_items:
        if item == clean_name or (len(item) > 3 and item in clean_name):
            if unit_str and unit_str.lower() in ['can', 'cans']:
                return 'cans'
            # Don't override other specific units if provided
            # Default cans only when no unit is specified
    
    # WEIGHT ITEMS - typically measured in weight (g, oz, lb)
    weight_items = [
        'meat', 'chicken', 'beef', 'pork', 'lamb', 'turkey', 'fish', 'salmon', 'tuna',
        'cheese', 'butter', 'flour', 'sugar'
    ]
    
    # LIQUID ITEMS - typically measured in volume (cups, ml, L)
    liquid_items = [
        'oil', 'vinegar', 'sauce', 'broth', 'stock', 'milk', 'cream', 'yogurt', 
        'juice', 'water', 'wine', 'dressing'
    ]
    
    # SMALL AMOUNT ITEMS - typically measured in tsp/tbsp
    small_amt_items = [
        'spice', 'herb', 'extract', 'seasoning', 'salt', 'pepper', 'cinnamon',
        'nutmeg', 'cumin', 'paprika', 'ginger', 'garlic powder', 'vanilla'
    ]
    
    # Apply specific unit mappings
    if 'garlic' in clean_name and 'powder' not in clean_name:
        return 'cloves'
    
    if 'lettuce' in clean_name or 'leaf' in clean_name:
        return 'leaves'
    
    if ('quinoa' in clean_name or 'rice' in clean_name) and 'cooked' in clean_name:
        return 'cups cooked'
    
    # If no unit is provided, check if we should apply a default unit based on the ingredient
    if not unit_str:
        for key, default_unit in DEFAULT_UNITS.items():
            if key in clean_name:
                return default_unit
                
        # Apply fallback units based on categories
        for item in small_amt_items:
            if item in clean_name:
                return 'tsp'
                
        for item in liquid_items:
            if item in clean_name:
                return 'cups'
                
        for item in weight_items:
            if item in clean_name:
                if 'cheese' in clean_name:
                    return 'g'  # Use grams for cheese
                return 'lb'     # Use pounds for most meats and weight items
        
        return ""
    
    # Normalize provided units
    clean = unit_str.lower().strip()
    
    # These are descriptors, not units
    if clean in ['piece', 'pieces', 'medium', 'large', 'small', 'whole']:
        return ""
        
    # Map standard unit abbreviations
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
    
    # Remove leading digits/fractions and qualifiers like "large", "medium"
    clean = re.sub(r"^[\d/\.\s]+(large|medium|small)?\s+", "", clean).strip()
    
    # Clean up common qualifiers in the middle
    clean = re.sub(r"\s+(large|medium|small|cloves|leaves|cups|can)\s+", " ", clean)
    
    # Remove filler phrases
    for fpat in FILLERS:
        clean = re.sub(fpat, "", clean)
    
    # Handle "cans" qualifier specially before removing descriptors
    has_cans = "can" in clean or "cans" in clean
    
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
    
    # Fix common spelling variations
    if clean in ["cheddase", "cheddas", "cheddar"]:
        clean = "cheddar cheese" # Fix the typo and standardize
    
    # Fix berry variations
    if clean in ["berrie", "berry", "mixed berrie", "mixed berry", "blueberrie", "blueberry"]:
        clean = "berries"
    
    # Handle "gluten-free" prefix consistently 
    if "gluten-free" in clean or "gluten free" in clean:
        base = clean.replace("gluten-free", "").replace("gluten free", "").strip()
        clean = f"gluten-free {base}"
    
    # Reapply "cooked" for rice/quinoa
    if clean_is_cooked and ("rice" in clean or "quinoa" in clean):
        clean = f"{clean} cooked"
    
    # Reapply "cans" for beans if needed
    if has_cans and any(bean in clean for bean in ["bean", "chickpea", "lentil"]):
        # Don't add "cans" to the name, as it will be handled in unit field
        pass
    
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
        for qty, unit_match in matches:
            amount = safe_convert_to_float(qty)
            if amount is not None:
                total_amount += convert_to_base_unit(amount, unit_match)
        
        # Remove quantity-unit parts from string
        clean_name = re.sub(pattern, '', ing_str, flags=re.IGNORECASE).strip()
        
        return total_amount, clean_name

    if isinstance(ing, str):
        logger.debug(f"Standardizing string ingredient: {ing}")
        # Try complex parsing first
        amount, name = parse_complex_ingredient(ing)
        raw_unit = ''  # Initialize raw_unit with default value
        
        # If complex parsing fails, fall back to existing method
        if amount == 0:
            amount, raw_unit, name = parse_quantity_unit(ing)
        
        # Clean up the name first
        clean_name = sanitize_name(name)
        
        # Sanitize the unit with the ingredient name for default units
        unit = sanitize_unit(raw_unit, clean_name)
            
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
        
        # Look for unit in various fields - initialize earlier
        unit = ing.get('unit', '')
        
        # Special handling for ingredients with potential qualifiers in quantity
        if isinstance(quantity, str):
            # Handle cases like "12 large eggs", "4 medium onions", etc.
            if re.search(r'\d+\s+(large|medium|small|cloves|leaves|cans|slices)', quantity):
                # Extract both number and qualifier
                number_match = re.search(r'(\d+)', quantity)
                qualifier_match = re.search(r'(large|medium|small|cloves|leaves|cans|slices)', quantity)
                
                if number_match:
                    # Store the qualifier in the unit field if appropriate
                    if qualifier_match and not unit:
                        qualifier = qualifier_match.group(1)
                        if qualifier in ['large', 'medium', 'small']:
                            # For eggs and similar items, keep the qualifier
                            if clean_name.lower() in ['egg', 'eggs', 'onion', 'potato', 'sweet potato', 'bell pepper']:
                                unit = qualifier
                        elif qualifier in ['cloves', 'leaves', 'cans', 'slices']:
                            unit = qualifier
                            
                    # Update the quantity to just the number
                    quantity = number_match.group(1)
                    logger.info(f"Extracted quantity: {quantity}, qualifier: {unit if unit else 'none'}")
            
            # Handle 'cooked' qualifier in quantities
            if 'cooked' in quantity.lower() and ('rice' in clean_name.lower() or 'quinoa' in clean_name.lower()):
                # Extract just the number for the quantity
                number_match = re.search(r'(\d+)', quantity)
                if number_match:
                    quantity = number_match.group(1)
                # Mark this as cooked in the unit field
                unit = 'cups cooked'
        
        # Standardize egg names
        if clean_name.lower() in ['egg', 'eggs']:
            clean_name = 'egg'
            # If unit is not specified but we know it's eggs, set qualifier to 'large'
            if not unit:
                unit = 'large'
        
        # Convert quantity to float
        amount = safe_convert_to_float(quantity)
        
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
    Uses a more flexible, category-based approach
    """
    # Ensure name is properly capitalized
    def capitalize_name(name_str):
        # Split and capitalize each word, preserving certain patterns
        words = name_str.split()
        capitalized = []
        for word in words:
            # Skip capitalization for articles, prepositions in the middle of the string
            if (word.lower() in ['and', 'or', 'with', 'in', 'on', 'of', 'to', 'the', 'a', 'an']) and capitalized:
                capitalized.append(word.lower())
            # Preserve hyphenated words like "gluten-free"
            elif '-' in word:
                parts = word.split('-')
                capitalized.append('-'.join([p.capitalize() for p in parts]))
            else:
                capitalized.append(word.capitalize())
        return ' '.join(capitalized)
    
    # Standardize ingredient name
    clean_name = name.lower().strip()
    display_name = capitalize_name(name)
    
    # Handle case with no amount
    if amount_float is None:
        # Special handling for common ingredients without quantities
        default_qty_map = {
            'lettuce': '1 leaves',
            'garlic': '2 cloves',
            'salsa': '1.5 cups',
            'kalamata olive': '1/4 cup',
            'soy ginger dressing': '1/4 cup',
            'feta cheese': '1/2 cup',
            'saffron': '1/2 tsp',
            'salt': 'To taste'
        }
        
        # Check for direct matches or partial matches
        for key, default_value in default_qty_map.items():
            if key == clean_name or (len(key) > 3 and key in clean_name):
                # Handle "to taste" specially
                if default_value == 'To taste':
                    return f"{display_name}    {default_value}"
                return f"{display_name}: {default_value}"
        
        # For ingredients where we can make reasonable guesses about quantity
        if 'oil' in clean_name:
            return f"{display_name}: 2 tbsp"
        if 'spice' in clean_name or 'powder' in clean_name or 'seasoning' in clean_name:
            return f"{display_name}: 1 tsp"
        if 'sauce' in clean_name:
            return f"{display_name}: 2 tbsp"
        if 'vinegar' in clean_name:
            return f"{display_name}: 1 tbsp"
        if 'extract' in clean_name:
            return f"{display_name}: 1 tsp"
        
        # Generic fallback - just display the name
        return display_name
    
    try:
        # Format the amount
        fraction = Fraction(amount_float).limit_denominator(16)
        quantity_str = str(fraction)
        
        # Check for simple whole numbers to make them cleaner
        if fraction.denominator == 1:
            quantity_str = str(fraction.numerator)
        
        # Special handling for salt to taste
        if clean_name == "salt to taste" or clean_name == "salt" and quantity_str.lower() in ["to", "to taste"]:
            return "Salt    To taste"
            
        # Special handling for "cooked" qualifier with precise formatting
        if "cooked" in clean_name and ("rice" in clean_name or "quinoa" in clean_name):
            base_name = clean_name.replace("cooked", "").strip()
            display_name = capitalize_name(base_name)
            return f"{display_name}: {quantity_str} cups cooked"
            
        # Special handling for "cans" to show proper format
        if unit == "cans" or clean_name.endswith("can") or clean_name.endswith("cans"):
            if "bean" in clean_name:
                return f"{display_name}: {quantity_str} cans"
                
        # Handle common meats with proper unit display
        if any(meat in clean_name for meat in ["chicken", "beef", "pork", "turkey", "fish"]):
            # Convert to pounds for large quantities
            if (unit == "g" or unit == "grams") and float(amount_float) > 500:
                pounds = float(amount_float) * 0.00220462
                return f"{display_name}: {pounds:.1f} lb"
                
        # Special handling for egg quantities
        if clean_name == "egg" or clean_name == "eggs":
            # If quantity is large enough, we can add "large" qualifier
            if float(quantity_str) >= 1:
                return f"{capitalize_name('eggs')}: {quantity_str} large"
                
        # Consistent formatting for bell peppers
        if "bell pepper" in clean_name:
            return f"{capitalize_name('bell peppers')}: {quantity_str} medium"
        if "sweet potato" in clean_name or clean_name == "potato":
            return f"{display_name}: {quantity_str} medium"
                
        # For garlic, always use cloves
        if 'garlic' in clean_name and 'powder' not in clean_name:
            unit = 'cloves'
            
        # Build the string with the appropriate unit
        if unit:
            # Handle "cups cooked" special case
            if unit == "cups cooked":
                return f"{display_name}: {quantity_str} {unit}"
                
            # Skip units that are descriptors
            if unit.lower() not in ['piece', 'pieces', 'medium', 'large', 'small', 'whole']:
                return f"{display_name}: {quantity_str} {unit}"
                
        # No unit
        return f"{display_name}: {quantity_str}"
    except (ValueError, TypeError):
        return display_name


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
                    # Handle case where current might be None
                    if current is None:
                        current = 0.0
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
                        # Handle case where current might be None
                        if current is None:
                            current = 0.0
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

    # Check if we found any ingredients
    if not aggregated:
        # Try a direct approach for the common structure with days array
        logger.info("No ingredients found with recursive approach, trying direct day/meal structure")
        try:
            # Try to access days directly from menu_dict
            days = None

            # Check if days is directly in the menu_dict
            if 'days' in menu_dict and isinstance(menu_dict['days'], list):
                days = menu_dict['days']
                logger.info(f"Found days array directly in menu_dict with {len(days)} days")

            # Check if days is in meal_plan
            elif 'meal_plan' in menu_dict and isinstance(menu_dict['meal_plan'], dict) and 'days' in menu_dict['meal_plan']:
                days = menu_dict['meal_plan']['days']
                logger.info(f"Found days array in meal_plan with {len(days)} days")

            # Process each day, meal, and snack if days was found
            if days:
                for day_index, day in enumerate(days):
                    # Process meals with consistent logic
                    for section in ['meals', 'snacks']:
                        if section not in day or not isinstance(day[section], list):
                            continue

                        for meal_index, item in enumerate(day[section]):
                            # Skip non-dictionary meals
                            if not isinstance(item, dict):
                                continue

                            # Handle different formats of ingredients
                            if 'ingredients' in item and isinstance(item['ingredients'], list):
                                ingredients = item['ingredients']
                                logger.info(f"Processing {len(ingredients)} ingredients from day {day_index+1}, {section}, meal {meal_index+1}")

                                # Process each ingredient based on its format
                                for ing_index, ing in enumerate(ingredients):
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
                                        # Handle case where current might be None
                                        if current is None:
                                            current = 0.0
                                        aggregated[key] = current + amount
                                        logger.info(f"Added ingredient: {name}, amount: {amount}")
                                    elif key not in aggregated:
                                        aggregated[key] = None
                                        logger.info(f"Added ingredient without amount: {name}")

                            # Check if this item is a snack in the simplified format (no ingredients array)
                            elif section == 'snacks' and item.get('title') and (item.get('quantity') or item.get('amount')):
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
                                    # Handle case where current might be None
                                    if current is None:
                                        current = 0.0
                                    aggregated[key] = current + amount
                                elif key not in aggregated:
                                    aggregated[key] = None
        except Exception as e:
            logger.error(f"Error in direct day/meal structure processing: {str(e)}")

    # Generate final list with smart formatting
    results = []
    for (name, unit), total_amt in aggregated.items():
        line = combine_amount_and_unit(total_amt, unit, name)
        results.append({"name": line, "quantity": ""})

    logger.info(f"Generated grocery list with {len(results)} items")
    return results
