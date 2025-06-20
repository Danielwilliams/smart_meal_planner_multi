# app/routers/recipe_ratings.py - Fixed version with simple connection handling
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
from datetime import datetime
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection
from ..utils.auth_utils import get_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ratings", tags=["Ratings"])

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

# Helper function for safe database operations
def execute_with_retry(query, params=None, fetch_one=False, fetch_all=False):
    """Execute a database query with simple error handling"""
    conn = None
    try:
        conn = get_db_connection()
        conn.autocommit = True
        
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(query, params)
            
            if fetch_one:
                return cur.fetchone()
            elif fetch_all:
                return cur.fetchall()
            else:
                return None
                
    except Exception as e:
        logger.error(f"Database operation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Database error: {str(e)}")
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
    user = Depends(get_user_from_token)
):
    """Submit a rating for a recipe"""
    try:
        user_id = user.get('id') or user.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        # Get or create recipe interaction
        interaction_result = execute_with_retry(
            "SELECT get_or_create_recipe_interaction(%s, %s, %s)", 
            (user_id, recipe_id, 'rating'),
            fetch_one=True
        )
        interaction_id = interaction_result['get_or_create_recipe_interaction']
        
        # Convert rating_aspects to dict if it exists
        rating_aspects_dict = rating.rating_aspects.model_dump() if rating.rating_aspects else {}
        
        # Update the rating
        updated_rating = execute_with_retry("""
            UPDATE recipe_interactions 
            SET rating_score = %s,
                rating_aspects = %s,
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
            rating_aspects_dict,
            rating.feedback_text,
            rating.made_recipe,
            rating.would_make_again,
            rating.difficulty_rating,
            rating.time_accuracy,
            interaction_id
        ), fetch_one=True)
        
        return {
            "success": True,
            "message": "Rating saved successfully",
            "rating_id": updated_rating['id'],
            "recipe_id": recipe_id
        }
        
    except Exception as e:
        logger.error(f"Error saving rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save rating: {str(e)}")

@router.get("/recipes/{recipe_id}/ratings")
async def get_recipe_ratings(recipe_id: int):
    """Get aggregated ratings for a recipe"""
    try:
        # Get rating summary from view
        summary = execute_with_retry(
            "SELECT * FROM recipe_ratings_summary WHERE recipe_id = %s",
            (recipe_id,),
            fetch_one=True
        )
        
        if not summary:
            return {
                "recipe_id": recipe_id,
                "total_ratings": 0,
                "average_rating": None,
                "message": "No ratings yet"
            }
        
        # Get recent reviews
        recent_reviews = execute_with_retry("""
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
    user = Depends(get_user_from_token)
):
    """Get current user's rating for a recipe"""
    try:
        user_id = user.get('id') or user.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        my_rating = execute_with_retry("""
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
    user = Depends(get_user_from_token)
):
    """Submit a rating for an entire menu"""
    try:
        user_id = user.get('id') or user.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        # Store menu rating in recipe_interactions with special recipe_id
        menu_rating = execute_with_retry("""
            INSERT INTO recipe_interactions 
            (user_id, recipe_id, interaction_type, rating_score, 
             rating_aspects, feedback_text, timestamp, updated_at)
            VALUES (%s, %s, 'menu_rating', %s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
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
            {
                "variety_score": rating.variety_score,
                "nutrition_balance": rating.nutrition_balance,
                "practicality": rating.practicality
            },
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
    user = Depends(get_user_from_token)
):
    """Get user's rating-based preferences"""
    try:
        # Only allow users to see their own preferences or admins
        current_user_id = user.get('id') or user.get('user_id')
        if current_user_id != user_id and user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Access denied")
        
        preferences = execute_with_retry(
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
    limit: int = 10,
    user = Depends(get_user_from_token)
):
    """Get recipe recommendations based on user's ratings"""
    try:
        user_id = user.get('id') or user.get('user_id')
        if not user_id:
            raise HTTPException(status_code=401, detail="User ID not found")
        
        # Simple recommendation based on highly rated recipes by similar users
        recommendations = execute_with_retry("""
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