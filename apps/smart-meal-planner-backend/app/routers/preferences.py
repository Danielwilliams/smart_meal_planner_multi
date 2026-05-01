import json
import traceback
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection, get_db_cursor
from ..models.user import PreferencesUpdate
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


router = APIRouter(prefix="/preferences", tags=["Preferences"])

@router.get("/{id}")
def get_user_preferences(id: int):
    try:
        with get_db_cursor(dict_cursor=True) as (cursor, conn):
            cursor.execute("""
                SELECT
                    diet_type,
                    dietary_restrictions,
                    disliked_ingredients,
                    recipe_type,
                    macro_protein,
                    macro_carbs,
                    macro_fat,
                    calorie_goal,
                    meal_times,
                    appliances,
                    prep_complexity,
                    servings_per_meal,
                    snacks_per_day,
                    flavor_preferences,
                    spice_level,
                    recipe_type_preferences,
                    meal_time_preferences,
                    time_constraints,
                    prep_preferences,
                    preferred_proteins,
                    other_proteins,
                    carb_cycling_enabled,
                    carb_cycling_config
                FROM user_profiles
                WHERE id = %s
            """, (id,))

            preferences = cursor.fetchone()

            if not preferences:
                return {
                    "diet_type": "",
                    "dietary_restrictions": "",
                    "disliked_ingredients": "",
                    "recipe_type": "",
                    "macro_protein": None,
                    "macro_carbs": None,
                    "macro_fat": None,
                    "calorie_goal": None,
                    "meal_times": {
                        "breakfast": False,
                        "lunch": False,
                        "dinner": False,
                        "snacks": False
                    },
                    "appliances": {
                        "airFryer": False,
                        "instapot": False,
                        "crockpot": False
                    },
                    "prep_complexity": 50,
                    "servings_per_meal": 1,
                    "snacks_per_day": 0,
                    "flavor_preferences": {
                        "creamy": False,
                        "cheesy": False,
                        "herbs": False,
                        "umami": False,
                        "sweet": False,
                        "spiced": False,
                        "smoky": False,
                        "garlicky": False,
                        "tangy": False,
                        "peppery": False,
                        "hearty": False,
                        "spicy": False
                    },
                    "spice_level": "medium",
                    "recipe_type_preferences": {
                        "stir-fry": False,
                        "grain-bowl": False,
                        "salad": False,
                        "pasta": False,
                        "main-sides": False,
                        "pizza": False,
                        "burger": False,
                        "sandwich": False,
                        "tacos": False,
                        "wrap": False,
                        "soup-stew": False,
                        "bake": False,
                        "family-meals": False
                    },
                    "meal_time_preferences": {
                        "breakfast": False,
                        "morning-snack": False,
                        "lunch": False,
                        "afternoon-snack": False,
                        "dinner": False,
                        "evening-snack": False
                    },
                    "time_constraints": {
                        "weekday-breakfast": 10,
                        "weekday-lunch": 15,
                        "weekday-dinner": 30,
                        "weekend-breakfast": 20,
                        "weekend-lunch": 30,
                        "weekend-dinner": 45
                    },
                    "prep_preferences": {
                        "batch-cooking": False,
                        "meal-prep": False,
                        "quick-assembly": False,
                        "one-pot": False,
                        "minimal-dishes": False
                    },
                    "preferred_proteins": {
                        "meat": {
                            "chicken": False,
                            "beef": False,
                            "pork": False,
                            "turkey": False,
                            "lamb": False,
                            "bison": False,
                            "other": False
                        },
                        "seafood": {
                            "salmon": False,
                            "tuna": False,
                            "cod": False,
                            "shrimp": False,
                            "crab": False,
                            "mussels": False,
                            "other": False
                        },
                        "vegetarian_vegan": {
                            "tofu": False,
                            "tempeh": False,
                            "seitan": False,
                            "lentils": False,
                            "chickpeas": False,
                            "black_beans": False,
                            "other": False
                        },
                        "other": {
                            "eggs": False,
                            "dairy_milk": False,
                            "dairy_yogurt": False,
                            "protein_powder_whey": False,
                            "protein_powder_pea": False,
                            "quinoa": False,
                            "other": False
                        }
                    },
                    "other_proteins": {
                        "meat": "",
                        "seafood": "",
                        "vegetarian_vegan": "",
                        "other": ""
                    },
                    "carb_cycling_enabled": False,
                    "carb_cycling_config": {
                        "pattern": "3-1-3",
                        "high_carb_grams": 200,
                        "moderate_carb_grams": 100,
                        "low_carb_grams": 50,
                        "no_carb_grams": 20,
                        "weekly_schedule": {
                            "monday": "high",
                            "tuesday": "low", 
                            "wednesday": "high",
                            "thursday": "moderate",
                            "friday": "high",
                            "saturday": "low",
                            "sunday": "low"
                        },
                        "sync_with_workouts": False,
                        "workout_days": [],
                        "custom_pattern": False,
                        "pattern_options": [
                            {"name": "3-1-3", "description": "3 High, 1 Moderate, 3 Low carb days"},
                            {"name": "2-2-3", "description": "2 High, 2 Moderate, 3 Low carb days"},
                            {"name": "4-0-3", "description": "4 High, 0 Moderate, 3 Low carb days"},
                            {"name": "5-0-2", "description": "5 High, 0 Moderate, 2 Low carb days"},
                            {"name": "custom", "description": "Create your own custom pattern"}
                        ],
                        "carb_ranges": {
                            "high": {"min": 150, "max": 300, "description": "High carb days (workout/active days)"},
                            "moderate": {"min": 75, "max": 150, "description": "Moderate carb days (light activity)"},
                            "low": {"min": 25, "max": 75, "description": "Low carb days (rest days)"},
                            "no_carb": {"min": 0, "max": 25, "description": "Very low carb days (advanced)"}
                        },
                        "goals": {
                            "primary": "fat_loss",
                            "secondary": "maintain_muscle"
                        },
                        "notes": ""
                    }
                }

            # Handle JSONB fields
            if preferences['meal_times'] is None:
                preferences['meal_times'] = {
                    "breakfast": False,
                    "lunch": False,
                    "dinner": False,
                    "snacks": False
                }

            if preferences['appliances'] is None:
                preferences['appliances'] = {
                    "airFryer": False,
                    "instapot": False,
                    "crockpot": False
                }

            # Ensure snacks_per_day has a default value if null
            if preferences['snacks_per_day'] is None:
                preferences['snacks_per_day'] = 0

            # Handle new JSONB fields
            if preferences['flavor_preferences'] is None:
                preferences['flavor_preferences'] = {
                    "creamy": False,
                    "cheesy": False,
                    "herbs": False,
                    "umami": False,
                    "sweet": False,
                    "spiced": False,
                    "smoky": False,
                    "garlicky": False,
                    "tangy": False,
                    "peppery": False,
                    "hearty": False,
                    "spicy": False
                }

            if preferences['spice_level'] is None:
                preferences['spice_level'] = "medium"

            if preferences['recipe_type_preferences'] is None:
                preferences['recipe_type_preferences'] = {
                    "stir-fry": False,
                    "grain-bowl": False,
                    "salad": False,
                    "pasta": False,
                    "main-sides": False,
                    "pizza": False,
                    "burger": False,
                    "sandwich": False,
                    "tacos": False,
                    "wrap": False,
                    "soup-stew": False,
                    "bake": False,
                    "family-meals": False
                }

            if preferences['meal_time_preferences'] is None:
                preferences['meal_time_preferences'] = {
                    "breakfast": False,
                    "morning-snack": False,
                    "lunch": False,
                    "afternoon-snack": False,
                    "dinner": False,
                    "evening-snack": False
                }

            if preferences['time_constraints'] is None:
                preferences['time_constraints'] = {
                    "weekday-breakfast": 10,
                    "weekday-lunch": 15,
                    "weekday-dinner": 30,
                    "weekend-breakfast": 20,
                    "weekend-lunch": 30,
                    "weekend-dinner": 45
                }

            if preferences['prep_preferences'] is None:
                preferences['prep_preferences'] = {
                    "batch-cooking": False,
                    "meal-prep": False,
                    "quick-assembly": False,
                    "one-pot": False,
                    "minimal-dishes": False
                }

            # Handle preferred proteins - check for None, empty dict, or missing keys
            if preferences['preferred_proteins'] is None or preferences['preferred_proteins'] == {} or not isinstance(preferences['preferred_proteins'], dict):
                preferences['preferred_proteins'] = {
                    "meat": {
                        "chicken": False,
                        "beef": False,
                        "pork": False,
                        "turkey": False,
                        "lamb": False,
                        "bison": False
                    },
                    "seafood": {
                        "salmon": False,
                        "tuna": False,
                        "cod": False,
                        "shrimp": False,
                        "crab": False,
                        "mussels": False
                    },
                    "vegetarian_vegan": {
                        "tofu": False,
                        "tempeh": False,
                        "seitan": False,
                        "lentils": False,
                        "chickpeas": False,
                        "black_beans": False
                    },
                    "other": {
                        "eggs": False,
                        "dairy_milk": False,
                        "dairy_yogurt": False,
                        "protein_powder_whey": False,
                        "protein_powder_pea": False,
                        "quinoa": False
                    }
                }
            else:
                # Ensure all categories exist in the preferred_proteins object
                default_categories = {
                    "meat": {
                        "chicken": False, "beef": False, "pork": False, "turkey": False, "lamb": False, "bison": False
                    },
                    "seafood": {
                        "salmon": False, "tuna": False, "cod": False, "shrimp": False, "crab": False, "mussels": False
                    },
                    "vegetarian_vegan": {
                        "tofu": False, "tempeh": False, "seitan": False, "lentils": False, "chickpeas": False, "black_beans": False
                    },
                    "other": {
                        "eggs": False, "dairy_milk": False, "dairy_yogurt": False, "protein_powder_whey": False, "protein_powder_pea": False, "quinoa": False
                    }
                }
                
                for category, default_proteins in default_categories.items():
                    if category not in preferences['preferred_proteins'] or not isinstance(preferences['preferred_proteins'][category], dict):
                        preferences['preferred_proteins'][category] = default_proteins
                    else:
                        # Ensure all proteins in category exist
                        for protein, default_value in default_proteins.items():
                            if protein not in preferences['preferred_proteins'][category]:
                                preferences['preferred_proteins'][category][protein] = default_value

            if preferences['other_proteins'] is None or preferences['other_proteins'] == {} or not isinstance(preferences['other_proteins'], dict):
                preferences['other_proteins'] = {
                    "meat": "",
                    "seafood": "",
                    "vegetarian_vegan": "",
                    "other": ""
                }
            else:
                # Ensure all categories exist in other_proteins
                for category in ["meat", "seafood", "vegetarian_vegan", "other"]:
                    if category not in preferences['other_proteins']:
                        preferences['other_proteins'][category] = ""

            # Handle carb cycling preferences defaults - robust null checking
            if preferences['carb_cycling_enabled'] is None:
                preferences['carb_cycling_enabled'] = False

            if preferences['carb_cycling_config'] is None or preferences['carb_cycling_config'] == {} or not isinstance(preferences['carb_cycling_config'], dict):
                preferences['carb_cycling_config'] = {
                    "pattern": "3-1-3",
                    "high_carb_grams": 200,
                    "moderate_carb_grams": 100,
                    "low_carb_grams": 50,
                    "no_carb_grams": 20,
                    "weekly_schedule": {
                        "monday": "high",
                        "tuesday": "low",
                        "wednesday": "high",
                        "thursday": "moderate",
                        "friday": "high",
                        "saturday": "low",
                        "sunday": "low"
                    },
                    "sync_with_workouts": False,
                    "workout_days": [],
                    "custom_pattern": False,
                    "pattern_options": [
                        {"name": "3-1-3", "description": "3 High, 1 Moderate, 3 Low carb days"},
                        {"name": "2-2-3", "description": "2 High, 2 Moderate, 3 Low carb days"},
                        {"name": "4-0-3", "description": "4 High, 0 Moderate, 3 Low carb days"},
                        {"name": "5-0-2", "description": "5 High, 0 Moderate, 2 Low carb days"},
                        {"name": "custom", "description": "Create your own custom pattern"}
                    ],
                    "carb_ranges": {
                        "high": {"min": 150, "max": 300, "description": "High carb days (workout/active days)"},
                        "moderate": {"min": 75, "max": 150, "description": "Moderate carb days (light activity)"},
                        "low": {"min": 25, "max": 75, "description": "Low carb days (rest days)"},
                        "no_carb": {"min": 0, "max": 25, "description": "Very low carb days (advanced)"}
                    },
                    "goals": {
                        "primary": "fat_loss",
                        "secondary": "maintain_muscle"
                    },
                    "notes": ""
                }

            return preferences

    except Exception as e:
        logger.error(f"Error fetching preferences: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.put("/{id}")
async def update_preferences(id: int, preferences: PreferencesUpdate):
    try:
        # Debug logging
        logger.debug(f"Received preferences object: {preferences}")
        logger.debug(f"Preferences dict: {preferences.dict()}")
        logger.debug(f"Has spice_level attr: {hasattr(preferences, 'spice_level')}")
        if hasattr(preferences, 'spice_level'):
            logger.debug(f"Spice level value: {preferences.spice_level}")
        logger.debug(f"Has spiceLevel attr: {hasattr(preferences, 'spiceLevel')}")
        if hasattr(preferences, 'spiceLevel'):
            logger.debug(f"SpiceLevel value: {preferences.spiceLevel}")

        with get_db_cursor(dict_cursor=True) as (cursor, conn):
            update_fields = []
            params = []

            # Handle each field that might be updated
            if preferences.diet_type is not None:
                update_fields.append("diet_type = %s")
                params.append(preferences.diet_type)

            if preferences.dietary_restrictions is not None:
                update_fields.append("dietary_restrictions = %s")
                params.append(preferences.dietary_restrictions)

            if preferences.disliked_ingredients is not None:
                update_fields.append("disliked_ingredients = %s")
                params.append(preferences.disliked_ingredients)

            if preferences.recipe_type is not None:
                update_fields.append("recipe_type = %s")
                params.append(preferences.recipe_type)

            if preferences.meal_times is not None:
                meal_times_data = preferences.meal_times
                update_fields.append("meal_times = %s::jsonb")
                params.append(json.dumps(meal_times_data))

            if preferences.macro_protein is not None:
                update_fields.append("macro_protein = %s")
                params.append(preferences.macro_protein)

            if preferences.macro_carbs is not None:
                update_fields.append("macro_carbs = %s")
                params.append(preferences.macro_carbs)

            if preferences.macro_fat is not None:
                update_fields.append("macro_fat = %s")
                params.append(preferences.macro_fat)

            if preferences.calorie_goal is not None:
                update_fields.append("calorie_goal = %s")
                params.append(preferences.calorie_goal)

            # Add new fields
            if preferences.appliances is not None:
                update_fields.append("appliances = %s::jsonb")
                params.append(json.dumps(preferences.appliances))

            if preferences.prep_complexity is not None:
                update_fields.append("prep_complexity = %s")
                params.append(preferences.prep_complexity)

            if preferences.servings_per_meal is not None:
                update_fields.append("servings_per_meal = %s")
                params.append(preferences.servings_per_meal)

            # Add snacks_per_day field to the update query
            if preferences.snacks_per_day is not None:
                update_fields.append("snacks_per_day = %s")
                params.append(preferences.snacks_per_day)

            # New preference fields
            if preferences.flavor_preferences is not None:
                update_fields.append("flavor_preferences = %s::jsonb")
                params.append(json.dumps(preferences.flavor_preferences))

            if hasattr(preferences, 'spice_level') and preferences.spice_level is not None:
                update_fields.append("spice_level = %s")
                params.append(preferences.spice_level)

            if preferences.recipe_type_preferences is not None:
                update_fields.append("recipe_type_preferences = %s::jsonb")
                params.append(json.dumps(preferences.recipe_type_preferences))

            if preferences.meal_time_preferences is not None:
                update_fields.append("meal_time_preferences = %s::jsonb")
                params.append(json.dumps(preferences.meal_time_preferences))

            if preferences.time_constraints is not None:
                update_fields.append("time_constraints = %s::jsonb")
                params.append(json.dumps(preferences.time_constraints))

            if preferences.prep_preferences is not None:
                update_fields.append("prep_preferences = %s::jsonb")
                params.append(json.dumps(preferences.prep_preferences))

            # Handle both camelCase and snake_case for preferred proteins
            preferred_proteins_data = None
            if hasattr(preferences, 'preferredProteins') and preferences.preferredProteins is not None:
                preferred_proteins_data = preferences.preferredProteins
            elif hasattr(preferences, 'preferred_proteins') and preferences.preferred_proteins is not None:
                preferred_proteins_data = preferences.preferred_proteins
            
            if preferred_proteins_data is not None:
                update_fields.append("preferred_proteins = %s::jsonb")
                params.append(json.dumps(preferred_proteins_data))

            # Handle both camelCase and snake_case for other proteins
            other_proteins_data = None
            if hasattr(preferences, 'otherProteins') and preferences.otherProteins is not None:
                other_proteins_data = preferences.otherProteins
            elif hasattr(preferences, 'other_proteins') and preferences.other_proteins is not None:
                other_proteins_data = preferences.other_proteins
            
            if other_proteins_data is not None:
                update_fields.append("other_proteins = %s::jsonb")
                params.append(json.dumps(other_proteins_data))

            # Handle carb cycling preferences - both camelCase and snake_case
            carb_cycling_enabled_data = None
            if hasattr(preferences, 'carbCyclingEnabled') and preferences.carbCyclingEnabled is not None:
                carb_cycling_enabled_data = preferences.carbCyclingEnabled
            elif hasattr(preferences, 'carb_cycling_enabled') and preferences.carb_cycling_enabled is not None:
                carb_cycling_enabled_data = preferences.carb_cycling_enabled
                
            if carb_cycling_enabled_data is not None:
                update_fields.append("carb_cycling_enabled = %s")
                params.append(carb_cycling_enabled_data)

            carb_cycling_config_data = None
            if hasattr(preferences, 'carbCyclingConfig') and preferences.carbCyclingConfig is not None:
                carb_cycling_config_data = preferences.carbCyclingConfig
            elif hasattr(preferences, 'carb_cycling_config') and preferences.carb_cycling_config is not None:
                carb_cycling_config_data = preferences.carb_cycling_config
                
            if carb_cycling_config_data is not None:
                update_fields.append("carb_cycling_config = %s::jsonb")
                params.append(json.dumps(carb_cycling_config_data))

            # Add id to params
            params.append(id)

            if update_fields:
                query = f"""
                UPDATE user_profiles
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id
                """

                cursor.execute(query, params)
                conn.commit()

                if cursor.rowcount == 0:
                    raise HTTPException(status_code=404, detail="User not found")

            return {"status": "success", "message": "Preferences updated successfully"}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating preferences: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error updating preferences: {str(e)}")