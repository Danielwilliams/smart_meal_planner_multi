import json
import time
import re
import os
import asyncio
import uuid
from typing import List, Optional, Dict, Any, Set
from fastapi import APIRouter, HTTPException, Query, Body, Depends, status, BackgroundTasks
import openai
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection
from sqlalchemy.orm import Session
from ..config import OPENAI_API_KEY
from ..models.user import GenerateMealPlanRequest
from ..models.menus import SaveMenuRequest
from pydantic import BaseModel
from ..crud import menu_crud

# Define a get_db dependency function since it's not in the db.py file
def get_db():
    """SQLAlchemy db session dependency for FastAPI"""
    from sqlalchemy.orm import sessionmaker
    from sqlalchemy import create_engine
    from ..config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

    # Create engine
    DATABASE_URL = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
    engine = create_engine(DATABASE_URL)

    # Create session
    SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    # Create and yield session for use in endpoint
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
import logging
from ..utils.grocery_aggregator import aggregate_grocery_list

# Setup enhanced logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)
from ..integration.kroger import add_to_kroger_cart
from ..integration.walmart import add_to_cart as add_to_walmart_cart
from ..db import track_recipe_interaction, is_recipe_saved
from ..utils.auth_utils import get_user_from_token
from datetime import datetime

# Model for menu sharing requests
class ShareMenuRequest(BaseModel):
    permission_level: str = "read"  # Default permission level

# Model for menu sharing response
class MenuSharingDetail(BaseModel):
    id: int
    client_id: int
    client_name: str
    shared_at: datetime
    permission_level: str

class MenuSharingResponse(BaseModel):
    menu_id: int
    shared_with: List[MenuSharingDetail]

# Enhanced logging setup
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def determine_model(model_to_use: str) -> str:
    """Determine which OpenAI model to use based on the request parameter"""
    if model_to_use == "enhanced":
        logger.info(f"Using enhanced GPT-4 model for meal generation")
        return "gpt-4"
    elif model_to_use == "local" and os.path.exists("./recipe-generation-model/pytorch_model.bin"):
        # Not implemented in this version, fallback to default
        logger.info(f"Local model selected but falling back to default")
        return "gpt-3.5-turbo"
    elif model_to_use == "hybrid":
        logger.info(f"Using hybrid GPT-3.5-turbo-16k model for meal generation")
        return "gpt-3.5-turbo-16k"
    else:
        logger.info(f"Using default GPT-3.5-turbo model for meal generation")
        return "gpt-3.5-turbo"

def extract_primary_ingredients(meal: Dict[str, Any]) -> List[str]:
    """Extract primary ingredients from a meal"""
    primary_ingredients = []
    for ingredient in meal.get("ingredients", []):
        if isinstance(ingredient, dict):
            name = ingredient.get("name", "")
        else:
            name = str(ingredient)
            
        # Get the first word of the ingredient as the primary ingredient
        words = name.lower().split()
        if words and len(words[0]) > 3:  # Skip small words like "a", "the", etc.
            primary_ingredients.append(words[0])
    
    return list(set(primary_ingredients))

def contains_meat(meal: Dict[str, Any]) -> bool:
    """Check if a meal contains meat"""
    meat_keywords = ["beef", "chicken", "pork", "turkey", "lamb", "veal", "bacon", "sausage", "ham", "fish", "salmon", "tuna", "shrimp"]
    
    for ingredient in meal.get("ingredients", []):
        if isinstance(ingredient, dict):
            name = ingredient.get("name", "").lower()
        else:
            name = str(ingredient).lower()
            
        for keyword in meat_keywords:
            if keyword in name:
                return True
    
    return False

def contains_animal_products(meal: Dict[str, Any]) -> bool:
    """Check if a meal contains animal products"""
    animal_keywords = ["meat", "beef", "chicken", "pork", "turkey", "lamb", "veal", "bacon", "sausage", "ham", 
                      "fish", "salmon", "tuna", "shrimp", "egg", "eggs", "milk", "cheese", "butter", "cream", "yogurt"]
    
    for ingredient in meal.get("ingredients", []):
        if isinstance(ingredient, dict):
            name = ingredient.get("name", "").lower()
        else:
            name = str(ingredient).lower()
            
        for keyword in animal_keywords:
            if keyword in name:
                return True
    
    return False

def contains_gluten(meal: Dict[str, Any]) -> bool:
    """Check if a meal contains gluten"""
    gluten_keywords = ["wheat", "flour", "bread", "pasta", "noodle", "barley", "rye", "cracker", "cereal", "beer", "soy sauce"]
    
    for ingredient in meal.get("ingredients", []):
        if isinstance(ingredient, dict):
            name = ingredient.get("name", "").lower()
        else:
            name = str(ingredient).lower()
            
        for keyword in gluten_keywords:
            if keyword in name and "gluten-free" not in name:
                return True
    
    return False

def convert_new_schema_to_old(day_json, required_meal_times, snacks_per_day=0):
    """Convert new schema format (breakfast, lunch, dinner as properties) to old format (meals array)"""
    meals = []

    # Convert main meals
    for meal_time in required_meal_times:
        if meal_time.lower() not in ['snack', 'morning snack', 'afternoon snack', 'evening snack']:
            meal_data = day_json.get(meal_time.lower())
            if meal_data:
                meals.append({
                    "meal_time": meal_time.lower(),
                    **meal_data
                })

    # Convert snacks
    snacks = day_json.get("snacks", [])
    for i, snack in enumerate(snacks):
        meals.append({
            "meal_time": f"snack_{i+1}",
            **snack
        })

    # Update the day_json to include meals array for backward compatibility
    day_json["meals"] = meals
    return day_json

def validate_meal_plan(
    day_json: Dict[str, Any],
    dietary_restrictions: List[str],
    disliked_ingredients: List[str],
    used_meal_titles: Set[str],
    required_meal_times: List[str] = None,
    time_constraints: Dict[str, int] = None,
    meal_time_preferences: Dict[str, bool] = None,
    spice_level: str = None
) -> List[str]:
    """Validate that the meal plan meets all requirements"""
    issues = []
    
    # Check for disliked ingredients
    for meal in day_json.get("meals", []):
        for ingredient in meal.get("ingredients", []):
            if isinstance(ingredient, dict):
                ing_name = ingredient.get("name", "").lower()
            else:
                ing_name = str(ingredient).lower()
                
            for disliked in disliked_ingredients:
                if disliked.strip() and disliked.lower() in ing_name:
                    issues.append(f"Meal '{meal.get('title')}' contains disliked ingredient: {disliked}")
    
    # Check for repeated meal titles
    for meal in day_json.get("meals", []):
        title = meal.get("title", "").strip()
        if title in used_meal_titles:
            issues.append(f"Meal title '{title}' has been used before")
    
    # Check dietary restrictions
    for restriction in dietary_restrictions:
        restriction = restriction.lower()
        if restriction == "vegetarian":
            for meal in day_json.get("meals", []):
                if contains_meat(meal):
                    issues.append(f"Meal '{meal.get('title')}' contains meat but diet is vegetarian")
        elif restriction == "vegan":
            for meal in day_json.get("meals", []):
                if contains_animal_products(meal):
                    issues.append(f"Meal '{meal.get('title')}' contains animal products but diet is vegan")
        elif restriction == "gluten-free":
            for meal in day_json.get("meals", []):
                if contains_gluten(meal):
                    issues.append(f"Meal '{meal.get('title')}' contains gluten but diet is gluten-free")
    
    # Verify all required meal times are included
    if required_meal_times:
        meal_times_in_plan = set(meal.get("meal_time", "").lower() for meal in day_json.get("meals", []))
        for meal_time in required_meal_times:
            if meal_time.lower() not in meal_times_in_plan:
                issues.append(f"Required meal time '{meal_time}' is missing from the meal plan")
    
    # Check detailed meal time preferences if specified
    if meal_time_preferences:
        preferred_times = [time for time, enabled in meal_time_preferences.items() if enabled]
        if preferred_times:
            for meal in day_json.get("meals", []):
                meal_time = meal.get("meal_time", "").lower()
                # Map standard meal times to preferred times if needed
                if meal_time == "breakfast" and "breakfast" in preferred_times:
                    pass  # This is fine
                elif meal_time == "lunch" and "lunch" in preferred_times:
                    pass  # This is fine
                elif meal_time == "dinner" and "dinner" in preferred_times:
                    pass  # This is fine
                elif meal_time not in preferred_times and meal_time in ["breakfast", "lunch", "dinner"]:
                    issues.append(f"Meal '{meal.get('title')}' is for {meal_time} but this time is not in preferred times")
    
    # Check time constraints if specified
    if time_constraints:
        for meal in day_json.get("meals", []):
            meal_time = meal.get("meal_time", "").lower()
            instructions = meal.get("instructions", [])
            # Estimate preparation time based on number of instructions
            # This is a simple heuristic - in a real system you might have more complex logic
            estimated_time = len(instructions) * 5  # Rough estimate: 5 minutes per instruction step
            
            # Check if meal time has a constraint
            weekday_constraint = f"weekday-{meal_time}"
            weekend_constraint = f"weekend-{meal_time}"
            
            if weekday_constraint in time_constraints:
                max_time = time_constraints[weekday_constraint]
                if estimated_time > max_time:
                    issues.append(f"Meal '{meal.get('title')}' likely exceeds weekday time constraint of {max_time} minutes for {meal_time}")
    
    return issues

def fix_common_issues(day_json: Dict[str, Any], day_number: int, servings_per_meal: int) -> Dict[str, Any]:
    """Fix common issues in the generated meal plan"""
    # Ensure dayNumber is correct
    day_json["dayNumber"] = day_number
    
    # Make sure each meal has standard fields
    for meal in day_json.get("meals", []):
        if "servings" not in meal:
            meal["servings"] = servings_per_meal
            
        if "macros" not in meal:
            meal["macros"] = {
                "perServing": {"calories": 0, "protein": "0g", "carbs": "0g", "fat": "0g"},
                "perMeal": {"calories": 0, "protein": "0g", "carbs": "0g", "fat": "0g"}
            }
            
        # Clean up ingredient format
        clean_ingredients = []
        for ingredient in meal.get("ingredients", []):
            if isinstance(ingredient, str):
                # Convert string to object
                parts = ingredient.split(',')
                name = parts[0]
                quantity = "1" if len(parts) < 2 else parts[1]
                clean_ingredients.append({
                    "name": name,
                    "quantity": quantity,
                    "calories": "0",
                    "protein": "0g",
                    "carbs": "0g",
                    "fat": "0g"
                })
            else:
                clean_ingredients.append(ingredient)
                
        meal["ingredients"] = clean_ingredients
    
    return day_json

router = APIRouter(prefix="/menu", tags=["Menu"])

# OpenAI initialization with error handling
if not OPENAI_API_KEY:
    logger.error("OPENAI_API_KEY not found in environment variables")
else:
    try:
        openai.api_key = OPENAI_API_KEY
        logger.info("OpenAI API key configured successfully")
    except Exception as e:
        logger.error(f"Failed to configure OpenAI API key: {str(e)}")

# Background Job Management Functions
def save_job_status(job_id: str, status_data: dict):
    """Save job status to database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO menu_generation_jobs
            (job_id, user_id, client_id, status, progress, message, request_data)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (job_id)
            DO UPDATE SET
                status = EXCLUDED.status,
                progress = EXCLUDED.progress,
                message = EXCLUDED.message,
                updated_at = CURRENT_TIMESTAMP
        """, (
            job_id,
            status_data.get('user_id'),
            status_data.get('client_id'),
            status_data.get('status', 'started'),
            status_data.get('progress', 0),
            status_data.get('message', 'Starting...'),
            json.dumps(status_data.get('request_data', {}))
        ))

        conn.commit()
        cursor.close()
        conn.close()
        logger.info(f"Saved job status for {job_id}: {status_data.get('status')} ({status_data.get('progress')}%)")

    except Exception as e:
        logger.error(f"Failed to save job status for {job_id}: {str(e)}")

def update_job_status(job_id: str, status_data: dict):
    """Update existing job status"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor()

        update_fields = []
        update_values = []

        if 'status' in status_data:
            update_fields.append("status = %s")
            update_values.append(status_data['status'])

        if 'progress' in status_data:
            update_fields.append("progress = %s")
            update_values.append(status_data['progress'])

        if 'message' in status_data:
            update_fields.append("message = %s")
            update_values.append(status_data['message'])

        if 'result_data' in status_data:
            update_fields.append("result_data = %s")
            update_values.append(json.dumps(status_data['result_data']))

        if 'error_message' in status_data:
            update_fields.append("error_message = %s")
            update_values.append(status_data['error_message'])

        if update_fields:
            update_fields.append("updated_at = CURRENT_TIMESTAMP")
            update_values.append(job_id)

            query = f"""
                UPDATE menu_generation_jobs
                SET {', '.join(update_fields)}
                WHERE job_id = %s
            """

            cursor.execute(query, update_values)
            conn.commit()

        cursor.close()
        conn.close()
        logger.info(f"Updated job {job_id}: {status_data.get('status')} ({status_data.get('progress')}%)")

    except Exception as e:
        logger.error(f"Failed to update job status for {job_id}: {str(e)}")

def get_job_status_from_database(job_id: str) -> Optional[dict]:
    """Retrieve job status from database"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT job_id, user_id, client_id, status, progress, message,
                   result_data, error_message, created_at, updated_at
            FROM menu_generation_jobs
            WHERE job_id = %s
        """, (job_id,))

        row = cursor.fetchone()
        cursor.close()
        conn.close()

        if row:
            result = dict(row)
            # Parse JSON fields
            if result['result_data']:
                try:
                    result['result_data'] = json.loads(result['result_data'])
                except:
                    result['result_data'] = None
            return result
        return None

    except Exception as e:
        logger.error(f"Failed to get job status for {job_id}: {str(e)}")
        return None

def merge_preference(db_value, req_value, default=None):
    """Helper function to merge preferences with precedence to request parameters"""
    return req_value if req_value is not None else (db_value or default)

def extract_meal_times(user_row, req_meal_times):
    """Helper function to extract meal times from user preferences"""
    # First check request parameter
    if req_meal_times:
        return req_meal_times
    
    # Next check detailed meal time preferences
    if user_row and 'meal_time_preferences' in user_row and user_row['meal_time_preferences']:
        # Get standard meal times (not snacks) from the detailed preferences
        standard_times = []
        
        if user_row['meal_time_preferences'].get('breakfast'):
            standard_times.append('breakfast')
        if user_row['meal_time_preferences'].get('lunch'):
            standard_times.append('lunch')
        if user_row['meal_time_preferences'].get('dinner'):
            standard_times.append('dinner')
            
        if standard_times:
            return standard_times
    
    # Fall back to basic meal times
    if user_row and 'meal_times' in user_row:
        return [meal for meal, enabled in user_row['meal_times'].items() 
                if enabled and meal != 'snacks']
    
    # Default case
    return ["breakfast", "lunch", "dinner"]

def process_dietary_restrictions(user_row, req_preferences):
    """Helper function to process dietary restrictions"""
    restrictions = []
    if user_row and user_row.get("dietary_restrictions"):
        restrictions.extend(user_row["dietary_restrictions"].split(','))
    if req_preferences:
        restrictions.extend(req_preferences)
    return list(set(filter(bool, restrictions)))

def process_disliked_ingredients(user_row, req_dislikes):
    """Helper function to process disliked ingredients"""
    dislikes = []
    if user_row and user_row.get("disliked_ingredients"):
        dislikes.extend(user_row["disliked_ingredients"].split(','))
    if req_dislikes:
        dislikes.extend(req_dislikes)
    return list(set(filter(bool, dislikes)))

def format_appliances_string(appliances_dict):
    """Helper function to format appliances string"""
    if not appliances_dict:
        return "None"
    active_appliances = [
        k.replace('airFryer', 'Air Fryer')
         .replace('instapot', 'Instant Pot')
         .replace('crockpot', 'Crock Pot')
        for k, v in appliances_dict.items() if v
    ]
    return ", ".join(active_appliances) if active_appliances else "None"

def get_prep_complexity_level(complexity_value):
    """Helper function to determine prep complexity level"""
    if complexity_value <= 25:
        return "minimal"
    elif complexity_value <= 50:
        return "easy"
    elif complexity_value <= 75:
        return "standard"
    return "complex"

@router.post("/generate")
def generate_meal_plan_variety(req: GenerateMealPlanRequest):
    """Generate a meal plan based on user preferences and requirements"""
    try:
        if req.duration_days < 1 or req.duration_days > 7:
            raise HTTPException(400, "duration_days must be between 1 and 7")

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Determine which user's preferences to use
            preference_user_id = req.for_client_id if req.for_client_id else req.user_id
            
            # Fetch user preferences (use client's preferences if for_client_id is provided)
            cursor.execute("""
                SELECT 
                    recipe_type,
                    macro_protein,
                    macro_carbs,
                    macro_fat,
                    calorie_goal,
                    appliances,
                    prep_complexity,
                    servings_per_meal,
                    meal_times,
                    diet_type,
                    dietary_restrictions,
                    disliked_ingredients,
                    snacks_per_day,
                    flavor_preferences,
                    spice_level,
                    recipe_type_preferences,
                    meal_time_preferences,
                    time_constraints,
                    prep_preferences
                FROM user_profiles
                WHERE id = %s
                LIMIT 1
            """, (preference_user_id,))
            
            user_row = cursor.fetchone()
            logger.debug(f"Fetched user preferences: {user_row}")

            # Process preferences
            servings_per_meal = merge_preference(
                user_row.get("servings_per_meal") if user_row else None,
                req.servings_per_meal,
                2
            )

            calorie_goal = merge_preference(
                user_row.get("calorie_goal") if user_row else None,
                req.calorie_goal,
                2000
            )

            # Macronutrients
            protein_goal = merge_preference(
                user_row.get("macro_protein") if user_row else None,
                req.macro_protein,
                40
            )
            carbs_goal = merge_preference(
                user_row.get("macro_carbs") if user_row else None,
                req.macro_carbs,
                30
            )
            fat_goal = merge_preference(
                user_row.get("macro_fat") if user_row else None,
                req.macro_fat,
                30
            )

            # Meal times and preferences
            selected_meal_times = extract_meal_times(user_row, req.meal_times)
            dietary_restrictions = process_dietary_restrictions(user_row, req.dietary_preferences)
            disliked_ingredients = process_disliked_ingredients(user_row, req.disliked_foods)
            
            # Determine snacks per day based on detailed meal time preferences
            snack_count_from_prefs = 0
            if user_row and user_row.get("meal_time_preferences"):
                meal_time_prefs = user_row.get("meal_time_preferences")
                if meal_time_prefs.get("morning-snack"):
                    snack_count_from_prefs += 1
                if meal_time_prefs.get("afternoon-snack"):
                    snack_count_from_prefs += 1
                if meal_time_prefs.get("evening-snack"):
                    snack_count_from_prefs += 1
            
            # If request has snacks_per_day, use that, otherwise use the determined count or fall back to the database value
            if req.snacks_per_day is not None:
                # Keep existing value from request
                pass
            elif snack_count_from_prefs > 0:
                # Use count based on meal time preferences
                req.snacks_per_day = snack_count_from_prefs
            elif user_row and user_row.get("snacks_per_day") is not None:
                # Fall back to database value
                req.snacks_per_day = user_row.get("snacks_per_day")

            # Appliances and complexity
            appliances = user_row.get("appliances", {}) if user_row else {}
            appliances_str = format_appliances_string(appliances)

            prep_complexity = merge_preference(
                user_row.get("prep_complexity") if user_row else None,
                req.prep_complexity,
                0
            )
            prep_level = get_prep_complexity_level(prep_complexity)

            # Diet and recipe types
            diet_type = merge_preference(
                user_row.get("diet_type") if user_row else None,
                req.diet_type,
                "Mixed"
            )
            recipe_type = merge_preference(
                user_row.get("recipe_type") if user_row else None,
                "American, Italian, Mexican, Asian, Chinese, Spanish"
            )
            
            # Extract new preference fields
            flavor_preferences = user_row.get("flavor_preferences", {}) if user_row else {}
            flavor_prefs_str = ", ".join([flavor for flavor, enabled in flavor_preferences.items() if enabled]) if flavor_preferences else ""
            
            spice_level = merge_preference(
                user_row.get("spice_level") if user_row else None,
                "medium"
            )
            
            recipe_type_preferences = user_row.get("recipe_type_preferences", {}) if user_row else {}
            recipe_type_prefs_str = ", ".join([type.replace('-', ' ') for type, enabled in recipe_type_preferences.items() if enabled]) if recipe_type_preferences else ""
            
            detailed_meal_times = user_row.get("meal_time_preferences", {}) if user_row else {}
            detailed_meal_times_str = ", ".join([time.replace('-', ' ') for time, enabled in detailed_meal_times.items() if enabled]) if detailed_meal_times else ""
            
            time_constraints = user_row.get("time_constraints", {}) if user_row else {}
            
            prep_preferences = user_row.get("prep_preferences", {}) if user_row else {}
            prep_prefs_str = ", ".join([prep.replace('-', ' ') for prep, enabled in prep_preferences.items() if enabled]) if prep_preferences else ""

            # Generate meal plan
            final_plan = {"days": []}
            
            # Track meal titles by category and primary ingredients for better variety
            used_meal_titles = set()  # All used titles
            used_by_meal_time = {meal_time: set() for meal_time in selected_meal_times}
            used_primary_ingredients = []  # List of (day, ingredients) tuples to track ingredients by day
            
            # Define OpenAI function schema for structured meal plan output
            # Construct a description based on detailed meal times or fall back to basic meal times
            meal_times_desc = ""
            if detailed_meal_times and any(enabled for time, enabled in detailed_meal_times.items()):
                # Use detailed meal times
                standard_meals = [time.replace('-', ' ').title() for time, enabled in detailed_meal_times.items() if enabled and not 'snack' in time]
                snack_meals = [time.replace('-', ' ').title() + " Snack" for time, enabled in detailed_meal_times.items() if enabled and 'snack' in time]
                meal_times_desc = ", ".join(standard_meals)
                if snack_meals:
                    meal_times_desc += " plus " + ", ".join(snack_meals)
            else:
                # Use basic meal times
                meal_times_desc = ", ".join(selected_meal_times)
                if req.snacks_per_day > 0:
                    meal_times_desc += f" plus {req.snacks_per_day} snack(s)"
            
            # Create schema with explicit meal time requirements
            meal_properties = {}

            # Add required meal times as separate properties
            for meal_time in selected_meal_times:
                if meal_time.lower() not in ['snack', 'morning snack', 'afternoon snack', 'evening snack']:
                    meal_properties[meal_time.lower()] = {
                        "type": "object",
                        "description": f"Required {meal_time} meal",
                        "properties": {
                            "title": {"type": "string", "description": "Title of the meal"},
                            "ingredients": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "quantity": {"type": "string"},
                                        "calories": {"type": "string"},
                                        "protein": {"type": "string"},
                                        "carbs": {"type": "string"},
                                        "fat": {"type": "string"}
                                    },
                                    "required": ["name", "quantity"]
                                }
                            },
                            "instructions": {"type": "array", "items": {"type": "string"}},
                            "servings": {"type": "integer"},
                            "macros": {
                                "type": "object",
                                "properties": {
                                    "perServing": {
                                        "type": "object",
                                        "properties": {
                                            "calories": {"type": "integer"},
                                            "protein": {"type": "string"},
                                            "carbs": {"type": "string"},
                                            "fat": {"type": "string"}
                                        }
                                    },
                                    "perMeal": {
                                        "type": "object",
                                        "properties": {
                                            "calories": {"type": "integer"},
                                            "protein": {"type": "string"},
                                            "carbs": {"type": "string"},
                                            "fat": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        },
                        "required": ["title", "ingredients", "instructions", "servings", "macros"]
                    }

            # Add snacks if requested
            if req.snacks_per_day > 0:
                meal_properties["snacks"] = {
                    "type": "array",
                    "description": f"Required {req.snacks_per_day} snack(s)",
                    "items": {
                        "type": "object",
                        "properties": {
                            "title": {"type": "string"},
                            "ingredients": {
                                "type": "array",
                                "items": {
                                    "type": "object",
                                    "properties": {
                                        "name": {"type": "string"},
                                        "quantity": {"type": "string"},
                                        "calories": {"type": "string"},
                                        "protein": {"type": "string"},
                                        "carbs": {"type": "string"},
                                        "fat": {"type": "string"}
                                    }
                                }
                            },
                            "servings": {"type": "integer"},
                            "macros": {
                                "type": "object",
                                "properties": {
                                    "perServing": {
                                        "type": "object",
                                        "properties": {
                                            "calories": {"type": "integer"},
                                            "protein": {"type": "string"},
                                            "carbs": {"type": "string"},
                                            "fat": {"type": "string"}
                                        }
                                    },
                                    "perMeal": {
                                        "type": "object",
                                        "properties": {
                                            "calories": {"type": "integer"},
                                            "protein": {"type": "string"},
                                            "carbs": {"type": "string"},
                                            "fat": {"type": "string"}
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "minItems": req.snacks_per_day,
                    "maxItems": req.snacks_per_day
                }

            menu_schema = {
                "name": "generate_daily_meal_plan",
                "description": f"Generate a daily meal plan with ALL required meal times: {meal_times_desc}. YOU MUST INCLUDE ALL MEAL TIMES.",
                "parameters": {
                    "type": "object",
                    "properties": {
                        "dayNumber": {
                            "type": "integer",
                            "description": "Day number in the meal plan"
                        },
                        **meal_properties,
                        "summary": {
                            "type": "object",
                            "properties": {
                                "calorie_goal": {"type": "string"},
                                "protein_goal": {"type": "string"},
                                "carbs_goal": {"type": "string"},
                                "fat_goal": {"type": "string"},
                                "protein_grams": {"type": "string"},
                                "carbs_grams": {"type": "string"},
                                "fat_grams": {"type": "string"},
                                "variance_from_goal": {"type": "string"}
                            }
                        }
                    },
                    "required": ["dayNumber", "summary"] + [meal_time.lower() for meal_time in selected_meal_times if meal_time.lower() not in ['snack', 'morning snack', 'afternoon snack', 'evening snack']] + (["snacks"] if req.snacks_per_day > 0 else [])
                }
            }

            # Generate each day's meal plan
            for day_number in range(1, req.duration_days + 1):
                logger.info(f"Generating day {day_number} of {req.duration_days}")
                
                # Get used ingredients that are within the last 3 days
                recent_ingredients = []
                for past_day, ingredients in used_primary_ingredients:
                    if day_number - past_day <= 3:  # Only consider ingredients from last 3 days
                        recent_ingredients.extend(ingredients)
                
                recent_ingredients_str = ", ".join(recent_ingredients) if recent_ingredients else "None"
                
                # Create a more structured system prompt
                system_prompt = f"""You are an advanced meal planning assistant that creates detailed, nutritionally balanced meal plans.
                Your task is to generate meal plans with precise cooking instructions while strictly adhering to user preferences.
                
                CRITICAL: You MUST generate meals for ALL meal times specified by the user, including breakfast, lunch, dinner, and snacks if requested.
                
                Pay special attention to the following preference areas:
                1. Flavor preferences - Focus on incorporating preferred flavor profiles
                2. Spice level - Adjust recipes to match the specified spice level
                3. Meal formats - Prioritize preferred meal structures like stir-fry, bowls, etc.
                4. Time constraints - Ensure recipes can be prepared within the time limits
                5. Meal preparation preferences - Use batch cooking, one-pot meals, etc. when specified
                
                Respect both dietary restrictions and detailed preferences to create personalized and practical meal plans."""
                
                # Create a more concise and structured user prompt
                user_prompt = f"""
                ## Meal Plan Requirements - Day {day_number} of {req.duration_days}

                ### User Profile
                - Servings per meal: {servings_per_meal}
                - Dietary preferences: {', '.join(dietary_restrictions)}
                - Disliked foods: {', '.join(disliked_ingredients)}
                - Preferred cuisines: {recipe_type}
                - Diet type: {diet_type}
                - Available appliances: {appliances_str}
                - Cooking complexity level: {prep_level}
                
                ### Additional Preferences
                - Preferred flavors: {flavor_prefs_str or "No specific flavor preferences"}
                - Spice level: {spice_level}
                - Preferred meal formats: {recipe_type_prefs_str or "No specific meal format preferences"}
                - Preferred meal preparation: {prep_prefs_str or "No specific preparation preferences"}

                ### Time Constraints
                {chr(10).join([f"- {constraint.replace('-', ' ').title()}: {minutes} minutes max" for constraint, minutes in time_constraints.items()]) if time_constraints else "- No specific time constraints"}

                ### Nutrition Goals
                - Daily calories: {calorie_goal} kcal × {servings_per_meal} servings = {calorie_goal * servings_per_meal} total calories
                - Protein: {protein_goal}% ({round((calorie_goal * protein_goal / 100) / 4)}g)
                - Carbs: {carbs_goal}% ({round((calorie_goal * carbs_goal / 100) / 4)}g)
                - Fat: {fat_goal}% ({round((calorie_goal * fat_goal / 100) / 9)}g)

                ### Critical Constraints
                1. DO NOT use disliked ingredients
                2. DO NOT repeat meal titles from this list: {', '.join(used_meal_titles) if used_meal_titles else 'None'}
                3. DO NOT use primary ingredients that appeared in the last 3 days: {recent_ingredients_str}
                4. DO NOT use the same protein source more than once per day
                5. Include at least 3 distinct cuisines each day
                6. Use standardized units (grams, ounces, tablespoons)

                ### Structure Requirements
                - Scale all recipes to exactly {servings_per_meal} servings
                - Provide detailed, step-by-step cooking instructions
                - Include macronutrient breakdowns per serving AND per meal
                - Show calories, protein, carbs, and fat for each ingredient
                
                ### REQUIRED MEAL TIMES (YOU MUST GENERATE ALL OF THESE)
                - {meal_times_desc.replace(", ", chr(10) + "- ").replace(" plus ", chr(10) + "- ")}

                ### Meal Calorie Distribution
                - Breakfast: {round(calorie_goal * 0.25)} kcal per serving
                - Lunch: {round(calorie_goal * 0.35)} kcal per serving
                - Dinner: {round(calorie_goal * 0.35)} kcal per serving
                - Snacks (if applicable): {round(calorie_goal * 0.10)} kcal per serving
                """

                # Generate menu using OpenAI with function calling
                MAX_RETRIES = 3
                day_json = None
                
                # Select model based on request parameter
                openai_model = determine_model(req.ai_model if req.ai_model else "default")
                logger.info(f"Using {openai_model} model for meal generation")
                
                for attempt in range(MAX_RETRIES):
                    try:
                        response = openai.ChatCompletion.create(
                            model=openai_model,
                            messages=[
                                {"role": "system", "content": system_prompt},
                                {"role": "user", "content": user_prompt}
                            ],
                            functions=[menu_schema],
                            function_call={"name": "generate_daily_meal_plan"},
                            max_tokens=3000,
                            temperature=0.2,  # Slight creativity for variety
                            top_p=1,
                            request_timeout=600  # 10 minutes timeout
                        )
                        
                        logger.info(f"Received OpenAI response for day {day_number}")
                        
                        # Extract function call result
                        function_call = response.choices[0].message.get("function_call")
                        if function_call and function_call.get("name") == "generate_daily_meal_plan":
                            try:
                                day_json = json.loads(function_call.get("arguments", "{}"))
                                
                                # Additional validation
                                if not isinstance(day_json, dict):
                                    raise ValueError("Response is not a valid JSON object")
                                
                                # Convert new schema format to old format for backward compatibility
                                day_json = convert_new_schema_to_old(day_json, selected_meal_times, req.snacks_per_day)

                                if 'meals' not in day_json or 'dayNumber' not in day_json:
                                    raise ValueError("JSON missing required keys")

                                # Check for issues with the meal plan, including required meal times
                                issues = validate_meal_plan(
                                    day_json, 
                                    dietary_restrictions, 
                                    disliked_ingredients, 
                                    used_meal_titles,
                                    selected_meal_times,
                                    time_constraints,
                                    detailed_meal_times,
                                    spice_level
                                )
                                
                                if issues:
                                    logger.warning(f"Validation issues in day {day_number}: {issues}")
                                    if attempt < MAX_RETRIES - 1:
                                        # Add validation feedback in the next attempt
                                        user_prompt += f"\n\n### Validation Feedback\nPlease fix these issues in your meal plan:\n" + "\n".join([f"- {issue}" for issue in issues])
                                        continue
                                
                                # Fix common issues in the meal plan
                                day_json = fix_common_issues(day_json, day_number, servings_per_meal)
                                break
                                
                            except json.JSONDecodeError as json_err:
                                logger.warning(f"JSON parsing error on attempt {attempt + 1}: {str(json_err)}")
                                if attempt == MAX_RETRIES - 1:
                                    raise HTTPException(500, f"Unable to parse JSON for day {day_number}")
                                time.sleep(1)
                        else:
                            logger.warning(f"No function call in response for day {day_number}")
                            if attempt == MAX_RETRIES - 1:
                                raise HTTPException(500, f"No function call in response for day {day_number}")
                            time.sleep(1)

                    except openai.error.AuthenticationError:
                        logger.error("OpenAI authentication failed")
                        raise HTTPException(500, "OpenAI API key authentication failed")
                    except openai.error.APIError as e:
                        logger.error(f"OpenAI API error: {str(e)}")
                        if attempt == MAX_RETRIES - 1:
                            raise HTTPException(500, f"OpenAI API error: {str(e)}")
                        time.sleep(1)

                # Ensure day number is set correctly
                day_json["dayNumber"] = day_number
                
                # Add the day to the meal plan
                final_plan["days"].append(day_json)

                # Track used meal titles and primary ingredients for future days
                day_ingredients = []
                for meal in day_json.get("meals", []):
                    title = meal.get("title", "").strip()
                    meal_time = meal.get("meal_time", "").lower()
                    
                    if title:
                        used_meal_titles.add(title)
                        if meal_time in used_by_meal_time:
                            used_by_meal_time[meal_time].add(title)
                    
                    # Extract and track primary ingredients
                    primary_ingredients = extract_primary_ingredients(meal)
                    day_ingredients.extend(primary_ingredients)
                
                # Also track snack titles
                for snack in day_json.get("snacks", []):
                    title = snack.get("title", "").strip()
                    if title:
                        used_meal_titles.add(title)
                
                # Add the day's ingredients to the tracking list
                used_primary_ingredients.append((day_number, day_ingredients))

            # Save to database
            cursor.execute("""
                INSERT INTO menus (user_id, meal_plan_json, duration_days, meal_times, snacks_per_day, for_client_id, ai_model_used)
                VALUES (%s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                req.user_id,
                json.dumps(final_plan),
                req.duration_days,
                json.dumps(selected_meal_times),
                req.snacks_per_day,
                req.for_client_id,
                req.ai_model
            ))
            
            menu_id = cursor.fetchone()["id"]
            conn.commit()

            return {
                "menu_id": menu_id,
                "meal_plan": final_plan
            }

        finally:
            cursor.close()
            conn.close()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_meal_plan_variety: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Background Job Endpoints
@router.post("/generate-async")
async def start_menu_generation_async(req: GenerateMealPlanRequest, background_tasks: BackgroundTasks):
    """Start menu generation as a background job and return job ID immediately"""
    try:
        # Generate unique job ID
        job_id = str(uuid.uuid4())

        # Save initial job status
        save_job_status(job_id, {
            "user_id": req.user_id,
            "client_id": req.for_client_id,
            "status": "started",
            "progress": 0,
            "message": "Starting meal plan generation...",
            "request_data": req.dict()
        })

        # Start background task
        background_tasks.add_task(generate_menu_background_task, job_id, req)

        logger.info(f"Started background menu generation job {job_id} for user {req.user_id}")

        return {
            "job_id": job_id,
            "status": "started",
            "message": "Menu generation started"
        }

    except Exception as e:
        logger.error(f"Failed to start background menu generation: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/job-status/{job_id}")
async def get_menu_generation_status(job_id: str):
    """Get the status of a background menu generation job"""
    try:
        status = get_job_status_from_database(job_id)

        if not status:
            raise HTTPException(status_code=404, detail="Job not found")

        # Format response
        response = {
            "job_id": job_id,
            "status": status["status"],
            "progress": status["progress"],
            "message": status["message"],
            "created_at": status["created_at"].isoformat() if status["created_at"] else None,
            "updated_at": status["updated_at"].isoformat() if status["updated_at"] else None
        }

        # Include result data if completed
        if status["status"] == "completed" and status["result_data"]:
            response["result"] = status["result_data"]

        # Include error if failed
        if status["status"] == "failed" and status["error_message"]:
            response["error"] = status["error_message"]

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status for {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active-jobs/{user_id}")
async def get_active_jobs_for_user(user_id: int):
    """Get any active menu generation jobs for a user"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT job_id, status, progress, message, created_at, updated_at
            FROM menu_generation_jobs
            WHERE user_id = %s
            AND status IN ('started', 'generating', 'processing')
            ORDER BY created_at DESC
            LIMIT 5
        """, (user_id,))

        active_jobs = cursor.fetchall()
        cursor.close()
        conn.close()

        # Format the response
        jobs = []
        for job in active_jobs:
            jobs.append({
                "job_id": job["job_id"],
                "status": job["status"],
                "progress": job["progress"],
                "message": job["message"],
                "created_at": job["created_at"].isoformat() if job["created_at"] else None,
                "updated_at": job["updated_at"].isoformat() if job["updated_at"] else None,
                "time_running": (datetime.now() - job["created_at"]).total_seconds() if job["created_at"] else 0
            })

        return {
            "active_jobs": jobs,
            "has_active_jobs": len(jobs) > 0
        }

    except Exception as e:
        logger.error(f"Failed to get active jobs for user {user_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def generate_menu_background_task(job_id: str, req: GenerateMealPlanRequest):
    """Background task that performs the actual menu generation"""
    try:
        logger.info(f"Background task started for job {job_id}")

        # Update status: Starting AI generation
        update_job_status(job_id, {
            "status": "generating",
            "progress": 10,
            "message": "Calling AI to generate your meal plan..."
        })

        # Call the existing synchronous generation function
        logger.info(f"Calling generate_meal_plan_variety for job {job_id}")
        menu_result = generate_meal_plan_variety(req)

        # Update status: Processing complete
        update_job_status(job_id, {
            "status": "completed",
            "progress": 100,
            "message": "Menu generation completed successfully!",
            "result_data": menu_result
        })

        logger.info(f"Background task completed successfully for job {job_id}")

    except Exception as e:
        logger.error(f"Background task failed for job {job_id}: {str(e)}", exc_info=True)

        # Update status: Failed
        update_job_status(job_id, {
            "status": "failed",
            "progress": 0,
            "message": "Menu generation failed",
            "error_message": str(e)
        })

@router.get("/latest/{user_id}")
def get_latest_menu(user_id: int):
    """Fetch the most recent menu for a user"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT id, meal_plan_json, created_at::TEXT AS created_at
            FROM menus
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1;
        """, (user_id,))

        menu = cursor.fetchone()
        
        if not menu:
            raise HTTPException(status_code=404, detail="No menu found for this user.")

        return {
            "menu_id": menu["id"],
            "meal_plan": menu["meal_plan_json"],
            "created_at": menu["created_at"]
        }

    finally:
        cursor.close()
        conn.close()

@router.get("/history/{user_id}")
def get_menu_history(user_id: int):
    """Get menu history for a user"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                id as menu_id, 
                meal_plan_json, 
                created_at::TEXT AS created_at,
                COALESCE(nickname, '') AS nickname
            FROM menus
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 10;
        """, (user_id,))

        menus = cursor.fetchall()
        
        if not menus:
            raise HTTPException(status_code=404, detail="No menu history found.")

        return [
            {
                "menu_id": m["menu_id"], 
                "meal_plan": m["meal_plan_json"], 
                "created_at": m["created_at"],
                "nickname": m["nickname"]
            } 
            for m in menus
        ]

    finally:
        cursor.close()
        conn.close()

@router.patch("/{menu_id}/nickname")
async def update_menu_nickname(menu_id: int, nickname: str = Body(..., embed=True)):
    """Update the nickname for a menu"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            UPDATE menus 
            SET nickname = %s
            WHERE id = %s
            RETURNING id;
        """, (nickname, menu_id))
        
        conn.commit()
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="Menu not found")
            
        return {"status": "success", "message": "Nickname updated successfully"}
    
    finally:
        cursor.close()
        conn.close()

@router.get("/{menu_id}/grocery-list")
def get_grocery_list(menu_id: int):
    """Get grocery list for a specific menu"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT meal_plan_json
            FROM menus
            WHERE id = %s;
        """, (menu_id,))

        menu = cursor.fetchone()
        if not menu:
            raise HTTPException(status_code=404, detail="No grocery list found for this menu.")

        # Dump full menu data for debugging
        logging.info(f"Menu {menu_id} data retrieved: meal_plan_json exists: {menu.get('meal_plan_json') is not None}")
        
        # Print raw menu structure for debugging
        menu_keys = list(menu.keys()) if menu else []
        logging.info(f"Menu {menu_id} has these fields: {menu_keys}")
        
        # Specific debugging for menu 393
        if menu_id == 393:
            logging.info(f"SPECIAL HANDLING FOR MENU 393: {json.dumps(menu, default=str)[:1000]}")
            
            # If we have meal_plan_json, try to log its structure
            if menu.get('meal_plan_json'):
                if isinstance(menu['meal_plan_json'], str):
                    try:
                        parsed = json.loads(menu['meal_plan_json'])
                        logging.info(f"Menu 393 meal_plan_json parsed structure: {list(parsed.keys()) if isinstance(parsed, dict) else 'not a dict'}")
                    except json.JSONDecodeError:
                        logging.error("Menu 393 meal_plan_json is not valid JSON")
                else:
                    logging.info(f"Menu 393 meal_plan_json raw type: {type(menu['meal_plan_json'])}")
                    
        # Use meal_plan_json
        menu_data = menu.get("meal_plan_json")
            
        # Log raw menu data type
        logging.info(f"Menu {menu_id} data type: {type(menu_data)}")
        
        # If menu data is None, try different approaches
        if menu_data is None:
            logging.warning(f"Menu {menu_id} has no meal_plan_json or meal_plan data")
            # Try to use the entire menu object
            menu_data = menu
            
        # Try to normalize the menu data for ingredient extraction
        try:
            # Handle any menu data format - normalize it first
            logging.info(f"Normalizing menu data for extraction")
            
            # If menu_data is a string, try to parse it 
            if isinstance(menu_data, str):
                try:
                    menu_data = json.loads(menu_data)
                except json.JSONDecodeError:
                    logging.error(f"Failed to parse menu_data as JSON string")
            
            # For consistent handling, always try the grocery aggregator first
            grocery_list = aggregate_grocery_list(menu_data)
            
        except Exception as e:
            logging.error(f"Error during extraction: {str(e)}")
            # Fall back to regular aggregator with raw data
            grocery_list = aggregate_grocery_list(menu_data)
        
        # If grocery list is empty, try different approaches
        if not grocery_list and menu_data:
            logging.info(f"First attempt produced empty grocery list for menu {menu_id}, trying alternate approach")
            
            # If we have a JSON string, try to parse it
            if isinstance(menu_data, str):
                try:
                    parsed_data = json.loads(menu_data)
                    logging.info(f"Successfully parsed menu_data as JSON with keys: {list(parsed_data.keys()) if isinstance(parsed_data, dict) else 'not a dict'}")
                    grocery_list = aggregate_grocery_list(parsed_data)
                except json.JSONDecodeError:
                    logging.error(f"Failed to parse menu data as JSON for menu {menu_id}")
            
            # If we have a dict already, try wrapping it
            elif isinstance(menu_data, dict):
                logging.info(f"Trying with wrapped menu_data, keys: {list(menu_data.keys())}")
                grocery_list = aggregate_grocery_list({"meal_plan_json": menu_data})
        
        # Still empty? Try one more time with the full menu object
        if not grocery_list:
            logging.info(f"Second attempt produced empty grocery list for menu {menu_id}, trying with full menu object")
            grocery_list = aggregate_grocery_list(menu)
            
        # Log debugging info for troubleshooting
        if not grocery_list:
            logging.warning(f"All extraction attempts for menu {menu_id} failed to produce a grocery list")
            
            # As a last resort, try a direct parse of raw menu data to extract ingredients
            try:
                logging.info(f"Attempting direct scan of menu data as last resort for menu {menu_id}")
                
                # Function to scan any object structure for ingredients
                def scan_for_ingredients(obj, depth=0, path=""):
                    """Recursively scan any object structure for ingredients"""
                    if depth > 10:  # Prevent infinite recursion
                        return []
                        
                    found_ingredients = []
                    
                    # Handle arrays
                    if isinstance(obj, list):
                        for idx, item in enumerate(obj):
                            found_ingredients.extend(scan_for_ingredients(item, depth + 1, f"{path}[{idx}]"))
                        return found_ingredients
                    
                    # Handle dictionaries
                    if isinstance(obj, dict):
                        # Check for ingredients array
                        if 'ingredients' in obj and isinstance(obj['ingredients'], list):
                            logging.info(f"Found ingredients array at {path} with {len(obj['ingredients'])} items")
                            
                            for ing in obj['ingredients']:
                                if isinstance(ing, dict) and 'name' in ing:
                                    name = ing.get('name', '')
                                    quantity = ing.get('quantity', '') or ing.get('amount', '')
                                    if name:
                                        found_ingredients.append({
                                            "name": f"{quantity} {name}".strip(),
                                            "quantity": ""
                                        })
                                        logging.info(f"Extracted ingredient: {quantity} {name}")
                                elif isinstance(ing, str):
                                    found_ingredients.append({
                                        "name": ing,
                                        "quantity": ""
                                    })
                                    logging.info(f"Extracted string ingredient: {ing}")
                        
                        # Recursively check all nested objects
                        for key, value in obj.items():
                            if isinstance(value, (dict, list)):
                                found_ingredients.extend(scan_for_ingredients(value, depth + 1, f"{path}.{key}"))
                    
                    return found_ingredients
                
                # Try to extract using direct scan
                direct_ingredients = scan_for_ingredients(menu_data)
                
                if direct_ingredients:
                    logging.info(f"Direct scan found {len(direct_ingredients)} ingredients")
                    grocery_list = direct_ingredients
                else:
                    # If menu_data didn't work, try scanning the whole menu object
                    logging.info("Trying to scan entire menu object")
                    direct_ingredients = scan_for_ingredients(menu)
                    if direct_ingredients:
                        logging.info(f"Full menu scan found {len(direct_ingredients)} ingredients")
                        grocery_list = direct_ingredients
            except Exception as scan_error:
                logging.error(f"Error during direct scan: {str(scan_error)}")
                # If all attempts fail, at least return an empty list
                grocery_list = []
        
        # Make sure grocery_list isn't None
        if grocery_list is None:
            grocery_list = []
            
        # Ensure all items have proper format
        formatted_grocery_list = []
        for item in grocery_list:
            if isinstance(item, dict) and 'name' in item:
                # Already in correct format
                formatted_grocery_list.append(item)
            elif isinstance(item, str):
                # Convert string to object format
                formatted_grocery_list.append({
                    "name": item,
                    "quantity": ""
                })
            else:
                # Try to extract name from unknown format
                try:
                    name = str(item)
                    formatted_grocery_list.append({
                        "name": name,
                        "quantity": ""
                    })
                except:
                    # Skip invalid items
                    continue
        
        # Log the final grocery list
        grocery_item_count = len(formatted_grocery_list)
        logging.info(f"Generated grocery list with {grocery_item_count} items for menu {menu_id}")
        
        # Log a sample of items for debugging
        if formatted_grocery_list:
            sample_size = min(5, len(formatted_grocery_list))
            sample = formatted_grocery_list[:sample_size]
            logging.info(f"Sample of grocery list items: {sample}")
        
        return {"menu_id": menu_id, "groceryList": formatted_grocery_list}

    finally:
        cursor.close()
        conn.close()

@router.post("/{menu_id}/add-to-cart")
def add_grocery_list_to_cart(
    menu_id: int,
    store: str = Query(..., description="Choose 'walmart', 'kroger', or 'mixed'"),
    user_token: str = Query(None, description="User token for Walmart or Kroger (if required)"),
):
    """Add menu items to a store cart"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("SELECT meal_plan_json FROM menus WHERE id = %s;", (menu_id,))
        menu = cursor.fetchone()
        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found.")

        grocery_list = aggregate_grocery_list(menu["meal_plan_json"])
        added_items = []

        for item in grocery_list:
            item_name = item["name"]
            quantity = item["quantity"] or 1

            if store == "walmart":
                result = add_to_walmart_cart(user_token, item_name, quantity)
            elif store == "kroger":
                result = add_to_kroger_cart(user_token, item_name, quantity)
            elif store == "mixed":
                # For mixed store selection, return pending status for frontend handling
                result = {
                    "store": "User Choice Required",
                    "item": item_name,
                    "status": "pending"
                }
            else:
                raise HTTPException(status_code=400, detail="Invalid store selection.")

            added_items.append(result)

        return {
            "message": "Items added to cart",
            "addedItems": added_items
        }

    finally:
        cursor.close()
        conn.close()

@router.get("/latest/{user_id}/grocery-list")
def get_latest_grocery_list(user_id: int):
    """Get grocery list for user's latest menu"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        cursor.execute("""
            SELECT id, meal_plan_json
            FROM menus
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 1;
        """, (user_id,))

        menu = cursor.fetchone()
        if not menu:
            raise HTTPException(status_code=404, detail="No menu found for this user.")

        # Generate grocery list from the latest menu
        grocery_list = aggregate_grocery_list(menu["meal_plan_json"])

        return {
            "menu_id": menu["id"],
            "groceryList": grocery_list
        }

    finally:
        cursor.close()
        conn.close()


@router.get("/{menu_id}")
def get_menu_details(
    menu_id: int, 
    user_id: int = Query(None)
):
    """Retrieve full menu details for a specific menu"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the full menu details
            cur.execute("""
                SELECT 
                    id AS menu_id, 
                    meal_plan_json, 
                    user_id, 
                    created_at, 
                    nickname
                FROM menus 
                WHERE id = %s
            """, (menu_id,))
            menu = cur.fetchone()
        
        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found")
        
        # Track that user viewed this menu if user_id provided
        if user_id:
            track_recipe_interaction(user_id, menu_id, "viewed")
            
            # Check if menu is saved by this user
            menu['is_saved'] = is_recipe_saved(user_id, menu_id)
            
            # If the menu has recipe-level data, check each recipe
            # Parse the meal plan JSON
            menu['meal_plan'] = json.loads(menu['meal_plan_json']) if isinstance(menu['meal_plan_json'], str) else menu['meal_plan_json']
            
            # Check saved status for each recipe in the meal plan
            if 'days' in menu['meal_plan']:
                for day in menu['meal_plan']['days']:
                    day_number = day.get('dayNumber')
                    
                    if 'meals' in day:
                        for meal in day['meals']:
                            meal_time = meal.get('meal_time')
                            recipe_id = meal.get('id')  # If your recipes have IDs
                            
                            if recipe_id:
                                meal['is_saved'] = is_recipe_saved(
                                    user_id, 
                                    menu_id, 
                                    recipe_id=recipe_id, 
                                    meal_time=meal_time
                                )
        else:
            # Ensure meal_plan_json is parsed
            menu['meal_plan'] = json.loads(menu['meal_plan_json']) if isinstance(menu['meal_plan_json'], str) else menu['meal_plan_json']
        
        return menu
    except Exception as e:
        logger.error(f"Error retrieving menu details: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


@router.get("/shared")
async def get_shared_menus(user_id: int = Query(...)):
    """Get menus shared with the current user"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                m.id as menu_id, 
                m.meal_plan_json, 
                m.user_id, 
                m.created_at, 
                m.nickname,
                sm.permission_level,
                up.name as shared_by_name
            FROM menus m
            JOIN shared_menus sm ON m.id = sm.menu_id
            JOIN user_profiles up ON m.user_id = up.id
            WHERE sm.shared_with = %s
            ORDER BY m.created_at DESC
        """, (user_id,))
        
        shared_menus = cursor.fetchall()
        return shared_menus
        
    except Exception as e:
        logger.error(f"Error fetching shared menus: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


@router.get("/shared/{user_id}")
async def get_shared_menus(user_id: int):
    """Get menus shared with the current user"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First check if the shared_menus table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'shared_menus'
            )
        """)
        
        table_exists = cursor.fetchone()
        
        if not table_exists or not table_exists['exists']:
            logger.warning("shared_menus table does not exist")
            # Create the shared_menus table if it doesn't exist
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS shared_menus (
                    id SERIAL PRIMARY KEY,
                    menu_id INTEGER NOT NULL,
                    shared_with INTEGER NOT NULL,
                    created_by INTEGER NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    organization_id INTEGER,
                    permission_level VARCHAR(20) DEFAULT 'read'
                )
            """)
            conn.commit()
            return []
        
        # If the table exists, proceed with fetching shared menus
        cursor.execute("""
            SELECT 
                m.id as menu_id, 
                m.meal_plan_json, 
                m.user_id, 
                m.created_at::TEXT as created_at, 
                m.nickname,
                sm.permission_level,
                up.name as shared_by_name
            FROM menus m
            JOIN shared_menus sm ON m.id = sm.menu_id
            JOIN user_profiles up ON m.user_id = up.id
            WHERE sm.shared_with = %s
            ORDER BY m.created_at DESC
        """, (user_id,))
        
        shared_menus = cursor.fetchall()
        logger.info(f"Found {len(shared_menus)} shared menus for user {user_id}")
        
        # Convert datetime objects to strings for JSON serialization
        for menu in shared_menus:
            if 'created_at' in menu and not isinstance(menu['created_at'], str):
                menu['created_at'] = menu['created_at'].isoformat()
        
        return shared_menus
        
    except Exception as e:
        logger.error(f"Error fetching shared menus: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching shared menus: {str(e)}")
    finally:
        conn.close()

# New endpoint for client menus
@router.get("/client/{client_id}")
async def get_client_menus(
    client_id: int,
    user=Depends(get_user_from_token)
):
    """Get menus for a specific client"""
    # Check if user is organization owner or the client themselves
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    
    if user_id != client_id and user.get('role') != 'owner':
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to view this client's menus"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # If user is organization owner, get menus they created for this client
            if user.get('role') == 'owner':
                cur.execute("""
                    SELECT 
                        m.id as menu_id, 
                        m.created_at,
                        m.nickname,
                        m.user_id,
                        (SELECT count(*) FROM jsonb_array_elements(
                            CASE 
                                WHEN jsonb_typeof(m.meal_plan_json->'days') = 'array' 
                                THEN m.meal_plan_json->'days' 
                                ELSE '[]'::jsonb 
                            END
                        )) as days_count
                    FROM menus m
                    LEFT JOIN shared_menus sm ON m.id = sm.menu_id
                    WHERE sm.shared_with = %s OR m.user_id = %s
                    ORDER BY m.created_at DESC
                """, (client_id, user_id))
            else:
                # If user is the client, get menus shared with them
                # First check if the shared_menus table exists
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_name = 'shared_menus'
                    )
                """)
                
                table_exists = cur.fetchone()
                
                if table_exists and table_exists['exists']:
                    # If the shared_menus table exists, use it to find shared menus
                    cur.execute("""
                        SELECT 
                            m.id as menu_id, 
                            m.created_at,
                            m.nickname,
                            m.user_id,
                            (SELECT count(*) FROM jsonb_array_elements(
                                CASE 
                                    WHEN jsonb_typeof(m.meal_plan_json->'days') = 'array' 
                                    THEN m.meal_plan_json->'days' 
                                    ELSE '[]'::jsonb 
                                END
                            )) as days_count,
                            up.name as shared_by_name,
                            sm.permission_level
                        FROM menus m
                        JOIN shared_menus sm ON m.id = sm.menu_id
                        JOIN user_profiles up ON m.user_id = up.id
                        WHERE sm.shared_with = %s
                        ORDER BY m.created_at DESC
                    """, (client_id,))
                else:
                    # If the table doesn't exist, log a warning and return an empty result
                    logger.warning("shared_menus table does not exist")
                    cur.execute("SELECT 1 as menu_id LIMIT 0")  # Empty result
            
            menus = cur.fetchall()
            return menus
    finally:
        conn.close()

@router.post("/share/{menu_id}/client/{client_id}")
async def share_menu_with_client(
    menu_id: int,
    client_id: int,
    data: dict = Body(default={}),
    user = Depends(get_user_from_token)
):
    """Share a menu with a specific client"""
    try:
        user_id = user.get('user_id')
        role = user.get('role', '')
        org_id = user.get('organization_id')
        
        # Only organization owners can share menus
        if role != 'owner':
            raise HTTPException(
                status_code=403, 
                detail="Only organization owners can share menus"
            )
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # First check if the menu exists and belongs to this user
            cursor.execute("""
                SELECT id, user_id
                FROM menus 
                WHERE id = %s
            """, (menu_id,))
            
            menu = cursor.fetchone()
            
            if not menu:
                raise HTTPException(status_code=404, detail="Menu not found")
                
            if menu["user_id"] != user_id:
                raise HTTPException(
                    status_code=403, 
                    detail="You can only share menus that you own"
                )
            
            # Check if the client belongs to this organization
            cursor.execute("""
                SELECT id 
                FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s AND status = 'active'
            """, (org_id, client_id))
            
            client_record = cursor.fetchone()
            if not client_record:
                raise HTTPException(
                    status_code=404, 
                    detail="Client not found or not active in your organization"
                )
            
            # Check if shared_menus table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'shared_menus'
                )
            """)
            
            table_exists = cursor.fetchone()
            
            if not table_exists or not table_exists['exists']:
                # Create the shared_menus table if it doesn't exist
                logger.warning("Creating shared_menus table on-the-fly")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shared_menus (
                        id SERIAL PRIMARY KEY,
                        menu_id INTEGER NOT NULL,
                        shared_with INTEGER NOT NULL,
                        created_by INTEGER NOT NULL,
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        organization_id INTEGER,
                        permission_level VARCHAR(20) DEFAULT 'read'
                    )
                """)
                conn.commit()
                
                # Create indexes
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_shared_menus_menu_id 
                    ON shared_menus(menu_id)
                """)
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_shared_menus_shared_with 
                    ON shared_menus(shared_with)
                """)
                conn.commit()
            
            # Process data parameter - handle both old and new API styles
            shared = data.get('shared', True)
            if data.get('shared') is False:
                # If shared parameter is explicitly set to False, we'll remove any sharing
                remove_sharing = True
            else:
                remove_sharing = False
                
            # Get permission level from request data
            permission_level = data.get('permission_level', 'read')
            message = data.get('message', None)
                
            logger.info(f"Share menu request data: permission={permission_level}, message={message}, shared={shared}")
            
            # Check which version of shared_menus table we have
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'shared_menus' 
                AND column_name IN ('shared_with', 'client_id')
            """)
            
            columns = cursor.fetchall()
            column_names = [col['column_name'] for col in columns]
            
            # Determine which field names to use based on which columns exist
            client_field = 'client_id' if 'client_id' in column_names else 'shared_with'
            
            # Check if the menu is already shared with this client
            cursor.execute(f"""
                SELECT id FROM shared_menus 
                WHERE menu_id = %s AND {client_field} = %s
            """, (menu_id, client_id))
            
            existing_share = cursor.fetchone()
            
            if existing_share and remove_sharing:
                # Menu is already shared with this client - remove sharing
                cursor.execute("""
                    DELETE FROM shared_menus 
                    WHERE id = %s
                    RETURNING id
                """, (existing_share["id"],))
                conn.commit()
                
                return {
                    "menu_id": menu_id,
                    "client_id": client_id,
                    "shared": False,
                    "message": "Menu sharing removed"
                }
            elif existing_share:
                # Menu is already shared - update the permission level
                update_query = """
                    UPDATE shared_menus 
                    SET permission_level = %s
                """
                
                # Add message field if the parameter is provided
                if message is not None:
                    update_query += ", message = %s"
                    update_params = [permission_level, message, existing_share["id"]]
                else:
                    update_params = [permission_level, existing_share["id"]]
                    
                # Also update is_active if column exists
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'shared_menus' 
                    AND column_name = 'is_active'
                """)
                has_is_active = cursor.fetchone() is not None
                
                if has_is_active:
                    update_query += ", is_active = TRUE"
                    
                update_query += " WHERE id = %s RETURNING id"
                
                cursor.execute(update_query, update_params)
                conn.commit()
                
                return {
                    "menu_id": menu_id,
                    "client_id": client_id,
                    "permission_level": permission_level,
                    "shared": True,
                    "message": "Menu sharing updated"
                }
            else:
                # Share the menu with this client - check which version of the table we have
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'shared_menus'
                """)
                columns = [col['column_name'] for col in cursor.fetchall()]
                
                # Prepare the query based on the available columns
                insert_columns = [client_field, 'menu_id', 'organization_id']
                insert_values = [client_id, menu_id, org_id]
                
                if 'created_by' in columns:
                    insert_columns.append('created_by')
                    insert_values.append(user_id)
                    
                if 'permission_level' in columns:
                    insert_columns.append('permission_level')
                    insert_values.append(permission_level)
                    
                if 'message' in columns and message is not None:
                    insert_columns.append('message')
                    insert_values.append(message)
                    
                if 'is_active' in columns:
                    insert_columns.append('is_active')
                    insert_values.append(True)
                    
                # Build the INSERT query dynamically
                placeholders = ', '.join(['%s' for _ in insert_values])
                column_str = ', '.join(insert_columns)
                
                cursor.execute(f"""
                    INSERT INTO shared_menus ({column_str}) 
                    VALUES ({placeholders})
                    RETURNING id
                """, insert_values)
                conn.commit()
                
                # Get client name for the response
                cursor.execute("""
                    SELECT name FROM user_profiles WHERE id = %s
                """, (client_id,))
                client_name = cursor.fetchone()
                
                return {
                    "menu_id": menu_id,
                    "client_id": client_id,
                    "client_name": client_name['name'] if client_name else f"Client {client_id}",
                    "shared": True,
                    "message": "Menu shared successfully"
                }
                
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error sharing menu with client: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/for-client/{client_id}")
async def get_menus_for_client(
    client_id: int,
    user = Depends(get_user_from_token)
):
    """Get all menus created for a client by the organization and their sharing status"""
    try:
        # Only organization owners can access this endpoint
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        role = user.get('role', '')
        
        if role != 'owner':
            raise HTTPException(
                status_code=403, 
                detail="Only organization owners can access this endpoint"
            )
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # Check if the client belongs to this organization
            cursor.execute("""
                SELECT id 
                FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s
            """, (org_id, client_id))
            
            if not cursor.fetchone():
                raise HTTPException(
                    status_code=404, 
                    detail="Client not found in your organization"
                )
            
            # Get all menus created for this client by the organization owner
            cursor.execute("""
                SELECT 
                    m.id as menu_id, 
                    m.meal_plan_json, 
                    m.created_at::TEXT AS created_at,
                    COALESCE(m.nickname, '') AS nickname,
                    m.user_id as owner_id,
                    up.name as owner_name,
                    (
                        SELECT EXISTS(
                            SELECT 1 FROM shared_menus sm 
                            WHERE sm.menu_id = m.id AND sm.shared_with = %s
                        )
                    ) as is_shared,
                    (
                        SELECT sm.created_at::TEXT FROM shared_menus sm 
                        WHERE sm.menu_id = m.id AND sm.shared_with = %s
                        LIMIT 1
                    ) as shared_at
                FROM menus m
                JOIN user_profiles up ON m.user_id = up.id
                WHERE m.user_id = %s
                  AND m.for_client_id = %s
                ORDER BY m.created_at DESC;
            """, (client_id, client_id, user_id, client_id))
            
            menus = cursor.fetchall()
            
            return {
                "menus": [
                    {
                        "menu_id": m["menu_id"], 
                        "meal_plan": m["meal_plan_json"], 
                        "created_at": m["created_at"],
                        "shared_at": m["shared_at"],
                        "nickname": m["nickname"],
                        "is_shared": m["is_shared"],
                        "owner": {
                            "id": m["owner_id"],
                            "name": m["owner_name"]
                        }
                    } 
                    for m in menus
                ]
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error getting menus for client: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-for-client/{client_id}")
async def generate_meal_plan_for_client(
    client_id: int,
    req: GenerateMealPlanRequest,
    user = Depends(get_user_from_token)
):
    """Generate a meal plan for a specific client using their preferences"""
    try:
        # Verify user is an organization owner
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        role = user.get('role', '')
        
        if role != 'owner':
            raise HTTPException(
                status_code=403, 
                detail="Only organization owners can generate menus for clients"
            )
        
        # Verify client belongs to this organization
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            cursor.execute("""
                SELECT id 
                FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s AND status = 'active'
            """, (org_id, client_id))
            
            client_record = cursor.fetchone()
            if not client_record:
                raise HTTPException(
                    status_code=404, 
                    detail="Client not found or not active in your organization"
                )
                
            # Set the client_id in the request
            req.for_client_id = client_id
            req.user_id = user_id
            
            # Call the existing meal plan generation function
            return generate_meal_plan_variety(req)
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error generating menu for client: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-and-share/{client_id}")
async def generate_and_share_menu(
    client_id: int,
    req: GenerateMealPlanRequest,
    user = Depends(get_user_from_token)
):
    """Generate a meal plan for a client and immediately share it with them"""
    try:
        # Call the generate_meal_plan_for_client function
        result = await generate_meal_plan_for_client(client_id, req, user)
        
        # Get the menu_id from the result
        menu_id = result.get("menu_id")
        
        # Now share this menu with the client automatically
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # First check if shared_menus table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'shared_menus'
                )
            """)
            
            table_exists = cursor.fetchone()
            
            if not table_exists or not table_exists['exists']:
                # Create the shared_menus table if it doesn't exist
                logger.warning("Creating shared_menus table on-the-fly")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shared_menus (
                        id SERIAL PRIMARY KEY,
                        menu_id INTEGER NOT NULL,
                        client_id INTEGER NOT NULL,
                        organization_id INTEGER NOT NULL,
                        permission_level VARCHAR(20) DEFAULT 'read',
                        shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        is_active BOOLEAN DEFAULT TRUE,
                        message TEXT
                    )
                """)
                conn.commit()
            
            # Check which columns exist in shared_menus table
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'shared_menus'
            """)
            columns = [col['column_name'] for col in cursor.fetchall()]
            
            # Prepare the query based on available columns
            insert_columns = ['menu_id', 'organization_id', 'permission_level']
            insert_values = [menu_id, org_id, 'read']
            
            # Use client_id if available, otherwise use shared_with
            if 'client_id' in columns:
                insert_columns.append('client_id')
                insert_values.append(client_id)
            else:
                insert_columns.append('shared_with')
                insert_values.append(client_id)
            
            if 'created_by' in columns:
                insert_columns.append('created_by')
                insert_values.append(user_id)
                
            if 'is_active' in columns:
                insert_columns.append('is_active')
                insert_values.append(True)
                
            if 'message' in columns:
                insert_columns.append('message')
                insert_values.append(f'Menu created and shared by {user.get("name", "your nutrition coach")}')
            
            # Build the INSERT query dynamically
            placeholders = ', '.join(['%s' for _ in insert_values])
            column_str = ', '.join(insert_columns)
            
            cursor.execute(f"""
                INSERT INTO shared_menus ({column_str}) 
                VALUES ({placeholders})
                RETURNING id
            """, insert_values)
            conn.commit()
            
            return {
                "menu_id": menu_id,
                "client_id": client_id,
                "meal_plan": result.get("meal_plan"),
                "shared": True,
                "message": "Menu generated and shared successfully"
            }
                
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error generating and sharing menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/{menu_id}/sharing")
async def get_menu_sharing_details(
    menu_id: int,
    user = Depends(get_user_from_token)
):
    """Get details about who a menu is shared with"""
    try:
        # Verify user owns the menu
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        role = user.get('role', '')
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # First check if user owns the menu or has it shared with them
            if role == 'owner':
                cursor.execute("""
                    SELECT id FROM menus 
                    WHERE id = %s AND user_id = %s
                """, (menu_id, user_id))
                
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=403,
                        detail="You can only view sharing details for menus you own"
                    )
                    
                # Get all clients the menu is shared with
                cursor.execute("""
                    SELECT 
                        sm.id,
                        sm.shared_with AS client_id,
                        sm.created_at AS shared_at,
                        up.name AS client_name,
                        COALESCE(sm.permission_level, 'read') AS permission_level
                    FROM shared_menus sm
                    JOIN user_profiles up ON sm.shared_with = up.id
                    WHERE sm.menu_id = %s
                    ORDER BY sm.created_at DESC
                """, (menu_id,))
                
                shared_with = cursor.fetchall()
                
                return {
                    "menu_id": menu_id,
                    "shared_with": shared_with
                }
                
            else:  # Client
                # Check if the menu is shared with this client
                cursor.execute("""
                    SELECT id FROM shared_menus 
                    WHERE menu_id = %s AND shared_with = %s
                """, (menu_id, user_id))
                
                if not cursor.fetchone():
                    raise HTTPException(
                        status_code=403,
                        detail="You don't have access to this menu's sharing details"
                    )
                
                # For clients, only show that the menu is shared with them
                cursor.execute("""
                    SELECT 
                        sm.id,
                        sm.shared_with AS client_id,
                        sm.created_at AS shared_at,
                        up.name AS client_name,
                        COALESCE(sm.permission_level, 'read') AS permission_level
                    FROM shared_menus sm
                    JOIN user_profiles up ON sm.shared_with = up.id
                    WHERE sm.menu_id = %s AND sm.shared_with = %s
                """, (menu_id, user_id))
                
                shared_with = cursor.fetchall()
                
                return {
                    "menu_id": menu_id,
                    "shared_with": shared_with
                }
                
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error getting menu sharing details: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/share/{menu_id}/client/{client_id}")
async def share_menu_with_client(
    menu_id: int,
    client_id: int,
    permission_level: str = "read",
    user = Depends(get_user_from_token)
):
    """Share a menu with a specific client"""
    try:
        # Verify user owns the menu
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        role = user.get('role', '')
        
        if role != 'owner':
            raise HTTPException(
                status_code=403, 
                detail="Only organization owners can share menus with clients"
            )
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        try:
            # First verify menu exists and belongs to the user
            cursor.execute("""
                SELECT id FROM menus 
                WHERE id = %s AND user_id = %s
            """, (menu_id, user_id))
            
            menu = cursor.fetchone()
            if not menu:
                raise HTTPException(
                    status_code=404,
                    detail="Menu not found or you don't have permission to share it"
                )
            
            # Verify client exists and belongs to this organization
            cursor.execute("""
                SELECT id 
                FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s AND status = 'active'
            """, (org_id, client_id))
            
            client = cursor.fetchone()
            if not client:
                raise HTTPException(
                    status_code=404,
                    detail="Client not found or not active in your organization"
                )
            
            # Check if menu is already shared with this client
            cursor.execute("""
                SELECT id FROM shared_menus 
                WHERE menu_id = %s AND shared_with = %s
            """, (menu_id, client_id))
            
            existing_share = cursor.fetchone()
            
            if existing_share:
                # Update existing share
                cursor.execute("""
                    UPDATE shared_menus 
                    SET permission_level = %s,
                        created_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (permission_level, existing_share['id']))
                
                share_id = cursor.fetchone()['id']
                message = "Menu sharing updated successfully"
            else:
                # Create new share
                cursor.execute("""
                    INSERT INTO shared_menus (menu_id, shared_with, created_by, organization_id, permission_level) 
                    VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (menu_id, client_id, user_id, org_id, permission_level))
                
                share_id = cursor.fetchone()['id']
                message = "Menu shared successfully"
            
            conn.commit()
            
            return {
                "share_id": share_id,
                "menu_id": menu_id,
                "client_id": client_id,
                "message": message
            }
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error sharing menu with client: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/share/{share_id}")
async def unshare_menu(
    share_id: int,
    user = Depends(get_user_from_token)
):
    """Remove menu sharing"""
    try:
        # Verify user has permission
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        role = user.get('role', '')

        if role != 'owner':
            raise HTTPException(
                status_code=403,
                detail="Only organization owners can unshare menus"
            )

        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        try:
            # Get the share record with menu details
            cursor.execute("""
                SELECT sm.*, m.user_id as menu_owner_id
                FROM shared_menus sm
                JOIN menus m ON sm.menu_id = m.id
                WHERE sm.id = %s
            """, (share_id,))

            share = cursor.fetchone()

            if not share:
                raise HTTPException(
                    status_code=404,
                    detail="Share record not found"
                )

            # Check if user owns the menu or is from the same organization
            if share['menu_owner_id'] != user_id and share['organization_id'] != org_id:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to remove this share"
                )

            # Delete the share
            cursor.execute("""
                DELETE FROM shared_menus
                WHERE id = %s
                RETURNING id
            """, (share_id,))

            deleted = cursor.fetchone()

            if not deleted:
                raise HTTPException(
                    status_code=404,
                    detail="Share record not found"
                )

            conn.commit()

            return {
                "message": "Menu share removed successfully"
            }

        finally:
            cursor.close()
            conn.close()

    except Exception as e:
        logger.error(f"Error unsharing menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# @router.get("/{menu_id}/meal-shopping-lists")
# async def get_meal_shopping_lists(menu_id: int):
    """
    Get shopping lists organized by individual meals for a specific menu
    """
    # Retrieve the menu using the correct crud function
    menu = menu_crud.get_menu_by_id(menu_id)
    if not menu:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Menu with ID {menu_id} not found"
        )

    # Get menu data
    menu_data = menu.get("meal_plan_dict", {})

    # Initialize result
    result = {
        "title": f"Menu {menu_id}",
        "meal_lists": []
    }

    # Process menu plan data if available
    if menu_data and "days" in menu_data and isinstance(menu_data["days"], list):
        # Process each day
        for day_index, day in enumerate(menu_data["days"]):
            # Process meals
            if "meals" in day and isinstance(day["meals"], list):
                for meal_index, meal in enumerate(day["meals"]):
                    # Extract meal details
                    meal_data = {
                        "day_index": day_index,
                        "day": day.get("day_number", day_index + 1),
                        "meal_index": meal_index,
                        "title": meal.get("title", f"Meal {meal_index + 1}"),
                        "meal_time": meal.get("meal_time", ""),
                        "servings": meal.get("servings", 0),
                        "is_snack": False,
                        "ingredients": []
                    }

                    # Process ingredients for this meal
                    if "ingredients" in meal and isinstance(meal["ingredients"], list):
                        for ingredient in meal["ingredients"]:
                            if isinstance(ingredient, dict) and "name" in ingredient:
                                ing_entry = {
                                    "name": ingredient["name"].capitalize(),
                                    "quantity": ingredient.get("quantity", "")
                                }
                                meal_data["ingredients"].append(ing_entry)

                    # Add to result if it has ingredients
                    if meal_data["ingredients"]:
                        result["meal_lists"].append(meal_data)

            # Process snacks
            if "snacks" in day and isinstance(day["snacks"], list):
                for snack_index, snack in enumerate(day["snacks"]):
                    # Extract snack details
                    snack_data = {
                        "day_index": day_index,
                        "day": day.get("day_number", day_index + 1),
                        "meal_index": snack_index,
                        "title": snack.get("title", f"Snack {snack_index + 1}"),
                        "meal_time": "Snack",
                        "servings": snack.get("servings", 0),
                        "is_snack": True,
                        "ingredients": []
                    }

                    # Process ingredients for this snack
                    if "ingredients" in snack and isinstance(snack["ingredients"], list):
                        for ingredient in snack["ingredients"]:
                            if isinstance(ingredient, dict) and "name" in ingredient:
                                ing_entry = {
                                    "name": ingredient["name"].capitalize(),
                                    "quantity": ingredient.get("quantity", "")
                                }
                                snack_data["ingredients"].append(ing_entry)

                    # Add to result if it has ingredients
                    if snack_data["ingredients"]:
                        result["meal_lists"].append(snack_data)

    return result