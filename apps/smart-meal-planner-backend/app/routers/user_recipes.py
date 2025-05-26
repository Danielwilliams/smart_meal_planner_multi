# app/routers/user_recipes.py

from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.db import get_db_connection
from app.models.user import (
    UserRecipe, UserRecipeCreate, UserRecipeUpdate, UserRecipeListItem,
    UserRecipeIngredient, UserRecipeStep
)
from app.utils.auth_utils import get_user_from_token
import json
import logging
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/user-recipes", tags=["user-recipes"])
logger = logging.getLogger(__name__)

def get_user_organization_id(user_id: int) -> Optional[int]:
    """Get the organization ID for a user if they own an organization"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id FROM organizations 
                WHERE owner_id = %s
            """, (user_id,))
            
            result = cur.fetchone()
            return result[0] if result else None
    finally:
        conn.close()

# Get User Recipes

@router.get("/", response_model=List[UserRecipeListItem])
async def get_user_recipes(
    search: Optional[str] = Query(None, description="Search recipes by title"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    meal_category: Optional[str] = Query(None, description="Filter by meal category"),
    include_public: bool = Query(False, description="Include public recipes from other users"),
    limit: int = Query(50, ge=1, le=200, description="Number of recipes to return"),
    offset: int = Query(0, ge=0, description="Number of recipes to skip"),
    current_user = Depends(get_user_from_token)
):
    """Get user's custom recipes with optional filtering"""
    
    user_id = current_user['user_id']
    organization_id = get_user_organization_id(user_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Build query conditions
            where_conditions = ["ur.is_active = TRUE"]
            params = []
            
            if include_public:
                # Include user's own recipes OR public recipes from others
                if organization_id:
                    where_conditions.append("""
                        (ur.created_by_user_id = %s OR ur.created_by_organization_id = %s OR ur.is_public = TRUE)
                    """)
                    params.extend([user_id, organization_id])
                else:
                    where_conditions.append("(ur.created_by_user_id = %s OR ur.is_public = TRUE)")
                    params.append(user_id)
            else:
                # Only user's own recipes
                if organization_id:
                    where_conditions.append("(ur.created_by_user_id = %s OR ur.created_by_organization_id = %s)")
                    params.extend([user_id, organization_id])
                else:
                    where_conditions.append("ur.created_by_user_id = %s")
                    params.append(user_id)
            
            # Add search filter
            if search:
                where_conditions.append("ur.title ILIKE %s")
                params.append(f"%{search}%")
            
            # Add cuisine filter
            if cuisine:
                where_conditions.append("ur.cuisine ILIKE %s")
                params.append(f"%{cuisine}%")
                
            # Add meal category filter  
            if meal_category:
                where_conditions.append("ur.meal_category = %s")
                params.append(meal_category)
            
            where_clause = " AND ".join(where_conditions)
            
            query = f"""
                SELECT 
                    ur.id, ur.title, ur.description, ur.prep_time, ur.cook_time, ur.total_time,
                    ur.servings, ur.cuisine, ur.complexity, ur.meal_category, ur.diet_tags,
                    ur.custom_tags, ur.image_url, ur.calories_per_serving, ur.is_public,
                    ur.created_at, ur.created_by_user_id, ur.created_by_organization_id
                FROM user_recipes ur
                WHERE {where_clause}
                ORDER BY ur.updated_at DESC
                LIMIT %s OFFSET %s
            """
            
            params.extend([limit, offset])
            cur.execute(query, params)
            results = cur.fetchall()
            
            recipes = []
            for row in results:
                recipes.append({
                    "id": row[0],
                    "title": row[1],
                    "description": row[2],
                    "prep_time": row[3],
                    "cook_time": row[4],
                    "total_time": row[5],
                    "servings": row[6],
                    "cuisine": row[7],
                    "complexity": row[8],
                    "meal_category": row[9],
                    "diet_tags": json.loads(row[10]) if row[10] else [],
                    "custom_tags": json.loads(row[11]) if row[11] else [],
                    "image_url": row[12],
                    "calories_per_serving": row[13],
                    "is_public": row[14],
                    "created_at": row[15],
                    "created_by_user_id": row[16],
                    "created_by_organization_id": row[17]
                })
            
            return recipes
            
    except Exception as e:
        logger.error(f"Error getting user recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get user recipes"
        )
    finally:
        conn.close()

# Get Single Recipe with Full Details

@router.get("/{recipe_id}", response_model=UserRecipe)
async def get_user_recipe(
    recipe_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get a single user recipe with full details including ingredients and steps"""
    
    user_id = current_user['user_id']
    organization_id = get_user_organization_id(user_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get recipe details
            cur.execute("""
                SELECT 
                    ur.id, ur.created_by_user_id, ur.created_by_organization_id, ur.title,
                    ur.description, ur.instructions, ur.prep_time, ur.cook_time, ur.total_time,
                    ur.servings, ur.cuisine, ur.complexity, ur.meal_category, ur.diet_tags,
                    ur.custom_tags, ur.image_url, ur.calories_per_serving, ur.protein_grams,
                    ur.carbs_grams, ur.fat_grams, ur.fiber_grams, ur.is_public, ur.is_verified,
                    ur.is_active, ur.created_at, ur.updated_at
                FROM user_recipes ur
                WHERE ur.id = %s AND ur.is_active = TRUE
            """, (recipe_id,))
            
            recipe_row = cur.fetchone()
            if not recipe_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recipe not found"
                )
            
            # Check if user has access to this recipe
            recipe_user_id = recipe_row[1]
            recipe_org_id = recipe_row[2]
            is_public = recipe_row[21]
            
            has_access = (
                recipe_user_id == user_id or  # User owns it
                recipe_org_id == organization_id or  # User's org owns it
                is_public  # Recipe is public
            )
            
            if not has_access:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied to this recipe"
                )
            
            # Get ingredients
            cur.execute("""
                SELECT id, name, amount, unit, notes, sort_order, is_optional
                FROM user_recipe_ingredients
                WHERE recipe_id = %s
                ORDER BY sort_order ASC, id ASC
            """, (recipe_id,))
            
            ingredient_rows = cur.fetchall()
            ingredients = []
            for ing_row in ingredient_rows:
                ingredients.append({
                    "id": ing_row[0],
                    "name": ing_row[1],
                    "amount": ing_row[2],
                    "unit": ing_row[3],
                    "notes": ing_row[4],
                    "sort_order": ing_row[5],
                    "is_optional": ing_row[6]
                })
            
            # Get steps
            cur.execute("""
                SELECT id, step_number, instruction, notes, estimated_time
                FROM user_recipe_steps
                WHERE recipe_id = %s
                ORDER BY step_number ASC
            """, (recipe_id,))
            
            step_rows = cur.fetchall()
            steps = []
            for step_row in step_rows:
                steps.append({
                    "id": step_row[0],
                    "step_number": step_row[1],
                    "instruction": step_row[2],
                    "notes": step_row[3],
                    "estimated_time": step_row[4]
                })
            
            # Build complete recipe response
            recipe = {
                "id": recipe_row[0],
                "created_by_user_id": recipe_row[1],
                "created_by_organization_id": recipe_row[2],
                "title": recipe_row[3],
                "description": recipe_row[4],
                "instructions": recipe_row[5],
                "prep_time": recipe_row[6],
                "cook_time": recipe_row[7],
                "total_time": recipe_row[8],
                "servings": recipe_row[9],
                "cuisine": recipe_row[10],
                "complexity": recipe_row[11],
                "meal_category": recipe_row[12],
                "diet_tags": json.loads(recipe_row[13]) if recipe_row[13] else [],
                "custom_tags": json.loads(recipe_row[14]) if recipe_row[14] else [],
                "image_url": recipe_row[15],
                "calories_per_serving": recipe_row[16],
                "protein_grams": recipe_row[17],
                "carbs_grams": recipe_row[18],
                "fat_grams": recipe_row[19],
                "fiber_grams": recipe_row[20],
                "is_public": recipe_row[21],
                "is_verified": recipe_row[22],
                "is_active": recipe_row[23],
                "created_at": recipe_row[24],
                "updated_at": recipe_row[25],
                "ingredients": ingredients,
                "steps": steps
            }
            
            return recipe
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user recipe {recipe_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get recipe"
        )
    finally:
        conn.close()

# Create Recipe

@router.post("/", response_model=UserRecipe)
async def create_user_recipe(
    recipe_data: UserRecipeCreate,
    for_organization: bool = Query(False, description="Create recipe for user's organization"),
    current_user = Depends(get_user_from_token)
):
    """Create a new user recipe"""
    
    user_id = current_user['user_id']
    organization_id = None
    
    if for_organization:
        organization_id = get_user_organization_id(user_id)
        if not organization_id:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="User does not own an organization"
            )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Insert recipe
            cur.execute("""
                INSERT INTO user_recipes (
                    created_by_user_id, created_by_organization_id, title, description, instructions,
                    prep_time, cook_time, total_time, servings, cuisine, complexity, meal_category,
                    diet_tags, custom_tags, image_url, calories_per_serving, protein_grams,
                    carbs_grams, fat_grams, fiber_grams, is_public
                ) VALUES (
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s
                ) RETURNING id, created_at, updated_at
            """, (
                user_id if not for_organization else None,
                organization_id if for_organization else None,
                recipe_data.title,
                recipe_data.description,
                recipe_data.instructions,
                recipe_data.prep_time,
                recipe_data.cook_time,
                recipe_data.total_time,
                recipe_data.servings,
                recipe_data.cuisine,
                recipe_data.complexity,
                recipe_data.meal_category,
                json.dumps(recipe_data.diet_tags),
                json.dumps(recipe_data.custom_tags),
                recipe_data.image_url,
                recipe_data.calories_per_serving,
                recipe_data.protein_grams,
                recipe_data.carbs_grams,
                recipe_data.fat_grams,
                recipe_data.fiber_grams,
                recipe_data.is_public
            ))
            
            recipe_result = cur.fetchone()
            recipe_id = recipe_result[0]
            created_at = recipe_result[1]
            updated_at = recipe_result[2]
            
            # Insert ingredients
            ingredients = []
            for ingredient in recipe_data.ingredients:
                cur.execute("""
                    INSERT INTO user_recipe_ingredients (
                        recipe_id, name, amount, unit, notes, sort_order, is_optional
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    recipe_id,
                    ingredient.name,
                    ingredient.amount,
                    ingredient.unit,
                    ingredient.notes,
                    ingredient.sort_order,
                    ingredient.is_optional
                ))
                ing_id = cur.fetchone()[0]
                ingredients.append({
                    "id": ing_id,
                    "name": ingredient.name,
                    "amount": ingredient.amount,
                    "unit": ingredient.unit,
                    "notes": ingredient.notes,
                    "sort_order": ingredient.sort_order,
                    "is_optional": ingredient.is_optional
                })
            
            # Insert steps
            steps = []
            for step in recipe_data.steps:
                cur.execute("""
                    INSERT INTO user_recipe_steps (
                        recipe_id, step_number, instruction, notes, estimated_time
                    ) VALUES (%s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    recipe_id,
                    step.step_number,
                    step.instruction,
                    step.notes,
                    step.estimated_time
                ))
                step_id = cur.fetchone()[0]
                steps.append({
                    "id": step_id,
                    "step_number": step.step_number,
                    "instruction": step.instruction,
                    "notes": step.notes,
                    "estimated_time": step.estimated_time
                })
            
            conn.commit()
            
            # Return complete recipe
            return {
                "id": recipe_id,
                "created_by_user_id": user_id if not for_organization else None,
                "created_by_organization_id": organization_id if for_organization else None,
                "title": recipe_data.title,
                "description": recipe_data.description,
                "instructions": recipe_data.instructions,
                "prep_time": recipe_data.prep_time,
                "cook_time": recipe_data.cook_time,
                "total_time": recipe_data.total_time,
                "servings": recipe_data.servings,
                "cuisine": recipe_data.cuisine,
                "complexity": recipe_data.complexity,
                "meal_category": recipe_data.meal_category,
                "diet_tags": recipe_data.diet_tags,
                "custom_tags": recipe_data.custom_tags,
                "image_url": recipe_data.image_url,
                "calories_per_serving": recipe_data.calories_per_serving,
                "protein_grams": recipe_data.protein_grams,
                "carbs_grams": recipe_data.carbs_grams,
                "fat_grams": recipe_data.fat_grams,
                "fiber_grams": recipe_data.fiber_grams,
                "is_public": recipe_data.is_public,
                "is_verified": False,
                "is_active": True,
                "created_at": created_at,
                "updated_at": updated_at,
                "ingredients": ingredients,
                "steps": steps
            }
            
    except Exception as e:
        logger.error(f"Error creating user recipe: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create recipe"
        )
    finally:
        conn.close()

# Update Recipe

@router.put("/{recipe_id}", response_model=UserRecipe)
async def update_user_recipe(
    recipe_id: int,
    recipe_data: UserRecipeUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update a user recipe"""
    
    user_id = current_user['user_id']
    organization_id = get_user_organization_id(user_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if recipe exists and user has permission to edit
            cur.execute("""
                SELECT created_by_user_id, created_by_organization_id
                FROM user_recipes 
                WHERE id = %s AND is_active = TRUE
            """, (recipe_id,))
            
            recipe_row = cur.fetchone()
            if not recipe_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recipe not found"
                )
            
            recipe_user_id = recipe_row[0]
            recipe_org_id = recipe_row[1]
            
            # Check ownership
            if recipe_user_id != user_id and recipe_org_id != organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: You can only edit your own recipes"
                )
            
            # Build update query
            update_fields = []
            params = []
            
            if recipe_data.title is not None:
                update_fields.append("title = %s")
                params.append(recipe_data.title)
            if recipe_data.description is not None:
                update_fields.append("description = %s")
                params.append(recipe_data.description)
            if recipe_data.instructions is not None:
                update_fields.append("instructions = %s")
                params.append(recipe_data.instructions)
            if recipe_data.prep_time is not None:
                update_fields.append("prep_time = %s")
                params.append(recipe_data.prep_time)
            if recipe_data.cook_time is not None:
                update_fields.append("cook_time = %s")
                params.append(recipe_data.cook_time)
            if recipe_data.total_time is not None:
                update_fields.append("total_time = %s")
                params.append(recipe_data.total_time)
            if recipe_data.servings is not None:
                update_fields.append("servings = %s")
                params.append(recipe_data.servings)
            if recipe_data.cuisine is not None:
                update_fields.append("cuisine = %s")
                params.append(recipe_data.cuisine)
            if recipe_data.complexity is not None:
                update_fields.append("complexity = %s")
                params.append(recipe_data.complexity)
            if recipe_data.meal_category is not None:
                update_fields.append("meal_category = %s")
                params.append(recipe_data.meal_category)
            if recipe_data.diet_tags is not None:
                update_fields.append("diet_tags = %s")
                params.append(json.dumps(recipe_data.diet_tags))
            if recipe_data.custom_tags is not None:
                update_fields.append("custom_tags = %s")
                params.append(json.dumps(recipe_data.custom_tags))
            if recipe_data.image_url is not None:
                update_fields.append("image_url = %s")
                params.append(recipe_data.image_url)
            if recipe_data.calories_per_serving is not None:
                update_fields.append("calories_per_serving = %s")
                params.append(recipe_data.calories_per_serving)
            if recipe_data.protein_grams is not None:
                update_fields.append("protein_grams = %s")
                params.append(recipe_data.protein_grams)
            if recipe_data.carbs_grams is not None:
                update_fields.append("carbs_grams = %s")
                params.append(recipe_data.carbs_grams)
            if recipe_data.fat_grams is not None:
                update_fields.append("fat_grams = %s")
                params.append(recipe_data.fat_grams)
            if recipe_data.fiber_grams is not None:
                update_fields.append("fiber_grams = %s")
                params.append(recipe_data.fiber_grams)
            if recipe_data.is_public is not None:
                update_fields.append("is_public = %s")
                params.append(recipe_data.is_public)
            
            if update_fields:
                update_query = f"""
                    UPDATE user_recipes 
                    SET {', '.join(update_fields)}
                    WHERE id = %s
                """
                params.append(recipe_id)
                cur.execute(update_query, params)
            
            # Update ingredients if provided
            if recipe_data.ingredients is not None:
                # Delete existing ingredients
                cur.execute("DELETE FROM user_recipe_ingredients WHERE recipe_id = %s", (recipe_id,))
                
                # Insert new ingredients
                for ingredient in recipe_data.ingredients:
                    cur.execute("""
                        INSERT INTO user_recipe_ingredients (
                            recipe_id, name, amount, unit, notes, sort_order, is_optional
                        ) VALUES (%s, %s, %s, %s, %s, %s, %s)
                    """, (
                        recipe_id,
                        ingredient.name,
                        ingredient.amount,
                        ingredient.unit,
                        ingredient.notes,
                        ingredient.sort_order,
                        ingredient.is_optional
                    ))
            
            # Update steps if provided
            if recipe_data.steps is not None:
                # Delete existing steps
                cur.execute("DELETE FROM user_recipe_steps WHERE recipe_id = %s", (recipe_id,))
                
                # Insert new steps
                for step in recipe_data.steps:
                    cur.execute("""
                        INSERT INTO user_recipe_steps (
                            recipe_id, step_number, instruction, notes, estimated_time
                        ) VALUES (%s, %s, %s, %s, %s)
                    """, (
                        recipe_id,
                        step.step_number,
                        step.instruction,
                        step.notes,
                        step.estimated_time
                    ))
            
            conn.commit()
            
            # Return updated recipe (reuse get_user_recipe logic)
            return await get_user_recipe(recipe_id, current_user)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating user recipe {recipe_id}: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update recipe"
        )
    finally:
        conn.close()

# Delete Recipe

@router.delete("/{recipe_id}")
async def delete_user_recipe(
    recipe_id: int,
    current_user = Depends(get_user_from_token)
):
    """Delete a user recipe (soft delete by setting is_active = FALSE)"""
    
    user_id = current_user['user_id']
    organization_id = get_user_organization_id(user_id)
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if recipe exists and user has permission
            cur.execute("""
                SELECT created_by_user_id, created_by_organization_id
                FROM user_recipes 
                WHERE id = %s AND is_active = TRUE
            """, (recipe_id,))
            
            recipe_row = cur.fetchone()
            if not recipe_row:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recipe not found"
                )
            
            recipe_user_id = recipe_row[0]
            recipe_org_id = recipe_row[1]
            
            # Check ownership
            if recipe_user_id != user_id and recipe_org_id != organization_id:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Permission denied: You can only delete your own recipes"
                )
            
            # Soft delete
            cur.execute("""
                UPDATE user_recipes 
                SET is_active = FALSE
                WHERE id = %s
            """, (recipe_id,))
            
            conn.commit()
            
            return {"message": "Recipe deleted successfully"}
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting user recipe {recipe_id}: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete recipe"
        )
    finally:
        conn.close()