# app/routers/client_resources.py
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from typing import List, Optional, Dict, Any
import logging
import json
from pydantic import BaseModel, Field
from ..db import get_db_connection
from ..utils.auth_utils import get_user_from_token
from ..utils.auth_middleware import require_client_or_owner, check_recipe_access, check_menu_access
from psycopg2.extras import RealDictCursor
from ..utils.grocery_aggregator import aggregate_grocery_list

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/client", tags=["Client Resources"])

# --- Models ---
class SharedResource(BaseModel):
    id: int
    name: str
    description: Optional[str] = None
    shared_at: Optional[str] = None
    owner_name: Optional[str] = None

class SharedMenu(SharedResource):
    meal_count: Optional[int] = None
    
class SharedRecipe(SharedResource):
    cuisine: Optional[str] = None
    prep_time: Optional[int] = None
    
# --- Endpoints ---

@router.get("/dashboard")
async def get_client_dashboard(
    user = Depends(require_client_or_owner)
):
    """
    Get a client dashboard with all resources shared with them
    Includes:
    - Shared menus
    - Shared recipes
    - Organization info
    """
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    role = user.get('role')
    
    # Add debug logging
    logger.info(f"Dashboard accessed by user_id={user_id}, org_id={org_id}, role={role}")
    
    if not org_id:
        logger.error(f"User {user_id} tried to access client dashboard without organization association")
        raise HTTPException(
            status_code=403,
            detail="You must be part of an organization to access this resource"
        )
        
    if not role:
        # Fix role if missing - check organization_clients table
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                # Check if user is a client of any organization
                cur.execute("""
                    SELECT role, status FROM organization_clients
                    WHERE client_id = %s AND organization_id = %s
                """, (user_id, org_id))
                client_record = cur.fetchone()
                
                if client_record:
                    role = client_record[0]
                    status = client_record[1]
                    logger.info(f"Found client role from DB: role={role}, status={status}")
                    
                    # Update user object with role
                    user['role'] = role
                    
                    # Check if status is active
                    if status != 'active':
                        logger.error(f"User {user_id} has inactive status: {status}")
                        raise HTTPException(
                            status_code=403,
                            detail="Your client account is not active. Please contact your organization."
                        )
                else:
                    # Check if user is an organization owner
                    cur.execute("""
                        SELECT id FROM organizations 
                        WHERE owner_id = %s AND id = %s
                    """, (user_id, org_id))
                    
                    org_owner = cur.fetchone()
                    if org_owner:
                        role = 'owner'
                        user['role'] = role
                        logger.info(f"Found user is organization owner: {user_id}")
                    else:
                        logger.error(f"User {user_id} has no valid role for org {org_id}")
                        raise HTTPException(
                            status_code=403,
                            detail="You don't have a valid role in this organization"
                        )
        finally:
            conn.close()
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Get organization info
            cur.execute("""
                SELECT id, name, description, owner_id
                FROM organizations
                WHERE id = %s
            """, (org_id,))
            
            organization = cur.fetchone()
            if not organization:
                raise HTTPException(
                    status_code=404,
                    detail="Organization not found"
                )
            
            # Get organization owner info
            owner_id = organization['owner_id']
            cur.execute("""
                SELECT name, email
                FROM user_profiles
                WHERE id = %s
            """, (owner_id,))
            
            owner = cur.fetchone()
            organization['owner'] = owner
            
            # Get shared menus 
            # If user is a client, get menus shared directly with them
            # If user is an org owner, return the menus they've shared with clients
            if role == 'client':
                cur.execute("""
                    SELECT 
                        m.id, 
                        m.nickname as name, 
                        sm.created_at as shared_at,
                        up.name as owner_name,
                        (SELECT COUNT(*) 
                         FROM jsonb_array_elements(
                            CASE 
                                WHEN m.meal_plan_json IS NULL THEN '[]'::jsonb
                                WHEN jsonb_typeof(m.meal_plan_json) = 'string' 
                                THEN '[]'::jsonb
                                WHEN jsonb_typeof(m.meal_plan_json->'days') = 'array'
                                THEN m.meal_plan_json->'days'
                                ELSE '[]'::jsonb
                            END
                         )
                        ) as meal_count
                    FROM menus m
                    JOIN shared_menus sm ON m.id = sm.menu_id
                    JOIN user_profiles up ON m.user_id = up.id
                    WHERE sm.shared_with = %s
                    ORDER BY sm.created_at DESC
                """, (user_id,))
            else:  # Owner
                cur.execute("""
                    SELECT 
                        m.id, 
                        m.nickname as name, 
                        sm.created_at as shared_at,
                        up.name as owner_name,
                        (SELECT COUNT(*) 
                         FROM jsonb_array_elements(
                            CASE 
                                WHEN m.meal_plan_json IS NULL THEN '[]'::jsonb
                                WHEN jsonb_typeof(m.meal_plan_json) = 'string' 
                                THEN '[]'::jsonb
                                WHEN jsonb_typeof(m.meal_plan_json->'days') = 'array'
                                THEN m.meal_plan_json->'days'
                                ELSE '[]'::jsonb
                            END
                         )
                        ) as meal_count
                    FROM menus m
                    JOIN shared_menus sm ON m.id = sm.menu_id
                    JOIN user_profiles up ON m.user_id = up.id
                    WHERE sm.created_by = %s
                    ORDER BY sm.created_at DESC
                """, (user_id,))
            
            shared_menus = cur.fetchall()
            
            # If no shared menus were found, try to create a test share for demo purposes
            if not shared_menus and role == 'client':
                logger.warning(f"No shared menus found for client {user_id}, attempting to create a test share")
                
                # First check if there are any menus that could be shared
                cur.execute("""
                    SELECT m.id, m.user_id, o.id as organization_id
                    FROM menus m
                    JOIN user_profiles up ON m.user_id = up.id
                    JOIN organizations o ON up.id = o.owner_id
                    JOIN organization_clients oc ON o.id = oc.organization_id
                    WHERE oc.client_id = %s
                    ORDER BY m.created_at DESC
                    LIMIT 1
                """, (user_id,))
                
                potential_menu = cur.fetchone()
                
                if potential_menu:
                    # We found a menu that could be shared, create a share record
                    logger.info(f"Creating test share for menu {potential_menu['id']} with client {user_id}")
                    
                    # Check if a share already exists
                    cur.execute("""
                        SELECT id FROM shared_menus
                        WHERE menu_id = %s AND shared_with = %s
                    """, (potential_menu['id'], user_id))
                    
                    existing_share = cur.fetchone()
                    
                    if not existing_share:
                        # Create a new share
                        cur.execute("""
                            INSERT INTO shared_menus (menu_id, shared_with, created_by, organization_id, permission_level)
                            VALUES (%s, %s, %s, %s, 'read')
                            RETURNING id
                        """, (
                            potential_menu['id'],
                            user_id,
                            potential_menu['user_id'],
                            potential_menu['organization_id']
                        ))
                        
                        conn.commit()
                        logger.info(f"Created test share with ID {cur.fetchone()['id']}")
                        
                        # Fetch shared menus again
                        cur.execute("""
                            SELECT 
                                m.id, 
                                m.nickname as name, 
                                sm.created_at as shared_at,
                                up.name as owner_name,
                                (SELECT COUNT(*) 
                                 FROM jsonb_array_elements(
                                    CASE 
                                        WHEN m.meal_plan_json IS NULL THEN '[]'::jsonb
                                        WHEN jsonb_typeof(m.meal_plan_json) = 'string' 
                                        THEN '[]'::jsonb
                                        WHEN jsonb_typeof(m.meal_plan_json->'days') = 'array'
                                        THEN m.meal_plan_json->'days'
                                        ELSE '[]'::jsonb
                                    END
                                 )
                                ) as meal_count
                            FROM menus m
                            JOIN shared_menus sm ON m.id = sm.menu_id
                            JOIN user_profiles up ON m.user_id = up.id
                            WHERE sm.shared_with = %s
                            ORDER BY sm.created_at DESC
                        """, (user_id,))
                        
                        shared_menus = cur.fetchall()
            
            # Get shared recipes
            # If user is a client, get all recipes owned by the organization owner
            # If user is an org owner, return their own recipes
            if role == 'client':
                cur.execute("""
                    SELECT 
                        sr.id, 
                        sr.recipe_name as name, 
                        sr.created_at as shared_at,
                        up.name as owner_name,
                        sr.notes as description,
                        COALESCE(sr.prep_time, 0) as prep_time
                    FROM saved_recipes sr
                    JOIN user_profiles up ON sr.user_id = up.id
                    WHERE sr.user_id = %s AND sr.shared_with_organization = TRUE
                    ORDER BY sr.created_at DESC
                """, (owner_id,))
            else:  # Owner
                cur.execute("""
                    SELECT 
                        sr.id, 
                        sr.recipe_name as name, 
                        sr.created_at as shared_at,
                        up.name as owner_name,
                        sr.notes as description,
                        COALESCE(sr.prep_time, 0) as prep_time
                    FROM saved_recipes sr
                    JOIN user_profiles up ON sr.user_id = up.id
                    WHERE sr.user_id = %s AND sr.shared_with_organization = TRUE
                    ORDER BY sr.created_at DESC
                """, (user_id,))
            
            shared_recipes = cur.fetchall()
            
            return {
                "organization": organization,
                "shared_menus": shared_menus,
                "shared_recipes": shared_recipes
            }
    finally:
        conn.close()

@router.get("/menus/{menu_id}")
async def get_client_menu(
    menu_id: int,
    user = Depends(check_menu_access)
):
    """Get a shared menu for a client with all details"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the full menu details
            cur.execute("""
                SELECT 
                    id AS menu_id, 
                    meal_plan_json, 
                    user_id, 
                    created_at, 
                    nickname,
                    ai_model_used
                FROM menus 
                WHERE id = %s
            """, (menu_id,))
            menu = cur.fetchone()
        
        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found")
        
        # Ensure meal_plan_json is parsed
        try:
            if isinstance(menu['meal_plan_json'], str):
                try:
                    menu['meal_plan'] = json.loads(menu['meal_plan_json'])
                except json.JSONDecodeError:
                    logger.error(f"Invalid JSON in meal_plan_json, creating empty structure")
                    menu['meal_plan'] = {"days": []}
            else:
                menu['meal_plan'] = menu['meal_plan_json']
            
            # Check if meal_plan is None
            if menu['meal_plan'] is None:
                logger.warning("meal_plan is None, creating empty structure")
                menu['meal_plan'] = {"days": []}
                
            # Make sure days are properly formatted
            if 'days' not in menu['meal_plan']:
                if isinstance(menu['meal_plan'], list):
                    # Convert list of days to proper format
                    logger.info("Converting list of days to proper format")
                    menu['meal_plan'] = {"days": menu['meal_plan']}
                else:
                    # Create an empty structure
                    logger.warning("meal_plan did not have 'days' property, creating empty structure")
                    menu['meal_plan'] = {"days": []}
            
            # Add menu_id for consistency
            if 'menu_id' in menu and 'id' not in menu:
                menu['id'] = menu['menu_id']
            elif 'id' in menu and 'menu_id' not in menu:
                menu['menu_id'] = menu['id']
            
            # Check that days array exists and is valid
            if not isinstance(menu['meal_plan']['days'], list):
                logger.warning("meal_plan.days is not a list, creating empty array")
                menu['meal_plan']['days'] = []
            
        except Exception as e:
            logger.error(f"Error parsing meal_plan_json: {str(e)}")
            # Provide a default empty structure
            menu['meal_plan'] = {"days": []}
        
        return menu
    except Exception as e:
        logger.error(f"Error retrieving menu details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        conn.close()

@router.get("/menus/{menu_id}/grocery-list")
async def get_client_grocery_list(
    menu_id: int,
    user = Depends(check_menu_access)
):
    """Get a grocery list for a shared menu"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the meal_plan_json field
            cur.execute("SELECT meal_plan_json FROM menus WHERE id=%s", (menu_id,))
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Menu not found")

        # parse the JSON text into a Python dict
        menu_data = row["meal_plan_json"]

        # aggregate
        grocery_list = aggregate_grocery_list(menu_data)
        return {"groceryList": grocery_list}

    except Exception as e:
        logger.error(f"Error retrieving grocery list: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        conn.close()

@router.get("/recipes/{recipe_id}")
async def get_client_recipe(
    recipe_id: int,
    user = Depends(check_recipe_access)
):
    """Get a shared recipe for a client with all details"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the full recipe details
            cur.execute("""
                SELECT 
                    sr.id, 
                    sr.recipe_name, 
                    sr.notes, 
                    sr.created_at,
                    sr.macros,
                    sr.ingredients,
                    sr.instructions,
                    sr.prep_time,
                    sr.complexity_level,
                    sr.servings,
                    up.name as owner_name
                FROM saved_recipes sr
                JOIN user_profiles up ON sr.user_id = up.id
                WHERE sr.id = %s
            """, (recipe_id,))
            
            recipe = cur.fetchone()
            
            if not recipe:
                raise HTTPException(status_code=404, detail="Recipe not found")
                
            return recipe
    except Exception as e:
        logger.error(f"Error retrieving recipe details: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        conn.close()

@router.patch("/toggle-menu-sharing/{menu_id}")
async def toggle_menu_sharing_with_organization(
    menu_id: int,
    shared: bool = Body(..., embed=True),
    client_id: Optional[int] = Body(None, embed=True),
    user = Depends(get_user_from_token)
):
    """Toggle whether a menu is shared with a specific client"""
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if user owns the menu
            cur.execute("""
                SELECT 1 FROM menus WHERE id = %s AND user_id = %s
            """, (menu_id, user_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=403,
                    detail="You can only share menus that you own"
                )
            
            # If client_id is provided, share with specific client
            if client_id:
                # Check if client belongs to organization
                cur.execute("""
                    SELECT 1 FROM organization_clients 
                    WHERE organization_id = %s AND client_id = %s AND status = 'active'
                """, (org_id, client_id))
                
                if not cur.fetchone():
                    raise HTTPException(
                        status_code=404,
                        detail="Client not found or not active in your organization"
                    )
                
                if shared:
                    # Check if already shared with this client
                    cur.execute("""
                        SELECT id FROM shared_menus 
                        WHERE menu_id = %s AND shared_with = %s
                    """, (menu_id, client_id))
                    
                    if not cur.fetchone():
                        # Share with this client
                        cur.execute("""
                            INSERT INTO shared_menus (menu_id, shared_with, created_by, organization_id) 
                            VALUES (%s, %s, %s, %s)
                        """, (menu_id, client_id, user_id, org_id))
                else:
                    # Remove sharing with this client
                    cur.execute("""
                        DELETE FROM shared_menus 
                        WHERE menu_id = %s AND shared_with = %s
                    """, (menu_id, client_id))
            else:
                # If no client_id is provided, toggle sharing for all clients in the organization
                if shared:
                    # Get all active clients in the organization
                    cur.execute("""
                        SELECT client_id FROM organization_clients 
                        WHERE organization_id = %s AND status = 'active'
                    """, (org_id,))
                    
                    clients = cur.fetchall()
                    
                    for client in clients:
                        client_id = client['client_id']
                        
                        # Check if already shared with this client
                        cur.execute("""
                            SELECT id FROM shared_menus 
                            WHERE menu_id = %s AND shared_with = %s
                        """, (menu_id, client_id))
                        
                        if not cur.fetchone():
                            # Share with this client
                            cur.execute("""
                                INSERT INTO shared_menus (menu_id, shared_with, created_by, organization_id) 
                                VALUES (%s, %s, %s, %s)
                            """, (menu_id, client_id, user_id, org_id))
                else:
                    # Remove sharing with all clients
                    cur.execute("""
                        DELETE FROM shared_menus 
                        WHERE menu_id = %s AND created_by = %s
                    """, (menu_id, user_id))
            
            conn.commit()
            
            return {
                "status": "success",
                "message": f"Menu sharing {'enabled' if shared else 'disabled'}"
            }
    except Exception as e:
        logger.error(f"Error updating menu sharing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        conn.close()

@router.patch("/toggle-recipe-sharing/{recipe_id}")
async def toggle_recipe_sharing_with_organization(
    recipe_id: int,
    shared: bool = Body(..., embed=True),
    user = Depends(get_user_from_token)
):
    """Toggle whether a recipe is shared with the organization's clients"""
    user_id = user.get('user_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user owns the recipe
            cur.execute("""
                SELECT 1 FROM saved_recipes WHERE id = %s AND user_id = %s
            """, (recipe_id, user_id))
            
            if not cur.fetchone():
                raise HTTPException(
                    status_code=403,
                    detail="You can only share recipes that you own"
                )
            
            # Update sharing status
            cur.execute("""
                UPDATE saved_recipes 
                SET shared_with_organization = %s
                WHERE id = %s
            """, (shared, recipe_id))
            
            conn.commit()
            
            return {
                "status": "success",
                "message": f"Recipe sharing {'enabled' if shared else 'disabled'}"
            }
    except Exception as e:
        logger.error(f"Error updating recipe sharing: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        conn.close()