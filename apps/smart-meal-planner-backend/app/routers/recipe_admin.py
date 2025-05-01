"""
Admin endpoints for managing scraped recipes
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from fastapi.responses import JSONResponse
from psycopg2.extras import RealDictCursor
from typing import List, Optional, Dict, Any
import json
from ..db import get_db_connection
from ..utils.auth_utils import admin_required, get_user_from_token
from ..utils.s3.s3_utils import s3_helper

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recipe-admin", tags=["RecipeAdmin"])

@router.post("/upload-image")
async def upload_recipe_image(
    file: UploadFile = File(...),
    user = Depends(admin_required)
):
    """
    Upload a recipe image to S3 and return the image URL
    """
    try:
        # Upload image to S3
        image_url = await s3_helper.upload_image(file)
        
        return {
            "success": True,
            "image_url": image_url,
            "message": "Image uploaded successfully"
        }
    except ValueError as e:
        logger.error(f"S3 configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail="S3 configuration is incomplete. Contact the administrator.")
    except Exception as e:
        logger.error(f"Image upload error: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error uploading image: {str(e)}")

@router.patch("/update-recipe-image/{recipe_id}")
async def update_recipe_image(
    recipe_id: int,
    file: UploadFile = File(...),
    user = Depends(admin_required)
):
    """
    Update the image for an existing recipe
    """
    conn = None
    try:
        # First, get the current image URL if it exists
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT image_url FROM scraped_recipes
            WHERE id = %s
        """, (recipe_id,))
        
        recipe = cursor.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Delete old image if it exists and is in our S3 bucket
        old_image_url = recipe.get('image_url')
        if old_image_url and s3_helper.bucket_name in old_image_url:
            s3_helper.delete_image(old_image_url)
        
        # Upload new image
        new_image_url = await s3_helper.upload_image(file)
        
        # Update recipe with new image URL
        cursor.execute("""
            UPDATE scraped_recipes
            SET image_url = %s
            WHERE id = %s
            RETURNING id, title, image_url
        """, (new_image_url, recipe_id))
        
        updated_recipe = cursor.fetchone()
        conn.commit()
        
        return {
            "success": True, 
            "recipe": updated_recipe,
            "message": "Recipe image updated successfully"
        }
    except ValueError as e:
        logger.error(f"S3 configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail="S3 configuration is incomplete. Contact the administrator.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating recipe image: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating recipe image: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.delete("/delete-recipe-image/{recipe_id}")
async def delete_recipe_image(
    recipe_id: int,
    user = Depends(admin_required)
):
    """
    Delete the image for a recipe
    """
    conn = None
    try:
        # Get the current image URL
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT image_url FROM scraped_recipes
            WHERE id = %s
        """, (recipe_id,))
        
        recipe = cursor.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        image_url = recipe.get('image_url')
        if not image_url:
            raise HTTPException(status_code=400, detail="Recipe doesn't have an image to delete")
        
        # Delete image from S3 if it's from our bucket
        if s3_helper.bucket_name in image_url:
            if not s3_helper.delete_image(image_url):
                logger.warning(f"Failed to delete image from S3: {image_url}")
        
        # Update recipe to remove image reference
        cursor.execute("""
            UPDATE scraped_recipes
            SET image_url = NULL
            WHERE id = %s
            RETURNING id, title
        """, (recipe_id,))
        
        updated_recipe = cursor.fetchone()
        conn.commit()
        
        return {
            "success": True,
            "recipe": updated_recipe,
            "message": "Recipe image deleted successfully"
        }
    except ValueError as e:
        logger.error(f"S3 configuration error: {str(e)}")
        raise HTTPException(status_code=500, detail="S3 configuration is incomplete. Contact the administrator.")
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting recipe image: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error deleting recipe image: {str(e)}")
    finally:
        if conn:
            conn.close()
            
@router.get("/component-types")
async def get_component_types(user = Depends(get_user_from_token)):
    """
    Get all component types and their counts
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("""
            SELECT 
                component_type, 
                COUNT(*) as count
            FROM recipe_components
            GROUP BY component_type
            ORDER BY count DESC
        """)
        
        component_types = cursor.fetchall()
        return component_types
    except Exception as e:
        logger.error(f"Error fetching component types: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching component types: {str(e)}")
    finally:
        if conn:
            conn.close()
            
@router.get("/check-component/{recipe_id}")
async def check_recipe_component(
    recipe_id: int,
    user = Depends(get_user_from_token)
):
    """
    Check component type and preferences for a specific recipe
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get recipe details
        cursor.execute("""
            SELECT * FROM scraped_recipes
            WHERE id = %s
        """, (recipe_id,))
        
        recipe = cursor.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
            
        # Get component type if any
        cursor.execute("""
            SELECT * FROM recipe_components
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        component = cursor.fetchone()
        
        # Get preferences if any
        cursor.execute("""
            SELECT * FROM recipe_preferences
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        preferences = cursor.fetchone()
        
        return {
            "recipe": recipe,
            "component": component,
            "preferences": preferences
        }
    except Exception as e:
        logger.error(f"Error checking recipe component: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error checking recipe component: {str(e)}")
    finally:
        if conn:
            conn.close()