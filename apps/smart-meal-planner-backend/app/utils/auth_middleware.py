# app/utils/auth_middleware.py - New file

from fastapi import Depends, HTTPException
from app.utils.auth_utils import get_user_from_token
from app.db import get_db_cursor
import logging

logger = logging.getLogger(__name__)

def require_organization_owner(user=Depends(get_user_from_token)):
    """Ensure the user is an organization owner"""
    if user.get('role') != 'owner':
        raise HTTPException(
            status_code=403, 
            detail="Only organization owners can access this resource"
        )
    return user

def require_organization_member(user=Depends(get_user_from_token)):
    """Ensure the user belongs to an organization (owner or client)"""
    if not user.get('organization_id'):
        raise HTTPException(
            status_code=403, 
            detail="Organization membership required"
        )
    return user

def require_client_or_owner(user=Depends(get_user_from_token)):
    """Ensure the user is either a client or an organization owner"""
    if not user.get('organization_id'):
        raise HTTPException(
            status_code=403,
            detail="Organization membership required"
        )
    
    role = user.get('role')
    if role not in ['owner', 'client']:
        raise HTTPException(
            status_code=403,
            detail="Only clients or organization owners can access this resource"
        )
    
    return user

def require_active_client(user=Depends(get_user_from_token)):
    """Ensure the user is an active client or organization owner"""
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    # Organization owners always have access
    if user.get('role') == 'owner':
        return user
    
    # Check if client is active
    client_status = user.get('client_status')
    if client_status == 'inactive':
        # Get organization info for the error message
        org_id = user.get('organization_id')
        try:
            with get_db_cursor() as (cur, conn):
                cur.execute("""
                    SELECT o.name, up.email as owner_email
                    FROM organizations o
                    JOIN user_profiles up ON o.owner_id = up.id
                    WHERE o.id = %s
                """, (org_id,))
                org_info = cur.fetchone()
                
                org_name = org_info[0] if org_info else "your organization"
                owner_email = org_info[1] if org_info else "your organization administrator"
                
        except Exception:
            org_name = "your organization"
            owner_email = "your organization administrator"
        
        raise HTTPException(
            status_code=403,
            detail=f"Your account has been deactivated by {org_name}. Please contact {owner_email} to reactivate your account."
        )
    
    # For clients, ensure they have organization membership and are active
    if not user.get('organization_id') or user.get('role') != 'client':
        raise HTTPException(
            status_code=403,
            detail="Client membership required"
        )
    
    return user

def check_menu_access(menu_id: int, user=Depends(get_user_from_token)):
    """
    Check if user has access to a specific menu
    Returns user with added menu_access_level field
    """
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    
    with get_db_cursor() as (cur, conn):
        # Check if user owns the menu
        cur.execute("""
            SELECT 1 FROM menus WHERE id = %s AND user_id = %s
        """, (menu_id, user_id))
        
        if cur.fetchone():
            user['menu_access_level'] = 'owner'
            return user
        
        # Check if the menu is shared with the user
        if org_id:
            cur.execute("""
                SELECT permission_level FROM shared_menus
                WHERE menu_id = %s AND 
                      (shared_with = %s OR organization_id = %s)
            """, (menu_id, user_id, org_id))
            
            shared = cur.fetchone()
            if shared:
                user['menu_access_level'] = shared[0]
                return user
        
        # User has no access to this menu
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this menu"
        )

def check_recipe_access(recipe_id: int, user=Depends(get_user_from_token)):
    """
    Check if user has access to a specific recipe
    This includes:
    - The recipe owner
    - Clients of the organization that owns the recipe
    - Users with whom the recipe is explicitly shared
    
    Returns user with added recipe_access_level field
    """
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    role = user.get('role')
    
    logger.info(f"Checking recipe access for recipe_id={recipe_id}, user_id={user_id}, org_id={org_id}, role={role}")
    
    with get_db_cursor() as (cur, conn):
        # Check if user owns the recipe
        cur.execute("""
            SELECT 1 FROM saved_recipes WHERE id = %s AND user_id = %s
        """, (recipe_id, user_id))
        
        if cur.fetchone():
            user['recipe_access_level'] = 'owner'
            logger.info(f"User {user_id} is the owner of recipe {recipe_id}")
            return user
        
        # If user is a client, check if the recipe belongs to their organization
        if org_id and role == 'client':
            # Find the organization owner
            cur.execute("""
                SELECT owner_id FROM organizations WHERE id = %s
            """, (org_id,))
            
            org_owner = cur.fetchone()
            if org_owner:
                owner_id = org_owner[0]
                
                # Check if the recipe belongs to the organization owner
                cur.execute("""
                    SELECT 1 FROM saved_recipes WHERE id = %s AND user_id = %s
                """, (recipe_id, owner_id))
                
                if cur.fetchone():
                    user['recipe_access_level'] = 'client'
                    logger.info(f"User {user_id} has client access to recipe {recipe_id} through organization {org_id}")
                    return user
        
        # Check if the recipe is shared with the user
        cur.execute("""
            SELECT permission_level FROM shared_recipes
            WHERE recipe_id = %s AND 
                  (shared_with = %s OR (organization_id = %s AND %s IS NOT NULL))
        """, (recipe_id, user_id, org_id, org_id))
        
        shared = cur.fetchone()
        if shared:
            user['recipe_access_level'] = shared[0]
            logger.info(f"User {user_id} has shared access to recipe {recipe_id} with permission {shared[0]}")
            return user
        
        # User has no access to this recipe
        logger.warning(f"User {user_id} has no access to recipe {recipe_id}")
        raise HTTPException(
            status_code=403,
            detail="You do not have access to this recipe"
        )