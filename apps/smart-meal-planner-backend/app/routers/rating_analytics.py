# app/routers/rating_analytics.py - Rating Analytics API Endpoints

from fastapi import APIRouter, HTTPException, Depends, Request
from typing import Dict, List, Optional
import logging
from ..ai.rating_analytics import rating_analytics
from ..routers.recipe_ratings import get_rating_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/analytics", tags=["Rating Analytics"])

@router.get("/users/{user_id}/preferences")
async def get_user_preferences(
    user_id: int,
    request: Request
):
    """
    Get comprehensive user preferences extracted from rating data.
    This endpoint provides detailed preference analysis for AI integration.
    """
    logger.info(f"=== GET USER PREFERENCES: user_id={user_id} ===")
    
    # Use the same auth system as ratings
    try:
        user = await get_rating_user_from_token(request)
        logger.info(f"Auth result: {bool(user)}")
        if user:
            logger.info(f"Requesting user ID: {user.get('user_id')}")
    except Exception as e:
        logger.error(f"Auth error: {str(e)}")
        user = None
    
    # Check authentication
    if not user:
        logger.error("Authentication required for preferences")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    current_user_id = user.get('user_id')
    
    # Users can only access their own preferences (or admins can access any)
    if current_user_id != user_id and user.get('role') != 'admin':
        logger.error(f"Access denied: user {current_user_id} requested preferences for user {user_id}")
        raise HTTPException(
            status_code=403, 
            detail="Access denied"
        )
    
    try:
        logger.info(f"Extracting preferences for user {user_id}")
        preferences = rating_analytics.extract_user_preferences(user_id)
        
        logger.info(f"Successfully extracted preferences: {preferences['total_ratings']} ratings analyzed")
        return {
            "user_id": user_id,
            "preferences": preferences,
            "status": "success"
        }
        
    except Exception as e:
        logger.error(f"Error getting user preferences: {str(e)}")
        import traceback
        logger.error(f"Traceback: {traceback.format_exc()}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get user preferences: {str(e)}"
        )

@router.get("/users/{user_id}/personalization")
async def get_personalization_insights(
    user_id: int,
    request: Request
):
    """
    Get AI personalization insights and prompt suggestions based on user ratings.
    This endpoint provides actionable data for customizing AI meal recommendations.
    """
    logger.info(f"=== GET PERSONALIZATION INSIGHTS: user_id={user_id} ===")
    
    # Use the same auth system as ratings
    try:
        user = await get_rating_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        current_user_id = user.get('user_id')
        
        # Users can only access their own insights
        if current_user_id != user_id and user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Access denied")
        
        logger.info(f"Getting personalization insights for user {user_id}")
        insights = rating_analytics.get_personalization_insights(user_id)
        
        logger.info(f"Generated {len(insights['ai_prompt_suggestions'])} AI prompt suggestions")
        return {
            "user_id": user_id,
            "insights": insights,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting personalization insights: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get personalization insights: {str(e)}"
        )

@router.get("/users/{user_id}/ai-prompt-data")
async def get_ai_prompt_data(
    user_id: int,
    request: Request
):
    """
    Get formatted data specifically for including in AI prompts.
    Returns concise, prompt-ready user preference data.
    """
    logger.info(f"=== GET AI PROMPT DATA: user_id={user_id} ===")
    
    try:
        user = await get_rating_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        current_user_id = user.get('user_id')
        
        # Users can only access their own data
        if current_user_id != user_id and user.get('role') != 'admin':
            raise HTTPException(status_code=403, detail="Access denied")
        
        insights = rating_analytics.get_personalization_insights(user_id)
        preferences = insights['preferences']
        
        # Format data for AI prompt inclusion
        ai_prompt_data = {
            "user_profile": {
                "total_recipes_rated": preferences['total_ratings'],
                "average_rating": round(preferences['average_rating'], 1),
                "personalization_confidence": insights['recommendation_confidence']
            },
            "cuisine_preferences": preferences['cuisine_preferences']['top_cuisines'][:3],
            "cooking_style": {
                "preferred_complexity": preferences['complexity_preferences'].get('preferred_difficulty', 3),
                "preferred_time_range": preferences['time_preferences']['preferred_time_range'],
                "cooking_engagement": preferences['behavioral_insights']['cooking_engagement']
            },
            "key_priorities": preferences['aspect_preferences']['most_important_aspects'][:3],
            "prompt_suggestions": insights['ai_prompt_suggestions'],
            "personalization_strength": insights['personalization_strength']
        }
        
        return {
            "user_id": user_id,
            "ai_prompt_data": ai_prompt_data,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting AI prompt data: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get AI prompt data: {str(e)}"
        )

@router.get("/trends/cuisine-popularity")
async def get_cuisine_popularity_trends(
    request: Request,
    limit: int = 10
):
    """
    Get trending cuisine preferences across all users.
    Useful for understanding platform-wide food trends.
    """
    logger.info("=== GET CUISINE TRENDS ===")
    
    try:
        user = await get_rating_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Get cuisine popularity from rating data
        cuisine_trends = rating_analytics.execute_analytics_query("""
            SELECT 
                sr.cuisine,
                COUNT(*) as rating_count,
                AVG(ri.rating_score) as average_rating,
                COUNT(CASE WHEN ri.rating_score >= 4 THEN 1 END) as high_ratings
            FROM recipe_interactions ri
            JOIN scraped_recipes sr ON ri.recipe_id = sr.id
            WHERE ri.rating_score IS NOT NULL 
            AND sr.cuisine IS NOT NULL
            AND ri.updated_at >= NOW() - INTERVAL '90 days'
            GROUP BY sr.cuisine
            HAVING COUNT(*) >= 3
            ORDER BY 
                (AVG(ri.rating_score) * COUNT(*)) DESC,
                COUNT(*) DESC
            LIMIT %s
        """, (limit,), fetch_all=True)
        
        trends = []
        for trend in cuisine_trends or []:
            trends.append({
                "cuisine": trend['cuisine'],
                "rating_count": trend['rating_count'],
                "average_rating": float(trend['average_rating']),
                "high_rating_percentage": round((trend['high_ratings'] / trend['rating_count']) * 100, 1),
                "popularity_score": round(float(trend['average_rating']) * trend['rating_count'], 1)
            })
        
        return {
            "cuisine_trends": trends,
            "period": "last_90_days",
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting cuisine trends: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get cuisine trends: {str(e)}"
        )

@router.get("/trends/recipe-performance")
async def get_recipe_performance_trends(
    request: Request,
    limit: int = 20
):
    """
    Get top performing recipes based on rating data.
    Identifies recipes that should be recommended more often.
    """
    logger.info("=== GET RECIPE PERFORMANCE TRENDS ===")
    
    try:
        user = await get_rating_user_from_token(request)
        if not user:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Get top performing recipes
        top_recipes = rating_analytics.execute_analytics_query("""
            SELECT 
                ri.recipe_id,
                sr.title,
                sr.cuisine,
                sr.complexity,
                sr.total_time,
                COUNT(*) as rating_count,
                AVG(ri.rating_score) as average_rating,
                COUNT(CASE WHEN ri.made_recipe = true THEN 1 END) as times_made,
                COUNT(CASE WHEN ri.would_make_again = true THEN 1 END) as would_remake
            FROM recipe_interactions ri
            JOIN scraped_recipes sr ON ri.recipe_id = sr.id
            WHERE ri.rating_score IS NOT NULL
            GROUP BY ri.recipe_id, sr.title, sr.cuisine, sr.complexity, sr.total_time
            HAVING COUNT(*) >= 2
            ORDER BY 
                AVG(ri.rating_score) DESC,
                COUNT(*) DESC
            LIMIT %s
        """, (limit,), fetch_all=True)
        
        performance_data = []
        for recipe in top_recipes or []:
            remake_rate = recipe['would_remake'] / max(recipe['times_made'], 1) if recipe['times_made'] > 0 else 0
            
            performance_data.append({
                "recipe_id": recipe['recipe_id'],
                "title": recipe['title'],
                "cuisine": recipe['cuisine'],
                "complexity": recipe['complexity'],
                "total_time": recipe['total_time'],
                "rating_count": recipe['rating_count'],
                "average_rating": round(float(recipe['average_rating']), 2),
                "times_made": recipe['times_made'],
                "remake_rate": round(remake_rate * 100, 1),
                "performance_score": round(float(recipe['average_rating']) * recipe['rating_count'], 1)
            })
        
        return {
            "top_recipes": performance_data,
            "status": "success"
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recipe performance: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Failed to get recipe performance: {str(e)}"
        )