import json
import time
import re
import os
import asyncio
import uuid
from typing import List, Optional, Dict, Any, Set
from datetime import datetime
from fastapi import APIRouter, HTTPException, Query, Body, Depends, status, BackgroundTasks
import openai

# Feature flag for optimized generation method
USE_OPTIMIZED_GENERATION = False  # TEMPORARY: Disabled due to token limit issues - single request too large
from psycopg2.extras import RealDictCursor
# Use the enhanced DB with specialized connection pools
from ..db_enhanced_actual import get_db_connection, get_db_cursor
from ..db_enhanced_actual import _connection_stats, _stats_lock, log_connection_stats
from ..config import OPENAI_API_KEY
from ..models.user import GenerateMealPlanRequest
from ..models.menus import SaveMenuRequest
from pydantic import BaseModel
from ..crud import menu_crud
import threading
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

# Concurrency control - increased limit for better user experience
MAX_CONCURRENT_GENERATIONS = 10  # Increased from 3 to allow more concurrent users
generation_semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)

# Track menu generations by user to prevent duplicates
active_user_generations = {}
user_generation_lock = threading.Lock()

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
    
    # Check time constraints with 25% deadband buffer for flexibility
    if time_constraints:
        DEADBAND_MULTIPLIER = 1.25  # 25% tolerance buffer - reduces validation failures
        
        for meal in day_json.get("meals", []):
            meal_time = meal.get("meal_time", "").lower()
            instructions = meal.get("instructions", [])
            ingredient_count = len(meal.get("ingredients", []))
            
            # Improved time estimation (reduced from 5 to 3.5 minutes per instruction)
            instruction_time = len(instructions) * 3.5
            ingredient_prep_time = ingredient_count * 1.5  # 1.5 min per ingredient for prep
            estimated_time = int(instruction_time + ingredient_prep_time)
            
            # Check both weekday and weekend constraints
            weekday_constraint = f"weekday-{meal_time}"
            weekend_constraint = f"weekend-{meal_time}"
            
            # Check weekday constraint with deadband
            if weekday_constraint in time_constraints:
                max_time = time_constraints[weekday_constraint]
                max_time_with_deadband = max_time * DEADBAND_MULTIPLIER
                
                if estimated_time > max_time_with_deadband:
                    issues.append(f"Meal '{meal.get('title')}' exceeds weekday time limit: {estimated_time}min > {max_time}min (+25% buffer = {int(max_time_with_deadband)}min)")
                elif estimated_time > max_time:
                    # Within deadband - log info but don't fail validation
                    logger.info(f"Meal '{meal.get('title')}' slightly over weekday target but within deadband: {estimated_time}min vs {max_time}min target")
            
            # Check weekend constraint with deadband
            if weekend_constraint in time_constraints:
                max_time = time_constraints[weekend_constraint]
                max_time_with_deadband = max_time * DEADBAND_MULTIPLIER
                
                if estimated_time > max_time_with_deadband:
                    issues.append(f"Meal '{meal.get('title')}' exceeds weekend time limit: {estimated_time}min > {max_time}min (+25% buffer = {int(max_time_with_deadband)}min)")
                elif estimated_time > max_time:
                    # Within deadband - log info but don't fail validation
                    logger.info(f"Meal '{meal.get('title')}' slightly over weekend target but within deadband: {estimated_time}min vs {max_time}min target")
    
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

# In-memory status tracking to reduce database connections during generation
_job_status_cache = {}
_status_cache_lock = threading.Lock()

def batch_update_job_status(job_id: str, status_data: dict, force_db_update: bool = False):
    """
    Batch status updates to reduce database connections during menu generation.
    Only writes to database for critical milestones or when forced.
    
    Args:
        job_id: The job identifier
        status_data: Dictionary containing status information
        force_db_update: If True, forces a database write regardless of status
    """
    critical_statuses = {'started', 'completed', 'failed'}
    is_critical = status_data.get('status') in critical_statuses
    
    # Always update in-memory cache
    with _status_cache_lock:
        if job_id not in _job_status_cache:
            _job_status_cache[job_id] = {}
        _job_status_cache[job_id].update(status_data)
        _job_status_cache[job_id]['last_updated'] = datetime.utcnow()
    
    # Only write to database for critical statuses or forced updates
    if is_critical or force_db_update:
        update_job_status(job_id, status_data)
        logger.info(f"Status update written to DB for {job_id}: {status_data.get('status')}")
    else:
        logger.debug(f"Status cached for {job_id}: {status_data.get('status')} (DB write skipped)")

def get_cached_job_status(job_id: str) -> Optional[dict]:
    """Get job status from cache first, fallback to database"""
    with _status_cache_lock:
        if job_id in _job_status_cache:
            return _job_status_cache[job_id].copy()
    
    # Fallback to database
    return get_job_status_from_database(job_id)

def cleanup_job_cache(job_id: str):
    """Clean up job from cache when completed"""
    with _status_cache_lock:
        _job_status_cache.pop(job_id, None)

# Background Job Management Functions
def save_job_status(job_id: str, status_data: dict):
    """Save job status to database with minimal connection time and update cache"""
    try:
        # First, update the cache to ensure immediate availability
        with _status_cache_lock:
            if job_id not in _job_status_cache:
                _job_status_cache[job_id] = {}
            _job_status_cache[job_id].update(status_data)
            _job_status_cache[job_id]['last_updated'] = datetime.utcnow()
            _job_status_cache[job_id]['created_at'] = datetime.utcnow()
        
        # Then save to database
        with get_db_cursor() as (cursor, conn):
            # Enable autocommit for faster operations
            conn.autocommit = True
            
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

            # No commit needed with autocommit=True
            logger.info(f"Saved job status for {job_id}: {status_data.get('status')} ({status_data.get('progress')}%) to both cache and DB")

    except Exception as e:
        logger.error(f"Failed to save job status for {job_id}: {str(e)}")
        # No rollback needed with autocommit=True

def update_job_status(job_id: str, status_data: dict):
    """Update existing job status with minimal connection usage"""
    # Only open a connection when absolutely necessary, minimize connection time
    try:
        with get_db_cursor() as (cursor, conn):
            # Enable autocommit to reduce transaction time
            conn.autocommit = True
            
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
                # No commit needed with autocommit=True
                logger.info(f"Updated job {job_id}: {status_data.get('status')} ({status_data.get('progress')}%)")

    except Exception as e:
        logger.error(f"Failed to update job status for {job_id}: {str(e)}")
        # No rollback needed with autocommit=True

def get_job_status_from_database(job_id: str) -> Optional[dict]:
    """Retrieve job status from database with minimal connection time"""
    try:
        with get_db_cursor(dict_cursor=True) as (cursor, conn):
            # Enable autocommit for faster read operations
            conn.autocommit = True
            
            cursor.execute("""
                SELECT job_id, user_id, client_id, status, progress, message,
                       result_data, error_message, created_at, updated_at
                FROM menu_generation_jobs
                WHERE job_id = %s
            """, (job_id,))

            row = cursor.fetchone()

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

def generate_meal_plan_single_request(req: GenerateMealPlanRequest, job_id: str = None):
    """Generate entire meal plan in one OpenAI call with self-validation - NEW OPTIMIZED APPROACH"""
    try:
        import threading
        import time
        
        generation_start_time = time.time()
        MAX_GENERATION_TIME = 300  # 5 minutes maximum for single request
        
        current_thread = threading.current_thread()
        logger.info(f"SINGLE_REQUEST_DEBUG: Starting optimized single-request generation on thread: {current_thread.name}")
        logger.info(f"Job ID: {job_id}, User ID: {req.user_id}, Duration: {req.duration_days} days")
        
        if req.duration_days < 1 or req.duration_days > 7:
            raise HTTPException(400, "duration_days must be between 1 and 7")

        # PHASE 1: Fetch user preferences once
        user_row = None
        preference_user_id = req.for_client_id if req.for_client_id else req.user_id

        with get_db_cursor(dict_cursor=True) as (cursor, conn):
            # Fetch user preferences
            cursor.execute("""
                SELECT recipe_type, macro_protein, macro_carbs, macro_fat, calorie_goal,
                       appliances, prep_complexity, servings_per_meal, meal_times,
                       dietary_restrictions, disliked_ingredients, snacks_per_day,
                       flavor_preferences, spice_level, recipe_type_preferences,
                       meal_time_preferences, time_constraints, prep_preferences
                FROM user_profiles WHERE id = %s
            """, (preference_user_id,))
            
            user_row = cursor.fetchone()
            if not user_row:
                raise HTTPException(404, f"User {preference_user_id} not found")

            # Fetch recent menu history to avoid repeats (last 14 menus)
            cursor.execute("""
                SELECT meal_plan_json, created_at, nickname
                FROM menus 
                WHERE user_id = %s OR for_client_id = %s
                ORDER BY created_at DESC 
                LIMIT 14
            """, (preference_user_id, preference_user_id))
            
            recent_menus = cursor.fetchall()

        # Extract user preferences (same logic as before)
        dietary_restrictions = user_row.get('dietary_restrictions', []) or []
        disliked_ingredients = user_row.get('disliked_ingredients', []) or []
        time_constraints = user_row.get('time_constraints', {}) or {}

        # Extract meal titles from recent menus to avoid repeats
        used_meal_titles = set()
        used_primary_ingredients = set()
        recent_menu_summaries = []
        
        for menu in recent_menus:
            try:
                meal_plan = menu['meal_plan_json']
                if isinstance(meal_plan, str):
                    meal_plan = json.loads(meal_plan)
                
                menu_summary = f"Menu from {menu['created_at'].strftime('%Y-%m-%d')}"
                if menu['nickname']:
                    menu_summary += f" ({menu['nickname']})"
                
                meal_titles_in_menu = []
                if isinstance(meal_plan, dict) and 'days' in meal_plan:
                    for day in meal_plan['days']:
                        if 'meals' in day:
                            for meal in day['meals']:
                                title = meal.get('title', '')
                                if title:
                                    used_meal_titles.add(title.lower())
                                    meal_titles_in_menu.append(title)
                                
                                # Extract primary ingredients
                                ingredients = meal.get('ingredients', [])
                                if ingredients and len(ingredients) > 0:
                                    primary_ingredient = ingredients[0].get('name', '') if isinstance(ingredients[0], dict) else str(ingredients[0])
                                    if primary_ingredient:
                                        used_primary_ingredients.add(primary_ingredient.lower())
                
                if meal_titles_in_menu:
                    menu_summary += f": {', '.join(meal_titles_in_menu[:3])}" + ("..." if len(meal_titles_in_menu) > 3 else "")
                    recent_menu_summaries.append(menu_summary)
                    
            except (json.JSONDecodeError, KeyError, TypeError) as e:
                logger.warning(f"Could not parse menu history: {e}")
                continue

        logger.info(f"Found {len(used_meal_titles)} meal titles and {len(used_primary_ingredients)} primary ingredients to avoid")
        
        # Create history context for OpenAI
        recent_history_text = ""
        if recent_menu_summaries:
            recent_history_text = "\n".join([f"- {summary}" for summary in recent_menu_summaries[:7]])  # Show last 7 menus
        else:
            recent_history_text = "- No previous menus found"
        
        # Build comprehensive system prompt for self-validation
        system_prompt = f"""You are an advanced meal planning assistant that creates complete, self-validated meal plans.

CRITICAL SELF-VALIDATION REQUIREMENTS - CHECK BEFORE RESPONDING:
1. Verify NO disliked ingredients are used: {', '.join(disliked_ingredients) if disliked_ingredients else 'None'}
2. Confirm ALL required meal times are included each day: {req.meal_times if hasattr(req, 'meal_times') else 'breakfast, lunch, dinner'}
3. Ensure NO meal titles repeat across the entire {req.duration_days}-day plan
4. AVOID all previously used meal titles: {', '.join(sorted(used_meal_titles)[:20]) if used_meal_titles else 'None'}{'...' if len(used_meal_titles) > 20 else ''}
5. AVOID reusing primary ingredients from recent menus: {', '.join(sorted(used_primary_ingredients)[:15]) if used_primary_ingredients else 'None'}{'...' if len(used_primary_ingredients) > 15 else ''}
6. Respect time constraints with 25% flexibility buffer
7. Follow all dietary restrictions: {', '.join(dietary_restrictions) if dietary_restrictions else 'None'}
8. If any issues found, automatically correct them before responding

VARIETY IS CRITICAL: Create completely new and different meals from the user's previous menus. Be creative and avoid repetition.

ONLY return a meal plan that passes ALL validation checks. Self-correct any issues during generation."""

        # Build comprehensive user prompt
        user_prompt = f"""Generate a complete {req.duration_days}-day meal plan that is self-validated and ready to use.

### User Requirements
- Servings per meal: {req.servings_per_meal}
- Dietary restrictions: {', '.join(dietary_restrictions) if dietary_restrictions else 'None'}
- Disliked ingredients: {', '.join(disliked_ingredients) if disliked_ingredients else 'None'} (NEVER use these)
- Time constraints: {time_constraints if time_constraints else 'No specific constraints'}
- Required meal times each day: {req.meal_times if hasattr(req, 'meal_times') else 'breakfast, lunch, dinner'}
- Snacks per day: {req.snacks_per_day}

### PREVIOUS MENU HISTORY (AVOID REPEATING THESE):
{recent_history_text}

### CRITICAL AVOIDANCE REQUIREMENTS:
- DO NOT repeat any meal titles from previous menus
- DO NOT reuse primary ingredients as main components
- CREATE COMPLETELY NEW AND DIFFERENT meals for maximum variety
- Be creative with cuisines, cooking methods, and ingredient combinations

### Quality Requirements
- Ensure variety: NO repeated meal titles across all {req.duration_days} days
- Include detailed cooking instructions for each meal
- Provide nutritional information per serving and per meal
- Respect all dietary restrictions and preferences
- Generate consolidated grocery list organized by store categories

### Response Format
Return a JSON object with this exact structure:
{{
    "meal_plan": {{
        "days": [
            {{
                "dayNumber": 1,
                "meals": [
                    {{
                        "meal_time": "breakfast",
                        "title": "Meal Name",
                        "ingredients": [
                            {{"name": "ingredient", "quantity": "amount", "calories": "X", "protein": "Xg", "carbs": "Xg", "fat": "Xg"}}
                        ],
                        "instructions": ["Step 1", "Step 2"],
                        "servings": {req.servings_per_meal},
                        "macros": {{
                            "perServing": {{"calories": X, "protein": "Xg", "carbs": "Xg", "fat": "Xg"}},
                            "perMeal": {{"calories": X, "protein": "Xg", "carbs": "Xg", "fat": "Xg"}}
                        }}
                    }}
                ],
                "snacks": [] // Include if snacks_per_day > 0
            }}
            // ... repeat for all {req.duration_days} days
        ]
    }},
    "grocery_list": {{
        "produce": ["item with quantity"],
        "dairy": ["item with quantity"],
        "meat": ["item with quantity"],
        "pantry": ["item with quantity"],
        "frozen": ["item with quantity"]
    }},
    "validation_summary": {{
        "disliked_ingredients_avoided": true,
        "all_meal_times_included": true,
        "no_repeated_titles": true,
        "time_constraints_respected": true
    }}
}}

IMPORTANT: Self-validate your response before finalizing. Ensure no disliked ingredients, no repeated meal titles, and all requirements are met."""

        # Update progress
        if job_id:
            batch_update_job_status(job_id, {
                "progress": 20,
                "message": f"Generating complete {req.duration_days}-day meal plan..."
            }, force_db_update=False)

        # Single comprehensive OpenAI call
        openai_model = determine_model(req.ai_model if req.ai_model else "default")
        logger.info(f"Using {openai_model} model for single-request generation")

        # Determine appropriate token limit based on model - be more aggressive for single request
        max_tokens = 4095  # Maximum possible for completion tokens
        if "gpt-4" in openai_model.lower():
            max_tokens = 4095  # GPT-4 has 4096 completion token limit
        elif "gpt-3.5" in openai_model.lower():
            max_tokens = 4095  # GPT-3.5 has 4096 completion token limit, use maximum
        
        logger.info(f"Using {max_tokens} max_tokens for model {openai_model}")

        try:
            response = openai.ChatCompletion.create(
                model=openai_model,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt}
                ],
                max_tokens=max_tokens,
                temperature=0.3,  # Slightly higher for more variety
                request_timeout=180  # 3 minutes timeout for single large request
            )
        except openai.error.InvalidRequestError as e:
            if "max_tokens" in str(e):
                # Retry with smaller token limit
                logger.warning(f"Token limit too high, retrying with 3000 tokens: {e}")
                max_tokens = 3000
                response = openai.ChatCompletion.create(
                    model=openai_model,
                    messages=[
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    max_tokens=max_tokens,
                    temperature=0.3,
                    request_timeout=180
                )
            else:
                raise

        logger.info("Received complete meal plan from OpenAI")

        # Update progress
        if job_id:
            batch_update_job_status(job_id, {
                "progress": 70,
                "message": "Processing and validating meal plan..."
            }, force_db_update=False)

        # Parse the response
        response_content = response.choices[0].message.content
        logger.info(f"Received response content length: {len(response_content)} characters")
        
        try:
            meal_plan_data = json.loads(response_content)
        except json.JSONDecodeError as e:
            logger.error(f"Failed to parse OpenAI response as JSON: {e}")
            logger.error(f"Response content length: {len(response_content)} characters")
            logger.error(f"Response content preview: {response_content[:500]}...")
            logger.error(f"Response content ending: ...{response_content[-500:]}")
            
            # Check if response was truncated (common issue with token limits)
            if len(response_content) >= 13000:  # Likely truncated if very long but invalid JSON
                logger.error("Response appears to be truncated due to token limit")
                logger.info("🔄 OPTIMIZATION: Response truncated, falling back to legacy method")
                raise HTTPException(500, f"Response truncated due to token limit - falling back to legacy method")
            
            # Try to extract JSON from response if it's wrapped in markdown or has extra text
            import re
            json_match = re.search(r'\{.*\}', response_content, re.DOTALL)
            if json_match:
                try:
                    meal_plan_data = json.loads(json_match.group())
                    logger.info("Successfully extracted JSON from response")
                except json.JSONDecodeError:
                    logger.error("Could not extract valid JSON from response")
                    raise HTTPException(500, f"Invalid meal plan format received. Error: {e}")
            else:
                raise HTTPException(500, f"No JSON found in response. Error: {e}")

        # Validate the structure
        if "meal_plan" not in meal_plan_data or "days" not in meal_plan_data["meal_plan"]:
            raise HTTPException(500, "Invalid meal plan structure")

        final_plan = meal_plan_data["meal_plan"]
        grocery_list = meal_plan_data.get("grocery_list", {})

        # Update progress
        if job_id:
            batch_update_job_status(job_id, {
                "progress": 90,
                "message": "Finalizing meal plan..."
            }, force_db_update=False)

        # PHASE 2: Save to database (connection closed after generation)
        menu_id = None
        with get_db_cursor(dict_cursor=False) as (cursor, conn):
            # Insert menu record
            cursor.execute("""
                INSERT INTO menus (user_id, meal_plan_json, duration_days, for_client_id, nickname)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING id
            """, (
                req.user_id,
                json.dumps(final_plan),
                req.duration_days,
                req.for_client_id,
                req.nickname or f"{req.duration_days}-day meal plan"
            ))
            
            menu_id = cursor.fetchone()[0]
            conn.commit()

        # Update progress to complete
        if job_id:
            batch_update_job_status(job_id, {
                "progress": 100,
                "status": "completed",
                "message": "Meal plan generated successfully!",
                "result_data": json.dumps({"menu_id": menu_id})
            }, force_db_update=True)

        logger.info(f"Single-request meal plan generation completed in {time.time() - generation_start_time:.1f}s")

        return {
            "message": "Meal plan generated successfully using optimized single-request approach",
            "menu_id": menu_id,
            "meal_plan": final_plan,
            "grocery_list": grocery_list,
            "generation_method": "single_request_optimized"
        }

    except Exception as e:
        logger.error(f"Error in single-request generation: {str(e)}")
        if job_id:
            batch_update_job_status(job_id, {
                "status": "error",
                "error_message": str(e),
                "progress": 0
            }, force_db_update=True)
        raise HTTPException(500, f"Generation failed: {str(e)}")

@router.post("/generate")
def generate_meal_plan_variety(req: GenerateMealPlanRequest, job_id: str = None):
    """Generate a meal plan - tries optimized method first, falls back to legacy if needed"""
    
    if USE_OPTIMIZED_GENERATION:
        try:
            logger.info(f"🚀 OPTIMIZATION: Attempting optimized single-request generation for user {req.user_id}")
            result = generate_meal_plan_single_request(req, job_id)
            logger.info(f"✅ OPTIMIZATION: Single-request generation successful for user {req.user_id}")
            return result
        except Exception as e:
            logger.error(f"❌ OPTIMIZATION: Single-request generation failed: {str(e)}")
            logger.error(f"❌ OPTIMIZATION: Exception type: {type(e).__name__}")
            import traceback
            logger.error(f"❌ OPTIMIZATION: Traceback: {traceback.format_exc()}")
            logger.info(f"🔄 FALLBACK: Switching to legacy multi-request generation for user {req.user_id}")
            
            # Reset job status for retry
            if job_id:
                batch_update_job_status(job_id, {
                    "progress": 5,
                    "message": "Optimized method failed, retrying with legacy method..."
                }, force_db_update=False)
            
            return generate_meal_plan_legacy(req, job_id)
    else:
        logger.info(f"Using legacy multi-request generation for user {req.user_id}")
        return generate_meal_plan_legacy(req, job_id)

@router.post("/generate-legacy")  
def generate_meal_plan_legacy(req: GenerateMealPlanRequest, job_id: str = None):
    """Legacy meal plan generation (7 separate API calls) - kept as fallback"""
    try:
        import threading
        current_thread = threading.current_thread()
        logger.info(f"THREAD_EXECUTION_DEBUG: generate_meal_plan_variety called on thread: {current_thread.name} (ID: {current_thread.ident})")
        logger.info(f"THREAD_EXECUTION_DEBUG: Job ID: {job_id}, User ID: {req.user_id}")
        
        if req.duration_days < 1 or req.duration_days > 7:
            raise HTTPException(400, "duration_days must be between 1 and 7")

        # PHASE 1: Fetch user preferences, then close connection
        user_row = None
        logger.info("Opening database connection to fetch user preferences")

        # Determine which user's preferences to use
        preference_user_id = req.for_client_id if req.for_client_id else req.user_id

        # Use the read pool for user preferences retrieval to avoid blocking other operations
        with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
            # Enable autocommit for faster read operations
            conn.autocommit = True

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

        # Connection is automatically closed by the context manager
        logger.info("Database connection closed after fetching preferences")

        # PHASE 2: Process preferences in memory without a DB connection

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
            
            # Update progress during generation (only to cache, not database)
            if job_id:
                progress = 10 + (day_number - 1) * (80 / req.duration_days)  # 10-90% range
                batch_update_job_status(job_id, {
                    "progress": round(progress),
                    "message": f"Generating day {day_number} of {req.duration_days}..."
                }, force_db_update=False)  # Cache only to reduce DB load
            
            # Get used ingredients that are within the last 3 days
            recent_ingredients = []
            for past_day, ingredients in used_primary_ingredients:
                if day_number - past_day <= 3:  # Only consider ingredients from last 3 days
                    recent_ingredients.extend(ingredients)
            
            recent_ingredients_str = ", ".join(recent_ingredients) if recent_ingredients else "None"
            
            # Create a more structured system prompt
            system_prompt = f"""You are an advanced meal planning assistant that creates detailed, nutritionally balanced meal plans.
            Your task is to generate meal plans with precise cooking instructions while strictly adhering to user preferences.
            
            🚨 ABSOLUTELY CRITICAL - ZERO TOLERANCE RULES:
            1. NEVER EVER use these disliked ingredients: {', '.join(disliked_ingredients) if disliked_ingredients else 'None'}
            2. Check EVERY ingredient against the disliked list before including it
            3. If an ingredient is disliked, find a complete substitute - do not use it at all
            
            CRITICAL: You MUST generate meals for ALL meal times specified by the user, including breakfast, lunch, dinner, and snacks if requested.
            
            Pay special attention to the following preference areas:
            1. Flavor preferences - Focus on incorporating preferred flavor profiles
            2. Spice level - Adjust recipes to match the specified spice level
            3. Meal formats - Prioritize preferred meal structures like stir-fry, bowls, etc.
            4. Time constraints - Aim for recipes within time limits. Up to 25% over is acceptable for better nutrition/taste balance
            5. Meal preparation preferences - Use batch cooking, one-pot meals, etc. when specified
            
            Respect both dietary restrictions and detailed preferences to create personalized and practical meal plans.
            
            REMINDER: Absolutely NO disliked ingredients: {', '.join(disliked_ingredients) if disliked_ingredients else 'None'}"""
            
            # Create a more concise and structured user prompt
            user_prompt = f"""
            ## Meal Plan Requirements - Day {day_number} of {req.duration_days}

            ### User Profile
            - Servings per meal: {servings_per_meal}
            - Dietary preferences: {', '.join(dietary_restrictions)}
            
            🚨 FORBIDDEN INGREDIENTS (NEVER USE): {', '.join(disliked_ingredients) if disliked_ingredients else 'None'}
            
            - Preferred cuisines: {recipe_type}
            - Diet type: {diet_type}
            - Available appliances: {appliances_str}
            - Cooking complexity level: {prep_level}
            
            ### Additional Preferences
            - Preferred flavors: {flavor_prefs_str or "No specific flavor preferences"}
            - Spice level: {spice_level}
            - Preferred meal formats: {recipe_type_prefs_str or "No specific meal format preferences"}
            - Preferred meal preparation: {prep_prefs_str or "No specific preparation preferences"}

            ### Time Guidelines (with 25% flexibility)
            {chr(10).join([f"- {constraint.replace('-', ' ').title()}: Target {minutes}min (up to {int(minutes * 1.25)}min acceptable)" for constraint, minutes in time_constraints.items()]) if time_constraints else "- No specific time constraints"}

            ### **Preparation Guidelines:**
            - When designing weekday breakfasts, keep preparation time under {time_constraints.get('weekday-breakfast', 15)} minutes.
            - For lunches on workdays, aim for {time_constraints.get('weekday-lunch', 20)} minute preparation times.
            - Weekend meals can be more elaborate, but respect the time constraints provided.
            - If "Quick Assembly" is preferred, prioritize meals with minimal cooking and more assembly.
            - If "One Pot" is preferred, design recipes that can be prepared in a single cooking vessel.
            - If "Batch Cooking" is preferred, suggest recipes that scale well and can be partially prepared in advance.

            #### **Quick Prep Tips:**
            - **Use pre-cooked proteins** such as rotisserie chicken, grilled shrimp, or canned beans to save cooking time.
            - **Incorporate pre-prepped vegetables** like bagged salad mixes, frozen stir-fry blends, or pre-cut bell peppers.
            - **Consider sauces and dressings** that are ready-made or require minimal mixing.

            ### Nutrition Goals
            - Daily calories: {calorie_goal} kcal × {servings_per_meal} servings = {calorie_goal * servings_per_meal} total calories
            - Protein: {protein_goal}% ({round((calorie_goal * protein_goal / 100) / 4)}g)
            - Carbs: {carbs_goal}% ({round((calorie_goal * carbs_goal / 100) / 4)}g)
            - Fat: {fat_goal}% ({round((calorie_goal * fat_goal / 100) / 9)}g)

            ### 🚨 CRITICAL CONSTRAINTS - ABSOLUTE RULES:
            1. 🚫 ABSOLUTELY NO DISLIKED INGREDIENTS: {', '.join(disliked_ingredients) if disliked_ingredients else 'None'} 
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
                    # Progressive timeout reduction: 2min, 90s, 60s for retries
                    timeout = max(60, 120 - (attempt * 30))
                    
                    # Debug which thread OpenAI call is happening on
                    import threading
                    current_thread = threading.current_thread()
                    logger.info(f"OPENAI_THREAD_DEBUG: About to call OpenAI on thread: {current_thread.name} (ID: {current_thread.ident})")
                    logger.info(f"OPENAI_THREAD_DEBUG: Day {day_number}, attempt {attempt + 1}, timeout {timeout}s")
                    
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
                        request_timeout=timeout  # Progressive timeout: 120s, 90s, 60s
                    )
                    
                    logger.info(f"OPENAI_THREAD_DEBUG: OpenAI call completed on thread: {current_thread.name} (ID: {current_thread.ident})")
                    
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
                                
                                # Check for CRITICAL issues (disliked ingredients) vs minor issues
                                critical_issues = [issue for issue in issues if 'disliked ingredient' in issue.lower()]
                                minor_issues = [issue for issue in issues if 'disliked ingredient' not in issue.lower()]
                                
                                if critical_issues:
                                    # ALWAYS retry for disliked ingredients - these are unacceptable
                                    logger.error(f"CRITICAL: Disliked ingredient violations found: {critical_issues}")
                                    if attempt < MAX_RETRIES - 1:
                                        user_prompt += f"\n\n### CRITICAL VALIDATION ERRORS - MUST FIX:\n" + "\n".join([f"- {issue}" for issue in critical_issues])
                                        user_prompt += f"\n\nREMINDER: ABSOLUTELY NO disliked ingredients: {', '.join(disliked_ingredients)}"
                                        continue
                                    else:
                                        # Last attempt failed - this is unacceptable for disliked ingredients
                                        raise HTTPException(500, f"Failed to generate menu without disliked ingredients after {MAX_RETRIES} attempts: {critical_issues}")
                                
                                elif minor_issues and attempt < MAX_RETRIES - 1:
                                    # Only retry minor issues (time constraints, repeated titles) on early attempts  
                                    serious_minor_issues = [issue for issue in minor_issues if ('repeated' in issue.lower() or 'missing' in issue.lower())]
                                    if serious_minor_issues:
                                        user_prompt += f"\n\n### Validation Feedback\nPlease fix these issues:\n" + "\n".join([f"- {issue}" for issue in serious_minor_issues])
                                        continue
                                    else:
                                        logger.info(f"Accepting meal plan with minor time constraint issues: {minor_issues}")
                                        # Accept the plan with minor issues
                            
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
                    error_type = type(e).__name__
                    logger.error(f"OpenAI API error ({error_type}): {str(e)}")
                    
                    # Update progress with retry information
                    if job_id:
                        current_progress = 10 + (day_number - 1) * (80 / req.duration_days)
                        batch_update_job_status(job_id, {
                            "progress": round(current_progress),
                            "message": f"Retrying day {day_number} due to {error_type} (attempt {attempt + 1}/{MAX_RETRIES})..."
                        }, force_db_update=False)
                    
                    if attempt == MAX_RETRIES - 1:
                        raise HTTPException(500, f"OpenAI API error: {error_type} - {str(e)}")
                    time.sleep(2)  # Slightly longer wait between retries

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
            
            # Update progress after successful day completion
            if job_id:
                progress = 10 + day_number * (80 / req.duration_days)  # 10-90% range
                batch_update_job_status(job_id, {
                    "progress": round(progress),
                    "message": f"Completed day {day_number} of {req.duration_days}. Saving to database..."
                }, force_db_update=False)  # Cache only

        # PHASE 3: All meal generation complete, now open a new connection to save the menu
        logger.info("Opening new database connection to save generated menu")

        # Use the AI pool for saving menu data since this is part of the AI process
        with get_db_cursor(dict_cursor=True, pool_type='ai', timeout=20) as (cursor, conn):
            try:
                # Prepare the plan data as JSON string once
                plan_json = json.dumps(final_plan)
                meal_times_json = json.dumps(selected_meal_times)

                # Save to database
                cursor.execute("""
                    INSERT INTO menus (user_id, meal_plan_json, duration_days, meal_times, snacks_per_day, for_client_id, ai_model_used)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id;
                """, (
                    req.user_id,
                    plan_json,
                    req.duration_days,
                    meal_times_json,
                    req.snacks_per_day,
                    req.for_client_id,
                    req.ai_model
                ))

                menu_id = cursor.fetchone()["id"]
                conn.commit()
                logger.info(f"Successfully saved menu with ID {menu_id}")

                # Connection will be automatically closed by context manager
                logger.info("Database connection closed after saving menu")

                return {
                    "menu_id": menu_id,
                    "meal_plan": final_plan
                }
            except Exception as db_error:
                conn.rollback()
                logger.error(f"Error saving menu to database: {str(db_error)}", exc_info=True)
                raise HTTPException(status_code=500, detail=f"Error saving menu: {str(db_error)}")

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in generate_meal_plan_variety: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

# Background Job Endpoints
@router.post("/generate-async")
async def start_menu_generation_async(req: GenerateMealPlanRequest, background_tasks: BackgroundTasks):
    """Debug the asyncio.create_task approach to see why thread pool isn't working"""
    try:
        logger.info(f"DEBUG_ASYNCIO: Starting menu generation for user {req.user_id}")
        
        # Generate unique job ID for tracking
        job_id = str(uuid.uuid4())
        logger.info(f"DEBUG_ASYNCIO: Generated job_id {job_id}")
        
        # Save initial job status in cache immediately
        with _status_cache_lock:
            _job_status_cache[job_id] = {
                "user_id": req.user_id,
                "client_id": req.for_client_id,
                "status": "started",
                "progress": 0,
                "message": "Starting meal plan generation...",
                "created_at": datetime.utcnow(),
                "last_updated": datetime.utcnow()
            }
        logger.info(f"DEBUG_ASYNCIO: Cached initial job status for {job_id}")
        
        # Test asyncio task creation step by step
        import asyncio
        logger.info(f"DEBUG_ASYNCIO: About to create asyncio task for {job_id}")
        
        # Create the task explicitly and capture it
        logger.info(f"DEBUG_ASYNCIO: Calling asyncio.create_task with run_generation_with_thread_pool")
        task = asyncio.create_task(run_generation_with_thread_pool(job_id, req))
        logger.info(f"DEBUG_ASYNCIO: Task created successfully: {task}")
        
        # Check if task was created and is running
        logger.info(f"DEBUG_ASYNCIO: Task done: {task.done()}, cancelled: {task.cancelled()}")
        
        logger.info(f"DEBUG_ASYNCIO: Returning job_id {job_id} to client immediately")
        
        return {
            "job_id": job_id,
            "status": "started", 
            "message": "Menu generation started with detailed debug logging"
        }
        
    except Exception as e:
        logger.error(f"DEBUG_ASYNCIO: Failed to start menu generation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/job-status/{job_id}")
async def get_menu_generation_status(job_id: str):
    """Get the status of a background menu generation job with cache optimization"""
    try:
        # Use cached status first to reduce database load during generation
        status = get_cached_job_status(job_id)

        if not status:
            raise HTTPException(status_code=404, detail="Job not found")

        # Format response
        response = {
            "job_id": job_id,
            "status": status.get("status"),
            "progress": status.get("progress"),
            "message": status.get("message"),
            "created_at": status.get("created_at").isoformat() if status.get("created_at") else None,
            "updated_at": status.get("updated_at").isoformat() if status.get("updated_at") else None
        }

        # Include result data if completed
        if status.get("status") == "completed" and status.get("result_data"):
            response["result"] = status["result_data"]

        # Include error if failed
        if status.get("status") == "failed" and status.get("error_message"):
            response["error"] = status["error_message"]

        return response

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get job status for {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/active-jobs/{user_id}")
async def get_active_jobs_for_user(user_id: int):
    """Get any active menu generation jobs for a user with optimized caching"""
    try:
        # First check in-memory cache for active jobs (much faster)
        active_from_cache = []
        with _status_cache_lock:
            for job_id, job_data in _job_status_cache.items():
                if (job_data.get('user_id') == user_id and 
                    job_data.get('status') in ['started', 'generating', 'processing']):
                    active_from_cache.append({
                        "job_id": job_id,
                        "status": job_data.get('status'),
                        "progress": job_data.get('progress'),
                        "message": job_data.get('message'),
                        "created_at": job_data.get('created_at').isoformat() if job_data.get('created_at') else None,
                        "updated_at": job_data.get('last_updated').isoformat() if job_data.get('last_updated') else None,
                    })
        
        # If we found active jobs in cache, return them immediately (faster response during generation)
        if active_from_cache:
            return {
                "active_jobs": active_from_cache,
                "has_active_jobs": True,
                "source": "cache"  # Debug info
            }
        
        # Fall back to database query for comprehensive check
        with get_db_cursor(dict_cursor=True) as (cursor, conn):
            # Enable autocommit for faster read operations during generation
            conn.autocommit = True
            
            cursor.execute("""
                SELECT job_id, status, progress, message, created_at, updated_at
                FROM menu_generation_jobs
                WHERE user_id = %s
                AND status IN ('started', 'generating', 'processing')
                ORDER BY created_at DESC
                LIMIT 5
            """, (user_id,))

            active_jobs = cursor.fetchall()

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
                "has_active_jobs": len(jobs) > 0,
                "source": "database"  # Debug info
            }
            
    except Exception as e:
        logger.error(f"Failed to get active jobs for user {user_id}: {str(e)}")
        # Return empty result instead of error to avoid blocking UI
        return {
            "active_jobs": [],
            "has_active_jobs": False,
            "error": str(e)
        }

@router.post("/cancel-job/{job_id}")
async def cancel_menu_generation_job(job_id: str, user=Depends(get_user_from_token)):
    """Cancel an active menu generation job"""
    try:
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        user_id = user.get('user_id')
        
        # Check if this job belongs to the user
        with _status_cache_lock:
            job_data = _job_status_cache.get(job_id)
            if not job_data or job_data.get('user_id') != user_id:
                # Also check database for older jobs
                status = get_job_status_from_database(job_id)
                if not status or status.get('user_id') != user_id:
                    raise HTTPException(status_code=404, detail="Job not found or access denied")
        
        # Update job status to cancelled
        batch_update_job_status(job_id, {
            "status": "cancelled",
            "progress": 0,
            "message": "Job cancelled by user",
        }, force_db_update=True)  # Force database write for cancellation
        
        # Clean up user tracking
        with user_generation_lock:
            if user_id in active_user_generations and active_user_generations[user_id] == job_id:
                del active_user_generations[user_id]
                logger.info(f"Cleaned up cancelled job {job_id} for user {user_id}")
        
        # Clean up cache
        cleanup_job_cache(job_id)
        
        return {
            "success": True,
            "message": "Job cancelled successfully",
            "job_id": job_id
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to cancel job {job_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

async def run_generation_with_thread_pool(job_id: str, req: GenerateMealPlanRequest):
    """Debug the thread pool execution to see why it's not isolating OpenAI calls"""
    import asyncio
    import concurrent.futures
    
    try:
        logger.info(f"THREAD_POOL_DEBUG: Function called for job {job_id}")
        logger.info(f"THREAD_POOL_DEBUG: Request user_id: {req.user_id}")
        
        # Update status to generating
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "generating",
                    "progress": 10,
                    "message": "Running in thread pool...",
                    "last_updated": datetime.utcnow()
                })
        logger.info(f"THREAD_POOL_DEBUG: Updated cache status for {job_id}")
        
        # Get the current event loop
        loop = asyncio.get_running_loop()
        logger.info(f"THREAD_POOL_DEBUG: Got running loop: {loop}")
        
        # Create ThreadPoolExecutor
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            logger.info(f"THREAD_POOL_DEBUG: Created executor: {executor}")
            logger.info(f"THREAD_POOL_DEBUG: About to submit job {job_id} to thread pool")
            
            # Submit to thread pool
            logger.info(f"THREAD_POOL_DEBUG: Calling loop.run_in_executor for {job_id}")
            result = await loop.run_in_executor(
                executor,
                generate_meal_plan_variety,
                req,
                job_id
            )
            logger.info(f"THREAD_POOL_DEBUG: Thread pool execution completed for job {job_id}")
            logger.info(f"THREAD_POOL_DEBUG: Result type: {type(result)}")
        
        # Update status to completed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": "Menu generation completed successfully!",
                    "result_data": result,
                    "last_updated": datetime.utcnow()
                })
        
        logger.info(f"THREAD_POOL_DEBUG: Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"THREAD_POOL_DEBUG: Job {job_id} failed: {str(e)}", exc_info=True)
        
        # Update status to failed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": "Menu generation failed",
                    "error_message": str(e),
                    "last_updated": datetime.utcnow()
                })

def run_generation_in_python_thread(job_id: str, req: GenerateMealPlanRequest):
    """Run the entire menu generation process in a completely separate Python thread"""
    try:
        logger.info(f"PYTHON THREADING: Executing job {job_id} in separate thread")
        
        # Update status to generating
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "generating",
                    "progress": 10,
                    "message": "Running in Python thread...",
                    "last_updated": datetime.utcnow()
                })
        
        # Run the ENTIRE generation process in this thread
        # This should be completely isolated from FastAPI event loop
        logger.info(f"PYTHON THREADING: Calling generate_meal_plan_variety for job {job_id}")
        result = generate_meal_plan_variety(req, job_id)
        logger.info(f"PYTHON THREADING: Generation completed for job {job_id}")
        
        # Update status to completed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": "Menu generation completed successfully!",
                    "result_data": result,
                    "last_updated": datetime.utcnow()
                })
        
        logger.info(f"PYTHON THREADING: Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"PYTHON THREADING: Job {job_id} failed: {str(e)}", exc_info=True)
        
        # Update status to failed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": "Menu generation failed",
                    "error_message": str(e),
                    "last_updated": datetime.utcnow()
                })

async def run_generation_in_thread_pool_task(job_id: str, req: GenerateMealPlanRequest):
    """Async task that runs the entire menu generation process in a thread pool"""
    import asyncio
    import concurrent.futures
    
    try:
        logger.info(f"THREAD POOL: Starting thread pool execution for job {job_id}")
        
        # Update status to generating
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "generating",
                    "progress": 10,
                    "message": "Running in thread pool...",
                    "last_updated": datetime.utcnow()
                })
        
        # Create a dedicated thread pool executor and run the generation
        loop = asyncio.get_running_loop()
        
        # Run the ENTIRE generation process in a separate thread
        with concurrent.futures.ThreadPoolExecutor(max_workers=1) as executor:
            logger.info(f"THREAD POOL: Submitting job {job_id} to thread pool executor")
            result = await loop.run_in_executor(
                executor,
                generate_meal_plan_variety,
                req,
                job_id
            )
            logger.info(f"THREAD POOL: Generation completed in thread pool for job {job_id}")
        
        # Update status to completed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": "Menu generation completed successfully!",
                    "result_data": result,
                    "last_updated": datetime.utcnow()
                })
        
        logger.info(f"THREAD POOL: Job {job_id} completed successfully")
        
    except Exception as e:
        logger.error(f"THREAD POOL: Job {job_id} failed: {str(e)}", exc_info=True)
        
        # Update status to failed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": "Menu generation failed",
                    "error_message": str(e),
                    "last_updated": datetime.utcnow()
                })

async def run_generation_in_thread_pool(job_id: str, req: GenerateMealPlanRequest):
    """Run the entire menu generation process in a thread pool to prevent blocking"""
    import asyncio
    import concurrent.futures
    
    try:
        logger.info(f"Starting thread pool execution for job {job_id}")
        
        # Update status to generating
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "generating",
                    "progress": 10,
                    "message": "Generating your meal plan...",
                    "last_updated": datetime.utcnow()
                })
        
        # Run the ENTIRE generation process (including database save) in thread pool
        loop = asyncio.get_event_loop()
        with concurrent.futures.ThreadPoolExecutor() as executor:
            result = await loop.run_in_executor(
                executor,
                generate_meal_plan_variety,
                req,
                job_id  # Pass job_id for progress updates
            )
        
        # Update status to completed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "completed",
                    "progress": 100,
                    "message": "Menu generation completed successfully!",
                    "result_data": result,
                    "last_updated": datetime.utcnow()
                })
        
        logger.info(f"Thread pool generation completed successfully for job {job_id}")
        
    except Exception as e:
        logger.error(f"Thread pool generation failed for job {job_id}: {str(e)}", exc_info=True)
        
        # Update status to failed
        with _status_cache_lock:
            if job_id in _job_status_cache:
                _job_status_cache[job_id].update({
                    "status": "failed",
                    "progress": 0,
                    "message": "Menu generation failed",
                    "error_message": str(e),
                    "last_updated": datetime.utcnow()
                })

async def generate_menu_background_task(job_id: str, req: GenerateMealPlanRequest):
    """Background task that performs the actual menu generation with minimal DB connections"""
    start_time = time.time()
    try:
        logger.info(f"Background task started for job {job_id}")

        # Update status: Starting AI generation (writes to DB - critical status)
        batch_update_job_status(job_id, {
            "status": "generating",
            "progress": 10,
            "message": "Calling AI to generate your meal plan..."
        }, force_db_update=True)  # Force DB write for initial generating status

        # Call the existing synchronous generation function with job_id for progress tracking
        # This function handles its own connections properly
        logger.info(f"Calling generate_meal_plan_variety for job {job_id}")
        menu_result = generate_meal_plan_variety(req, job_id)
        
        generation_time = time.time() - start_time
        logger.info(f"Menu generation completed in {generation_time:.2f} seconds")

        # Update status: Processing complete (writes to DB - critical status)
        batch_update_job_status(job_id, {
            "status": "completed",
            "progress": 100,
            "message": "Menu generation completed successfully!",
            "result_data": menu_result
        })

        logger.info(f"Background task completed successfully for job {job_id}")

    except Exception as e:
        logger.error(f"Background task failed for job {job_id}: {str(e)}", exc_info=True)

        # Update status: Failed (writes to DB - critical status)
        batch_update_job_status(job_id, {
            "status": "failed",
            "progress": 0,
            "message": "Menu generation failed",
            "error_message": str(e)
        })

    finally:
        # Clean up concurrency controls and cache
        try:
            # Remove user from active generations tracking
            with user_generation_lock:
                user_id = req.user_id
                if user_id in active_user_generations and active_user_generations[user_id] == job_id:
                    del active_user_generations[user_id]
                    logger.info(f"Removed user {user_id} from active generations tracking")

            # DON'T clean up completed job cache immediately - let frontend see completion status
            # The cache will be cleaned up after a delay or by periodic cleanup
            # cleanup_job_cache(job_id)  # DISABLED - causing frontend to miss completion status
            logger.info(f"Leaving job {job_id} in cache for frontend to detect completion")

            # Release semaphore to allow another generation to start
            generation_semaphore.release()
            logger.info(f"Released generation semaphore for job {job_id}")
        except Exception as e:
            logger.error(f"Error cleaning up concurrency controls: {str(e)}")
            # Still try to release the semaphore even if there was an error
            try:
                generation_semaphore.release()
            except:
                pass

@router.get("/latest/{user_id}")
def get_latest_menu(user_id: int):
    """Fetch the most recent menu for a user with minimal connection time"""
    try:
        # Use the read pool for quick menu retrieval
        with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
            # Enable autocommit for faster read operations
            conn.autocommit = True
            
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

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching latest menu: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching latest menu")

@router.get("/history/{user_id}")
def get_menu_history(user_id: int):
    """Get menu history for a user"""
    # Use the read pool for menu history retrieval
    with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
        # Enable autocommit for faster read operations
        conn.autocommit = True
        try:
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

        except Exception as e:
            logger.error(f"Error fetching menu history: {str(e)}")
            raise HTTPException(status_code=500, detail="Error fetching menu history")

@router.patch("/{menu_id}/nickname")
async def update_menu_nickname(menu_id: int, nickname: str = Body(..., embed=True)):
    """Update the nickname for a menu"""
    # Use the general pool for standard write operations
    with get_db_cursor(dict_cursor=True, pool_type='general', timeout=15) as (cursor, conn):
        try:
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

        except Exception as e:
            conn.rollback()
            logger.error(f"Error updating menu nickname: {str(e)}")
            raise HTTPException(status_code=500, detail="Error updating menu nickname")

@router.get("/{menu_id}/grocery-list")
def get_grocery_list(menu_id: int):
    """Get grocery list for a specific menu"""
    # Use the read pool for grocery list operations
    with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
        # Enable autocommit for faster read operations
        conn.autocommit = True
        try:
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

        except Exception as e:
            logger.error(f"Error generating grocery list: {str(e)}")
            raise HTTPException(status_code=500, detail="Error generating grocery list")

@router.post("/{menu_id}/add-to-cart")
def add_grocery_list_to_cart(
    menu_id: int,
    store: str = Query(..., description="Choose 'walmart', 'kroger', or 'mixed'"),
    user_token: str = Query(None, description="User token for Walmart or Kroger (if required)"),
):
    """Add menu items to a store cart"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
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

        except Exception as e:
            logger.error(f"Error adding items to cart: {str(e)}")
            raise HTTPException(status_code=500, detail="Error adding items to cart")

@router.get("/latest/{user_id}/grocery-list")
def get_latest_grocery_list(user_id: int):
    """Get grocery list for user's latest menu"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
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

        except Exception as e:
            logger.error(f"Error getting latest grocery list: {str(e)}")
            raise HTTPException(status_code=500, detail="Error getting latest grocery list")


@router.get("/{menu_id}")
def get_menu_details(
    menu_id: int,
    user_id: int = Query(None)
):
    """Retrieve full menu details for a specific menu"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cur, conn):
        try:
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
                # Ensure meal_plan_json is parsed if user_id was not provided
                menu['meal_plan'] = json.loads(menu['meal_plan_json']) if isinstance(menu['meal_plan_json'], str) else menu['meal_plan_json']

            return menu

        except Exception as e:
            logger.error(f"Error retrieving menu details: {str(e)}")
            raise HTTPException(status_code=500, detail="Internal server error")


@router.get("/shared")
async def get_shared_menus(user_id: int = Query(...)):
    """Get menus shared with the current user"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
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


@router.get("/shared/{user_id}")
async def get_shared_menus(user_id: int):
    """Get menus shared with the current user"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
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

    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cur, conn):
        try:
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

        except Exception as e:
            logger.error(f"Error fetching client menus: {str(e)}")
            raise HTTPException(status_code=500, detail="Error fetching client menus")

@router.post("/share/{menu_id}/client/{client_id}")
async def share_menu_with_client(
    menu_id: int,
    client_id: int,
    data: dict = Body(default={}),
    user = Depends(get_user_from_token)
):
    """Share a menu with a specific client"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
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

        except Exception as e:
            logger.error(f"Error sharing menu with client: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))
        finally:
            cursor.close()
            conn.close()

@router.get("/for-client/{client_id}")
async def get_menus_for_client(
    client_id: int,
    user = Depends(get_user_from_token)
):
    """Get all menus created for a client by the organization and their sharing status"""
    # Only organization owners can access this endpoint
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    role = user.get('role', '')

    if role != 'owner':
        raise HTTPException(
            status_code=403,
            detail="Only organization owners can access this endpoint"
        )

    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
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
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
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

        # Use the context manager for safer database operations
        with get_db_cursor(dict_cursor=True) as (cursor, conn):
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

    except Exception as e:
        logger.error(f"Error generating and sharing menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
        
@router.get("/{menu_id}/sharing")
async def get_menu_sharing_details(
    menu_id: int,
    user = Depends(get_user_from_token)
):
    """Get details about who a menu is shared with"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
            # Verify user owns the menu
            user_id = user.get('user_id')
            org_id = user.get('organization_id')
            role = user.get('role', '')

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
    # Verify user owns the menu
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    role = user.get('role', '')

    if role != 'owner':
        raise HTTPException(
            status_code=403,
            detail="Only organization owners can share menus with clients"
        )

    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        
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

        except Exception as e:
            logger.error(f"Error sharing menu with client: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

@router.delete("/share/{share_id}")
async def unshare_menu(
    share_id: int,
    user = Depends(get_user_from_token)
):
    """Remove menu sharing"""
    # Use the context manager for safer database operations
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
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

        except Exception as e:
            logger.error(f"Error unsharing menu: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

@router.get("/db-stats")
async def get_database_connection_stats():
    """Get database connection pool statistics for monitoring"""
    try:
        with _stats_lock:
            stats = _connection_stats.copy()
            
        # Calculate uptime
        uptime_seconds = time.time() - stats['last_reset']
        
        # Add additional calculated metrics
        stats['uptime_minutes'] = round(uptime_seconds / 60, 2)
        stats['connections_per_minute'] = round(stats['total_connections'] / (uptime_seconds / 60), 2) if uptime_seconds > 0 else 0
        stats['error_rate'] = round((stats['connection_errors'] / max(stats['total_connections'], 1)) * 100, 2)
        
        # Check for potential issues
        warnings = []
        if stats['error_rate'] > 5:
            warnings.append(f"High error rate: {stats['error_rate']}%")
        if stats['peak_connections'] > 40:  # 80% of max pool size
            warnings.append(f"High peak connections: {stats['peak_connections']}/50")
        if stats['last_pool_exhaustion']:
            time_since_exhaustion = time.time() - stats['last_pool_exhaustion']
            if time_since_exhaustion < 300:  # Last 5 minutes
                warnings.append(f"Recent pool exhaustion: {round(time_since_exhaustion/60, 1)} minutes ago")
        
        stats['warnings'] = warnings
        stats['status'] = 'critical' if len(warnings) > 1 else ('warning' if warnings else 'healthy')
        
        # Force a stats log for monitoring
        log_connection_stats()
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting database stats: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/debug/concurrency")
async def get_concurrency_debug_info():
    """Get current concurrency state for debugging blocking issues"""
    try:
        with _status_cache_lock:
            cached_jobs = list(_job_status_cache.keys())
        
        with user_generation_lock:
            active_users = dict(active_user_generations)
        
        # Check semaphore availability
        available_slots = generation_semaphore._value if hasattr(generation_semaphore, '_value') else "unknown"
        
        return {
            "max_concurrent_generations": MAX_CONCURRENT_GENERATIONS,
            "available_semaphore_slots": available_slots,
            "cached_job_count": len(cached_jobs),
            "active_user_generations": active_users,
            "cached_job_ids": cached_jobs[:5],  # First 5 for debugging
            "timestamp": datetime.utcnow().isoformat()
        }
        
    except Exception as e:
        logger.error(f"Error getting concurrency debug info: {str(e)}")
        return {"error": str(e)}

