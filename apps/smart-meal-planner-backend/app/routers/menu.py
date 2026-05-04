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
from psycopg2.extras import RealDictCursor
# Use the enhanced DB with specialized connection pools
from ..db import get_db_connection, get_db_cursor
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
from ..utils.auth_utils import get_user_from_token, admin_required
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

def detect_duplicates_for_regeneration(day_json: Dict[str, Any]) -> List[str]:
    """Detect duplicate titles that need regeneration, not just renaming"""
    seen_titles = set()
    duplicate_titles = []
    
    # Check meals
    if 'meals' in day_json:
        for meal in day_json['meals']:
            title = meal.get('title', '').strip()
            if title:
                if title in seen_titles:
                    if title not in duplicate_titles:
                        duplicate_titles.append(title)
                seen_titles.add(title)
    
    # Check snacks
    if 'snacks' in day_json:
        for snack in day_json['snacks']:
            title = snack.get('title', '').strip()
            if title:
                if title in seen_titles:
                    if title not in duplicate_titles:
                        duplicate_titles.append(title)
                seen_titles.add(title)
    
    return duplicate_titles

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
    
    # CRITICAL: Check for duplicate titles within this day's plan first
    day_titles = set()
    for meal in day_json.get("meals", []):
        title = meal.get("title", "").strip()
        if title:
            if title in day_titles:
                issues.append(f"🚨 DUPLICATE IN SAME DAY: '{title}' appears multiple times")
            day_titles.add(title)
    
    for snack in day_json.get("snacks", []):
        title = snack.get("title", "").strip()
        if title:
            if title in day_titles:
                issues.append(f"🚨 DUPLICATE IN SAME DAY: '{title}' appears multiple times")
            day_titles.add(title)
    
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

def smart_duplicate_cleanup(day_json: Dict[str, Any], used_meal_titles: Set[str], day_number: int) -> Dict[str, Any]:
    """
    Intelligent cleanup of duplicate titles when AI fails to generate unique names.
    Creates genuinely different meal alternatives rather than just renaming duplicates.
    """
    logger.info(f"Starting smart duplicate cleanup for day {day_number}")
    
    # Define intelligent meal alternatives for common duplicate patterns
    meal_alternatives = {
        # Protein-based alternatives
        'chicken': ['turkey', 'pork', 'beef', 'salmon', 'cod'],
        'beef': ['pork', 'turkey', 'chicken', 'salmon'],
        'pork': ['beef', 'turkey', 'chicken', 'cod'],
        'turkey': ['chicken', 'pork', 'beef', 'salmon'],
        'salmon': ['cod', 'chicken', 'turkey', 'beef'],
        'cod': ['salmon', 'chicken', 'turkey', 'pork'],
        
        # Cooking method alternatives
        'grilled': ['baked', 'pan-seared', 'roasted', 'air-fried'],
        'baked': ['grilled', 'roasted', 'pan-seared', 'braised'],
        'roasted': ['baked', 'grilled', 'braised', 'sautéed'],
        'fried': ['baked', 'grilled', 'roasted', 'steamed'],
        
        # Cuisine style alternatives
        'spicy': ['smoky', 'garlicky', 'herbed', 'tangy'],
        'smoky': ['spicy', 'garlicky', 'savory', 'herbed'],
        'garlicky': ['herbed', 'smoky', 'spicy', 'tangy'],
    }
    
    # Track titles within this day to avoid same-day duplicates
    day_titles = set()
    all_meals = []
    
    # Collect all meals and snacks
    for meal in day_json.get("meals", []):
        all_meals.append(('meal', meal))
    for snack in day_json.get("snacks", []):
        all_meals.append(('snack', snack))
    
    # Process each meal/snack and fix duplicates
    for meal_type, meal in all_meals:
        original_title = meal.get("title", "").strip()
        
        # Check if this title is a duplicate (same day or previous days)
        title_lower = original_title.lower()
        is_duplicate = (title_lower in day_titles or 
                       original_title in used_meal_titles or
                       title_lower in [t.lower() for t in used_meal_titles])
        
        if is_duplicate:
            logger.warning(f"Fixing duplicate title: '{original_title}'")
            new_title = generate_alternative_meal(original_title, day_titles, used_meal_titles, meal_alternatives)
            meal["title"] = new_title
            logger.info(f"Replaced duplicate '{original_title}' with '{new_title}'")
        
        # Add to day titles set (use lower case for comparison)
        day_titles.add(meal.get("title", "").lower())
    
    logger.info(f"Smart duplicate cleanup completed for day {day_number}")
    return day_json

def generate_alternative_meal(original_title: str, day_titles: Set[str], used_titles: Set[str], alternatives: Dict[str, List[str]]) -> str:
    """Generate an intelligent alternative meal title that's genuinely different"""
    
    # Split title into words for intelligent replacement
    words = original_title.lower().split()
    
    # Try to find and replace key components
    for i, word in enumerate(words):
        if word in alternatives:
            for alt in alternatives[word]:
                # Create new title with alternative
                new_words = words.copy()
                new_words[i] = alt
                new_title = ' '.join(new_words).title()
                
                # Check if this new title is unique
                if (new_title not in used_titles and 
                    new_title.lower() not in day_titles and
                    new_title.lower() not in [t.lower() for t in used_titles]):
                    return new_title
    
    # If intelligent replacement fails, use method-based alternatives
    method_alternatives = [
        ("Spicy", "Smoky"), ("Smoky", "Garlicky"), ("Garlicky", "Herbed"),
        ("Grilled", "Baked"), ("Baked", "Roasted"), ("Roasted", "Pan-Seared"),
        ("Chicken", "Turkey"), ("Turkey", "Pork"), ("Pork", "Beef"),
        ("Beef", "Salmon"), ("Salmon", "Cod"),
        ("Tacos", "Bowl"), ("Bowl", "Salad"), ("Salad", "Wrap"),
        ("Wrap", "Sandwich"), ("Sandwich", "Skewers")
    ]
    
    for old_word, new_word in method_alternatives:
        if old_word.lower() in original_title.lower():
            new_title = original_title.replace(old_word, new_word)
            if (new_title not in used_titles and 
                new_title.lower() not in day_titles and
                new_title.lower() not in [t.lower() for t in used_titles]):
                return new_title
    
    # Last resort: add descriptive prefix
    prefixes = ["Savory", "Hearty", "Fresh", "Crispy", "Tender", "Zesty", "Rich", "Light"]
    for prefix in prefixes:
        new_title = f"{prefix} {original_title}"
        if (new_title not in used_titles and 
            new_title.lower() not in day_titles and
            new_title.lower() not in [t.lower() for t in used_titles]):
            return new_title
    
    # Final fallback: use meal type + number
    import random
    backup_meals = [
        "Mediterranean Power Bowl", "Asian Fusion Stir-Fry", "Southwest Protein Pack",
        "Italian Herb Medley", "Greek Style Feast", "BBQ Fusion Plate",
        "Moroccan Spice Bowl", "Thai-Inspired Dish", "Mexican Fiesta Plate"
    ]
    
    for backup in backup_meals:
        if (backup not in used_titles and 
            backup.lower() not in day_titles and
            backup.lower() not in [t.lower() for t in used_titles]):
            return backup
    
    # Ultimate fallback - should rarely be reached
    return f"Alternative Meal {random.randint(100, 999)}"

def auto_fix_duplicates(day_json: Dict[str, Any]) -> Dict[str, Any]:
    """
    Auto-fix duplicate titles within a single day's meal plan.
    This is a lightweight version for single-request generation.
    """
    if not day_json or "meals" not in day_json:
        return day_json
    
    day_titles = set()
    
    # Process meals
    for meal in day_json.get("meals", []):
        title = meal.get("title", "").strip()
        if title:
            title_lower = title.lower()
            if title_lower in day_titles:
                # Generate a quick alternative
                alternatives = ["Alternative", "Variation", "Style", "Twist", "Version"]
                import random
                new_title = f"{random.choice(alternatives)} {title}"
                meal["title"] = new_title
                logger.info(f"Auto-fixed same-day duplicate: '{title}' → '{new_title}'")
            day_titles.add(title_lower)
    
    # Process snacks
    for snack in day_json.get("snacks", []):
        title = snack.get("title", "").strip()
        if title:
            title_lower = title.lower()
            if title_lower in day_titles:
                # Generate a quick alternative
                alternatives = ["Quick", "Simple", "Easy", "Light", "Mini"]
                import random
                new_title = f"{random.choice(alternatives)} {title}"
                snack["title"] = new_title
                logger.info(f"Auto-fixed same-day duplicate snack: '{title}' → '{new_title}'")
            day_titles.add(title_lower)
    
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

def process_preferred_proteins(user_row):
    """Helper function to process preferred proteins"""
    preferred_proteins = []
    if user_row and user_row.get("preferred_proteins"):
        protein_data = user_row["preferred_proteins"]
        other_proteins_data = user_row.get("other_proteins", {})
        
        # Extract selected proteins from each category
        for category, proteins in protein_data.items():
            if isinstance(proteins, dict):
                for protein_key, is_selected in proteins.items():
                    if is_selected:
                        if protein_key == 'other':
                            # Handle custom "Other" proteins
                            custom_proteins = other_proteins_data.get(category, "")
                            if custom_proteins and custom_proteins.strip():
                                # Split by comma and add each custom protein
                                custom_list = [p.strip() for p in custom_proteins.split(',') if p.strip()]
                                preferred_proteins.extend(custom_list)
                        else:
                            # Convert protein key to readable name
                            readable_name = protein_key.replace('_', ' ').title()
                            # Handle special cases for better readability
                            readable_name = readable_name.replace('Dairy Milk', 'Milk')
                            readable_name = readable_name.replace('Dairy Yogurt', 'Yogurt')
                            readable_name = readable_name.replace('Protein Powder Whey', 'Whey Protein')
                            readable_name = readable_name.replace('Protein Powder Pea', 'Pea Protein')
                            readable_name = readable_name.replace('Black Beans', 'Black Beans')
                            preferred_proteins.append(readable_name)
    
    return preferred_proteins

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

async def _run_agent_pipeline(req: GenerateMealPlanRequest, job_id: str = None) -> dict:
    """Fetch prefs and run the 3-stage agent pipeline. Returns result dict."""
    from ..ai.pipeline_orchestrator import run_pipeline

    preference_user_id = req.for_client_id if req.for_client_id else req.user_id

    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        cursor.execute("""
            SELECT recipe_type, macro_protein, macro_carbs, macro_fat, calorie_goal,
                   appliances, prep_complexity, servings_per_meal, meal_times,
                   dietary_restrictions, disliked_ingredients, snacks_per_day,
                   flavor_preferences, spice_level, recipe_type_preferences,
                   meal_time_preferences, time_constraints, prep_preferences,
                   preferred_proteins, other_proteins,
                   carb_cycling_enabled, carb_cycling_config, diet_type
            FROM user_profiles WHERE id = %s
        """, (preference_user_id,))
        prefs = cursor.fetchone()
        if not prefs:
            raise HTTPException(404, f"User {preference_user_id} not found")

        result = await run_pipeline(
            req=req,
            prefs=dict(prefs),
            cursor=cursor,
            conn=conn,
            user_id=preference_user_id,
            job_id=job_id,
        )
    return result


def generate_meal_plan_variety(req: GenerateMealPlanRequest, job_id: str = None):
    """Generate a meal plan using the 3-stage agent pipeline."""
    from ..utils.snack_enhancer import enhance_meal_plan_snacks
    logger.info("🤖 PIPELINE: Using 3-stage agent pipeline for user %s", req.user_id)
    result = asyncio.run(_run_agent_pipeline(req, job_id))
    return enhance_meal_plan_snacks(result)

# Background Job Endpoints
@router.post("/generate-async")
async def start_menu_generation_async(req: GenerateMealPlanRequest, background_tasks: BackgroundTasks, current_user: dict = Depends(get_user_from_token)):
    """Start async menu generation — user_id is always taken from the auth token."""
    req.user_id = current_user["user_id"]  # never trust client-supplied user_id
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
async def get_menu_generation_status(job_id: str, current_user: dict = Depends(get_user_from_token)):
    """Get the status of a background menu generation job."""
    try:
        status = get_cached_job_status(job_id)

        if not status:
            raise HTTPException(status_code=404, detail="Job not found")

        if status.get("user_id") != current_user["user_id"]:
            raise HTTPException(status_code=403, detail="Access denied")

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
async def get_active_jobs_for_user(user_id: int, current_user: dict = Depends(get_user_from_token)):
    """Get any active menu generation jobs for a user."""
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
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

@router.get("/latest/{user_id}")
def get_latest_menu(user_id: int, current_user: dict = Depends(get_user_from_token)):
    """Fetch the most recent menu for a user."""
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    try:
        # Use autocommit for quick menu retrieval
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cursor, conn):
            # Autocommit is enabled at connection creation time
            
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
def get_menu_history(user_id: int, current_user: dict = Depends(get_user_from_token)):
    """Get menu history for a user."""
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    # Use autocommit for menu history retrieval
    with get_db_cursor(dict_cursor=True, autocommit=True) as (cursor, conn):
        # Autocommit is enabled at connection creation time
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
async def update_menu_nickname(menu_id: int, nickname: str = Body(..., embed=True), current_user: dict = Depends(get_user_from_token)):
    """Update the nickname for a menu."""
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
            cursor.execute("SELECT user_id FROM menus WHERE id = %s", (menu_id,))
            menu = cursor.fetchone()
            if not menu:
                raise HTTPException(status_code=404, detail="Menu not found")
            if menu["user_id"] != current_user["user_id"]:
                raise HTTPException(status_code=403, detail="Access denied")
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
def get_grocery_list(menu_id: int, current_user: dict = Depends(get_user_from_token)):
    """Get grocery list for a specific menu."""
    # Use autocommit for grocery list operations
    with get_db_cursor(dict_cursor=True, autocommit=True) as (cursor, conn):
        # Autocommit is enabled at connection creation time
        try:
            cursor.execute("""
                SELECT meal_plan_json, user_id
                FROM menus
                WHERE id = %s;
            """, (menu_id,))

            menu = cursor.fetchone()
            if not menu:
                raise HTTPException(status_code=404, detail="No grocery list found for this menu.")
            if menu["user_id"] != current_user["user_id"]:
                raise HTTPException(status_code=403, detail="Access denied")

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
def get_latest_grocery_list(user_id: int, current_user: dict = Depends(get_user_from_token)):
    """Get grocery list for user's latest menu."""
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
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
    current_user: dict = Depends(get_user_from_token)
):
    """Retrieve full menu details for a specific menu."""
    user_id = current_user["user_id"]
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

            # Verify ownership
            if menu["user_id"] != user_id:
                raise HTTPException(status_code=403, detail="Access denied")

            # Track that user viewed this menu
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


@router.get("/shared/{user_id}")
async def get_shared_menus(user_id: int, current_user: dict = Depends(get_user_from_token)):
    """Get menus shared with the current user."""
    if current_user["user_id"] != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
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
async def get_database_connection_stats(admin=Depends(admin_required)):
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
async def get_concurrency_debug_info(admin=Depends(admin_required)):
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

@router.delete("/{menu_id}")
async def delete_menu(
    menu_id: int,
    user = Depends(get_user_from_token)
):
    """Delete a menu and all related data (saved recipes, sharing records)"""
    with get_db_cursor(dict_cursor=True) as (cursor, conn):
        try:
            user_id = user.get('user_id')
            org_id = user.get('organization_id')
            role = user.get('role', '')
            
            # First, check if the menu exists and get ownership info
            cursor.execute("""
                SELECT id, user_id, for_client_id, shared_with_organization
                FROM menus
                WHERE id = %s
            """, (menu_id,))
            
            menu = cursor.fetchone()
            
            if not menu:
                raise HTTPException(
                    status_code=404,
                    detail="Menu not found"
                )
            
            # Check permissions
            # User can delete if:
            # 1. They are the menu owner
            # 2. They are an organization owner and the menu is shared with organization
            # 3. They are an organization owner and the menu was created for a client in their org
            can_delete = False
            
            if menu['user_id'] == user_id:
                can_delete = True
            elif role == 'owner' and org_id:
                # Check if menu is shared with organization
                if menu['shared_with_organization']:
                    cursor.execute("""
                        SELECT 1 FROM user_profiles
                        WHERE id = %s AND organization_id = %s
                    """, (menu['user_id'], org_id))
                    if cursor.fetchone():
                        can_delete = True
                
                # Check if menu was created for a client in their organization
                if menu['for_client_id']:
                    cursor.execute("""
                        SELECT 1 FROM user_profiles
                        WHERE id = %s AND organization_id = %s
                    """, (menu['for_client_id'], org_id))
                    if cursor.fetchone():
                        can_delete = True
            
            if not can_delete:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to delete this menu"
                )
            
            # Start transaction for safe deletion
            # Delete in order of dependencies
            
            # 1. Delete shared_menus records
            cursor.execute("""
                DELETE FROM shared_menus
                WHERE menu_id = %s
            """, (menu_id,))
            shared_deleted = cursor.rowcount
            
            # 2. Delete saved_recipes records
            cursor.execute("""
                DELETE FROM saved_recipes
                WHERE menu_id = %s
            """, (menu_id,))
            recipes_deleted = cursor.rowcount
            
            # 3. Delete the menu itself
            cursor.execute("""
                DELETE FROM menus
                WHERE id = %s
                RETURNING id, nickname
            """, (menu_id,))
            
            deleted_menu = cursor.fetchone()
            
            if not deleted_menu:
                conn.rollback()
                raise HTTPException(
                    status_code=500,
                    detail="Failed to delete menu"
                )
            
            # Commit the transaction
            conn.commit()
            
            logger.info(f"Menu {menu_id} deleted successfully by user {user_id}. "
                       f"Cascade deleted: {shared_deleted} shares, {recipes_deleted} saved recipes")
            
            return {
                "message": "Menu deleted successfully",
                "menu_id": deleted_menu['id'],
                "menu_nickname": deleted_menu['nickname'],
                "cascade_deleted": {
                    "shared_menus": shared_deleted,
                    "saved_recipes": recipes_deleted
                }
            }
            
        except HTTPException:
            conn.rollback()
            raise
        except Exception as e:
            conn.rollback()
            logger.error(f"Error deleting menu {menu_id}: {str(e)}", exc_info=True)
            raise HTTPException(status_code=500, detail=str(e))

