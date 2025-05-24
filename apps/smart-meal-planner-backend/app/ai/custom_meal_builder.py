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
        # Find tagged components
        cursor.execute("""
            SELECT * FROM recipe_components
            ORDER BY id DESC
            LIMIT 100
        """)
        
        all_components = cursor.fetchall()
        
        if not all_components or len(all_components) < 2:
            logger.warning("Not enough components to generate a custom meal")
            return None
            
        # Group components by type
        components_by_type = {}
        for component in all_components:
            component_type = component.get('component_type')
            if component_type not in components_by_type:
                components_by_type[component_type] = []
            components_by_type[component_type].append(component)
        
        # We need at least a main component and a side component
        if 'main_protein' not in components_by_type or len(components_by_type['main_protein']) == 0:
            logger.warning("No main_protein components available")
            return None
            
        # Pick a random main protein
        main_component = random.choice(components_by_type['main_protein'])
        
        # Find components that pair well with the main component
        cursor.execute("""
            SELECT 
                cc.component2_id,
                cc.compatibility_score,
                rc.recipe_id,
                rc.name,
                rc.component_type,
                rc.cuisine_type
            FROM component_compatibility cc
            JOIN recipe_components rc ON cc.component2_id = rc.id
            WHERE cc.component1_id = %s
            AND cc.compatibility_score >= 70
            ORDER BY cc.compatibility_score DESC
            LIMIT 20
        """, (main_component['id'],))
        
        compatible_components = cursor.fetchall()
        
        if not compatible_components:
            logger.warning(f"No compatible components found for {main_component['name']}")
            
            # Fallback: Just pick a random side dish
            side_types = ['side_dish', 'salad', 'vegetable_component', 'carb_base']
            available_sides = []
            
            for side_type in side_types:
                if side_type in components_by_type and components_by_type[side_type]:
                    available_sides.extend(components_by_type[side_type])
            
            if not available_sides:
                logger.warning("No side components available")
                return None
                
            side_component = random.choice(available_sides)
        else:
            # Filter for side dishes from compatible components
            side_types = ['side_dish', 'salad', 'vegetable_component', 'carb_base']
            compatible_sides = [c for c in compatible_components if c['component_type'] in side_types]
            
            if not compatible_sides:
                # If no compatible sides, take any compatible component
                side_component = random.choice(compatible_components)
            else:
                # Take a random compatible side
                side_component = random.choice(compatible_sides)
        
        # Get recipe details for both components
        main_recipe = get_recipe_by_id(main_component['recipe_id'], cursor)
        side_recipe = get_recipe_by_id(side_component['recipe_id'], cursor)
        
        if not main_recipe or not side_recipe:
            logger.warning("Could not retrieve recipe details")
            return None
            
        # Create the meal suggestion
        meal = {
            "title": f"{main_recipe['title']} with {side_recipe['title']}",
            "main_component": {
                "id": main_component['recipe_id'],
                "title": main_recipe['title'],
                "component_type": main_component['component_type'],
                "cuisine": main_component['cuisine_type']
            },
            "side_component": {
                "id": side_component['recipe_id'],
                "title": side_recipe['title'],
                "component_type": side_component['component_type'],
                "cuisine": side_component['cuisine_type']
            },
            "combined_instructions": combine_instructions(main_recipe, side_recipe)
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