# app/routers/recipe_ratings.py - Fixed version with isolated rating connections
from fastapi import APIRouter, HTTPException, Depends, Body, Request
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
from datetime import datetime
import logging
from psycopg2.extras import RealDictCursor
from ..utils.auth_utils import get_user_from_token
import jwt
from ..config import JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ratings", tags=["Ratings"])

# Simplified auth function for ratings that doesn't hit the problematic database pool
async def get_rating_user_from_token(request):
    """Simplified authentication for rating endpoints that bypasses DB organization lookup"""
    logger.info(f"=== RATING AUTH DEBUG ===")
    logger.info(f"Request path: {request.url.path}")
    logger.info(f"Request method: {request.method}")
    
    # Log all headers for debugging
    logger.info("Request headers:")
    for header_name, header_value in request.headers.items():
        if header_name.lower() == 'authorization':
            logger.info(f"  {header_name}: Bearer ***")
        else:
            logger.info(f"  {header_name}: {header_value}")
    
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        logger.error("No Authorization header found for rating request")
        return None
    
    logger.info(f"Auth header present, length: {len(auth_header)}")
    
    try:
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
            logger.info(f"Extracted token, length: {len(token)}")
        else:
            token = auth_header
            logger.info("Using auth header as token directly")
            
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        logger.info(f"JWT decoded successfully. Payload keys: {list(payload.keys())}")
        
        user_id = payload.get('user_id')
        if not user_id:
            logger.error(f"Token payload missing user_id. Full payload: {payload}")
            return None
        
        # Return just the basic payload without organization data to avoid DB calls
        logger.info(f"Rating auth successful for user {user_id}")
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired for rating request")
        return None
    except jwt.PyJWTError as e:
        logger.error(f"JWT validation error for rating request: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in rating token validation: {str(e)}")
        logger.error(f"Exception type: {type(e).__name__}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        return None

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify routing works"""
    return {"status": "ratings route working"}

@router.post("/test-auth")
async def test_auth_post(request: Request):
    """Test POST endpoint to debug authentication"""
    logger.info("=== TEST AUTH POST ===")
    
    # Check if we can get the auth header
    auth_header = request.headers.get('Authorization')
    logger.info(f"Auth header present: {bool(auth_header)}")
    
    # Try our simplified auth
    user = await get_rating_user_from_token(request)
    logger.info(f"Auth result: {bool(user)}")
    
    if user:
        return {
            "status": "auth working",
            "user_id": user.get('user_id'),
            "method": "POST"
        }
    else:
        return {
            "status": "auth failed",
            "method": "POST"
        }

@router.get("/auth-test")
async def auth_test_endpoint(request: Request):
    """Test endpoint to verify authentication works"""
    user = await get_rating_user_from_token(request)
    
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required for rating auth test")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    user_id = user.get('user_id')
    logger.info(f"AUTH TEST: Rating auth working for user {user_id}")
    
    return {
        "status": "authentication working",
        "user_id": user_id,
        "user_type": type(user).__name__,
        "auth_method": "simplified_rating_auth"
    }

# Pydantic models for ratings
class RatingAspects(BaseModel):
    taste: Optional[int] = Field(None, ge=1, le=5)
    ease_of_preparation: Optional[int] = Field(None, ge=1, le=5)
    ingredient_availability: Optional[int] = Field(None, ge=1, le=5)
    portion_size: Optional[int] = Field(None, ge=1, le=5)
    nutrition_balance: Optional[int] = Field(None, ge=1, le=5)
    presentation: Optional[int] = Field(None, ge=1, le=5)

class RecipeRating(BaseModel):
    rating_score: int = Field(..., ge=1, le=5)
    rating_aspects: Optional[RatingAspects] = None
    feedback_text: Optional[str] = Field(None, max_length=1000)
    made_recipe: Optional[bool] = False
    would_make_again: Optional[bool] = None
    difficulty_rating: Optional[int] = Field(None, ge=1, le=5)
    time_accuracy: Optional[int] = Field(None, ge=1, le=5)

    @validator('would_make_again')
    def validate_would_make_again(cls, v, values):
        if v is not None and not values.get('made_recipe'):
            raise ValueError('cannot rate "would_make_again" if recipe was not made')
        return v

class MenuRating(BaseModel):
    overall_rating: int = Field(..., ge=1, le=5)
    variety_score: Optional[int] = Field(None, ge=1, le=5)
    nutrition_balance: Optional[int] = Field(None, ge=1, le=5)
    practicality: Optional[int] = Field(None, ge=1, le=5)
    feedback_text: Optional[str] = Field(None, max_length=1000)

# Create isolated database connection for ratings to avoid pool conflicts
def get_rating_db_connection():
    """Get a direct database connection for rating operations only"""
    try:
        from ..config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT
        import psycopg2
        
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT,
            connect_timeout=10
        )
        return conn
    except Exception as e:
        logger.error(f"Failed to create rating database connection: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection failed")

# Simplified database execution for ratings only
def execute_rating_query(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a database query specifically for rating operations"""
    conn = None
    try:
        conn = get_rating_db_connection()
        conn.autocommit = True
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SET statement_timeout = 15000")  # 15 second timeout
            cur.execute(query, params)
            
            if fetch_one:
                return cur.fetchone()
            elif fetch_all:
                return cur.fetchall()
            else:
                return None
                
    except Exception as e:
        logger.error(f"Rating database operation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Rating operation failed: {str(e)}")
    finally:
        if conn:
            try:
                conn.close()
            except:
                pass

# Recipe Rating Endpoints
@router.post("/recipes/{recipe_id}/rate")
async def rate_recipe(
    recipe_id: int,
    rating: RecipeRating,
    request: Request
):
    """Submit a rating for a recipe"""
    logger.info(f"=== RATE RECIPE ENDPOINT ===")
    logger.info(f"Recipe ID: {recipe_id}")
    logger.info(f"Request method: {request.method}")
    logger.info(f"Request URL: {request.url}")
    
    # Log headers
    auth_header = request.headers.get('Authorization')
    logger.info(f"Authorization header exists: {bool(auth_header)}")
    if auth_header:
        logger.info(f"Auth header starts with Bearer: {auth_header.startswith('Bearer ')}")
    
    # Use simplified auth that doesn't hit the problematic database pool
    logger.info("Calling get_rating_user_from_token...")
    try:
        user = await get_rating_user_from_token(request)
        logger.info(f"Auth function completed. User returned: {bool(user)}")
        if user:
            logger.info(f"User ID from auth: {user.get('user_id')}")
    except Exception as e:
        logger.error(f"Exception in auth function: {str(e)}")
        user = None
    
    # Check if user is authenticated
    if not user:
        logger.error("Authentication failed - user object is None")
        logger.error("Returning 401 Unauthorized")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )

    user_id = user.get('user_id')
    logger.info(f"Rating submission authenticated for user {user_id}, recipe {recipe_id}")
    
    if not user_id:
        logger.error("User ID not found in token")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    try:
        
        # Get or create recipe interaction
        interaction_result = execute_rating_query(
            "SELECT get_or_create_recipe_interaction(%s, %s, %s)", 
            (user_id, recipe_id, 'rating'),
            fetch_one=True
        )
        interaction_id = interaction_result['get_or_create_recipe_interaction']
        
        # Convert rating_aspects to JSON string if it exists
        import json
        rating_aspects_json = json.dumps(rating.rating_aspects.model_dump()) if rating.rating_aspects else None
        
        # Update the rating
        updated_rating = execute_rating_query("""
            UPDATE recipe_interactions 
            SET rating_score = %s,
                rating_aspects = %s::jsonb,
                feedback_text = %s,
                made_recipe = %s,
                would_make_again = %s,
                difficulty_rating = %s,
                time_accuracy = %s,
                interaction_type = 'rating',
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
            RETURNING *
        """, (
            rating.rating_score,
            rating_aspects_json,
            rating.feedback_text,
            rating.made_recipe,
            rating.would_make_again,
            rating.difficulty_rating,
            rating.time_accuracy,
            interaction_id
        ), fetch_one=True)
        
        result = {
            "success": True,
            "message": "Rating saved successfully",
            "rating_id": updated_rating['id'] if updated_rating else None,
            "recipe_id": recipe_id
        }
        logger.info(f"Returning success response: {result}")
        return result
        
    except Exception as e:
        logger.error(f"Error saving rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save rating: {str(e)}")

@router.get("/recipes/{recipe_id}/ratings")
async def get_recipe_ratings(recipe_id: int):
    """Get aggregated ratings for a recipe"""
    logger.info(f"Getting ratings for recipe {recipe_id}")
    try:
        # Get rating summary from view
        summary = execute_rating_query(
            "SELECT * FROM recipe_ratings_summary WHERE recipe_id = %s",
            (recipe_id,),
            fetch_one=True
        )
        logger.info(f"Summary query completed: {bool(summary)}")
        
        if not summary:
            return {
                "recipe_id": recipe_id,
                "total_ratings": 0,
                "average_rating": None,
                "message": "No ratings yet"
            }
        
        # Get recent reviews
        recent_reviews = execute_rating_query("""
            SELECT 
                ri.rating_score,
                ri.feedback_text,
                ri.made_recipe,
                ri.would_make_again,
                ri.updated_at,
                u.full_name as user_name
            FROM recipe_interactions ri
            JOIN user_profiles u ON ri.user_id = u.id
            WHERE ri.recipe_id = %s 
            AND ri.rating_score IS NOT NULL
            ORDER BY ri.updated_at DESC
            LIMIT 5
        """, (recipe_id,), fetch_all=True)
        
        return {
            "recipe_id": recipe_id,
            "summary": dict(summary),
            "recent_reviews": [dict(review) for review in (recent_reviews or [])]
        }
        
    except Exception as e:
        logger.error(f"Error getting recipe ratings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get ratings: {str(e)}")

@router.get("/recipes/{recipe_id}/my-rating")
async def get_my_recipe_rating(
    recipe_id: int,
    request: Request
):
    """Get current user's rating for a recipe"""
    # Use simplified auth
    user = await get_rating_user_from_token(request)
    
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required to get rating")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    try:
        user_id = user.get('user_id')
        
        my_rating = execute_rating_query("""
            SELECT * FROM recipe_interactions
            WHERE user_id = %s AND recipe_id = %s 
            AND rating_score IS NOT NULL
            ORDER BY updated_at DESC
            LIMIT 1
        """, (user_id, recipe_id), fetch_one=True)
        
        if not my_rating:
            return {"message": "No rating found"}
        
        return {
            "rating": dict(my_rating)
        }
        
    except Exception as e:
        logger.error(f"Error getting user rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get user rating: {str(e)}")

# Menu Rating Endpoints
@router.post("/menus/{menu_id}/rate")
async def rate_menu(
    menu_id: int,
    rating: MenuRating,
    request: Request
):
    """Submit a rating for an entire menu"""
    # Use simplified auth
    user = await get_rating_user_from_token(request)
    
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required to rate menu")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    try:
        user_id = user.get('user_id')
        
        # Store menu rating in recipe_interactions with special recipe_id
        import json
        menu_aspects_json = json.dumps({
            "variety_score": rating.variety_score,
            "nutrition_balance": rating.nutrition_balance,
            "practicality": rating.practicality
        })
        
        menu_rating = execute_rating_query("""
            INSERT INTO recipe_interactions 
            (user_id, recipe_id, interaction_type, rating_score, 
             rating_aspects, feedback_text, timestamp, updated_at)
            VALUES (%s, %s, 'menu_rating', %s, %s::jsonb, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
            ON CONFLICT (user_id, recipe_id) 
            DO UPDATE SET 
                rating_score = EXCLUDED.rating_score,
                rating_aspects = EXCLUDED.rating_aspects,
                feedback_text = EXCLUDED.feedback_text,
                updated_at = CURRENT_TIMESTAMP
            RETURNING *
        """, (
            user_id,
            -menu_id,  # Negative ID to distinguish from recipe ratings
            rating.overall_rating,
            menu_aspects_json,
            rating.feedback_text
        ), fetch_one=True)
        
        return {
            "success": True,
            "message": "Menu rating saved successfully",
            "rating_id": menu_rating['id'],
            "menu_id": menu_id
        }
        
    except Exception as e:
        logger.error(f"Error saving menu rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save menu rating: {str(e)}")

# Analytics Endpoints
@router.get("/users/{user_id}/preferences")
async def get_user_preferences(
    user_id: int,
    request: Request
):
    """Get user's rating-based preferences"""
    # Use simplified auth
    user = await get_rating_user_from_token(request)
    
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required to get preferences")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    try:
        # Only allow users to see their own preferences or admins
        current_user_id = user.get('user_id')
        if current_user_id != user_id and user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Access denied")
        
        preferences = execute_rating_query(
            "SELECT * FROM user_rating_preferences WHERE user_id = %s",
            (user_id,),
            fetch_one=True
        )
        
        if not preferences:
            return {"message": "No rating preferences found"}
        
        return {
            "user_id": user_id,
            "preferences": dict(preferences)
        }
        
    except Exception as e:
        logger.error(f"Error getting preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@router.get("/recipes/recommended")
async def get_recommended_recipes(
    request: Request,
    limit: int = 10
):
    """Get recipe recommendations based on user's ratings"""
    # Use simplified auth
    user = await get_rating_user_from_token(request)
    
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required to get recommendations")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    try:
        user_id = user.get('user_id')
        
        # Simple recommendation based on highly rated recipes by similar users
        recommendations = execute_rating_query("""
            SELECT DISTINCT
                ri2.recipe_id,
                AVG(ri2.rating_score) as avg_rating,
                COUNT(*) as rating_count
            FROM recipe_interactions ri1
            JOIN recipe_interactions ri2 ON ri1.user_id != ri2.user_id
            WHERE ri1.user_id = %s 
            AND ri1.rating_score >= 4
            AND ri2.rating_score >= 4
            AND ri2.recipe_id NOT IN (
                SELECT recipe_id FROM recipe_interactions 
                WHERE user_id = %s AND rating_score IS NOT NULL
            )
            GROUP BY ri2.recipe_id
            HAVING COUNT(*) >= 2
            ORDER BY avg_rating DESC, rating_count DESC
            LIMIT %s
        """, (user_id, user_id, limit), fetch_all=True)
        
        return {
            "user_id": user_id,
            "recommendations": [dict(rec) for rec in (recommendations or [])]
        }
        
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")