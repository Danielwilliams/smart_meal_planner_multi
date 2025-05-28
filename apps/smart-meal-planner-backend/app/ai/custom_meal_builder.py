# app/ai/custom_meal_builder.py
import logging
import random
from ..db import get_db_connection
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

def suggest_custom_meal(user_id):
    """
    Generate a custom meal suggestion based on component compatibility

    Args:
        user_id: The user ID to generate the meal for

    Returns:
        Dictionary with meal details
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)

    try:
        # Find recipes with component types
        cursor.execute("""
            SELECT id, title, component_type, cuisine, complexity, cooking_method
            FROM scraped_recipes
            WHERE component_type IS NOT NULL AND component_type != ''
            ORDER BY id DESC
            LIMIT 100
        """)

        all_components = cursor.fetchall()

        if not all_components or len(all_components) < 2:
            logger.warning("Not enough recipes with component types to generate a custom meal")
            return None

        # Group recipes by component type
        components_by_type = {}
        for recipe in all_components:
            component_type = recipe.get('component_type')
            if component_type not in components_by_type:
                components_by_type[component_type] = []
            components_by_type[component_type].append(recipe)
        
        # We need at least a main component and a side component
        if 'main_protein' not in components_by_type or len(components_by_type['main_protein']) == 0:
            logger.warning("No main_protein components available")
            return None

        # Pick a random main protein
        main_recipe = random.choice(components_by_type['main_protein'])

        # For now, use simple compatibility based on cuisine matching
        # TODO: Implement proper component compatibility table that references recipe IDs
        compatible_components = []

        # Find side dishes that match cuisine or are neutral
        side_types = ['side_dish', 'salad', 'vegetable_component', 'carb_base']
        for side_type in side_types:
            if side_type in components_by_type:
                for side_recipe in components_by_type[side_type]:
                    # Simple compatibility: same cuisine or neutral cuisine
                    if (side_recipe.get('cuisine') == main_recipe.get('cuisine') or
                        side_recipe.get('cuisine') in [None, '', 'American', 'Other']):
                        compatible_components.append({
                            'recipe_id': side_recipe['id'],
                            'title': side_recipe['title'],
                            'component_type': side_recipe['component_type'],
                            'cuisine': side_recipe.get('cuisine'),
                            'compatibility_score': 80 if side_recipe.get('cuisine') == main_recipe.get('cuisine') else 60
                        })
        
        if not compatible_components:
            logger.warning(f"No compatible components found for {main_recipe['title']}")

            # Fallback: Just pick a random side dish
            side_types = ['side_dish', 'salad', 'vegetable_component', 'carb_base']
            available_sides = []

            for side_type in side_types:
                if side_type in components_by_type and components_by_type[side_type]:
                    available_sides.extend(components_by_type[side_type])

            if not available_sides:
                logger.warning("No side components available")
                return None

            side_recipe = random.choice(available_sides)
        else:
            # Filter for side dishes from compatible components
            side_types = ['side_dish', 'salad', 'vegetable_component', 'carb_base']
            compatible_sides = [c for c in compatible_components if c['component_type'] in side_types]

            if not compatible_sides:
                # If no compatible sides, take any compatible component
                side_component_info = random.choice(compatible_components)
                side_recipe = get_recipe_by_id(side_component_info['recipe_id'], cursor)
            else:
                # Take a random compatible side
                side_component_info = random.choice(compatible_sides)
                side_recipe = get_recipe_by_id(side_component_info['recipe_id'], cursor)

        # Get full recipe details for both components
        main_recipe_full = get_recipe_by_id(main_recipe['id'], cursor)
        side_recipe_full = get_recipe_by_id(side_recipe['id'], cursor)
        
        if not main_recipe_full or not side_recipe_full:
            logger.warning("Could not retrieve recipe details")
            return None

        # Create the meal suggestion
        meal = {
            "title": f"{main_recipe_full['title']} with {side_recipe_full['title']}",
            "main_component": {
                "id": main_recipe['id'],
                "title": main_recipe_full['title'],
                "component_type": main_recipe['component_type'],
                "cuisine": main_recipe.get('cuisine')
            },
            "side_component": {
                "id": side_recipe['id'],
                "title": side_recipe_full['title'],
                "component_type": side_recipe['component_type'],
                "cuisine": side_recipe.get('cuisine')
            },
            "combined_instructions": combine_instructions(main_recipe_full, side_recipe_full)
        }
        
        return meal
        
    except Exception as e:
        logger.error(f"Error generating custom meal: {str(e)}")
        return None
        
    finally:
        cursor.close()
        conn.close()

def get_recipe_by_id(recipe_id, cursor):
    """
    Get recipe details by ID
    
    Args:
        recipe_id: The recipe ID
        cursor: Database cursor
        
    Returns:
        Recipe dictionary
    """
    try:
        cursor.execute("SELECT * FROM scraped_recipes WHERE id = %s", (recipe_id,))
        recipe = cursor.fetchone()
        return recipe
    except Exception as e:
        logger.error(f"Error fetching recipe {recipe_id}: {str(e)}")
        return None

def combine_instructions(main_recipe, side_recipe):
    """
    Combine instructions from two recipes into a single set of instructions
    
    Args:
        main_recipe: Main recipe dictionary
        side_recipe: Side recipe dictionary
        
    Returns:
        List of combined instructions
    """
    instructions = []
    
    # Add preparation steps
    instructions.append("Preparation:")
    instructions.append(f"1. Gather ingredients for {main_recipe['title']} and {side_recipe['title']}.")
    
    # Get main recipe instructions
    if 'instructions' in main_recipe:
        main_instructions = main_recipe['instructions']
        if isinstance(main_instructions, str):
            # Try to parse JSON string
            try:
                import json
                main_instructions = json.loads(main_instructions)
            except:
                main_instructions = [main_instructions]
        
        if not isinstance(main_instructions, list):
            main_instructions = [str(main_instructions)]
        
        # Add main recipe instructions
        instructions.append(f"\nFor {main_recipe['title']}:")
        for i, step in enumerate(main_instructions):
            instructions.append(f"{i+1}. {step}")
    
    # Get side recipe instructions
    if 'instructions' in side_recipe:
        side_instructions = side_recipe['instructions']
        if isinstance(side_instructions, str):
            # Try to parse JSON string
            try:
                import json
                side_instructions = json.loads(side_instructions)
            except:
                side_instructions = [side_instructions]
        
        if not isinstance(side_instructions, list):
            side_instructions = [str(side_instructions)]
        
        # Add side recipe instructions
        instructions.append(f"\nFor {side_recipe['title']}:")
        for i, step in enumerate(side_instructions):
            instructions.append(f"{i+1}. {step}")
    
    # Add timing and serving suggestion
    instructions.append("\nTiming and Serving:")
    instructions.append(f"1. Time the preparation so that both dishes are ready at the same time.")
    instructions.append(f"2. Serve {main_recipe['title']} as the main course with {side_recipe['title']} on the side.")
    
    return instructions