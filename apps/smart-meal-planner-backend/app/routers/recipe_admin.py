import logging
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import List, Optional, Dict, Any
import logging
from ..db import get_db_connection
from psycopg2.extras import RealDictCursor
import json
from ..utils.auth_utils import get_user_from_token, is_organization_admin

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/recipe-admin", tags=["RecipeAdmin"])

@router.get("/")
async def get_recipes(
    cuisine: Optional[str] = None,
    complexity: Optional[str] = None,
    ingredient: Optional[str] = None,
    tags: Optional[str] = None,
    include_details: bool = Query(False, description="Include ingredients and instructions"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user = Depends(get_user_from_token)
):
    """Get recipes with optional filtering"""
    user_id = user.get('user_id')
    
    # Check if user is an admin (organization admin or regular user)
    account_type = user.get('account_type', 'user')
    if account_type != 'admin' and not await is_organization_admin(user_id):
        # Regular users can still access, but you may want to limit features
        logger.info(f"Non-admin user {user_id} accessing recipe admin panel")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Base query - include the columns needed for ORDER BY
        # Now INCLUDING component_type in the query
        if include_details:
            query = """
                SELECT DISTINCT
                    r.id, r.title, r.complexity, r.source, r.cuisine,
                    r.prep_time, r.cook_time, r.total_time, r.image_url, 
                    r.is_verified, r.date_scraped, r.metadata, 
                    rc.component_type
                FROM scraped_recipes r
                LEFT JOIN recipe_components rc ON r.id = rc.recipe_id
            """
        else:
            query = """
                SELECT DISTINCT
                    r.id, r.title, r.complexity, r.source, r.cuisine,
                    r.prep_time, r.cook_time, r.total_time, r.image_url, 
                    r.is_verified, r.date_scraped, rc.component_type
                FROM scraped_recipes r
                LEFT JOIN recipe_components rc ON r.id = rc.recipe_id
            """
        
        where_clauses = []
        params = []
        joins = []
        
        # Add filters
        if cuisine:
            where_clauses.append("r.cuisine ILIKE %s")
            params.append(f"%{cuisine}%")
            
        if complexity:
            where_clauses.append("r.complexity = %s")
            params.append(complexity)
            
        if ingredient:
            joins.append("JOIN recipe_ingredients i ON r.id = i.recipe_id")
            where_clauses.append("i.name ILIKE %s")
            params.append(f"%{ingredient}%")
            
        if tags:
            # Filter by one or more tags (comma-separated)
            tag_list = [t.strip() for t in tags.split(',')]
            joins.append("JOIN recipe_tags t ON r.id = t.recipe_id")
            placeholders = ', '.join(['%s'] * len(tag_list))
            where_clauses.append(f"t.tag IN ({placeholders})")
            params.extend(tag_list)
        
        # Add joins to query if needed
        if joins:
            query += " " + " ".join(joins)
            
        # Add where clauses if any
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
            
        # Add ordering and limits
        query += """
            ORDER BY r.is_verified DESC, r.date_scraped DESC
            LIMIT %s OFFSET %s
        """
        
        params.extend([limit, offset])
        
        # Log the query for debugging
        logger.info(f"Executing query: {query} with params: {params}")
        
        # Execute query
        cursor.execute(query, params)
        recipes = cursor.fetchall()
        
        # Count query for pagination
        count_query = """
            SELECT COUNT(DISTINCT r.id) as total
            FROM scraped_recipes r
        """
        
        if joins:
            count_query += " " + " ".join(joins)
            
        if where_clauses:
            count_query += " WHERE " + " AND ".join(where_clauses)
            
        cursor.execute(count_query, params[:-2] if params else [])
        total = cursor.fetchone()["total"]
        
        # Check if each recipe is saved by the current user
        for recipe in recipes:
            cursor.execute("""
                SELECT id FROM saved_recipes 
                WHERE user_id = %s AND recipe_id = %s
            """, (user_id, recipe['id']))
            saved = cursor.fetchone()
            recipe['is_saved'] = saved is not None
            
            # Process metadata if available to extract ingredients and instructions 
            if include_details and recipe.get('metadata'):
                # Extract ingredients from metadata
                if isinstance(recipe['metadata'], str):
                    try:
                        metadata = json.loads(recipe['metadata'])
                    except:
                        metadata = {}
                else:
                    metadata = recipe.get('metadata', {})
                
                # Extract ingredients_list from metadata if present
                if metadata and 'ingredients_list' in metadata:
                    recipe['ingredients'] = metadata['ingredients_list']
                
                # Extract instructions separately (should be directly in scraped_recipes)
                if 'instructions' in recipe and isinstance(recipe['instructions'], str):
                    try:
                        recipe['instructions'] = json.loads(recipe['instructions'])
                    except:
                        pass
        
        logger.info(f"Returning {len(recipes)} recipes with component_type info")
        
        return {
            "total": total,
            "recipes": recipes,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Error in get_recipes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching recipes: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.post("/tag-preferences")
async def tag_recipe_preferences(
    request_data: dict = Body(...),
    user = Depends(get_user_from_token)
):
    """Tag recipes with preference information (diet, cuisine, flavors, etc.)"""
    recipe_ids = request_data.get("recipe_ids", [])
    preferences = request_data.get("preferences", {})
    
    # Check if user is an admin (organization admin or regular user)
    user_id = user.get('user_id')
    account_type = user.get('account_type', 'user')
    if account_type != 'admin' and not await is_organization_admin(user_id):
        # Only admins can tag recipes
        raise HTTPException(status_code=403, detail="Only administrators can tag recipes")
    
    if not recipe_ids:
        raise HTTPException(status_code=400, detail="No recipe IDs provided")
    
    if not preferences:
        raise HTTPException(status_code=400, detail="No preferences provided")
    
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        success_count = 0
        results = []
        
        for recipe_id in recipe_ids:
            try:
                # First check if recipe exists
                cursor.execute("SELECT id FROM scraped_recipes WHERE id = %s", (recipe_id,))
                if not cursor.fetchone():
                    results.append({
                        "recipe_id": recipe_id,
                        "success": False,
                        "error": "Recipe not found"
                    })
                    continue
                
                # Extract individual preference fields
                diet_type = preferences.get("diet_type")
                cuisine = preferences.get("cuisine")
                flavor_tags = preferences.get("flavor_tags", [])
                spice_level = preferences.get("spice_level")
                recipe_format = preferences.get("recipe_format")
                meal_prep_type = preferences.get("meal_prep_type")
                prep_complexity = preferences.get("prep_complexity")
                appliances = preferences.get("appliances", [])
                
                # Store the serialized flavor tags
                flavor_tags_json = json.dumps(flavor_tags) if flavor_tags else None
                
                # Store the serialized appliances
                appliances_json = json.dumps(appliances) if appliances else None
                
                # Check if preferences record already exists
                cursor.execute("""
                    SELECT id FROM recipe_preferences 
                    WHERE recipe_id = %s
                """, (recipe_id,))
                
                existing = cursor.fetchone()
                
                if existing:
                    # Update existing preferences
                    update_fields = []
                    update_values = []
                    
                    if diet_type is not None:
                        update_fields.append("diet_type = %s")
                        update_values.append(diet_type)
                    
                    if cuisine is not None:
                        update_fields.append("cuisine = %s")
                        update_values.append(cuisine)
                    
                    if flavor_tags_json is not None:
                        update_fields.append("flavor_tags = %s")
                        update_values.append(flavor_tags_json)
                    
                    if spice_level is not None:
                        update_fields.append("spice_level = %s")
                        update_values.append(spice_level)
                    
                    if recipe_format is not None:
                        update_fields.append("recipe_format = %s")
                        update_values.append(recipe_format)
                    
                    if meal_prep_type is not None:
                        update_fields.append("meal_prep_type = %s")
                        update_values.append(meal_prep_type)
                    
                    if prep_complexity is not None:
                        update_fields.append("prep_complexity = %s")
                        update_values.append(prep_complexity)
                    
                    if appliances_json is not None:
                        update_fields.append("appliances = %s")
                        update_values.append(appliances_json)
                    
                    # Only update if there are fields to update
                    if update_fields:
                        query = f"""
                            UPDATE recipe_preferences
                            SET {", ".join(update_fields)},
                                updated_at = NOW()
                            WHERE recipe_id = %s
                            RETURNING id
                        """
                        update_values.append(recipe_id)
                        cursor.execute(query, update_values)
                        
                        success_count += 1
                        results.append({
                            "recipe_id": recipe_id,
                            "success": True,
                            "message": "Preferences updated successfully"
                        })
                else:
                    # Create new preferences
                    cursor.execute("""
                        INSERT INTO recipe_preferences (
                            recipe_id,
                            diet_type,
                            cuisine,
                            flavor_tags,
                            spice_level,
                            recipe_format,
                            meal_prep_type,
                            prep_complexity,
                            appliances
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (
                        recipe_id,
                        diet_type,
                        cuisine,
                        flavor_tags_json,
                        spice_level,
                        recipe_format,
                        meal_prep_type,
                        prep_complexity,
                        appliances_json
                    ))
                    
                    success_count += 1
                    results.append({
                        "recipe_id": recipe_id,
                        "success": True,
                        "message": "Preferences created successfully"
                    })
            
            except Exception as e:
                logger.error(f"Error setting preferences for recipe {recipe_id}: {str(e)}")
                results.append({
                    "recipe_id": recipe_id,
                    "success": False,
                    "error": str(e)
                })
        
        conn.commit()
        
        # Also update the cuisine field in the scraped_recipes table if provided
        if cuisine:
            for recipe_id in recipe_ids:
                try:
                    cursor.execute("""
                        UPDATE scraped_recipes
                        SET cuisine = %s
                        WHERE id = %s
                    """, (cuisine, recipe_id))
                except Exception as e:
                    logger.error(f"Error updating cuisine for recipe {recipe_id}: {str(e)}")
        
        conn.commit()
        
        return {
            "success": True,
            "tagged_count": success_count,
            "results": results
        }
    
    except Exception as e:
        logger.error(f"Error tagging recipe preferences: {str(e)}")
        conn.rollback()
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        cursor.close()
        conn.close()
  
@router.get("/check-component/{recipe_id}")
async def check_component(
    recipe_id: int,
    user = Depends(get_user_from_token)
):
    """Check if a recipe has a component type assigned"""
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check recipe_components table
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'recipe_components'
            );
        """)
        table_exists = cursor.fetchone()["exists"]
        
        if not table_exists:
            return {
                "recipe_id": recipe_id,
                "error": "recipe_components table does not exist"
            }
        
        # Get component for this recipe
        cursor.execute("""
            SELECT * FROM recipe_components WHERE recipe_id = %s
        """, (recipe_id,))
        component = cursor.fetchone()
        
        # Get recipe details
        cursor.execute("""
            SELECT id, title, cuisine, complexity FROM scraped_recipes WHERE id = %s
        """, (recipe_id,))
        recipe = cursor.fetchone()
        
        # Get recipe preferences
        cursor.execute("""
            SELECT * FROM recipe_preferences WHERE recipe_id = %s
        """, (recipe_id,))
        preferences = cursor.fetchone()
        
        return {
            "recipe": recipe,
            "component": component,
            "preferences": preferences,
            "message": "Component data retrieved successfully" if component else "No component found for this recipe"
        }
        
    except Exception as e:
        logger.error(f"Error checking component: {str(e)}")
        return {
            "error": str(e),
            "recipe_id": recipe_id
        }
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.delete("/delete-recipe/{recipe_id}")
async def delete_recipe(
    recipe_id: int,
    user = Depends(get_user_from_token)
):
    """Delete a recipe and its associated data"""
    # Check if user is an admin
    user_id = user.get('user_id')
    account_type = user.get('account_type', 'user')
    if account_type != 'admin' and not await is_organization_admin(user_id):
        # Only admins can delete recipes
        raise HTTPException(status_code=403, detail="Only administrators can delete recipes")
        
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # First check if the recipe exists
        cursor.execute("SELECT id FROM scraped_recipes WHERE id = %s", (recipe_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Delete recipe preferences if they exist
        cursor.execute("""
            DELETE FROM recipe_preferences 
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        # Delete recipe component if it exists
        cursor.execute("""
            DELETE FROM recipe_components 
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        # Delete recipe ingredients if they exist
        cursor.execute("""
            DELETE FROM recipe_ingredients 
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        # Delete recipe tags if they exist
        cursor.execute("""
            DELETE FROM recipe_tags 
            WHERE recipe_id = %s
        """, (recipe_id,))
        
        # Delete the recipe itself
        cursor.execute("""
            DELETE FROM scraped_recipes
            WHERE id = %s
            RETURNING id
        """, (recipe_id,))
        
        deleted = cursor.fetchone()
        conn.commit()
        
        if deleted:
            return {
                "success": True,
                "message": f"Recipe {recipe_id} and all associated data deleted successfully"
            }
        else:
            return {
                "success": False,
                "message": "Failed to delete recipe"
            }
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error deleting recipe {recipe_id}: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.patch("/update-recipe/{recipe_id}")
async def update_recipe(
    recipe_id: int,
    request_data: dict = Body(...),
    user = Depends(get_user_from_token)
):
    """Update recipe details including title, instructions, image_url, and metadata"""
    # Check if user is an admin
    user_id = user.get('user_id')
    account_type = user.get('account_type', 'user')
    if account_type != 'admin' and not await is_organization_admin(user_id):
        # Only admins can update recipes
        raise HTTPException(status_code=403, detail="Only administrators can update recipes")
        
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # First check if the recipe exists
        cursor.execute("SELECT id FROM scraped_recipes WHERE id = %s", (recipe_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Log the full request data for debugging
        logger.info(f"Update recipe request data: {json.dumps(request_data)}")
        
        # Extract data from request
        title = request_data.get('title')
        instructions = request_data.get('instructions')
        image_url = request_data.get('image_url')
        metadata = request_data.get('metadata')
        
        # Process data for storage
        if instructions is not None:
            # Ensure instructions is properly formatted for storage
            if isinstance(instructions, list):
                instructions_json = json.dumps(instructions)
            else:
                instructions_json = json.dumps([instructions]) if instructions else None
        else:
            instructions_json = None
        
        if metadata is not None:
            # Ensure metadata is properly formatted for storage
            metadata_json = json.dumps(metadata) if metadata else None
        else:
            metadata_json = None
        
        # Build update query based on provided fields
        update_fields = []
        update_values = []
        
        if title is not None:
            update_fields.append("title = %s")
            update_values.append(title)
            
        if instructions_json is not None:
            update_fields.append("instructions = %s")
            update_values.append(instructions_json)
            
        if image_url is not None:
            update_fields.append("image_url = %s")
            update_values.append(image_url)
            
        if metadata_json is not None:
            update_fields.append("metadata = %s")
            update_values.append(metadata_json)
        
        # Add recipe ID as the last parameter
        update_values.append(recipe_id)
        
        # Log the SQL update operation for debugging
        logger.info(f"Update fields: {update_fields}")
        logger.info(f"Update values: {update_values}")
            
        # Update the recipe in scraped_recipes table
        if update_fields:
            update_query = f"""
                UPDATE scraped_recipes
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id, title
            """
            
            logger.info(f"Executing update query: {update_query}")
            cursor.execute(update_query, update_values)
            updated = cursor.fetchone()
            
            if not updated:
                raise HTTPException(status_code=500, detail="Failed to update recipe")
            
            logger.info(f"Update successful: {updated}")
        
        conn.commit()
        logger.info(f"Recipe {recipe_id} updated successfully")
        
        return {
            "success": True,
            "message": "Recipe updated successfully",
            "recipe_id": recipe_id
        }
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error updating recipe {recipe_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

@router.patch("/update-nutrition/{recipe_id}")
async def update_recipe_nutrition(
    recipe_id: int,
    request_data: dict = Body(...),
    user = Depends(get_user_from_token)
):
    """Update recipe nutrition information"""
    # Check if user is an admin
    user_id = user.get('user_id')
    account_type = user.get('account_type', 'user')
    if account_type != 'admin' and not await is_organization_admin(user_id):
        # Only admins can update recipes
        raise HTTPException(status_code=403, detail="Only administrators can update recipe nutrition")
        
    conn = None
    cursor = None
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if the recipe exists
        cursor.execute("SELECT id FROM scraped_recipes WHERE id = %s", (recipe_id,))
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Recipe not found")
        
        # Log the nutrition data for debugging
        logger.info(f"Update nutrition request data: {json.dumps(request_data)}")
        
        # Extract macros data from request
        macros = request_data.get('macros')
        
        # If macros provided, update or create recipe_nutrition record
        if macros and macros.get('perServing'):
            # Check if nutrition record already exists
            cursor.execute("""
                SELECT id FROM recipe_nutrition
                WHERE recipe_id = %s
            """, (recipe_id,))
            
            nutrition_record = cursor.fetchone()
            per_serving = macros.get('perServing', {})
            
            calories = per_serving.get('calories')
            protein = per_serving.get('protein')
            carbs = per_serving.get('carbs')
            fat = per_serving.get('fat')
            
            logger.info(f"Nutrition values: calories={calories}, protein={protein}, carbs={carbs}, fat={fat}")
            
            if nutrition_record:
                # Update existing nutrition record
                cursor.execute("""
                    UPDATE recipe_nutrition
                    SET 
                        calories = %s,
                        protein = %s,
                        carbs = %s,
                        fat = %s
                    WHERE recipe_id = %s
                """, (calories, protein, carbs, fat, recipe_id))
                logger.info(f"Updated nutrition record for recipe {recipe_id}")
            else:
                # Create new nutrition record
                cursor.execute("""
                    INSERT INTO recipe_nutrition (
                        recipe_id, calories, protein, carbs, fat
                    ) VALUES (%s, %s, %s, %s, %s)
                """, (recipe_id, calories, protein, carbs, fat))
                logger.info(f"Created new nutrition record for recipe {recipe_id}")
            
            conn.commit()
            return {
                "success": True,
                "message": "Recipe nutrition updated successfully",
                "recipe_id": recipe_id
            }
        else:
            return {
                "success": False,
                "message": "No nutrition data provided",
                "recipe_id": recipe_id
            }
        
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error updating recipe nutrition {recipe_id}: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()
            
@router.post("/tag-recipes")
async def tag_recipes(
    request_data: dict = Body(...),
    user = Depends(get_user_from_token)
):
    """Tag recipes with component type information"""
    # Check if user is an admin
    user_id = user.get('user_id')
    account_type = user.get('account_type', 'user')
    if account_type != 'admin' and not await is_organization_admin(user_id):
        # Only admins can tag recipes
        raise HTTPException(status_code=403, detail="Only administrators can tag recipes")
        
    conn = None
    cursor = None
    
    try:
        recipe_ids = request_data.get("recipe_ids", [])
        component_type = request_data.get("component_type")
        
        if not recipe_ids:
            raise HTTPException(status_code=400, detail="No recipe IDs provided")
        
        if not component_type:
            raise HTTPException(status_code=400, detail="No component type provided")
        
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Log the request for debugging
        logger.info(f"Tagging recipes with component_type: {component_type}")
        logger.info(f"Recipe IDs to tag: {recipe_ids}")
        
        success_count = 0
        results = []
        
        for recipe_id in recipe_ids:
            try:
                # Check if recipe exists
                cursor.execute("SELECT id, title FROM scraped_recipes WHERE id = %s", (recipe_id,))
                recipe = cursor.fetchone()
                
                if not recipe:
                    results.append({
                        "recipe_id": recipe_id,
                        "success": False,
                        "error": "Recipe not found"
                    })
                    continue
                
                # Update the component_type in scraped_recipes
                cursor.execute("""
                    UPDATE scraped_recipes
                    SET component_type = %s
                    WHERE id = %s
                """, (component_type, recipe_id))
                
                # Check if recipe already has a component in recipe_components
                cursor.execute("""
                    SELECT id FROM recipe_components
                    WHERE recipe_id = %s
                """, (recipe_id,))
                
                existing_component = cursor.fetchone()
                
                if existing_component:
                    # Update existing component
                    cursor.execute("""
                        UPDATE recipe_components
                        SET component_type = %s,
                            updated_at = CURRENT_TIMESTAMP
                        WHERE recipe_id = %s
                    """, (component_type, recipe_id))
                    
                    logger.info(f"Updated component type for recipe {recipe_id} to {component_type}")
                else:
                    # Create a new component record
                    cursor.execute("""
                        INSERT INTO recipe_components (
                            recipe_id,
                            name,
                            component_type,
                            created_at,
                            updated_at
                        ) VALUES (%s, %s, %s, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
                    """, (
                        recipe_id,
                        recipe["title"],
                        component_type
                    ))
                    
                    logger.info(f"Created new component for recipe {recipe_id} with type {component_type}")
                
                success_count += 1
                results.append({
                    "recipe_id": recipe_id,
                    "success": True,
                    "message": f"Tagged as {component_type}"
                })
                
            except Exception as e:
                logger.error(f"Error tagging recipe {recipe_id}: {str(e)}")
                results.append({
                    "recipe_id": recipe_id,
                    "success": False,
                    "error": str(e)
                })
        
        conn.commit()
        logger.info(f"Successfully tagged {success_count} out of {len(recipe_ids)} recipes")
        
        return {
            "success": True,
            "tagged_count": success_count,
            "results": results
        }
    
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error in tag_recipes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
    
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()