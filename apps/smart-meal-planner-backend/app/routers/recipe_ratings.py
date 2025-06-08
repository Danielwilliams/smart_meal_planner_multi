# app/routers/recipe_ratings.py
from fastapi import APIRouter, HTTPException, Depends, Body
from pydantic import BaseModel, Field, validator
from typing import Optional, Dict, List
from datetime import datetime
import logging
from ..db import get_db_connection, get_db_cursor
from ..utils.auth_utils import get_user_from_token
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ratings", tags=["Ratings"])

# Pydantic models for ratings
class RatingAspects(BaseModel):
    taste: Optional[int] = Field(None, ge=1, le=5)
    ease_of_preparation: Optional[int] = Field(None, ge=1, le=5)
    ingredient_availability: Optional[int] = Field(None, ge=1, le=5)
    portion_size: Optional[int] = Field(None, ge=1, le=5)
    nutritional_value: Optional[int] = Field(None, ge=1, le=5)
    presentation: Optional[int] = Field(None, ge=1, le=5)
    family_approval: Optional[int] = Field(None, ge=1, le=5)

class RecipeRating(BaseModel):
    rating_score: float = Field(..., ge=1, le=5)
    rating_aspects: Optional[RatingAspects] = None
    feedback_text: Optional[str] = Field(None, max_length=1000)
    made_recipe: bool = False
    would_make_again: Optional[bool] = None
    difficulty_rating: Optional[int] = Field(None, ge=1, le=5)
    time_accuracy: Optional[int] = Field(None, ge=1, le=5)

class MenuRatingAspects(BaseModel):
    variety: Optional[int] = Field(None, ge=1, le=5)
    practicality: Optional[int] = Field(None, ge=1, le=5)
    family_approval: Optional[int] = Field(None, ge=1, le=5)

class MenuRating(BaseModel):
    rating_score: float = Field(..., ge=1, le=5)
    rating_aspects: Optional[MenuRatingAspects] = None
    feedback_text: Optional[str] = Field(None, max_length=1000)
    variety_rating: Optional[int] = Field(None, ge=1, le=5)
    practicality_rating: Optional[int] = Field(None, ge=1, le=5)
    family_approval_rating: Optional[int] = Field(None, ge=1, le=5)
    would_use_again: Optional[bool] = None

class SavedRecipeQuickRating(BaseModel):
    quick_rating: int = Field(..., ge=1, le=5)
    notes: Optional[str] = None

# Recipe Rating Endpoints
@router.post("/recipes/{recipe_id}/rate")
async def rate_recipe(
    recipe_id: int,
    rating: RecipeRating,
    user = Depends(get_user_from_token)
):
    """Submit or update a recipe rating"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get('user_id')
    logger.info(f"User {user_id} rating recipe {recipe_id} with score {rating.rating_score}")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Get or create recipe interaction
            cur.execute("SELECT get_or_create_recipe_interaction(%s, %s, %s)", 
                       (user_id, recipe_id, 'rating'))
            interaction_id = cur.fetchone()['get_or_create_recipe_interaction']
            
            # Convert rating_aspects to dict if it exists
            rating_aspects_dict = rating.rating_aspects.dict() if rating.rating_aspects else {}
            
            # Update the rating
            cur.execute("""
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
            ))
            
            updated_rating = cur.fetchone()
            conn.commit()
            
            # Update saved recipes if there's a link
            if rating.made_recipe:
                cur.execute("""
                    UPDATE saved_recipes 
                    SET quick_rating = %s,
                        last_made_date = CURRENT_DATE
                    WHERE user_id = %s 
                    AND (scraped_recipe_id = %s OR recipe_id = %s)
                """, (rating.rating_score, user_id, recipe_id, recipe_id))
                conn.commit()
            
            logger.info(f"Successfully saved rating for recipe {recipe_id}")
            return {
                "success": True,
                "rating_id": interaction_id,
                "message": "Rating saved successfully"
            }
            
    except Exception as e:
        logger.error(f"Error saving recipe rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save rating: {str(e)}")

@router.get("/recipes/{recipe_id}/ratings")
async def get_recipe_ratings(recipe_id: int):
    """Get aggregated ratings for a recipe"""
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Get rating summary from view
            cur.execute("""
                SELECT * FROM recipe_ratings_summary
                WHERE recipe_id = %s
            """, (recipe_id,))
            
            summary = cur.fetchone()
            
            if not summary:
                return {
                    "recipe_id": recipe_id,
                    "total_ratings": 0,
                    "average_rating": None,
                    "message": "No ratings yet"
                }
            
            # Get recent reviews
            cur.execute("""
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
                AND ri.feedback_text IS NOT NULL
                ORDER BY ri.updated_at DESC
                LIMIT 5
            """, (recipe_id,))
            
            recent_reviews = cur.fetchall()
            
            return {
                "recipe_id": recipe_id,
                "summary": summary,
                "recent_reviews": recent_reviews
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
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get('user_id')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            cur.execute("""
                SELECT * FROM recipe_interactions
                WHERE user_id = %s AND recipe_id = %s
                AND rating_score IS NOT NULL
            """, (user_id, recipe_id))
            
            rating = cur.fetchone()
            
            if not rating:
                return {"has_rating": False}
            
            return {
                "has_rating": True,
                "rating": rating
            }
            
    except Exception as e:
        logger.error(f"Error getting user recipe rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get rating: {str(e)}")

# Menu Rating Endpoints
@router.post("/menus/{menu_id}/rate")
async def rate_menu(
    menu_id: int,
    rating: MenuRating,
    user = Depends(get_user_from_token)
):
    """Submit or update a menu rating"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get('user_id')
    logger.info(f"User {user_id} rating menu {menu_id} with score {rating.rating_score}")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if menu exists and user has access
            cur.execute("""
                SELECT id FROM menus 
                WHERE id = %s AND (user_id = %s OR for_client_id = %s)
            """, (menu_id, user_id, user_id))
            
            if not cur.fetchone():
                raise HTTPException(status_code=403, detail="Menu not found or access denied")
            
            # Convert rating_aspects to dict if it exists
            rating_aspects_dict = rating.rating_aspects.dict() if rating.rating_aspects else {}
            
            # Insert or update menu rating
            cur.execute("""
                INSERT INTO menu_ratings 
                (user_id, menu_id, rating_score, rating_aspects, feedback_text,
                 variety_rating, practicality_rating, family_approval_rating, would_use_again)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (user_id, menu_id) 
                DO UPDATE SET 
                    rating_score = EXCLUDED.rating_score,
                    rating_aspects = EXCLUDED.rating_aspects,
                    feedback_text = EXCLUDED.feedback_text,
                    variety_rating = EXCLUDED.variety_rating,
                    practicality_rating = EXCLUDED.practicality_rating,
                    family_approval_rating = EXCLUDED.family_approval_rating,
                    would_use_again = EXCLUDED.would_use_again,
                    updated_at = CURRENT_TIMESTAMP
                RETURNING id
            """, (
                user_id, menu_id, rating.rating_score, rating_aspects_dict,
                rating.feedback_text, rating.variety_rating, rating.practicality_rating,
                rating.family_approval_rating, rating.would_use_again
            ))
            
            rating_id = cur.fetchone()['id']
            conn.commit()
            
            logger.info(f"Successfully saved menu rating {rating_id}")
            return {
                "success": True,
                "rating_id": rating_id,
                "message": "Menu rating saved successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving menu rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save rating: {str(e)}")

@router.get("/menus/{menu_id}/ratings")
async def get_menu_ratings(menu_id: int):
    """Get aggregated ratings for a menu"""
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Get rating summary from view
            cur.execute("""
                SELECT * FROM menu_ratings_summary
                WHERE menu_id = %s
            """, (menu_id,))
            
            summary = cur.fetchone()
            
            if not summary:
                return {
                    "menu_id": menu_id,
                    "total_ratings": 0,
                    "average_rating": None,
                    "message": "No ratings yet"
                }
            
            return {
                "menu_id": menu_id,
                "summary": summary
            }
            
    except Exception as e:
        logger.error(f"Error getting menu ratings: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get ratings: {str(e)}")

# Saved Recipe Quick Rating
@router.post("/saved-recipes/{saved_recipe_id}/quick-rate")
async def quick_rate_saved_recipe(
    saved_recipe_id: int,
    rating: SavedRecipeQuickRating,
    user = Depends(get_user_from_token)
):
    """Quick rate a saved recipe (simplified rating)"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get('user_id')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Verify ownership and get recipe details
            cur.execute("""
                SELECT id, scraped_recipe_id, recipe_id, notes
                FROM saved_recipes
                WHERE id = %s AND user_id = %s
            """, (saved_recipe_id, user_id))
            
            saved_recipe = cur.fetchone()
            if not saved_recipe:
                raise HTTPException(status_code=404, detail="Saved recipe not found")
            
            # Update quick rating
            cur.execute("""
                UPDATE saved_recipes
                SET quick_rating = %s,
                    notes = COALESCE(%s, notes)
                WHERE id = %s
                RETURNING *
            """, (rating.quick_rating, rating.notes, saved_recipe_id))
            
            updated = cur.fetchone()
            
            # Also create/update a full rating if there's a linked recipe
            recipe_id = saved_recipe['scraped_recipe_id'] or saved_recipe['recipe_id']
            if recipe_id:
                cur.execute("SELECT get_or_create_recipe_interaction(%s, %s, %s)", 
                           (user_id, recipe_id, 'rating'))
                interaction_id = cur.fetchone()['get_or_create_recipe_interaction']
                
                cur.execute("""
                    UPDATE recipe_interactions 
                    SET rating_score = %s,
                        updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                """, (rating.quick_rating, interaction_id))
                
                # Link the rating to the saved recipe
                cur.execute("""
                    UPDATE saved_recipes
                    SET rating_id = %s
                    WHERE id = %s
                """, (interaction_id, saved_recipe_id))
            
            conn.commit()
            
            return {
                "success": True,
                "saved_recipe": updated,
                "message": "Quick rating saved successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error saving quick rating: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to save rating: {str(e)}")

# User Rating Analytics
@router.get("/users/me/rating-preferences")
async def get_my_rating_preferences(user = Depends(get_user_from_token)):
    """Get user's rating preferences and patterns"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get('user_id')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Get cuisine preferences from view
            cur.execute("""
                SELECT * FROM user_rating_preferences
                WHERE user_id = %s
                ORDER BY avg_rating DESC
            """, (user_id,))
            
            cuisine_preferences = cur.fetchall()
            
            # Get top rated recipes
            cur.execute("""
                SELECT 
                    ri.recipe_id,
                    ri.rating_score,
                    ri.would_make_again,
                    sr.title,
                    sr.cuisine,
                    sr.complexity
                FROM recipe_interactions ri
                JOIN scraped_recipes sr ON ri.recipe_id = sr.id
                WHERE ri.user_id = %s 
                AND ri.rating_score >= 4
                ORDER BY ri.rating_score DESC, ri.updated_at DESC
                LIMIT 10
            """, (user_id,))
            
            top_recipes = cur.fetchall()
            
            # Get rating statistics
            cur.execute("""
                SELECT 
                    COUNT(*) as total_ratings,
                    AVG(rating_score) as average_rating,
                    COUNT(CASE WHEN rating_score >= 4 THEN 1 END) as high_ratings,
                    COUNT(CASE WHEN made_recipe = TRUE THEN 1 END) as recipes_made
                FROM recipe_interactions
                WHERE user_id = %s AND rating_score IS NOT NULL
            """, (user_id,))
            
            stats = cur.fetchone()
            
            return {
                "cuisine_preferences": cuisine_preferences,
                "top_rated_recipes": top_recipes,
                "rating_statistics": stats
            }
            
    except Exception as e:
        logger.error(f"Error getting rating preferences: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get preferences: {str(e)}")

@router.get("/recipes/recommended")
async def get_recommended_recipes(
    limit: int = 10,
    user = Depends(get_user_from_token)
):
    """Get recipe recommendations based on user's ratings"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    user_id = user.get('user_id')
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Get user's preferred cuisines
            cur.execute("""
                SELECT cuisine 
                FROM user_rating_preferences
                WHERE user_id = %s AND avg_rating >= 4
                ORDER BY avg_rating DESC
                LIMIT 3
            """, (user_id,))
            
            preferred_cuisines = [row['cuisine'] for row in cur.fetchall()]
            
            if not preferred_cuisines:
                # Fallback to popular recipes
                cur.execute("""
                    SELECT 
                        sr.*,
                        rrs.average_rating,
                        rrs.total_ratings
                    FROM scraped_recipes sr
                    JOIN recipe_ratings_summary rrs ON sr.id = rrs.recipe_id
                    WHERE rrs.average_rating >= 4
                    AND rrs.total_ratings >= 3
                    ORDER BY rrs.average_rating DESC, rrs.total_ratings DESC
                    LIMIT %s
                """, (limit,))
            else:
                # Get highly rated recipes in preferred cuisines
                cur.execute("""
                    SELECT 
                        sr.*,
                        rrs.average_rating,
                        rrs.total_ratings,
                        CASE WHEN ri.id IS NOT NULL THEN TRUE ELSE FALSE END as already_rated
                    FROM scraped_recipes sr
                    JOIN recipe_ratings_summary rrs ON sr.id = rrs.recipe_id
                    LEFT JOIN recipe_interactions ri ON sr.id = ri.recipe_id 
                        AND ri.user_id = %s AND ri.rating_score IS NOT NULL
                    WHERE sr.cuisine = ANY(%s)
                    AND rrs.average_rating >= 4
                    AND ri.id IS NULL  -- Not already rated by user
                    ORDER BY rrs.average_rating DESC, rrs.total_ratings DESC
                    LIMIT %s
                """, (user_id, preferred_cuisines, limit))
            
            recommendations = cur.fetchall()
            
            return {
                "preferred_cuisines": preferred_cuisines,
                "recommendations": recommendations
            }
            
    except Exception as e:
        logger.error(f"Error getting recommendations: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Failed to get recommendations: {str(e)}")