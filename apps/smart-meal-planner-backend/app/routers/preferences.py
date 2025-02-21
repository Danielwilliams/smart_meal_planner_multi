import json
import traceback
from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection
from ..models.user import PreferencesUpdate
import logging

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


router = APIRouter(prefix="/preferences", tags=["Preferences"])

@router.get("/{id}")
def get_user_preferences(id: int):
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

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
                kroger_username,
                appliances,
                prep_complexity,
                servings_per_meal,
                snacks_per_day 
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
                "kroger_username": "",
                "snacks_per_day": 0
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

        return preferences

    except Exception as e:
        logger.error(f"Error fetching preferences: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500, 
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        if conn:
            conn.close()

@router.put("/{id}")
async def update_preferences(id: int, preferences: PreferencesUpdate):
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
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
        
        if preferences.kroger_username is not None:
            update_fields.append("kroger_username = %s")
            params.append(preferences.kroger_username)
        
        if preferences.kroger_password is not None:
            update_fields.append("kroger_password = %s")
            params.append(preferences.kroger_password)
        
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
        conn.rollback()
        print(f"Error updating preferences: {e}")
        print(traceback.format_exc())
        raise HTTPException(status_code=500, detail=f"Error updating preferences: {str(e)}")
    
    finally:
        if conn:
            conn.close()
