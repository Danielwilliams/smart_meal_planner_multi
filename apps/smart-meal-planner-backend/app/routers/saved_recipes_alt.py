# app/routers/saved_recipes_alt.py
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import Optional, Dict, Any
import logging
from pydantic import BaseModel
from ..db import get_db_connection
from ..utils.auth_utils import get_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/saved-recipes-alt", tags=["Saved Recipes Alternative"])

class SimpleSaveRequest(BaseModel):
    """Simple model for saving a recipe"""
    scraped_recipe_id: Optional[int] = None
    recipe_name: Optional[str] = None
    recipe_source: Optional[str] = None
    notes: Optional[str] = None
    macros: Optional[Dict[str, Any]] = None
    ingredients: Optional[Dict[str, Any]] = None
    instructions: Optional[Dict[str, Any]] = None
    complexity_level: Optional[str] = None
    servings: Optional[int] = None

@router.post("/scraped")
async def save_scraped_recipe(
    req: SimpleSaveRequest,
    user = Depends(get_user_from_token)
):
    """
    Simplified endpoint to save just a scraped recipe
    """
    user_id = user.get('user_id')
    
    try:
        # Log the incoming request data in detail
        logger.info(f"Received simplified recipe save request: {req}")
        
        # Log all request fields individually for debugging
        for field, value in req.dict().items():
            logger.info(f"Field '{field}': {value}")
        
        conn = get_db_connection()
        try:
            # Create a simplified save process that only requires scraped_recipe_id
            with conn.cursor() as cur:
                # Check if the saved_recipes table has required columns
                cur.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'saved_recipes'
                """)
                columns = [row[0] for row in cur.fetchall()]
                
                # Check if scraped_recipe_id exists in the table
                if 'scraped_recipe_id' not in columns:
                    # Add the column if it doesn't exist
                    cur.execute("""
                        ALTER TABLE saved_recipes 
                        ADD COLUMN IF NOT EXISTS scraped_recipe_id INTEGER,
                        ADD COLUMN IF NOT EXISTS recipe_source VARCHAR(50)
                    """)
                    logger.info("Added missing columns to saved_recipes table")
                
                # Check if recipe is already saved
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND scraped_recipe_id = %s
                """, (user_id, req.scraped_recipe_id))
                
                existing = cur.fetchone()
                
                if existing:
                    # Return the existing saved ID
                    saved_id = existing[0]
                    logger.info(f"Recipe already saved with ID: {saved_id}")
                else:
                    # Basic insert with only required fields
                    cur.execute("""
                        INSERT INTO saved_recipes 
                        (user_id, scraped_recipe_id, recipe_name, notes, recipe_source)
                        VALUES (%s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        user_id, 
                        req.scraped_recipe_id, 
                        req.recipe_name, 
                        req.notes, 
                        'scraped'
                    ))
                    
                    saved_id = cur.fetchone()[0]
                    logger.info(f"Successfully saved recipe with ID: {saved_id}")
                
                conn.commit()
                
                return {
                    "status": "success",
                    "message": "Recipe saved successfully",
                    "saved_id": saved_id
                }
        finally:
            conn.close()
    except Exception as e:
        logger.error(f"Error saving recipe: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error saving recipe: {str(e)}"
        )

@router.delete("/{saved_id}")
async def delete_saved_recipe(
    saved_id: int,
    user = Depends(get_user_from_token)
):
    """Delete a saved recipe by ID"""
    user_id = user.get('user_id')
    
    try:
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                # Check if the recipe belongs to the user
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE id = %s AND user_id = %s
                """, (saved_id, user_id))
                
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=404,
                        detail="Saved recipe not found or doesn't belong to you"
                    )
                
                # Delete the recipe
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE id = %s
                """, (saved_id,))
                
                conn.commit()
                
                return {
                    "status": "success",
                    "message": "Recipe deleted successfully"
                }
        finally:
            conn.close()
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting recipe: {str(e)}", exc_info=True)
        raise HTTPException(
            status_code=500,
            detail=f"Error deleting recipe: {str(e)}"
        )