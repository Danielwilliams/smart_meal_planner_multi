# app/utils/snack_enhancer.py
"""
Utility module for enhancing snack recipes with instructions.
This addresses the issue where complex snacks are generated without instructions.
"""

import logging
from collections import defaultdict

logger = logging.getLogger(__name__)

def generate_snack_instructions(ingredients, title=None):
    """
    Generate appropriate instructions for a snack based on its ingredients
    
    Args:
        ingredients: List of ingredients or ingredient objects
        title: Optional title of the snack
    
    Returns:
        List of instruction steps
    """
    # Handle different ingredient formats
    cleaned_ingredients = []
    
    if not ingredients:
        return ["Serve and enjoy!"]
    
    # Process ingredients into a standard format
    for ing in ingredients:
        if isinstance(ing, str):
            cleaned_ingredients.append(ing)
        elif isinstance(ing, dict):
            # Extract the name from various possible formats
            if 'name' in ing:
                cleaned_ingredients.append(ing['name'])
            elif 'ingredient' in ing:
                cleaned_ingredients.append(ing['ingredient'])
            elif 'item' in ing:
                cleaned_ingredients.append(ing['item'])
            elif 'text' in ing:
                cleaned_ingredients.append(ing['text'])
    
    # Count ingredients to determine complexity
    ingredient_count = len(cleaned_ingredients)
    
    # For simple snacks (1-2 ingredients)
    if ingredient_count <= 2:
        return generate_simple_snack_instructions(cleaned_ingredients, title)
    
    # For complex snacks (3+ ingredients)
    return generate_complex_snack_instructions(cleaned_ingredients, title)

def generate_simple_snack_instructions(ingredients, title=None):
    """Generate instructions for simple snacks with 1-2 ingredients"""
    instructions = []
    
    if len(ingredients) == 1:
        instructions.append(f"Prepare {ingredients[0]} and serve.")
        instructions.append("Enjoy immediately or store in an airtight container.")
    elif len(ingredients) == 2:
        instructions.append(f"Prepare {ingredients[0]} and {ingredients[1]}.")
        instructions.append(f"Combine {ingredients[0]} with {ingredients[1]} and serve.")
        instructions.append("Enjoy immediately or store in an airtight container.")
    
    return instructions

def generate_complex_snack_instructions(ingredients, title=None):
    """Generate instructions for complex snacks with 3+ ingredients"""
    instructions = []
    
    # Categorize ingredients by likely preparation method
    prep_categories = categorize_ingredients(ingredients)
    
    # Step 1: Preparation instructions
    instructions.append("Preparation:")
    instructions.append(f"1. Gather all ingredients: {', '.join(ingredients)}.")
    
    step_counter = 2
    
    # Step 2: Process ingredients that need to be cut/chopped
    if prep_categories['cut']:
        cut_items = ', '.join(prep_categories['cut'])
        instructions.append(f"{step_counter}. Wash and chop {cut_items} as needed.")
        step_counter += 1
    
    # Step 3: Process ingredients that need to be mixed
    if len(prep_categories['mix']) >= 2:
        mix_items = ', '.join(prep_categories['mix'])
        instructions.append(f"{step_counter}. In a bowl, combine {mix_items}.")
        step_counter += 1
    
    # Step 4: Process ingredients that need heating
    if prep_categories['heat']:
        heat_items = ', '.join(prep_categories['heat'])
        instructions.append(f"{step_counter}. If needed, heat or toast {heat_items} according to preference.")
        step_counter += 1
    
    # Step 5: Assembly instructions
    if title and "trail mix" in title.lower():
        instructions.append(f"{step_counter}. Mix all ingredients together in a large bowl.")
        step_counter += 1
    elif title and ("sandwich" in title.lower() or "wrap" in title.lower()):
        instructions.append(f"{step_counter}. Layer ingredients to assemble your {title}.")
        step_counter += 1
    elif title and "parfait" in title.lower():
        instructions.append(f"{step_counter}. Layer ingredients in a glass or bowl to create your parfait.")
        step_counter += 1
    else:
        instructions.append(f"{step_counter}. Combine all ingredients as desired to complete the snack.")
        step_counter += 1
    
    # Final step: Serving suggestion
    instructions.append(f"{step_counter}. Serve immediately or store in an airtight container if applicable.")
    
    return instructions

def categorize_ingredients(ingredients):
    """Categorize ingredients by likely preparation method"""
    categories = defaultdict(list)
    
    # Common items that need to be cut
    cut_keywords = ['fruit', 'vegetable', 'vegetables', 'pepper', 'celery', 'carrot', 'cucumber', 
                   'apple', 'orange', 'strawberries', 'berries', 'avocado', 'tomato']
    
    # Common items that need to be mixed
    mix_keywords = ['yogurt', 'dip', 'sauce', 'spread', 'hummus', 'cream cheese', 'butter', 
                   'peanut butter', 'almond butter', 'nutella', 'honey', 'jam', 'jelly']
    
    # Common items that may need heating
    heat_keywords = ['toast', 'bread', 'bagel', 'english muffin', 'pita', 'tortilla', 'nuts']
    
    for ingredient in ingredients:
        ingredient_lower = ingredient.lower()
        
        # Check for cutting needs
        if any(keyword in ingredient_lower for keyword in cut_keywords):
            categories['cut'].append(ingredient)
        
        # Check for mixing needs
        elif any(keyword in ingredient_lower for keyword in mix_keywords):
            categories['mix'].append(ingredient)
        
        # Check for heating needs
        elif any(keyword in ingredient_lower for keyword in heat_keywords):
            categories['heat'].append(ingredient)
        
        # Default category
        else:
            categories['other'].append(ingredient)
    
    return categories

def enhance_snack_with_instructions(snack):
    """
    Enhance a snack object by adding instructions if they're missing
    
    Args:
        snack: A snack object/dictionary that may be missing instructions
        
    Returns:
        The enhanced snack with instructions
    """
    # Skip if snack already has non-empty instructions
    if 'instructions' in snack and snack['instructions'] and len(snack['instructions']) > 0:
        # Instructions already exist and are not empty
        return snack
    
    # Generate instructions based on ingredients
    ingredients = snack.get('ingredients', [])
    title = snack.get('title', '')
    
    generated_instructions = generate_snack_instructions(ingredients, title)
    
    # Update the snack with generated instructions
    snack['instructions'] = generated_instructions
    
    return snack

def enhance_meal_plan_snacks(meal_plan):
    """
    Process a meal plan and enhance all snacks with instructions

    Args:
        meal_plan: The meal plan object/dictionary

    Returns:
        The enhanced meal plan with snack instructions
    """
    if not meal_plan:
        logger.warning("Unable to enhance snacks: meal plan is None")
        return meal_plan

    # Handle various meal plan formats
    if isinstance(meal_plan, str):
        try:
            import json
            meal_plan = json.loads(meal_plan)
        except Exception as e:
            logger.error(f"Failed to parse meal plan JSON: {str(e)}")
            return meal_plan

    # Handle nested structure where meal_plan might be inside another object
    if isinstance(meal_plan, dict) and 'meal_plan' in meal_plan and 'days' not in meal_plan:
        inner_plan = meal_plan['meal_plan']
        if isinstance(inner_plan, str):
            try:
                import json
                meal_plan['meal_plan'] = json.loads(inner_plan)
                return enhance_meal_plan_snacks(meal_plan)
            except Exception as e:
                logger.error(f"Failed to parse nested meal plan JSON: {str(e)}")
                return meal_plan
        elif isinstance(inner_plan, dict):
            meal_plan['meal_plan'] = enhance_meal_plan_snacks(inner_plan)
            return meal_plan

    # Now process the actual meal plan
    if not isinstance(meal_plan, dict) or 'days' not in meal_plan:
        logger.warning(f"Unable to enhance snacks: invalid meal plan structure (type: {type(meal_plan)})")
        return meal_plan

    try:
        enhanced_count = 0

        # First, build a map of meal titles to instructions from the meals array
        meal_instructions = {}
        for day in meal_plan['days']:
            if 'meals' in day and isinstance(day['meals'], list):
                for meal in day['meals']:
                    if isinstance(meal, dict) and 'title' in meal and 'instructions' in meal and meal['instructions']:
                        # Store instructions by title for later lookup
                        meal_instructions[meal['title']] = meal['instructions']

                        # Also check if meal_time is a snack type
                        if meal.get('meal_time', '').startswith('snack'):
                            meal_instructions[meal['title']] = meal['instructions']

        # Now process snacks, first checking if there's a matching meal with instructions
        for day in meal_plan['days']:
            if 'snacks' in day and isinstance(day['snacks'], list):
                for i, snack in enumerate(day['snacks']):
                    if isinstance(snack, dict):
                        # Check if snack needs instructions
                        if not snack.get('instructions') or len(snack.get('instructions', [])) == 0:
                            # First try to find matching instructions from a meal with the same title
                            if snack.get('title') in meal_instructions:
                                logger.info(f"Copying instructions from meal to snack: {snack.get('title')}")
                                snack['instructions'] = meal_instructions[snack.get('title')]
                                day['snacks'][i] = snack
                                enhanced_count += 1
                            else:
                                # If no matching meal found, generate new instructions
                                day['snacks'][i] = enhance_snack_with_instructions(snack)
                                enhanced_count += 1

        if enhanced_count > 0:
            logger.info(f"Enhanced {enhanced_count} snacks with instructions")

        return meal_plan
    except Exception as e:
        logger.error(f"Error enhancing snacks: {str(e)}")
        # Return original meal plan in case of error
        return meal_plan