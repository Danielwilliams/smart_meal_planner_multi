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
    Clean up ingredient names while preserving numbers
    """
    clean = raw_name.lower().strip()
    
    # Fix common misspellings
    clean = clean.replace('tomatoe', 'tomato')
    clean = clean.replace('potatoe', 'potato')
    
    # IMPORTANT: We don't remove leading digits/fractions anymore
    # This was causing quantities to be stripped out
    # We'll only clean up extra spaces around numbers
    clean = re.sub(r"(\d+)\s+", r"\1 ", clean).strip()
    
    # Remove filler phrases
    for fpat in FILLERS:
        clean = re.sub(fpat, "", clean)
    
    # Remove descriptors
    for dpat in DESCRIPTORS:
        clean = re.sub(dpat, "", clean)
    
    # Special handling for items with commas that might be causing issues
    # This helps with entries like "800 g chicken thigh, boneless"
    if ',' in clean:
        # Save the part after the comma as an adjective to preserve
        parts = clean.split(',')
        main_part = parts[0].strip()
        adjective = ','.join(parts[1:]).strip()
        
        # Special handling for numbered quantities
        if re.match(r'^\d+', main_part):
            return main_part  # Keep just the main part with the number

        # If there are meaningful adjectives like "boneless", keep them
        if adjective and len(adjective) < 20:  # Not too long
            clean = f"{main_part} {adjective}"
        else:
            clean = main_part
    
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
    and preserving numbers in names
    """
    import logging
    logger = logging.getLogger(__name__)
    
    # Log the input for debugging
    logger.debug(f"Parsing ingredient: {ingredient_str}")
    
    # Fix common misspellings
    cleaned = ingredient_str.replace('tomatoe', 'tomato')
    cleaned = cleaned.replace('potatoe', 'potato')
    
    # Check for ingredients with explicit quantity measurements at the beginning
    # Examples: "500g Chicken Breast", "1 lb Beef Strips", "800g chicken thigh"
    quantity_match = re.match(r'^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?\s+(.+)$', cleaned)
    if quantity_match:
        raw_quantity = quantity_match.group(1)
        unit = quantity_match.group(2) or ""
        ingredient = quantity_match.group(3)
        
        logger.debug(f"Found quantity: {raw_quantity}{unit} for {ingredient}")
        
        # Convert the quantity to a number
        quantity = safe_convert_to_float(raw_quantity)
        
        # Normalize the ingredient name
        ingredient = ingredient.lower().strip()
        
        # Standardize common meat cuts and ingredients
        if re.search(r'chicken\s+breast', ingredient, re.IGNORECASE):
            ingredient = 'chicken breast'
        elif re.search(r'chicken\s+thigh', ingredient, re.IGNORECASE):
            ingredient = 'chicken thigh'
        elif re.search(r'beef\s+strip', ingredient, re.IGNORECASE):
            ingredient = 'beef strips'
        elif re.search(r'bell\s+pepper', ingredient, re.IGNORECASE):
            ingredient = 'bell peppers'
        elif re.search(r'tomatoe?s?$', ingredient, re.IGNORECASE):
            ingredient = 'tomatoes'
        elif re.search(r'potatoe?s?$', ingredient, re.IGNORECASE):
            ingredient = 'potatoes'
        
        # Properly pluralize names for quantities > 1
        if quantity > 1:
            if ingredient.endswith('y') and not any(ingredient.endswith(x) for x in ['key', 'bay']):
                ingredient = ingredient[:-1] + 'ies'
            elif ingredient.endswith('o') and not any(ingredient.endswith(x) for x in ['photo', 'piano']):
                ingredient = ingredient + 'es'
            elif not ingredient.endswith('s') and not any(ingredient in ['rice', 'beef', 'chicken', 'pork']):
                ingredient = ingredient + 's'
        
        return (quantity, unit, ingredient)
    
    # Remove any piece/pieces references first
    cleaned = re.sub(r'\b(?:piece|pieces)\b\s*', '', cleaned, flags=re.IGNORECASE).strip()
    
    # Match patterns for:
    # 1. "8 chicken breasts"
    # 2. "1/2 cup milk"
    # 3. "1.5 tbsp sugar"
    # 4. "800 g chicken" - number with unit
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
            if unit and unit.lower() in ['piece', 'pieces']:
                unit = ''
                
            # Check for numbers in the name - might be part of the name (like "800 chicken")
            # This is particularly important for items that start with numbers
            if re.match(r'^\d+\s+\w+', name):
                logger.debug(f"Found number in name: {name}")
                # We'll keep it as is, since it might be intentional
            
            logger.debug(f"Parsed: amount={amount}, unit='{unit}', name='{name}'")
            return (amount, unit, name.strip())
    
    # If no patterns match, check if it's just a number
    number_only_match = re.match(r'^(\d+(?:/\d+)?|\d+(?:\.\d+)?)$', cleaned)
    if number_only_match:
        amount = safe_convert_to_float(number_only_match.group(1))
        return (amount, "", "")
    
    # If still no match, return original string as name
    logger.debug(f"No patterns matched, returning as name: {cleaned}")
    return (None, "", cleaned)

def standardize_ingredient(ing: Any):
    """
    Enhanced ingredient standardization with more robust parsing
    """
    import logging
    logger = logging.getLogger(__name__)
    
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
        logger.debug(f"Standardizing string ingredient: {ing}")
        # Try complex parsing first
        amount, name = parse_complex_ingredient(ing)
        
        # If complex parsing fails, fall back to existing method
        if amount == 0:
            amount, raw_unit, name = parse_quantity_unit(ing)
        
        # Sanitize and return
        unit = sanitize_unit(raw_unit) if 'raw_unit' in locals() else ''
        return (sanitize_name(name), amount, unit)
    
    # Dictionary handling with better name detection
    elif isinstance(ing, dict):
        logger.debug(f"Standardizing dict ingredient: {ing}")
        
        # Look for name in various fields
        name = ing.get('name', '')
        if not name:
            name = ing.get('ingredient', '')
        
        # Log the name we found
        logger.debug(f"Found ingredient name: {name}")
        
        # Look for quantity in various fields
        quantity = ing.get('quantity', None)
        if quantity is None:
            quantity = ing.get('amount', None)
        
        # Log the quantity we found
        logger.debug(f"Found ingredient quantity: {quantity}")
        
        # Convert quantity to float
        amount = safe_convert_to_float(quantity)
        
        # Look for unit in various fields
        unit = ing.get('unit', '')
        
        # Remove piece units
        if unit and unit.lower() in ['piece', 'pieces']:
            unit = ''
        else:
            unit = sanitize_unit(unit)
            
        return (sanitize_name(name), amount, unit)
    
    logger.warning(f"Unexpected ingredient type: {type(ing)}")
    return (str(ing).lower(), None, "")


def combine_amount_and_unit(amount_float: float, unit: str, name: str) -> str:
    """
    Combine amount, unit and name into display string without pieces,
    preserving numbers in names and ensuring proper pluralization
    """
    import logging
    logger = logging.getLogger(__name__)
    
    if amount_float is None:
        return name
    
    try:
        # Format the amount
        fraction = Fraction(amount_float).limit_denominator(16)
        quantity_str = str(fraction)
        quantity_val = float(amount_float)
        
        # Check for simple whole numbers to make them cleaner
        if fraction.denominator == 1:
            quantity_str = str(fraction.numerator)
        
        # Function to properly pluralize words based on quantity
        def pluralize_if_needed(item_name, quantity):
            # Skip pluralization for uncountable nouns
            uncountable = [
                'rice', 'milk', 'water', 'oil', 'butter', 'flour', 'cheese',
                'salt', 'pepper', 'sugar', 'cinnamon', 'bread', 'garlic',
                'beef', 'chicken', 'pork', 'fish', 'salmon', 'tuna', 'pasta',
                'spaghetti', 'yogurt', 'corn', 'broccoli', 'spinach', 'lettuce',
                'celery', 'parsley', 'cilantro', 'mint', 'honey', 'juice',
                'vinegar', 'cream', 'salsa', 'sauce', 'chocolate', 'mustard',
                'ketchup', 'mayo', 'mayonnaise', 'hummus', 'asparagus'
            ]
            
            # Words that naturally end in 's' but aren't plural
            s_ending_words = [
                'hummus', 'molasses', 'asparagus', 'brussels sprouts', 'swiss chard'
            ]
            
            # Check if it's an uncountable noun
            is_uncountable = False
            item_lower = item_name.lower()
            
            if item_lower in uncountable:
                is_uncountable = True
            else:
                # Check if item contains an uncountable noun
                for word in uncountable:
                    if item_lower.endswith(word) or item_lower.startswith(word):
                        is_uncountable = True
                        break
            
            # Check if it naturally ends in 's'
            ends_in_natural_s = any(item_lower == word or item_lower.endswith(' ' + word) for word in s_ending_words)
            
            # Don't pluralize if already plural, naturally ends in 's', quantity is 1, or uncountable
            if (quantity <= 1 or 
                (item_name.endswith('s') and not ends_in_natural_s) or 
                is_uncountable):
                return item_name
                
            # Special cases
            if item_name.endswith('y') and not any(item_name.endswith(x) for x in ['key', 'bay', 'day']):
                return item_name[:-1] + 'ies'
            elif item_name.endswith('sh') or item_name.endswith('ch') or item_name.endswith('x') or item_name.endswith('z'):
                return item_name + 'es'
            elif item_name == 'tomato':
                return 'tomatoes'
            elif item_name == 'potato':
                return 'potatoes'
            else:
                return item_name + 's'
        
        # Check if the name already starts with a number
        has_leading_number = re.match(r'^\d+', name.strip())
        
        # If name already starts with a number, we might want to preserve it 
        # as it could be part of the name (e.g. "800 g chicken")
        if has_leading_number:
            logger.debug(f"Name starts with number: {name}")
            # In most cases, we'll keep the name as is and just add the quantity
            # to avoid replacing meaningful numbers in names
            return f"{quantity_str} {name}"
        
        # Clean up name to prevent cases where unit is already in the name
        # Extract first word to check if it matches the unit
        name_parts = name.split()
        first_word = name_parts[0].lower() if name and name_parts else ""
        
        # Process name for pluralization if quantity > 1
        pluralized_name = name
        if quantity_val > 1:
            # For multi-word names, only pluralize the last word if appropriate
            if len(name_parts) > 1:
                last_word = name_parts[-1].lower()
                pluralized_last = pluralize_if_needed(last_word, quantity_val)
                if pluralized_last != last_word:
                    name_parts[-1] = pluralized_last
                    pluralized_name = ' '.join(name_parts)
            else:
                # For single word names
                pluralized_name = pluralize_if_needed(name, quantity_val)
        
        # Check if the unit is already in the name (to avoid "2 cups cups milk")
        if unit and unit.lower() not in ['piece', 'pieces']:
            # If the name already starts with the unit, don't repeat it
            if first_word == unit.lower() or first_word == unit.lower() + 's':
                return f"{quantity_str} {pluralized_name}"
            else:
                return f"{quantity_str} {unit} {pluralized_name}"
        return f"{quantity_str} {pluralized_name}"
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
    
    # Unit conversion for commonly used measures
    UNIT_CONVERSIONS = {
        'g_to_lbs': 0.00220462,  # 1g = 0.00220462 lbs
        'oz_to_lbs': 0.0625,     # 1oz = 0.0625 lbs
        'cup_to_g': {
            'rice': 200,         # 1 cup rice ≈ 200g
            'broccoli': 150,     # 1 cup chopped broccoli ≈ 150g
            'bell peppers': 150, # 1 cup chopped bell peppers ≈ 150g
            'carrots': 110,      # 1 cup chopped carrots ≈ 110g
            'default': 130       # Default for unknown ingredients
        },
        'tbsp_to_ml': 15,        # 1 tbsp ≈ 15ml
        'tsp_to_ml': 5           # 1 tsp ≈ 5ml
    }
    
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
                    
                # Try to convert to standard units when possible for better aggregation
                standardized_amount = amount
                standardized_unit = unit.lower() if unit else ""
                
                # Convert cups to grams for some ingredients
                if standardized_unit in ['cup', 'cups'] and amount is not None:
                    if name.lower() in UNIT_CONVERSIONS['cup_to_g']:
                        conversion_factor = UNIT_CONVERSIONS['cup_to_g'][name.lower()]
                        standardized_amount = amount * conversion_factor
                        standardized_unit = 'g'
                        logger.info(f"Converted {amount} cups of {name} to {standardized_amount}g")
                
                key = (name, standardized_unit)
                if standardized_amount is not None:
                    current = aggregated_dict.get(key, 0.0)
                    aggregated_dict[key] = current + standardized_amount
                    logger.info(f"Added amount {standardized_amount} to {name}, total now: {aggregated_dict[key]}")
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
    
    # Generate final list with smart formatting and categorization
    results = []
    
    # Organize by categories for better readability
    categories = {
        'protein': ['chicken', 'beef', 'egg', 'bacon', 'pork', 'fish', 'salmon', 'tuna', 'bean'],
        'produce': ['broccoli', 'bell pepper', 'tomato', 'lettuce', 'greens', 'carrot', 'cucumber', 
                   'onion', 'garlic', 'potato', 'avocado', 'basil', 'ginger'],
        'dairy': ['mozzarella', 'cheddar', 'cheese', 'yogurt', 'milk', 'cream', 'butter', 'feta'],
        'grains': ['rice', 'quinoa', 'pasta', 'bread', 'oat'],
        'condiments': ['sauce', 'oil', 'vinegar', 'soy sauce', 'balsamic', 'glaze', 'dressing',
                      'salsa', 'ketchup', 'mustard', 'mayo', 'olive oil']
    }
    
    def get_category(ingredient_name):
        """Determine category based on ingredient name"""
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in ingredient_name.lower():
                    return category
        return 'other'
    
    # Format by category
    categorized = {}
    for (name, unit), total_amt in aggregated.items():
        category = get_category(name)
        if category not in categorized:
            categorized[category] = []
            
        line = combine_amount_and_unit(total_amt, unit, name)
        categorized[category].append(line)
    
    # Sort items within each category
    for category, items in categorized.items():
        sorted_items = sorted(items)
        for item in sorted_items:
            results.append({"name": item, "quantity": "", "category": category})
    
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