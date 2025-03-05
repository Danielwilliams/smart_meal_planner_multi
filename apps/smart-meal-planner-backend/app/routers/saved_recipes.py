# app/routers/saved_recipes.py
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import Optional
import logging
from ..db import (
    save_recipe, 
    unsave_recipe, 
    get_user_saved_recipes, 
    is_recipe_saved, 
    get_saved_recipe_by_id,
    get_saved_recipe_id
)
from ..utils.auth_utils import get_user_from_token
from ..models.user import SaveRecipeRequest

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/saved-recipes", tags=["SavedRecipes"])

@router.post("/")
async def add_saved_recipe(
    req: SaveRecipeRequest,
    user = Depends(get_user_from_token)
):
    """Save a recipe or entire menu to user's favorites"""
    user_id = user.get('user_id')
    
    try:
        saved_id = save_recipe(
            user_id=user_id,
            menu_id=req.menu_id,
            recipe_id=req.recipe_id,
            recipe_name=req.recipe_name,
            day_number=req.day_number,
            meal_time=req.meal_time,
            notes=req.notes
        )
        
        if saved_id:
            return {
                "status": "success", 
                "message": "Recipe saved successfully", 
                "saved_id": saved_id
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to save recipe"
            )
    
    except Exception as e:
        logging.error(f"Error saving recipe: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error saving recipe: {str(e)}"
        )

@router.delete("/{saved_id}")
async def remove_saved_recipe(
    saved_id: int,
    user = Depends(get_user_from_token)
):
    """Remove a recipe from saved/favorites"""
    user_id = user.get('user_id')
    
    try:
        success = unsave_recipe(user_id=user_id, saved_id=saved_id)
        
        if success:
            return {
                "status": "success", 
                "message": "Recipe removed from favorites"
            }
        else:
            raise HTTPException(
                status_code=404, 
                detail="Saved recipe not found or already removed"
            )
    
    except Exception as e:
        logger.error(f"Error removing saved recipe: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error removing saved recipe: {str(e)}"
        )

@router.get("/")
async def list_saved_recipes(
    user = Depends(get_user_from_token)
):
    """Get all saved recipes for current user"""
    user_id = user.get('user_id')
    
    try:
        saved_recipes = get_user_saved_recipes(user_id)
        
        return {
            "status": "success", 
            "saved_recipes": saved_recipes
        }
    
    except Exception as e:
        logger.error(f"Error fetching saved recipes: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching saved recipes: {str(e)}"
        )

@router.get("/check")
async def check_recipe_saved(
    menu_id: int,
    recipe_id: Optional[str] = None,
    meal_time: Optional[str] = None,
    user = Depends(get_user_from_token)
):
    """Check if a recipe is saved by the current user"""
    user_id = user.get('user_id')
    
    try:
        is_saved = is_recipe_saved(
            user_id=user_id,
            menu_id=menu_id,
            recipe_id=recipe_id,
            meal_time=meal_time
        )
        
        # If saved, also return the saved ID for easier deletion
        saved_id = None
        if is_saved:
            saved_id = get_saved_recipe_id(
                user_id=user_id,
                menu_id=menu_id,
                recipe_id=recipe_id,
                meal_time=meal_time
            )
            
        return {
            "is_saved": is_saved,
            "saved_id": saved_id
        }
    
    except Exception as e:
        logger.error(f"Error checking saved status: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error checking saved status: {str(e)}"
        )

@router.get("/{saved_id}")
async def get_saved_recipe_details(
    saved_id: int,
    user = Depends(get_user_from_token)
):
    """Get details of a specific saved recipe"""
    user_id = user.get('user_id')
    
    try:
        recipe = get_saved_recipe_by_id(user_id, saved_id)
        
        if not recipe:
            raise HTTPException(
                status_code=404, 
                detail="Saved recipe not found"
            )
            
        return {
            "status": "success",
            "recipe": recipe
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching saved recipe details: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching saved recipe details: {str(e)}"
        )