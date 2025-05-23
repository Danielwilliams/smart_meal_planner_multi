# app/routers/client_resources.py

from fastapi import APIRouter, Depends, HTTPException, Path, Query
from pydantic import BaseModel
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection
from ..utils.auth_middleware import require_organization_owner, get_user_from_token
from typing import List, Dict, Any, Optional
import logging
import traceback
import json

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(tags=["Client Resources"])

# Helper function removed - using direct queries with known schema

class MenuShare(BaseModel):
    client_id: int
    menu_id: int
    permission_level: str = "read"
    message: Optional[str] = None

@router.get("/client/dashboard")
async def get_client_dashboard(user=Depends(get_user_from_token)):
    """Get client dashboard data including shared menus"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get('user_id')
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user token")

    # Check if user is a client by looking for organization_id in the token
    organization_id = user.get('organization_id')
    account_type = user.get('account_type')
    is_client = organization_id is not None or account_type == 'client'

    if not is_client:
        raise HTTPException(status_code=403, detail="User is not a client")

    conn = None
    cursor = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Enable autocommit to prevent transaction issues
        conn.autocommit = True
        
        # The user_id from the token is the user's profile ID
        # For shared menus, we need to use this same ID as the client_id
        # since client_id in shared_menus refers to the user profile ID of the client
        client_id = user_id
        logger.info(f"Looking for shared menus for client_id/user_id: {client_id}")

        # Check if shared_menus table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'shared_menus'
            )
        """)
        
        has_shared_menus_table = cursor.fetchone()['exists']
        
        shared_menus = []
        
        if has_shared_menus_table:
            try:
                # First check if there are any shared menus at all (for debugging)
                cursor.execute("SELECT COUNT(*) as count FROM shared_menus")
                total_count = cursor.fetchone()['count']
                logger.info(f"Total shared menus in database: {total_count}")
                
                # Get shared menus using the known schema
                cursor.execute("""
                    SELECT 
                        sm.id as share_id, 
                        sm.menu_id, 
                        sm.client_id, 
                        sm.organization_id, 
                        sm.permission_level,
                        sm.shared_at,
                        sm.message,
                        m.title, 
                        m.nickname,
                        m.description,
                        m.created_at,
                        o.name as organization_name
                    FROM shared_menus sm
                    JOIN menus m ON sm.menu_id = m.id
                    LEFT JOIN organizations o ON sm.organization_id = o.id
                    WHERE sm.client_id = %s AND sm.is_active = TRUE
                    ORDER BY sm.shared_at DESC
                """, (client_id,))
                
                shared_menus = cursor.fetchall()
                logger.info(f"Found {len(shared_menus)} shared menus for user {user_id}")
            except Exception as e:
                logger.error(f"Error fetching shared menus for user {user_id}: {e}")
                logger.error(f"Full traceback: {traceback.format_exc()}")
                # If autocommit is off, rollback the transaction
                if not conn.autocommit:
                    conn.rollback()
                shared_menus = []
        else:
            logger.warning("shared_menus table does not exist in the database")

        # Also check for menus created directly for this client
        direct_menus = []
        try:
            cursor.execute("""
                SELECT 
                    m.id as menu_id,
                    NULL as share_id,
                    m.client_id,
                    m.organization_id,
                    'owner' as permission_level,
                    m.created_at as shared_at,
                    NULL as message,
                    m.title,
                    m.nickname,
                    m.description,
                    m.created_at,
                    o.name as organization_name
                FROM menus m
                LEFT JOIN organizations o ON m.organization_id = o.id
                WHERE m.client_id = %s
                ORDER BY m.created_at DESC
            """, (client_id,))
            
            direct_menus = cursor.fetchall()
            logger.info(f"Found {len(direct_menus)} menus created directly for client {client_id}")
        except Exception as e:
            logger.error(f"Error fetching direct menus: {e}")
            logger.error(f"Full traceback: {traceback.format_exc()}")
            if not conn.autocommit:
                conn.rollback()
        
        # Combine shared menus and direct menus
        all_menus = shared_menus + direct_menus
        
        # Sort by date (shared_at/created_at) - handle datetime objects
        try:
            all_menus.sort(key=lambda x: x.get('shared_at') or x.get('created_at') or '', reverse=True)
        except Exception as sort_error:
            logger.warning(f"Error sorting menus: {sort_error}")
        
        # Use all_menus instead of shared_menus
        shared_menus = all_menus

        # Get saved recipes
        saved_recipes = []
        try:
            cursor.execute("""
                SELECT 
                    id,
                    recipe_name,
                    recipe_type,
                    recipe_id,
                    created_at,
                    updated_at,
                    scraped_recipe_id,
                    user_id,
                    url,
                    ingredients,
                    instructions,
                    servings,
                    rating,
                    image_url
                FROM saved_recipes
                WHERE user_id = %s
                ORDER BY created_at DESC
            """, (user_id,))

            saved_recipes = cursor.fetchall()
        except Exception as e:
            logger.error(f"Error fetching saved recipes: {e}")
            if not conn.autocommit:
                conn.rollback()
            saved_recipes = []

        # Get user preferences data (summary)
        preferences_summary = None
        try:
            cursor.execute("""
                SELECT 
                    has_preferences,
                    diet_type,
                    dietary_restrictions,
                    calorie_goal,
                    macro_protein,
                    macro_carbs,
                    macro_fat,
                    prep_complexity
                FROM user_profiles
                WHERE id = %s
            """, (user_id,))

            preferences_summary = cursor.fetchone()
        except Exception as e:
            logger.error(f"Error fetching preferences: {e}")
            if not conn.autocommit:
                conn.rollback()
            preferences_summary = None

        # Get organization data
        organization = None
        try:
            if organization_id:
                cursor.execute("""
                    SELECT 
                        id,
                        name,
                        description,
                        owner_id,
                        created_at
                    FROM organizations
                    WHERE id = %s
                """, (organization_id,))
                organization = cursor.fetchone()
            else:
                # Try to find the organization from menu shares
                if shared_menus and len(shared_menus) > 0:
                    organization_id = shared_menus[0].get('organization_id')
                    if organization_id:
                        cursor.execute("""
                            SELECT 
                                id,
                                name,
                                description,
                                owner_id,
                                created_at
                            FROM organizations
                            WHERE id = %s
                        """, (organization_id,))
                        organization = cursor.fetchone()
        except Exception as e:
            logger.error(f"Error fetching organization: {e}")
            if not conn.autocommit:
                conn.rollback()
            organization = None

        return {
            "user_id": user_id,
            "is_client": is_client,
            "organization": organization,
            "shared_menus": shared_menus,
            "saved_recipes_count": len(saved_recipes),
            "preferences": preferences_summary
        }

    except Exception as e:
        logger.error(f"Error in get_client_dashboard: {str(e)}", exc_info=True)
        # Return a more detailed error for debugging
        error_detail = {
            "error": str(e),
            "type": type(e).__name__,
            "user_id": user_id if 'user_id' in locals() else None,
            "client_id": client_id if 'client_id' in locals() else None,
            "traceback": traceback.format_exc()
        }
        raise HTTPException(status_code=500, detail=error_detail)
    finally:
        if 'cursor' in locals() and cursor:
            cursor.close()
        if 'conn' in locals() and conn:
            conn.close()

@router.get("/client/menus/{menu_id}")
async def get_client_menu(
    menu_id: int = Path(..., description="The ID of the menu to retrieve"),
    user=Depends(get_user_from_token)
):
    """Get a specific menu that has been shared with a client"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get('user_id')
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user token")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First check if user has access to this menu
        if user.get('account_type') == 'organization':
            # Organization owners can access any menu they created
            cursor.execute("""
                SELECT 1 FROM menus
                WHERE id = %s AND user_id = %s
            """, (menu_id, user_id))
            has_access = cursor.fetchone() is not None
        else:
            # Check if shared_menus table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'shared_menus'
                )
            """)
            
            has_shared_menus_table = cursor.fetchone()['exists']
            
            if has_shared_menus_table:
                # Clients can only access menus shared with them
                cursor.execute("""
                    SELECT 1 FROM shared_menus
                    WHERE menu_id = %s AND client_id = %s
                """, (menu_id, user_id))
                has_access = cursor.fetchone() is not None
            else:
                logger.warning("shared_menus table does not exist in the database")
                has_access = False

        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have access to this menu")

        # Get the menu details
        cursor.execute("""
            SELECT 
                id,
                user_id,
                title,
                description,
                created_at,
                meal_plan,
                meal_plan_json,
                nickname,
                published,
                updated_at,
                metadata,
                image_url,
                organization_id,
                client_id
            FROM menus
            WHERE id = %s
        """, (menu_id,))

        menu = cursor.fetchone()

        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found")

        # Convert JSONB fields
        if menu.get('meal_plan_json'):
            if isinstance(menu['meal_plan_json'], str):
                try:
                    menu['meal_plan_json'] = json.loads(menu['meal_plan_json'])
                except:
                    pass

        if menu.get('meal_plan'):
            if isinstance(menu['meal_plan'], str):
                try:
                    menu['meal_plan'] = json.loads(menu['meal_plan'])
                except:
                    pass

        if menu.get('metadata'):
            if isinstance(menu['metadata'], str):
                try:
                    menu['metadata'] = json.loads(menu['metadata'])
                except:
                    pass

        # Get share information if client is accessing
        if user.get('account_type') != 'organization':
            # Check if shared_menus table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'shared_menus'
                )
            """)
            
            has_shared_menus_table = cursor.fetchone()['exists']
            
            if has_shared_menus_table:
                cursor.execute("""
                    SELECT 
                        id as share_id,
                        menu_id,
                        client_id,
                        organization_id,
                        permission_level,
                        shared_at,
                        message
                    FROM shared_menus
                    WHERE menu_id = %s AND client_id = %s
                """, (menu_id, user_id))
                share_info = cursor.fetchone()
                if share_info:
                    menu['share_info'] = share_info
            else:
                logger.warning("shared_menus table does not exist in the database")

        return menu

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_client_menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.get("/client/menus/{menu_id}/grocery-list")
async def get_client_menu_grocery_list(
    menu_id: int = Path(..., description="The ID of the menu"),
    user=Depends(get_user_from_token)
):
    """Get the grocery list for a menu that has been shared with a client"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get('user_id')
    if not user_id:
        raise HTTPException(status_code=400, detail="Invalid user token")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First check if user has access to this menu
        if user.get('account_type') == 'organization':
            # Organization owners can access any menu they created
            cursor.execute("""
                SELECT 1 FROM menus
                WHERE id = %s AND user_id = %s
            """, (menu_id, user_id))
            has_access = cursor.fetchone() is not None
        else:
            # Check if shared_menus table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'shared_menus'
                )
            """)
            
            has_shared_menus_table = cursor.fetchone()['exists']
            
            if has_shared_menus_table:
                # Clients can only access menus shared with them
                cursor.execute("""
                    SELECT 1 FROM shared_menus
                    WHERE menu_id = %s AND client_id = %s
                """, (menu_id, user_id))
                has_access = cursor.fetchone() is not None
            else:
                logger.warning("shared_menus table does not exist in the database")
                has_access = False

        if not has_access:
            raise HTTPException(status_code=403, detail="You don't have access to this menu")

        # Get the grocery list
        cursor.execute("""
            SELECT 
                id,
                menu_id,
                ingredients,
                categories,
                metadata,
                created_at,
                updated_at
            FROM grocery_lists
            WHERE menu_id = %s
        """, (menu_id,))

        grocery_list = cursor.fetchone()

        if not grocery_list:
            # If no grocery list is found, try to generate one from the menu
            cursor.execute("""
                SELECT meal_plan_json
                FROM menus
                WHERE id = %s
            """, (menu_id,))
            
            menu_data = cursor.fetchone()
            
            if not menu_data:
                raise HTTPException(status_code=404, detail="Menu not found")
                
            # Extract ingredients from menu data
            ingredients = []
            
            # Process meal_plan_json if available
            if menu_data.get('meal_plan_json'):
                meal_plan_json = menu_data['meal_plan_json']
                if isinstance(meal_plan_json, str):
                    try:
                        meal_plan_json = json.loads(meal_plan_json)
                    except:
                        meal_plan_json = {}
                        
                # Extract ingredients from meal_plan_json structure
                if isinstance(meal_plan_json, dict):
                    # Different possible structures
                    if 'days' in meal_plan_json:
                        # Structure type 1: Direct meals array in day
                        for day in meal_plan_json.get('days', []):
                            if isinstance(day.get('meals'), list):
                                for meal in day.get('meals', []):
                                    for ingredient in meal.get('ingredients', []):
                                        if isinstance(ingredient, dict):
                                            ingredients.append({
                                                'name': ingredient.get('name', ''),
                                                'quantity': ingredient.get('quantity', '')
                                            })
                                        elif isinstance(ingredient, str):
                                            ingredients.append({
                                                'name': ingredient,
                                                'quantity': ''
                                            })
                            # Structure type 2: Meals grouped by meal_type
                            elif isinstance(day.get('meals'), dict):
                                for meal_type, meals in day.get('meals', {}).items():
                                    if isinstance(meals, list):
                                        for meal in meals:
                                            for ingredient in meal.get('ingredients', []):
                                                if isinstance(ingredient, dict):
                                                    ingredients.append({
                                                        'name': ingredient.get('name', ''),
                                                        'quantity': ingredient.get('quantity', '')
                                                    })
                                                elif isinstance(ingredient, str):
                                                    ingredients.append({
                                                        'name': ingredient,
                                                        'quantity': ''
                                                    })
                    
                    # Look for snacks too
                    for day in meal_plan_json.get('days', []):
                        if isinstance(day.get('snacks'), list):
                            for snack in day.get('snacks', []):
                                for ingredient in snack.get('ingredients', []):
                                    if isinstance(ingredient, dict):
                                        ingredients.append({
                                            'name': ingredient.get('name', ''),
                                            'quantity': ingredient.get('quantity', '')
                                        })
                                    elif isinstance(ingredient, str):
                                        ingredients.append({
                                            'name': ingredient,
                                            'quantity': ''
                                        })
            
            return {
                "groceryList": ingredients,
                "menu_id": menu_id,
                "generated": True
            }

        # Convert JSONB fields
        if grocery_list.get('ingredients'):
            if isinstance(grocery_list['ingredients'], str):
                try:
                    grocery_list['ingredients'] = json.loads(grocery_list['ingredients'])
                except:
                    grocery_list['ingredients'] = []

        if grocery_list.get('categories'):
            if isinstance(grocery_list['categories'], str):
                try:
                    grocery_list['categories'] = json.loads(grocery_list['categories'])
                except:
                    grocery_list['categories'] = {}

        if grocery_list.get('metadata'):
            if isinstance(grocery_list['metadata'], str):
                try:
                    grocery_list['metadata'] = json.loads(grocery_list['metadata'])
                except:
                    grocery_list['metadata'] = {}

        # Format for frontend
        return {
            "groceryList": grocery_list.get('ingredients', []),
            "categories": grocery_list.get('categories', {}),
            "metadata": grocery_list.get('metadata', {}),
            "menu_id": menu_id
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_client_menu_grocery_list: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn:
            conn.close()

# New endpoints to support mobile app specific patterns

@router.get("/organizations/clients/{client_id}/menus")
@router.post("/organizations/clients/{client_id}/menus")
async def org_get_client_menus(
    client_id: int = Path(..., description="The ID of the client"),
    user=Depends(get_user_from_token)
):
    """Get menus for a specific client (organization owner only)"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get('user_id')
    
    # Get organization ID - either from token or try to determine from user data
    organization_id = user.get('organization_id')
    account_type = user.get('account_type')
    
    # More flexible approach to check if user can access this endpoint
    is_authorized = False
    
    # Check if token explicitly marks user as organization
    if account_type == 'organization' or user.get('is_organization') == True:
        is_authorized = True
        logger.info(f"User {user_id} authorized as organization account")
    
    # If no organization_id in token but has user_id, check the database
    if not is_authorized and user_id:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Check if user is an organization owner in any organization
            cursor.execute("""
                SELECT id FROM organizations WHERE owner_id = %s
            """, (user_id,))
            
            org_result = cursor.fetchone()
            if org_result:
                organization_id = org_result[0]
                is_authorized = True
                logger.info(f"User {user_id} authorized as owner of organization {organization_id}")
            
            conn.close()
        except Exception as e:
            logger.error(f"Error checking organization ownership: {e}")
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only organization owners can access this endpoint")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First check if the client belongs to this organization
        cursor.execute("""
            SELECT 1 FROM organization_clients
            WHERE organization_id = %s AND client_id = %s AND status = 'active'
        """, (organization_id, client_id))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Client not found in your organization")

        # First check if shared_menus table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'shared_menus'
            )
        """)
        
        has_shared_menus_table = cursor.fetchone()['exists']
        
        shared_menus = []
        
        if has_shared_menus_table:
            try:
                # Get all menus shared with this client using known schema
                cursor.execute("""
                    SELECT 
                        m.id,
                        m.title,
                        m.description,
                        m.created_at,
                        m.nickname,
                        m.published,
                        m.image_url,
                        ms.permission_level,
                        ms.shared_at,
                        ms.id as share_id,
                        ms.message
                    FROM menus m
                    JOIN shared_menus ms ON m.id = ms.menu_id
                    WHERE ms.client_id = %s AND ms.organization_id = %s AND ms.is_active = TRUE
                    ORDER BY ms.shared_at DESC
                """, (client_id, organization_id))
                
                shared_menus = cursor.fetchall()
                logger.info(f"Found {len(shared_menus)} shared menus for client {client_id}")
            except Exception as e:
                logger.error(f"Error fetching shared menus for client {client_id}: {e}")
                logger.error(f"Full traceback: {traceback.format_exc()}")
                shared_menus = []
        else:
            logger.warning("shared_menus table does not exist in the database")

        # Also get menus directly created for this client
        cursor.execute("""
            SELECT 
                id,
                title,
                description,
                created_at,
                nickname,
                published,
                image_url,
                'owner' as permission_level,
                created_at as shared_at,
                NULL as share_id,
                NULL as message
            FROM menus
            WHERE client_id = %s AND organization_id = %s
            ORDER BY created_at DESC
        """, (client_id, organization_id))

        direct_menus = cursor.fetchall()

        # Combine the results
        all_menus = direct_menus + shared_menus

        return all_menus

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in org_get_client_menus: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.get("/organizations/clients/{client_id}/preferences")
@router.post("/organizations/clients/{client_id}/preferences")
async def org_get_client_preferences(
    client_id: int = Path(..., description="The ID of the client"),
    user=Depends(get_user_from_token)
):
    """Get preferences for a specific client (organization owner only)"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get('user_id')
    
    # Get organization ID - either from token or try to determine from user data
    organization_id = user.get('organization_id')
    account_type = user.get('account_type')
    
    # More flexible approach to check if user can access this endpoint
    is_authorized = False
    
    # Check if token explicitly marks user as organization
    if account_type == 'organization' or user.get('is_organization') == True:
        is_authorized = True
        logger.info(f"User {user_id} authorized as organization account")
    
    # If no organization_id in token but has user_id, check the database
    if not is_authorized and user_id:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Check if user is an organization owner in any organization
            cursor.execute("""
                SELECT id FROM organizations WHERE owner_id = %s
            """, (user_id,))
            
            org_result = cursor.fetchone()
            if org_result:
                organization_id = org_result[0]
                is_authorized = True
                logger.info(f"User {user_id} authorized as owner of organization {organization_id}")
            
            conn.close()
        except Exception as e:
            logger.error(f"Error checking organization ownership: {e}")
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only organization owners can access this endpoint")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First check if the client belongs to this organization
        cursor.execute("""
            SELECT 1 FROM organization_clients
            WHERE organization_id = %s AND client_id = %s AND status = 'active'
        """, (organization_id, client_id))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Client not found in your organization")

        # Fetch client's preferences
        cursor.execute("""
            SELECT 
                diet_type,
                dietary_restrictions,
                disliked_ingredients,
                recipe_type,
                macro_protein,
                macro_carbs,
                macro_fat,
                calorie_goal,
                meal_times,
                kroger_username,
                appliances,
                prep_complexity,
                servings_per_meal,
                snacks_per_day,
                flavor_preferences,
                spice_level,
                recipe_type_preferences,
                meal_time_preferences,
                time_constraints,
                prep_preferences
            FROM user_profiles
            WHERE id = %s
        """, (client_id,))

        preferences = cursor.fetchone()

        if not preferences:
            raise HTTPException(status_code=404, detail="Client preferences not found")

        # Handle JSONB fields
        if preferences['meal_times'] is None:
            preferences['meal_times'] = {
                "breakfast": False,
                "lunch": False,
                "dinner": False,
                "snacks": False
            }

        if preferences['appliances'] is None:
            preferences['appliances'] = {
                "airFryer": False,
                "instapot": False,
                "crockpot": False
            }
        
        # Ensure snacks_per_day has a default value if null
        if preferences['snacks_per_day'] is None:
            preferences['snacks_per_day'] = 0
            
        # Handle new JSONB fields
        if preferences['flavor_preferences'] is None:
            preferences['flavor_preferences'] = {
                "creamy": False,
                "cheesy": False,
                "herbs": False,
                "umami": False,
                "sweet": False,
                "spiced": False,
                "smoky": False,
                "garlicky": False,
                "tangy": False,
                "peppery": False,
                "hearty": False,
                "spicy": False
            }

        if preferences['spice_level'] is None:
            preferences['spice_level'] = "medium"

        if preferences['recipe_type_preferences'] is None:
            preferences['recipe_type_preferences'] = {
                "stir-fry": False,
                "grain-bowl": False,
                "salad": False,
                "pasta": False,
                "main-sides": False,
                "pizza": False,
                "burger": False,
                "sandwich": False,
                "tacos": False,
                "wrap": False,
                "soup-stew": False,
                "bake": False,
                "family-meals": False
            }

        if preferences['meal_time_preferences'] is None:
            preferences['meal_time_preferences'] = {
                "breakfast": False,
                "morning-snack": False,
                "lunch": False,
                "afternoon-snack": False,
                "dinner": False,
                "evening-snack": False
            }

        if preferences['time_constraints'] is None:
            preferences['time_constraints'] = {
                "weekday-breakfast": 10,
                "weekday-lunch": 15,
                "weekday-dinner": 30,
                "weekend-breakfast": 20,
                "weekend-lunch": 30,
                "weekend-dinner": 45
            }

        if preferences['prep_preferences'] is None:
            preferences['prep_preferences'] = {
                "batch-cooking": False,
                "meal-prep": False,
                "quick-assembly": False,
                "one-pot": False,
                "minimal-dishes": False
            }

        return preferences

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in org_get_client_preferences: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.post("/organizations/clients/{client_id}/menus/create")
async def org_create_client_menu(
    client_id: int = Path(..., description="The ID of the client"),
    menu_data: Dict[str, Any] = None,
    user=Depends(get_user_from_token)
):
    """Create a menu for a specific client (organization owner only)"""
    if not user:
        raise HTTPException(status_code=401, detail="Authentication required")

    user_id = user.get('user_id')
    
    # Get organization ID - either from token or try to determine from user data
    organization_id = user.get('organization_id')
    account_type = user.get('account_type')
    
    # More flexible approach to check if user can access this endpoint
    is_authorized = False
    
    # Check if token explicitly marks user as organization
    if account_type == 'organization' or user.get('is_organization') == True:
        is_authorized = True
        logger.info(f"User {user_id} authorized as organization account")
    
    # If no organization_id in token but has user_id, check the database
    if not is_authorized and user_id:
        try:
            conn = get_db_connection()
            cursor = conn.cursor()
            
            # Check if user is an organization owner in any organization
            cursor.execute("""
                SELECT id FROM organizations WHERE owner_id = %s
            """, (user_id,))
            
            org_result = cursor.fetchone()
            if org_result:
                organization_id = org_result[0]
                is_authorized = True
                logger.info(f"User {user_id} authorized as owner of organization {organization_id}")
            
            conn.close()
        except Exception as e:
            logger.error(f"Error checking organization ownership: {e}")
    
    if not is_authorized:
        raise HTTPException(status_code=403, detail="Only organization owners can access this endpoint")

    if not menu_data:
        raise HTTPException(status_code=400, detail="Menu data is required")

    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)

        # First check if the client belongs to this organization
        cursor.execute("""
            SELECT 1 FROM organization_clients
            WHERE organization_id = %s AND client_id = %s AND status = 'active'
        """, (organization_id, client_id))
        
        if not cursor.fetchone():
            raise HTTPException(status_code=404, detail="Client not found in your organization")

        # Prepare menu data
        title = menu_data.get('title', 'Menu')
        description = menu_data.get('description', '')
        meal_plan = menu_data.get('meal_plan', {})
        meal_plan_json = menu_data.get('meal_plan_json', menu_data.get('meal_plan', {}))
        nickname = menu_data.get('nickname', '')
        published = menu_data.get('published', True)
        image_url = menu_data.get('image_url', '')
        metadata = menu_data.get('metadata', {})
        
        # Ensure meal_plan and meal_plan_json are JSON strings
        if isinstance(meal_plan, dict):
            meal_plan = json.dumps(meal_plan)
        
        if isinstance(meal_plan_json, dict):
            meal_plan_json = json.dumps(meal_plan_json)
            
        if isinstance(metadata, dict):
            metadata = json.dumps(metadata)

        # Create the menu
        cursor.execute("""
            INSERT INTO menus (
                user_id, 
                title, 
                description, 
                meal_plan, 
                meal_plan_json, 
                nickname, 
                published, 
                image_url, 
                metadata, 
                organization_id, 
                client_id
            )
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_id,
            title,
            description,
            meal_plan,
            meal_plan_json,
            nickname,
            published,
            image_url,
            metadata,
            organization_id,
            client_id
        ))
        
        menu_id = cursor.fetchone()['id']
        
        # First check if shared_menus table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'shared_menus'
            )
        """)
        
        has_shared_menus_table = cursor.fetchone()['exists']
        
        share_id = None
        
        if has_shared_menus_table:
            # Share the menu with the client
            cursor.execute("""
                INSERT INTO shared_menus (
                    menu_id, 
                    client_id, 
                    organization_id, 
                    permission_level, 
                    message, 
                    is_active
                )
                VALUES (%s, %s, %s, %s, %s, TRUE)
                RETURNING id
            """, (
                menu_id,
                client_id,
                organization_id,
                'read',
                f'Menu created for you: {title}'
            ))
            
            share_result = cursor.fetchone()
            if share_result:
                share_id = share_result['id']
        else:
            logger.warning("shared_menus table does not exist in the database - menu created but not shared")
        
        conn.commit()
        
        return {
            "success": True,
            "menu_id": menu_id,
            "share_id": share_id,
            "message": "Menu created and shared with client successfully"
        }

    except HTTPException:
        raise
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error in org_create_client_menu: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")
    finally:
        if conn:
            conn.close()

@router.get("/clients/{client_id}/menus")
@router.post("/clients/{client_id}/menus")
async def client_get_menus(
    client_id: int = Path(..., description="The ID of the client"),
    user=Depends(get_user_from_token)
):
    """Alternative endpoint to get menus for a client - compatible with mobile app"""
    # This is just a proxy to the organization client menus endpoint
    return await org_get_client_menus(client_id, user)

@router.get("/clients/{client_id}/preferences")
@router.post("/clients/{client_id}/preferences")
async def client_get_preferences(
    client_id: int = Path(..., description="The ID of the client"),
    user=Depends(get_user_from_token)
):
    """Alternative endpoint to get preferences for a client - compatible with mobile app"""
    # This is just a proxy to the organization client preferences endpoint
    return await org_get_client_preferences(client_id, user)