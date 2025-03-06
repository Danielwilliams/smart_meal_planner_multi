# app/utils/auth_middleware.py - New file

from fastapi import Depends, HTTPException
from app.utils.auth_utils import get_user_from_token

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

def check_menu_access(menu_id: int, user=Depends(get_user_from_token)):
    """
    Check if user has access to a specific menu
    Returns user with added menu_access_level field
    """
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
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
    finally:
        conn.close()