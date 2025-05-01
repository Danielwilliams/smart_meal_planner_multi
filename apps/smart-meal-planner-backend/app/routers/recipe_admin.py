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
    user = Depends(get_user_from_token)
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
            
@router.patch("/update-recipe/{recipe_id}")
async def update_recipe(
    recipe_id: int,
    recipe_data: Dict[str, Any],
    user = Depends(get_user_from_token)
):
    """
    Update a recipe's basic information including metadata for ingredients
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if recipe exists
        cursor.execute("""
            SELECT id FROM scraped_recipes
            WHERE id = %s
        """, (recipe_id,))
        
        recipe = cursor.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Prepare update data
        update_fields = []
        update_values = []
        
        # Handle title update
        if 'title' in recipe_data:
            update_fields.append("title = %s")
            update_values.append(recipe_data['title'])
        
        # Handle image_url update
        if 'image_url' in recipe_data:
            update_fields.append("image_url = %s")
            update_values.append(recipe_data['image_url'])
        
        # Handle instructions update
        if 'instructions' in recipe_data:
            # Convert instructions to JSON if it's not already a string
            if isinstance(recipe_data['instructions'], list):
                instructions_json = json.dumps(recipe_data['instructions'])
            else:
                instructions_json = recipe_data['instructions']
            
            update_fields.append("instructions = %s")
            update_values.append(instructions_json)
        
        # Handle metadata update (includes ingredients_list)
        if 'metadata' in recipe_data:
            # Get existing metadata
            cursor.execute("""
                SELECT metadata FROM scraped_recipes
                WHERE id = %s
            """, (recipe_id,))
            
            result = cursor.fetchone()
            current_metadata = result.get('metadata', {}) if result else {}
            
            # If current metadata is a string, parse it
            if isinstance(current_metadata, str):
                try:
                    current_metadata = json.loads(current_metadata)
                except json.JSONDecodeError:
                    current_metadata = {}
            
            if current_metadata is None:
                current_metadata = {}
                
            # Merge with new metadata
            new_metadata = recipe_data['metadata']
            if isinstance(new_metadata, str):
                try:
                    new_metadata = json.loads(new_metadata)
                except json.JSONDecodeError:
                    new_metadata = {}
            
            # Ensure new_metadata is a dictionary
            if new_metadata is None:
                new_metadata = {}
                
            # Update the existing metadata with new values
            current_metadata.update(new_metadata)
            
            # Add to update fields
            update_fields.append("metadata = %s")
            update_values.append(json.dumps(current_metadata))
        
        # If there's nothing to update, return early
        if not update_fields:
            return {
                "success": False,
                "message": "No update data provided"
            }
        
        # Build and execute the UPDATE query
        update_query = f"""
            UPDATE scraped_recipes
            SET {", ".join(update_fields)}
            WHERE id = %s
            RETURNING id, title, image_url, instructions, metadata
        """
        
        # Add recipe_id to values
        update_values.append(recipe_id)
        
        # Execute the update
        cursor.execute(update_query, update_values)
        updated_recipe = cursor.fetchone()
        conn.commit()
        
        # Parse metadata if it's a string
        if updated_recipe and 'metadata' in updated_recipe and isinstance(updated_recipe['metadata'], str):
            try:
                updated_recipe['metadata'] = json.loads(updated_recipe['metadata'])
            except json.JSONDecodeError:
                pass
        
        # Parse instructions if it's a string
        if updated_recipe and 'instructions' in updated_recipe and isinstance(updated_recipe['instructions'], str):
            try:
                updated_recipe['instructions'] = json.loads(updated_recipe['instructions'])
            except json.JSONDecodeError:
                pass
        
        return {
            "success": True,
            "recipe": updated_recipe,
            "message": "Recipe updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating recipe: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating recipe: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.patch("/update-nutrition/{recipe_id}")
async def update_recipe_nutrition(
    recipe_id: int,
    nutrition_data: Dict[str, Any],
    user = Depends(get_user_from_token)
):
    """
    Update a recipe's nutrition information
    """
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if recipe exists
        cursor.execute("""
            SELECT id FROM scraped_recipes
            WHERE id = %s
        """, (recipe_id,))
        
        recipe = cursor.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Check if nutrition record exists
        cursor.execute("""
            SELECT * FROM recipe_nutrition
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        nutrition = cursor.fetchone()
        
        # Get nutrition values
        macros = nutrition_data.get('macros', {}).get('perServing', {})
        calories = macros.get('calories')
        protein = macros.get('protein')
        carbs = macros.get('carbs')
        fat = macros.get('fat')
        
        if nutrition:
            # Update existing nutrition record
            cursor.execute("""
                UPDATE recipe_nutrition
                SET calories = %s, protein = %s, carbs = %s, fat = %s
                WHERE recipe_id = %s
                RETURNING *
            """, (calories, protein, carbs, fat, recipe_id))
        else:
            # Create new nutrition record
            cursor.execute("""
                INSERT INTO recipe_nutrition (recipe_id, calories, protein, carbs, fat)
                VALUES (%s, %s, %s, %s, %s)
                RETURNING *
            """, (recipe_id, calories, protein, carbs, fat))
        
        updated_nutrition = cursor.fetchone()
        conn.commit()
        
        return {
            "success": True,
            "nutrition": updated_nutrition,
            "message": "Nutrition information updated successfully"
        }
    except Exception as e:
        logger.error(f"Error updating nutrition: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        raise HTTPException(status_code=500, detail=f"Error updating nutrition: {str(e)}")
    finally:
        if conn:
            conn.close()