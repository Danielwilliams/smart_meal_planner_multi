# app/routers/organization_recipes.py

from fastapi import APIRouter, HTTPException, Depends, status, Query
from app.db import get_db_connection
from app.models.user import (
    OrganizationRecipe, OrganizationRecipeCreate, OrganizationRecipeUpdate,
    OrganizationRecipeCategory, OrganizationRecipeCategoryCreate, OrganizationRecipeCategoryUpdate,
    OrganizationMenuDefaults, OrganizationMenuDefaultsUpdate,
    OrganizationNutritionalStandard, OrganizationNutritionalStandardCreate, OrganizationNutritionalStandardUpdate,
    RecipeApprovalRequest, RecipeApprovalResponse
)
from app.utils.auth_utils import get_user_from_token
import json
import logging
from typing import List, Optional
from datetime import datetime

router = APIRouter(prefix="/api/organization-recipes", tags=["organization-recipes"])
logger = logging.getLogger(__name__)

def get_user_organization_id(user_id: int) -> int:
    """Get the organization ID for a user, ensuring they are an organization owner"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user owns an organization
            cur.execute("""
                SELECT id FROM organizations 
                WHERE owner_id = %s
            """, (user_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="Access denied: User is not an organization owner"
                )
            return result[0]
    finally:
        conn.close()

# Recipe Categories Management

@router.get("/{organization_id}/categories", response_model=List[OrganizationRecipeCategory])
async def get_recipe_categories(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get all recipe categories for an organization"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    id, organization_id, name, description, color, sort_order,
                    is_active, created_at, updated_at, created_by
                FROM organization_recipe_categories
                WHERE organization_id = %s AND is_active = TRUE
                ORDER BY sort_order ASC, name ASC
            """, (organization_id,))
            
            categories = cur.fetchall()
            
            result = []
            for cat in categories:
                result.append({
                    "id": cat[0],
                    "organization_id": cat[1],
                    "name": cat[2],
                    "description": cat[3],
                    "color": cat[4],
                    "sort_order": cat[5],
                    "is_active": cat[6],
                    "created_at": cat[7],
                    "updated_at": cat[8],
                    "created_by": cat[9]
                })
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting recipe categories for org {organization_id}: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get recipe categories"
        )
    finally:
        conn.close()

@router.post("/{organization_id}/categories", response_model=OrganizationRecipeCategory)
async def create_recipe_category(
    organization_id: int,
    category_data: OrganizationRecipeCategoryCreate,
    current_user = Depends(get_user_from_token)
):
    """Create a new recipe category"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO organization_recipe_categories 
                (organization_id, name, description, color, sort_order, created_by)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id, organization_id, name, description, color, sort_order,
                         is_active, created_at, updated_at, created_by
            """, (
                organization_id,
                category_data.name,
                category_data.description,
                category_data.color,
                category_data.sort_order,
                current_user['user_id']
            ))
            
            result = cur.fetchone()
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": result[1],
                "name": result[2],
                "description": result[3],
                "color": result[4],
                "sort_order": result[5],
                "is_active": result[6],
                "created_at": result[7],
                "updated_at": result[8],
                "created_by": result[9]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error creating recipe category: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create recipe category"
        )
    finally:
        conn.close()

# Organization Recipes Management

@router.get("/{organization_id}/recipes", response_model=List[OrganizationRecipe])
async def get_organization_recipes(
    organization_id: int,
    status_filter: Optional[str] = Query(None, description="Filter by approval status"),
    category_id: Optional[int] = Query(None, description="Filter by category"),
    approved_only: bool = Query(False, description="Show only approved recipes"),
    current_user = Depends(get_user_from_token)
):
    """Get organization recipes with optional filtering"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Build dynamic query with filters
            where_conditions = ["or_r.organization_id = %s"]
            params = [organization_id]
            
            if status_filter:
                where_conditions.append("or_r.approval_status = %s")
                params.append(status_filter)
            
            if category_id:
                where_conditions.append("or_r.category_id = %s")
                params.append(category_id)
            
            if approved_only:
                where_conditions.append("or_r.is_approved = TRUE")
            
            where_clause = " AND ".join(where_conditions)
            
            # Use simplified query that definitely works
            cur.execute(f"""
                SELECT 
                    or_r.id, or_r.organization_id, or_r.recipe_id, or_r.category_id, or_r.is_approved,
                    or_r.approval_status, or_r.tags, or_r.internal_notes, or_r.client_notes,
                    or_r.meets_standards, or_r.compliance_notes, or_r.usage_count, or_r.last_used_at,
                    or_r.approved_by, or_r.approved_at, or_r.submitted_for_approval_at,
                    or_r.created_at, or_r.updated_at, or_r.created_by, or_r.updated_by,
                    sr.title as recipe_name, sr.cuisine, sr.total_time, sr.servings, sr.image_url
                FROM organization_recipes or_r
                LEFT JOIN scraped_recipes sr ON or_r.recipe_id = sr.id
                WHERE {where_clause}
                ORDER BY or_r.updated_at DESC
            """, params)
            
            recipes = cur.fetchall()
            
            result = []
            for recipe in recipes:
                try:
                    # Safely parse tags JSON
                    tags = []
                    if recipe[6]:
                        if isinstance(recipe[6], str):
                            tags = json.loads(recipe[6])
                        elif isinstance(recipe[6], list):
                            tags = recipe[6]
                    
                    result.append({
                        "id": recipe[0],
                        "organization_id": recipe[1],
                        "recipe_id": recipe[2],
                        "category_id": recipe[3],
                        "is_approved": recipe[4],
                        "approval_status": recipe[5],
                        "tags": tags,
                        "internal_notes": recipe[7],
                        "client_notes": recipe[8],
                        "meets_standards": recipe[9],
                        "compliance_notes": recipe[10],
                        "usage_count": recipe[11],
                        "last_used_at": recipe[12],
                        "approved_by": recipe[13],
                        "approved_at": recipe[14],
                        "submitted_for_approval_at": recipe[15],
                        "created_at": recipe[16],
                        "updated_at": recipe[17],
                        "created_by": recipe[18],
                        "updated_by": recipe[19],
                        "recipe_name": recipe[20],
                        "cuisine": recipe[21],
                        "total_time": recipe[22],
                        "servings": recipe[23],
                        "image_url": recipe[24]
                    })
                except Exception as recipe_error:
                    logger.warning(f"Error processing recipe {recipe[0]}: {recipe_error}")
                    continue
            
            return result
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting organization recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get organization recipes"
        )
    finally:
        conn.close()

@router.post("/{organization_id}/recipes", response_model=OrganizationRecipe)
async def add_recipe_to_organization(
    organization_id: int,
    recipe_data: OrganizationRecipeCreate,
    current_user = Depends(get_user_from_token)
):
    """Add a recipe to organization library"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if recipe already exists in organization
            cur.execute("""
                SELECT id FROM organization_recipes 
                WHERE organization_id = %s AND recipe_id = %s
            """, (organization_id, recipe_data.recipe_id))
            
            if cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="Recipe already exists in organization library"
                )
            
            # Verify recipe exists
            cur.execute("SELECT id FROM scraped_recipes WHERE id = %s", (recipe_data.recipe_id,))
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recipe not found"
                )
            
            # Insert organization recipe
            cur.execute("""
                INSERT INTO organization_recipes 
                (organization_id, recipe_id, category_id, tags, internal_notes, client_notes, created_by, updated_by)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, organization_id, recipe_id, category_id, is_approved,
                         approval_status, tags, internal_notes, client_notes,
                         meets_standards, compliance_notes, usage_count, last_used_at,
                         approved_by, approved_at, submitted_for_approval_at,
                         created_at, updated_at, created_by, updated_by
            """, (
                organization_id,
                recipe_data.recipe_id,
                recipe_data.category_id,
                json.dumps(recipe_data.tags),
                recipe_data.internal_notes,
                recipe_data.client_notes,
                current_user['user_id'],
                current_user['user_id']
            ))
            
            result = cur.fetchone()
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": result[1],
                "recipe_id": result[2],
                "category_id": result[3],
                "is_approved": result[4],
                "approval_status": result[5],
                "tags": json.loads(result[6]) if result[6] else [],
                "internal_notes": result[7],
                "client_notes": result[8],
                "meets_standards": result[9],
                "compliance_notes": result[10],
                "usage_count": result[11],
                "last_used_at": result[12],
                "approved_by": result[13],
                "approved_at": result[14],
                "submitted_for_approval_at": result[15],
                "created_at": result[16],
                "updated_at": result[17],
                "created_by": result[18],
                "updated_by": result[19]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding recipe to organization: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to add recipe to organization"
        )
    finally:
        conn.close()

@router.put("/{organization_id}/recipes/{recipe_id}", response_model=OrganizationRecipe)
async def update_organization_recipe(
    organization_id: int,
    recipe_id: int,
    recipe_data: OrganizationRecipeUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update an organization recipe's settings"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if organization recipe exists
            cur.execute("""
                SELECT id FROM organization_recipes 
                WHERE organization_id = %s AND id = %s
            """, (organization_id, recipe_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Organization recipe not found"
                )
            
            # Build update query
            update_fields = []
            params = []
            
            if recipe_data.category_id is not None:
                update_fields.append("category_id = %s")
                params.append(recipe_data.category_id)
                
            if recipe_data.tags is not None:
                # Ensure tags is a list and properly serialize
                tags_list = recipe_data.tags if isinstance(recipe_data.tags, list) else []
                update_fields.append("tags = %s")
                params.append(json.dumps(tags_list))
                
            if recipe_data.internal_notes is not None:
                update_fields.append("internal_notes = %s")
                params.append(recipe_data.internal_notes)
                
            if recipe_data.client_notes is not None:
                update_fields.append("client_notes = %s")
                params.append(recipe_data.client_notes)
                
            if recipe_data.meets_standards is not None:
                update_fields.append("meets_standards = %s")
                params.append(recipe_data.meets_standards)
                
            if recipe_data.compliance_notes is not None:
                update_fields.append("compliance_notes = %s")
                params.append(recipe_data.compliance_notes)
                
            # Handle approval status changes
            if recipe_data.approval_status is not None:
                update_fields.append("approval_status = %s")
                params.append(recipe_data.approval_status)
                
                # If setting to pending, update submitted_for_approval_at
                if recipe_data.approval_status == 'pending':
                    update_fields.append("submitted_for_approval_at = NOW()")
            
            if not update_fields:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No update fields provided"
                )
            
            # Add updated timestamp and user
            update_fields.extend(["updated_at = NOW()", "updated_by = %s"])
            params.extend([current_user['user_id'], organization_id, recipe_id])
            
            update_query = f"""
                UPDATE organization_recipes 
                SET {', '.join(update_fields)}
                WHERE organization_id = %s AND id = %s
                RETURNING id, organization_id, recipe_id, category_id, is_approved,
                         approval_status, tags, internal_notes, client_notes,
                         meets_standards, compliance_notes, usage_count, last_used_at,
                         approved_by, approved_at, submitted_for_approval_at,
                         created_at, updated_at, created_by, updated_by
            """
            
            cur.execute(update_query, params)
            updated_recipe = cur.fetchone()
            
            # Get recipe name and details from either scraped_recipes or user_recipes
            recipe_details = None
            if updated_recipe[2]:  # recipe_id (scraped recipe)
                cur.execute("""
                    SELECT title, cuisine, total_time, servings, image_url
                    FROM scraped_recipes 
                    WHERE id = %s
                """, (updated_recipe[2],))
                recipe_details = cur.fetchone()
            else:  # user_recipe_id (custom recipe) - need to get user_recipe_id from updated record
                cur.execute("""
                    SELECT user_recipe_id FROM organization_recipes 
                    WHERE id = %s
                """, (updated_recipe[0],))
                user_recipe_result = cur.fetchone()
                if user_recipe_result and user_recipe_result[0]:
                    cur.execute("""
                        SELECT title, cuisine, total_time, servings, image_url
                        FROM user_recipes 
                        WHERE id = %s
                    """, (user_recipe_result[0],))
                    recipe_details = cur.fetchone()
            
            conn.commit()
            
            # Parse tags JSON
            tags = []
            if updated_recipe[6]:
                if isinstance(updated_recipe[6], str):
                    tags = json.loads(updated_recipe[6])
                elif isinstance(updated_recipe[6], list):
                    tags = updated_recipe[6]
            
            return {
                "id": updated_recipe[0],
                "organization_id": updated_recipe[1],
                "recipe_id": updated_recipe[2],
                "category_id": updated_recipe[3],
                "is_approved": updated_recipe[4],
                "approval_status": updated_recipe[5],
                "tags": tags,
                "internal_notes": updated_recipe[7],
                "client_notes": updated_recipe[8],
                "meets_standards": updated_recipe[9],
                "compliance_notes": updated_recipe[10],
                "usage_count": updated_recipe[11],
                "last_used_at": updated_recipe[12],
                "approved_by": updated_recipe[13],
                "approved_at": updated_recipe[14],
                "submitted_for_approval_at": updated_recipe[15],
                "created_at": updated_recipe[16],
                "updated_at": updated_recipe[17],
                "created_by": updated_recipe[18],
                "updated_by": updated_recipe[19],
                "recipe_name": recipe_details[0] if recipe_details else None,
                "cuisine": recipe_details[1] if recipe_details else None,
                "total_time": recipe_details[2] if recipe_details else None,
                "servings": recipe_details[3] if recipe_details else None,
                "image_url": recipe_details[4] if recipe_details else None
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating organization recipe: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update organization recipe"
        )
    finally:
        conn.close()

# Menu Defaults Management

@router.get("/{organization_id}/menu-defaults", response_model=OrganizationMenuDefaults)
async def get_menu_defaults(
    organization_id: int,
    current_user = Depends(get_user_from_token)
):
    """Get organization menu defaults"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT 
                    id, organization_id, default_planning_period, default_meals_per_day,
                    include_snacks, default_snacks_per_day, serving_sizes,
                    nutritional_targets, dietary_defaults, client_delivery_settings,
                    created_at, updated_at, updated_by
                FROM organization_menu_defaults
                WHERE organization_id = %s
            """, (organization_id,))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Menu defaults not found"
                )
            
            return {
                "id": result[0],
                "organization_id": result[1],
                "default_planning_period": result[2],
                "default_meals_per_day": result[3],
                "include_snacks": result[4],
                "default_snacks_per_day": result[5],
                "serving_sizes": json.loads(result[6]) if result[6] else {},
                "nutritional_targets": json.loads(result[7]) if result[7] else {},
                "dietary_defaults": json.loads(result[8]) if result[8] else {},
                "client_delivery_settings": json.loads(result[9]) if result[9] else {},
                "created_at": result[10],
                "updated_at": result[11],
                "updated_by": result[12]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting menu defaults: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get menu defaults"
        )
    finally:
        conn.close()

@router.put("/{organization_id}/menu-defaults", response_model=OrganizationMenuDefaults)
async def update_menu_defaults(
    organization_id: int,
    defaults_data: OrganizationMenuDefaultsUpdate,
    current_user = Depends(get_user_from_token)
):
    """Update organization menu defaults"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Build dynamic update query
            update_fields = []
            params = []
            
            if defaults_data.default_planning_period is not None:
                update_fields.append("default_planning_period = %s")
                params.append(defaults_data.default_planning_period)
            
            if defaults_data.default_meals_per_day is not None:
                update_fields.append("default_meals_per_day = %s")
                params.append(defaults_data.default_meals_per_day)
            
            if defaults_data.include_snacks is not None:
                update_fields.append("include_snacks = %s")
                params.append(defaults_data.include_snacks)
            
            if defaults_data.default_snacks_per_day is not None:
                update_fields.append("default_snacks_per_day = %s")
                params.append(defaults_data.default_snacks_per_day)
            
            if defaults_data.serving_sizes is not None:
                update_fields.append("serving_sizes = %s")
                params.append(json.dumps(defaults_data.serving_sizes))
            
            if defaults_data.nutritional_targets is not None:
                update_fields.append("nutritional_targets = %s")
                params.append(json.dumps(defaults_data.nutritional_targets))
            
            if defaults_data.dietary_defaults is not None:
                update_fields.append("dietary_defaults = %s")
                params.append(json.dumps(defaults_data.dietary_defaults))
            
            if defaults_data.client_delivery_settings is not None:
                update_fields.append("client_delivery_settings = %s")
                params.append(json.dumps(defaults_data.client_delivery_settings))
            
            if not update_fields:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="No fields to update"
                )
            
            update_fields.append("updated_by = %s")
            params.append(current_user['user_id'])
            
            params.extend([organization_id])
            
            cur.execute(f"""
                UPDATE organization_menu_defaults 
                SET {', '.join(update_fields)}
                WHERE organization_id = %s
                RETURNING id, organization_id, default_planning_period, default_meals_per_day,
                         include_snacks, default_snacks_per_day, serving_sizes,
                         nutritional_targets, dietary_defaults, client_delivery_settings,
                         created_at, updated_at, updated_by
            """, params)
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Menu defaults not found"
                )
            
            conn.commit()
            
            return {
                "id": result[0],
                "organization_id": result[1],
                "default_planning_period": result[2],
                "default_meals_per_day": result[3],
                "include_snacks": result[4],
                "default_snacks_per_day": result[5],
                "serving_sizes": json.loads(result[6]) if result[6] else {},
                "nutritional_targets": json.loads(result[7]) if result[7] else {},
                "dietary_defaults": json.loads(result[8]) if result[8] else {},
                "client_delivery_settings": json.loads(result[9]) if result[9] else {},
                "created_at": result[10],
                "updated_at": result[11],
                "updated_by": result[12]
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating menu defaults: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to update menu defaults"
        )
    finally:
        conn.close()

# Recipe Approval Workflow

@router.post("/{organization_id}/recipes/{recipe_id}/approve")
async def approve_recipe(
    organization_id: int,
    recipe_id: int,
    approval_data: RecipeApprovalResponse,
    current_user = Depends(get_user_from_token)
):
    """Approve or reject a recipe"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Update recipe approval status
            new_status = "approved" if approval_data.approved else "needs_revision"
            
            cur.execute("""
                UPDATE organization_recipes 
                SET 
                    is_approved = %s,
                    approval_status = %s,
                    approved_by = %s,
                    approved_at = %s,
                    compliance_notes = %s,
                    updated_by = %s
                WHERE organization_id = %s AND id = %s
                RETURNING id
            """, (
                approval_data.approved,
                new_status,
                current_user['user_id'] if approval_data.approved else None,
                datetime.utcnow() if approval_data.approved else None,
                approval_data.compliance_notes,
                current_user['user_id'],
                organization_id,
                recipe_id
            ))
            
            result = cur.fetchone()
            if not result:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="Recipe not found in organization"
                )
            
            conn.commit()
            
            return {
                "success": True,
                "message": f"Recipe {'approved' if approval_data.approved else 'rejected'} successfully"
            }
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error approving recipe: {str(e)}")
        conn.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to process recipe approval"
        )
    finally:
        conn.close()

# Available Recipes for Adding to Organization

@router.get("/{organization_id}/available-recipes")
async def get_available_recipes(
    organization_id: int,
    search: Optional[str] = Query(None, description="Search recipes by title"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    limit: int = Query(100, ge=1, le=200, description="Number of recipes to return"),
    offset: int = Query(0, ge=0, description="Number of recipes to skip"),
    current_user = Depends(get_user_from_token)
):
    """Get available scraped recipes that can be added to organization library"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not own this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get recipes that are not already in this organization's library
            where_clauses = ["sr.id NOT IN (SELECT recipe_id FROM organization_recipes WHERE organization_id = %s)"]
            params = [organization_id]
            
            # Add search filter
            if search:
                where_clauses.append("sr.title ILIKE %s")
                params.append(f"%{search}%")
            
            # Add cuisine filter
            if cuisine:
                where_clauses.append("sr.cuisine ILIKE %s")
                params.append(f"%{cuisine}%")
            
            where_clause = " AND ".join(where_clauses)
            
            query = f"""
                SELECT 
                    sr.id, sr.title, sr.source, sr.cuisine, sr.image_url,
                    sr.prep_time, sr.cook_time, sr.total_time, sr.servings,
                    sr.complexity, sr.diet_tags, sr.is_verified
                FROM scraped_recipes sr
                WHERE {where_clause}
                ORDER BY sr.title ASC
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
                    "recipe_name": row[1],  # Add for consistency
                    "source": row[2],
                    "cuisine": row[3],
                    "image_url": row[4],
                    "prep_time": row[5],
                    "cook_time": row[6],
                    "total_time": row[7],
                    "servings": row[8],
                    "complexity": row[9],
                    "diet_tags": row[10] if row[10] else [],
                    "is_verified": row[11]
                })
            
            return recipes
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting available recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get available recipes"
        )
    finally:
        conn.close()

@router.get("/{organization_id}/all-available-recipes")
async def get_all_available_recipes(
    organization_id: int,
    search: Optional[str] = Query(None, description="Search recipes by title"),
    cuisine: Optional[str] = Query(None, description="Filter by cuisine"),
    source: Optional[str] = Query(None, description="Filter by source: 'scraped', 'user', or 'all'"),
    limit: int = Query(100, ge=1, le=200, description="Number of recipes to return"),
    offset: int = Query(0, ge=0, description="Number of recipes to skip"),
    current_user = Depends(get_user_from_token)
):
    """Get all available recipes (both scraped and user-created) that can be added to organization library"""
    # Verify user owns this organization
    user_org_id = get_user_organization_id(current_user['user_id'])
    if user_org_id != organization_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied: User does not own this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            all_recipes = []
            
            # Get scraped recipes (if requested)
            if source in [None, 'all', 'scraped']:
                # Get scraped recipes that are not already in this organization's library
                where_clauses = ["sr.id NOT IN (SELECT recipe_id FROM organization_recipes WHERE organization_id = %s AND recipe_id IS NOT NULL)"]
                params = [organization_id]
                
                # Add search filter
                if search:
                    where_clauses.append("sr.title ILIKE %s")
                    params.append(f"%{search}%")
                
                # Add cuisine filter
                if cuisine:
                    where_clauses.append("sr.cuisine ILIKE %s")
                    params.append(f"%{cuisine}%")
                
                where_clause = " AND ".join(where_clauses)
                
                query = f"""
                    SELECT 
                        sr.id, sr.title, sr.source, sr.cuisine, sr.image_url,
                        sr.prep_time, sr.cook_time, sr.total_time, sr.servings,
                        sr.complexity, sr.diet_tags, sr.is_verified,
                        'scraped' as recipe_source
                    FROM scraped_recipes sr
                    WHERE {where_clause}
                    ORDER BY sr.title ASC
                    LIMIT %s OFFSET %s
                """
                
                scraped_params = params + [limit // 2 if source == 'all' else limit, offset]
                cur.execute(query, scraped_params)
                scraped_results = cur.fetchall()
                
                for row in scraped_results:
                    all_recipes.append({
                        "id": row[0],
                        "title": row[1],
                        "recipe_name": row[1],  # For consistency
                        "source": row[2],
                        "cuisine": row[3],
                        "image_url": row[4],
                        "prep_time": row[5],
                        "cook_time": row[6],
                        "total_time": row[7],
                        "servings": row[8],
                        "complexity": row[9],
                        "diet_tags": row[10] if row[10] else [],
                        "is_verified": row[11],
                        "recipe_source": row[12],
                        "recipe_type": "scraped"
                    })
            
            # Get user recipes (if requested)
            if source in [None, 'all', 'user']:
                # Get user recipes that are not already in this organization's library
                # Include organization's own recipes and public recipes from other users
                where_clauses = [
                    "ur.id NOT IN (SELECT user_recipe_id FROM organization_recipes WHERE organization_id = %s AND user_recipe_id IS NOT NULL)",
                    "ur.is_active = TRUE",
                    "(ur.created_by_organization_id = %s OR ur.is_public = TRUE)"
                ]
                params = [organization_id, organization_id]
                
                # Add search filter
                if search:
                    where_clauses.append("ur.title ILIKE %s")
                    params.append(f"%{search}%")
                
                # Add cuisine filter
                if cuisine:
                    where_clauses.append("ur.cuisine ILIKE %s")
                    params.append(f"%{cuisine}%")
                
                where_clause = " AND ".join(where_clauses)
                
                query = f"""
                    SELECT 
                        ur.id, ur.title, ur.created_by_organization_id, ur.cuisine, ur.image_url,
                        ur.prep_time, ur.cook_time, ur.total_time, ur.servings,
                        ur.complexity, ur.diet_tags, ur.is_verified,
                        'custom' as recipe_source, ur.is_public
                    FROM user_recipes ur
                    WHERE {where_clause}
                    ORDER BY ur.title ASC
                    LIMIT %s OFFSET %s
                """
                
                user_params = params + [limit // 2 if source == 'all' else limit, offset if source != 'all' else 0]
                cur.execute(query, user_params)
                user_results = cur.fetchall()
                
                for row in user_results:
                    all_recipes.append({
                        "id": row[0],
                        "title": row[1],
                        "recipe_name": row[1],  # For consistency
                        "source": "Custom Recipe" if row[2] == organization_id else "Public Recipe",
                        "cuisine": row[3],
                        "image_url": row[4],
                        "prep_time": row[5],
                        "cook_time": row[6],
                        "total_time": row[7],
                        "servings": row[8],
                        "complexity": row[9],
                        "diet_tags": json.loads(row[10]) if row[10] else [],
                        "is_verified": row[11],
                        "recipe_source": row[12],
                        "recipe_type": "user",
                        "is_public": row[13]
                    })
            
            # Sort combined results by title
            all_recipes.sort(key=lambda x: x['title'])
            
            return all_recipes[:limit]  # Ensure we don't exceed the limit
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all available recipes: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to get available recipes"
        )
    finally:
        conn.close()