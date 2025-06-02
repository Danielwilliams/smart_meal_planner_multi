"""
Enhanced menu generation implementation using specialized connection pools.
This demonstrates how to update the menu generation to use the AI connection pool.
"""

import json
import time
import asyncio
import uuid
from datetime import datetime
from fastapi import HTTPException, BackgroundTasks
from pydantic import BaseModel
import openai
import logging
import threading
from ..db_enhanced import get_db_cursor  # Using enhanced DB with specialized pools
from ..config import OPENAI_API_KEY

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Configure OpenAI API
openai.api_key = OPENAI_API_KEY

# Concurrency control
MAX_CONCURRENT_GENERATIONS = 10
generation_semaphore = asyncio.Semaphore(MAX_CONCURRENT_GENERATIONS)

# Track menu generations by user to prevent duplicates
active_user_generations = {}
user_generation_lock = threading.Lock()

# Job status cache
_job_status_cache = {}
_status_cache_lock = threading.Lock()

class GenerateMealPlanRequest(BaseModel):
    user_id: int
    duration_days: int = 7
    diet_type: str = None
    dietary_preferences: list = []
    disliked_foods: list = []
    meal_times: list = ["Breakfast", "Lunch", "Dinner"]
    servings_per_meal: int = None
    calorie_goal: int = None
    macro_protein: int = None
    macro_carbs: int = None
    macro_fat: int = None
    prep_complexity: int = None
    ai_model: str = "default"
    for_client_id: int = None
    snacks_per_day: int = None

def get_cached_job_status(job_id):
    """Get job status from cache"""
    with _status_cache_lock:
        return _job_status_cache.get(job_id)

def batch_update_job_status(job_id, updates, force_db_update=False):
    """Update job status in cache and optionally in DB"""
    with _status_cache_lock:
        # Update cache first (fast)
        if job_id in _job_status_cache:
            _job_status_cache[job_id].update(updates)
            _job_status_cache[job_id]['last_updated'] = datetime.utcnow()
        else:
            # Create new entry if it doesn't exist
            _job_status_cache[job_id] = {
                **updates,
                'created_at': datetime.utcnow(),
                'last_updated': datetime.utcnow()
            }
    
    # Update database if forced or for important status changes
    if force_db_update or updates.get('status') in ['completed', 'failed']:
        try:
            # Use AI pool for status updates to not block main operations
            with get_db_cursor(dict_cursor=True, pool_type='ai', timeout=10) as (cursor, conn):
                # Check if job exists in DB
                cursor.execute("""
                    SELECT id FROM menu_generation_jobs WHERE job_id = %s
                """, (job_id,))
                
                job_exists = cursor.fetchone() is not None
                
                if job_exists:
                    # Update existing job
                    set_clauses = []
                    params = []
                    
                    for key, value in updates.items():
                        if key not in ['job_id', 'user_id', 'client_id', 'created_at']:
                            set_clauses.append(f"{key} = %s")
                            params.append(value if not isinstance(value, dict) else json.dumps(value))
                    
                    set_clauses.append("updated_at = CURRENT_TIMESTAMP")
                    
                    cursor.execute(f"""
                        UPDATE menu_generation_jobs
                        SET {', '.join(set_clauses)}
                        WHERE job_id = %s
                    """, (*params, job_id))
                else:
                    # Get necessary fields from cache
                    cached_job = _job_status_cache[job_id]
                    user_id = cached_job.get('user_id')
                    client_id = cached_job.get('client_id')
                    
                    # Create new job record
                    cursor.execute("""
                        INSERT INTO menu_generation_jobs
                        (job_id, user_id, client_id, status, progress, message, created_at, updated_at)
                        VALUES (%s, %s, %s, %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, (
                        job_id, 
                        user_id, 
                        client_id,
                        updates.get('status', 'started'),
                        updates.get('progress', 0),
                        updates.get('message', 'Menu generation started')
                    ))
                
                conn.commit()
                logger.info(f"Updated job {job_id} status in database: {updates.get('status')}")
                
        except Exception as e:
            logger.error(f"Failed to update job status in database: {str(e)}", exc_info=True)
            # We continue even if DB update fails - the cache is the primary source during generation

def generate_meal_plan_variety(req: GenerateMealPlanRequest, job_id: str = None):
    """Generate a meal plan with specialized connection pooling"""
    try:
        import threading
        current_thread = threading.current_thread()
        logger.info(f"THREAD_EXECUTION_DEBUG: generate_meal_plan_variety called on thread: {current_thread.name} (ID: {current_thread.ident})")
        logger.info(f"THREAD_EXECUTION_DEBUG: Job ID: {job_id}, User ID: {req.user_id}")
        
        if req.duration_days < 1 or req.duration_days > 7:
            raise HTTPException(400, "duration_days must be between 1 and 7")

        # PHASE 1: Fetch user preferences with READ pool (faster, non-blocking)
        user_row = None
        logger.info("Opening database connection to fetch user preferences")

        # Determine which user's preferences to use
        preference_user_id = req.for_client_id if req.for_client_id else req.user_id

        # Use the READ pool with context manager for safer database operations
        with get_db_cursor(dict_cursor=True, pool_type='read', timeout=10) as (cursor, conn):
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
        # [Code for processing preferences - omitted for brevity]

        # PHASE 3: Use AI pool for OpenAI API calls (which can be long-running)
        logger.info("Starting AI meal plan generation")
        
        # Update status to generating (important DB update)
        if job_id:
            batch_update_job_status(job_id, {
                "status": "generating",
                "progress": 10,
                "message": "Calling AI to generate your meal plan..."
            }, force_db_update=True)
        
        # Generate each day's meal plan using OpenAI
        final_plan = {"days": []}
        for day_number in range(1, req.duration_days + 1):
            logger.info(f"Generating day {day_number} of {req.duration_days}")
            
            # Update progress during generation (only to cache, not database)
            if job_id:
                progress = 10 + (day_number - 1) * (80 / req.duration_days)  # 10-90% range
                batch_update_job_status(job_id, {
                    "progress": round(progress),
                    "message": f"Generating day {day_number} of {req.duration_days}..."
                }, force_db_update=False)  # Cache only to reduce DB load
            
            # Simulated meal generation (replace with actual OpenAI call)
            # This is where the actual AI API call would happen
            time.sleep(1)  # Simulate API call time
            
            day_json = {
                "day_number": day_number,
                "meals": [
                    {"title": f"Sample Breakfast {day_number}", "meal_time": "breakfast"},
                    {"title": f"Sample Lunch {day_number}", "meal_time": "lunch"},
                    {"title": f"Sample Dinner {day_number}", "meal_time": "dinner"},
                ]
            }
            
            final_plan["days"].append(day_json)
            
            # Update progress after successful day completion
            if job_id:
                progress = 10 + day_number * (80 / req.duration_days)  # 10-90% range
                batch_update_job_status(job_id, {
                    "progress": round(progress),
                    "message": f"Completed day {day_number} of {req.duration_days}. Saving to database..."
                }, force_db_update=False)  # Cache only

        # PHASE 4: Save the final menu using the AI pool (longer operations)
        logger.info("Opening new database connection to save generated menu")

        # Use the AI pool for database operations
        with get_db_cursor(dict_cursor=True, pool_type='ai', timeout=20) as (cursor, conn):
            try:
                # Prepare the plan data as JSON string once
                plan_json = json.dumps(final_plan)
                meal_times_json = json.dumps(["Breakfast", "Lunch", "Dinner"])

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

async def start_menu_generation_async(req: GenerateMealPlanRequest, background_tasks: BackgroundTasks):
    """Start asynchronous menu generation using specialized connection pools"""
    try:
        logger.info(f"Starting async menu generation for user {req.user_id}")
        
        # Generate unique job ID for tracking
        job_id = str(uuid.uuid4())
        logger.info(f"Generated job_id {job_id}")
        
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
        
        # Create background task for generation
        background_tasks.add_task(
            generate_menu_background_task,
            job_id,
            req
        )
        
        logger.info(f"Returning job_id {job_id} to client immediately")
        
        return {
            "job_id": job_id,
            "status": "started", 
            "message": "Menu generation started successfully"
        }
        
    except Exception as e:
        logger.error(f"Failed to start menu generation: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

async def generate_menu_background_task(job_id: str, req: GenerateMealPlanRequest):
    """Background task that performs the actual menu generation with specialized connection pools"""
    start_time = time.time()
    try:
        logger.info(f"Background task started for job {job_id}")

        # Update status: Starting AI generation (writes to DB - critical status)
        batch_update_job_status(job_id, {
            "status": "generating",
            "progress": 10,
            "message": "Calling AI to generate your meal plan..."
        }, force_db_update=True)  # Force DB write for initial generating status

        # Call the generation function with job_id for progress tracking
        # This function uses the AI pool internally
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
        }, force_db_update=True)  # Force DB update for completion

        logger.info(f"Background task completed successfully for job {job_id}")

    except Exception as e:
        logger.error(f"Background task failed for job {job_id}: {str(e)}", exc_info=True)

        # Update status: Failed (writes to DB - critical status)
        batch_update_job_status(job_id, {
            "status": "failed",
            "progress": 0,
            "message": "Menu generation failed",
            "error_message": str(e)
        }, force_db_update=True)  # Force DB update for failure

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