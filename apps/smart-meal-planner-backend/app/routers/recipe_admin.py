"""
Admin endpoints for managing scraped recipes
"""
import os
import uuid
import logging
import boto3
from botocore.exceptions import ClientError
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
        # Log incoming request details
        logger.debug(f"Image upload request received: filename={file.filename}, size={file.size if hasattr(file, 'size') else 'unknown'}")
        logger.debug(f"Content type: {file.content_type}")
        logger.debug(f"User: {user.get('user_id') if user else 'None'}")
        
        from ..utils.s3.s3_utils import force_initialize_s3_helper
        
        # Force initialize S3 helper if it wasn't properly initialized at startup
        logger.info("Force initializing S3 helper to ensure it has latest environment variables...")
        s3 = force_initialize_s3_helper()
        
        # Check if s3_helper is properly configured
        logger.debug(f"S3 helper bucket name: {s3.bucket_name if hasattr(s3, 'bucket_name') else 'None'}")
        
        # Upload image to S3
        logger.info("Initiating upload to S3...")
        image_url = await s3.upload_image(file)
        logger.info(f"Image successfully uploaded to {image_url}")
        
        return {
            "success": True,
            "image_url": image_url,
            "message": "Image uploaded successfully"
        }
    except ValueError as e:
        logger.error(f"S3 configuration error: {str(e)}")
        # Include more details in the error message
        error_detail = f"S3 configuration is incomplete: {str(e)}. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables."
        raise HTTPException(status_code=500, detail=error_detail)
    except HTTPException as e:
        # Re-raise HTTP exceptions directly
        logger.error(f"HTTP exception during image upload: {str(e)}")
        raise
    except Exception as e:
        logger.error(f"Unexpected error during image upload: {str(e)}", exc_info=True)
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
        # Force initialize S3 helper
        from ..utils.s3.s3_utils import force_initialize_s3_helper
        logger.info("Force initializing S3 helper for image update...")
        s3 = force_initialize_s3_helper()
        
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
        if old_image_url and s3.bucket_name and s3.bucket_name in old_image_url:
            logger.info(f"Deleting old image: {old_image_url}")
            s3.delete_image(old_image_url)
        
        # Upload new image
        logger.info("Uploading new image...")
        new_image_url = await s3.upload_image(file)
        logger.info(f"New image uploaded to: {new_image_url}")
        
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
        error_detail = f"S3 configuration is incomplete: {str(e)}. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables."
        raise HTTPException(status_code=500, detail=error_detail)
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
            
@router.post("/tag-recipes")
async def tag_recipes(
    tag_data: Dict[str, Any],
    user = Depends(admin_required)
):
    """
    Tag multiple recipes with a component type
    """
    conn = None
    try:
        # Log the raw input data for debugging
        logger.info(f"Raw tag_data received: {tag_data}")
        
        # Extract data
        recipe_ids = tag_data.get('recipe_ids', [])
        component_type = tag_data.get('component_type')
        
        # More detailed logging of extracted data
        logger.info(f"Extracted recipe_ids: {recipe_ids} (type: {type(recipe_ids)})")
        logger.info(f"Extracted component_type: {component_type} (type: {type(component_type)})")
        
        if not recipe_ids or not component_type:
            logger.error(f"Missing required data. recipe_ids: {recipe_ids}, component_type: {component_type}")
            raise HTTPException(
                status_code=400, 
                detail="Both recipe_ids and component_type are required"
            )
            
        logger.info(f"Tagging {len(recipe_ids)} recipes with component type: {component_type}")
        
        # Verify DB connection is working
        conn = get_db_connection()
        logger.info("Database connection established successfully")
        
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First, verify that recipe_components table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components'
            )
        """)
        table_exists = cursor.fetchone()
        logger.info(f"recipe_components table exists: {table_exists}")
        
        if not table_exists or not table_exists.get('exists', False):
            # Table doesn't exist, create it
            logger.warning("recipe_components table doesn't exist! Creating it now...")
            cursor.execute("""
                CREATE TABLE recipe_components (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES scraped_recipes(id),
                    component_type VARCHAR(100) NOT NULL,
                    name VARCHAR(255),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            conn.commit()
            logger.info("Created recipe_components table!")
        
        # Check table structure
        cursor.execute("""
            SELECT column_name, data_type, is_nullable 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'recipe_components'
        """)
        columns = cursor.fetchall()
        logger.info(f"recipe_components table structure: {columns}")
        
        # Process each recipe
        results = []
        for recipe_id in recipe_ids:
            try:
                logger.info(f"Processing recipe_id: {recipe_id}")
                
                # Check if recipe exists and get title
                cursor.execute("""
                    SELECT id, title FROM scraped_recipes 
                    WHERE id = %s
                """, (recipe_id,))
                
                recipe = cursor.fetchone()
                if not recipe:
                    logger.warning(f"Recipe {recipe_id} not found in database!")
                    results.append({
                        "recipe_id": recipe_id,
                        "success": False,
                        "message": "Recipe not found"
                    })
                    continue
                
                logger.info(f"Recipe found: {recipe}")
                recipe_title = recipe.get('title', f"Recipe {recipe_id}")
                
                # Check if component already exists
                cursor.execute("""
                    SELECT * FROM recipe_components
                    WHERE recipe_id = %s
                """, (recipe_id,))
                
                existing = cursor.fetchone()
                logger.info(f"Existing component record: {existing}")
                
                if existing:
                    # Update existing component
                    update_sql = """
                        UPDATE recipe_components
                        SET component_type = %s
                        WHERE recipe_id = %s
                        RETURNING *
                    """
                    logger.info(f"Executing update SQL: {update_sql} with params: [{component_type}, {recipe_id}]")
                    
                    cursor.execute(update_sql, (component_type, recipe_id))
                    updated = cursor.fetchone()
                    
                    if updated:
                        logger.info(f"Update successful, returned: {updated}")
                    else:
                        logger.error("Update query didn't return any data!")
                    
                    results.append({
                        "recipe_id": recipe_id,
                        "success": True,
                        "message": f"Updated component type from '{existing.get('component_type', 'unknown')}' to '{component_type}'",
                        "data": updated
                    })
                else:
                    # Insert new component
                    insert_sql = """
                        INSERT INTO recipe_components (recipe_id, component_type, name)
                        VALUES (%s, %s, %s)
                        RETURNING *
                    """
                    logger.info(f"Executing insert SQL: {insert_sql} with params: [{recipe_id}, {component_type}, {recipe_title}]")
                    
                    cursor.execute(insert_sql, (recipe_id, component_type, recipe_title))
                    created = cursor.fetchone()
                    
                    if created:
                        logger.info(f"Insert successful, returned: {created}")
                    else:
                        logger.error("Insert query didn't return any data!")
                    
                    results.append({
                        "recipe_id": recipe_id,
                        "success": True,
                        "message": f"Added component type '{component_type}'",
                        "data": created
                    })
                
                # Verify the change by doing a direct select
                cursor.execute("SELECT * FROM recipe_components WHERE recipe_id = %s", (recipe_id,))
                verification = cursor.fetchone()
                logger.info(f"Verification SELECT result: {verification}")
                
                # Force a commit after each recipe to ensure changes are saved even if later ones fail
                conn.commit()
                logger.info(f"Changes committed for recipe {recipe_id}")
                
            except Exception as e:
                logger.error(f"Error processing recipe {recipe_id}: {str(e)}", exc_info=True)
                results.append({
                    "recipe_id": recipe_id,
                    "success": False,
                    "message": f"Error: {str(e)}"
                })
                # Continue processing other recipes
        
        # Final commit of all changes
        conn.commit()
        logger.info("All changes committed to database")
        
        # Count successes and failures
        successes = sum(1 for r in results if r['success'])
        failures = len(results) - successes
        
        # Check again after all operations to verify status
        logger.info("Verifying final state of component records...")
        for recipe_id in recipe_ids:
            cursor.execute("SELECT * FROM recipe_components WHERE recipe_id = %s", (recipe_id,))
            final_state = cursor.fetchone()
            logger.info(f"Final state for recipe {recipe_id}: {final_state}")
        
        return {
            "success": True,
            "message": f"Processed {len(results)} recipes: {successes} successful, {failures} failed",
            "results": results
        }
    except Exception as e:
        logger.error(f"Error tagging recipes: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
            logger.info("Transaction rolled back due to error")
        raise HTTPException(status_code=500, detail=f"Error tagging recipes: {str(e)}")
    finally:
        if conn:
            # Final verification query to check database state
            try:
                with conn.cursor(cursor_factory=RealDictCursor) as final_cursor:
                    final_cursor.execute("SELECT COUNT(*) FROM recipe_components")
                    count = final_cursor.fetchone()
                    logger.info(f"Total recipe_components records in database: {count}")
            except Exception as e:
                logger.error(f"Error in final verification: {str(e)}")
                
            conn.close()
            logger.info("Database connection closed")

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
        # Force initialize S3 helper
        from ..utils.s3.s3_utils import force_initialize_s3_helper
        logger.info("Force initializing S3 helper for image deletion...")
        s3 = force_initialize_s3_helper()
        
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
        if s3.bucket_name and s3.bucket_name in image_url:
            logger.info(f"Deleting image from S3: {image_url}")
            if not s3.delete_image(image_url):
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
        error_detail = f"S3 configuration is incomplete: {str(e)}. Check AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, S3_BUCKET_NAME, and AWS_REGION environment variables."
        raise HTTPException(status_code=500, detail=error_detail)
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
            
@router.get("/test-s3-config")
async def test_s3_config(user = Depends(get_user_from_token)):
    """
    Test S3 configuration and return diagnostic information
    """
    try:
        # Check if we're in Railway environment
        railway_env = os.environ.get("RAILWAY_ENVIRONMENT", "false").lower() == "true"

        # Force initialize to get the very latest environment variables
        if railway_env:
            try:
                # In Railway environment, we need to be careful about importing and initializing
                from ..utils.s3.s3_utils import force_initialize_s3_helper
                logger.info("Railway environment detected - carefully initializing S3 helper...")
                s3_helper_instance = force_initialize_s3_helper()
            except Exception as railway_error:
                logger.warning(f"Railway environment S3 initialization failed: {str(railway_error)}")
                # Create a dummy object with needed attributes for diagnostics
                class DummyHelper:
                    def __init__(self):
                        self.bucket_name = os.getenv("S3_BUCKET_NAME")
                        self.region = os.getenv("AWS_REGION", "us-east-2")
                s3_helper_instance = DummyHelper()
        else:
            # Normal environment, just do the regular initialization
            from ..utils.s3.s3_utils import force_initialize_s3_helper
            logger.info("Force initializing S3 helper for configuration test...")
            s3_helper_instance = force_initialize_s3_helper()
        
        # Get environment variables (masking sensitive data)
        aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
        aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
        s3_bucket_name = os.getenv("S3_BUCKET_NAME")
        aws_region = os.getenv("AWS_REGION")
        
        # Show all relevant environment variables (safely)
        env_vars = {}
        for key, value in os.environ.items():
            if "AWS" in key or "S3" in key:
                if "KEY" in key or "SECRET" in key:
                    env_vars[key] = "PRESENT" if value else "MISSING"
                else:
                    env_vars[key] = value
        
        # Prepare diagnostics (safely)
        diagnostics = {
            "environment_variables": env_vars,
            "aws_access_key_present": bool(aws_access_key),
            "aws_secret_key_present": bool(aws_secret_key),
            "s3_bucket_name": s3_bucket_name,
            "aws_region": aws_region,
            "s3_helper_initialized": hasattr(s3_helper_instance, "s3_client"),
            "s3_helper_bucket": getattr(s3_helper_instance, "bucket_name", None),
            "s3_helper_region": getattr(s3_helper_instance, "region", None) if hasattr(s3_helper_instance, "region") else None
        }
        
        # Test S3 connection if credentials are present
        if all([aws_access_key, aws_secret_key, s3_bucket_name]):
            try:
                # Create a test client
                s3_client = boto3.client(
                    's3',
                    aws_access_key_id=aws_access_key,
                    aws_secret_access_key=aws_secret_key,
                    region_name=aws_region or "us-east-2"
                )
                
                # Test bucket access directly without listing all buckets
                bucket_exists = False
                bucket_access = False
                
                try:
                    # Try to check if bucket exists with head_bucket
                    s3_client.head_bucket(Bucket=s3_bucket_name)
                    bucket_exists = True
                    bucket_access = True
                    logger.info(f"Successfully verified bucket exists with head_bucket: {s3_bucket_name}")
                except s3_client.exceptions.NoSuchBucket:
                    bucket_exists = False
                    logger.warning(f"Bucket does not exist: {s3_bucket_name}")
                except Exception as head_err:
                    logger.warning(f"Error with head_bucket: {str(head_err)}")
                    # Try listing objects instead
                    try:
                        resp = s3_client.list_objects_v2(Bucket=s3_bucket_name, MaxKeys=1)
                        bucket_exists = True
                        bucket_access = True
                        logger.info(f"Successfully verified bucket with list_objects: {s3_bucket_name}")
                    except s3_client.exceptions.NoSuchBucket:
                        bucket_exists = False
                        logger.warning(f"Confirmed bucket does not exist with list_objects: {s3_bucket_name}")
                    except Exception as list_err:
                        logger.warning(f"Could not list objects: {str(list_err)}")
                        # We're not sure if the bucket exists or if we just don't have permission
                
                diagnostics.update({
                    "connection_test": "success",
                    "bucket_exists": bucket_exists,
                    "bucket_access": bucket_access
                })
                
                # Check bucket permissions if the bucket exists
                if bucket_exists:
                    try:
                        # Test list objects permission
                        s3_client.list_objects_v2(Bucket=s3_bucket_name, MaxKeys=1)
                        diagnostics["list_permission"] = True
                    except ClientError:
                        diagnostics["list_permission"] = False
                    
                    try:
                        # Test put object permission with a tiny test file
                        test_key = f"test/permission-check-{uuid.uuid4()}.txt"
                        s3_client.put_object(Bucket=s3_bucket_name, Key=test_key, Body=b"test")
                        diagnostics["write_permission"] = True
                        
                        # Try to delete the test file
                        s3_client.delete_object(Bucket=s3_bucket_name, Key=test_key)
                        diagnostics["delete_permission"] = True
                    except ClientError:
                        diagnostics["write_permission"] = False
                        diagnostics["delete_permission"] = False
                
            except Exception as e:
                diagnostics.update({
                    "connection_test": "failure",
                    "error": str(e)
                })
        else:
            diagnostics["connection_test"] = "skipped_missing_credentials"
        
        return {
            "success": True,
            "diagnostics": diagnostics,
            "message": "S3 configuration diagnostics completed"
        }
    except Exception as e:
        logger.error(f"Error testing S3 configuration: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error testing S3 configuration: {str(e)}")

@router.get("/check-env-vars")
async def check_env_vars(user = Depends(get_user_from_token)):
    """
    Debug endpoint to check environment variables directly
    """
    try:
        # Check environment variables using different methods
        result = {
            "os_environ_direct": {
                "AWS_ACCESS_KEY_ID": "PRESENT" if "AWS_ACCESS_KEY_ID" in os.environ else "MISSING",
                "AWS_SECRET_ACCESS_KEY": "PRESENT" if "AWS_SECRET_ACCESS_KEY" in os.environ else "MISSING",
                "S3_BUCKET_NAME": os.environ.get("S3_BUCKET_NAME", "MISSING"),
                "AWS_REGION": os.environ.get("AWS_REGION", "MISSING")
            },
            "os_getenv": {
                "AWS_ACCESS_KEY_ID": "PRESENT" if os.getenv("AWS_ACCESS_KEY_ID") else "MISSING",
                "AWS_SECRET_ACCESS_KEY": "PRESENT" if os.getenv("AWS_SECRET_ACCESS_KEY") else "MISSING",
                "S3_BUCKET_NAME": os.getenv("S3_BUCKET_NAME", "MISSING"),
                "AWS_REGION": os.getenv("AWS_REGION", "MISSING")
            },
            "railway_specific": {
                "RAILWAY_ENV": os.environ.get("RAILWAY_ENV", "MISSING"),
                "RAILWAY_SERVICE_NAME": os.environ.get("RAILWAY_SERVICE_NAME", "MISSING")
            }
        }
        
        # Add some Railway-specific environment info if available
        return {
            "success": True,
            "environment_variables": result,
            "railway_detected": "RAILWAY_ENV" in os.environ
        }
    except Exception as e:
        logger.error(f"Error checking environment variables: {str(e)}", exc_info=True)
        return {
            "success": False,
            "error": str(e)
        }

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
    debug: bool = False,
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
        logger.info(f"Component data for recipe {recipe_id}: {component}")
        
        # Get preferences if any
        cursor.execute("""
            SELECT * FROM recipe_preferences
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        preferences = cursor.fetchone()
        
        # If debug mode is enabled, include extra information
        debug_info = None
        if debug:
            logger.info(f"Running debug check for recipe {recipe_id}")
            
            # Check if recipe_components table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'recipe_components'
                )
            """)
            table_exists = cursor.fetchone()
            
            # Direct SQL checks
            cursor.execute("SELECT COUNT(*) FROM recipe_components")
            total_components = cursor.fetchone()
            
            # Check component_type column
            cursor.execute("""
                SELECT column_name, data_type, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components'
                AND column_name = 'component_type'
            """)
            component_type_info = cursor.fetchone()
            
            # Check if this specific recipe has a component
            cursor.execute("""
                SELECT COUNT(*) FROM recipe_components
                WHERE recipe_id = %s
            """, (recipe_id,))
            has_component = cursor.fetchone()
            
            # Get the actual component data without any processing
            cursor.execute("""
                SELECT * FROM recipe_components
                WHERE recipe_id = %s
            """, (recipe_id,))
            raw_component = cursor.fetchone()
            
            debug_info = {
                "table_exists": table_exists,
                "total_components": total_components,
                "component_type_column": component_type_info,
                "has_component_count": has_component,
                "raw_component_data": raw_component,
                "component_type": raw_component.get('component_type') if raw_component else None
            }
        
        result = {
            "recipe": recipe,
            "component": component,
            "preferences": preferences
        }
        
        if debug_info:
            result["debug_info"] = debug_info
            
        return result
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
            logger.info(f"Updating image_url to: {recipe_data['image_url']}")
            update_fields.append("image_url = %s")
            update_values.append(recipe_data['image_url'])
        else:
            logger.warning(f"No image_url found in update data: {recipe_data.keys()}")
            
        # Handle notes update
        if 'notes' in recipe_data:
            logger.info(f"Updating notes: {recipe_data['notes'][:50]}...")
            update_fields.append("notes = %s")
            update_values.append(recipe_data['notes'])
        
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
            RETURNING id, title, image_url, instructions, metadata, notes
        """
        
        # Add recipe_id to values
        update_values.append(recipe_id)
        
        # Log the final query and values for debugging
        logger.info(f"Update query: {update_query}")
        logger.info(f"Update values: {update_values}")
        
        # Execute the update
        cursor.execute(update_query, update_values)
        updated_recipe = cursor.fetchone()
        conn.commit()
        
        # Log the returned recipe
        logger.info(f"Updated recipe returned from database: {updated_recipe}")
        
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