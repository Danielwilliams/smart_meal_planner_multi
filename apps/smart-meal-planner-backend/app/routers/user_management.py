from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from datetime import datetime
import logging

from app.dependencies import get_current_user, get_db_connection
from app.models.user import (
    UserManagementAction, UserManagementLog, UserListFilter,
    UserListResponse, UserWithRole, UserManagementPermissions
)

logger = logging.getLogger(__name__)
router = APIRouter()

def check_user_management_permissions(current_user: dict, target_user: dict = None) -> UserManagementPermissions:
    """Check what user management actions the current user can perform"""
    permissions = UserManagementPermissions()
    
    # Check if user is system admin
    if current_user.get('system_role') == 'admin':
        permissions.is_system_admin = True
        permissions.can_pause_users = True
        permissions.can_delete_users = True
        permissions.can_restore_users = True
        permissions.can_view_all_users = True
        permissions.can_manage_org_users = True
        return permissions
    
    # Check if user is organization owner/manager
    if current_user.get('organization_id') and current_user.get('role') in ['owner', 'manager']:
        permissions.can_manage_org_users = True
        permissions.can_pause_users = True
        # Only allow deletion of organization users, not the organization itself
        if target_user and target_user.get('organization_id') == current_user.get('organization_id'):
            permissions.can_delete_users = True
    
    return permissions

@router.get("/permissions", response_model=UserManagementPermissions)
async def get_user_permissions(current_user: dict = Depends(get_current_user)):
    """Get current user's management permissions"""
    return check_user_management_permissions(current_user)

@router.get("/users", response_model=UserListResponse)
async def list_users(
    filter: UserListFilter = Depends(),
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db_connection)
):
    """List users with filtering and pagination"""
    permissions = check_user_management_permissions(current_user)
    cursor = conn.cursor()
    
    try:
        # Build the base query
        query = """
            SELECT DISTINCT
                u.id, u.email, u.name, u.profile_complete,
                u.organization_id, u.is_active, u.paused_at, u.pause_reason,
                u.created_at, u.updated_at,
                CASE 
                    WHEN u.organization_id IS NOT NULL THEN oc.role
                    ELSE NULL
                END as role,
                o.name as organization_name
            FROM users u
            LEFT JOIN organization_clients oc ON u.id = oc.client_id
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE 1=1
        """
        params = []
        
        # Apply filters based on permissions
        if not permissions.can_view_all_users:
            if permissions.can_manage_org_users and current_user.get('organization_id'):
                query += " AND u.organization_id = %s"
                params.append(current_user['organization_id'])
            else:
                # Can only see themselves
                query += " AND u.id = %s"
                params.append(current_user['id'])
        elif filter.organization_id is not None:
            query += " AND u.organization_id = %s"
            params.append(filter.organization_id)
        
        # Apply other filters
        if filter.is_active is not None:
            query += " AND u.is_active = %s"
            params.append(filter.is_active)
        
        if filter.is_paused is not None:
            if filter.is_paused:
                query += " AND u.paused_at IS NOT NULL"
            else:
                query += " AND u.paused_at IS NULL"
        
        if filter.search_query:
            query += " AND (u.email ILIKE %s OR u.name ILIKE %s)"
            search_pattern = f"%{filter.search_query}%"
            params.extend([search_pattern, search_pattern])
        
        if filter.role:
            query += " AND oc.role = %s"
            params.append(filter.role)
        
        if filter.created_after:
            query += " AND u.created_at >= %s"
            params.append(filter.created_after)
        
        if filter.created_before:
            query += " AND u.created_at <= %s"
            params.append(filter.created_before)
        
        # Get total count
        count_query = f"SELECT COUNT(DISTINCT u.id) FROM ({query}) as subquery"
        cursor.execute(count_query, params)
        total_count = cursor.fetchone()[0]
        
        # Apply pagination
        query += " ORDER BY u.created_at DESC LIMIT %s OFFSET %s"
        params.extend([filter.limit, filter.offset])
        
        cursor.execute(query, params)
        rows = cursor.fetchall()
        
        users = []
        for row in rows:
            user = UserWithRole(
                id=row[0],
                email=row[1],
                name=row[2] or '',
                profile_complete=row[3],
                organization_id=row[4],
                is_active=row[5],
                paused_at=row[6],
                pause_reason=row[7],
                role=row[10]
            )
            users.append(user)
        
        return UserListResponse(
            users=users,
            total_count=total_count,
            limit=filter.limit,
            offset=filter.offset,
            has_more=(filter.offset + filter.limit) < total_count
        )
        
    except Exception as e:
        logger.error(f"Error listing users: {e}")
        raise HTTPException(status_code=500, detail="Failed to list users")

@router.post("/users/{user_id}/pause")
async def pause_user(
    user_id: int,
    action: UserManagementAction,
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db_connection)
):
    """Pause a user account"""
    if action.action != 'pause':
        raise HTTPException(status_code=400, detail="Invalid action for this endpoint")
    
    cursor = conn.cursor()
    
    try:
        # Get target user
        cursor.execute("SELECT id, organization_id FROM users WHERE id = %s", (user_id,))
        target_user = cursor.fetchone()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        target_user_dict = {'id': target_user[0], 'organization_id': target_user[1]}
        permissions = check_user_management_permissions(current_user, target_user_dict)
        
        if not permissions.can_pause_users:
            raise HTTPException(status_code=403, detail="You don't have permission to pause users")
        
        # Prevent self-pause
        if user_id == current_user['id']:
            raise HTTPException(status_code=400, detail="You cannot pause your own account")
        
        # Pause the user
        cursor.execute("""
            UPDATE users 
            SET paused_at = CURRENT_TIMESTAMP,
                paused_by = %s,
                pause_reason = %s
            WHERE id = %s
        """, (current_user['id'], action.reason, user_id))
        
        # Log the action
        cursor.execute("""
            INSERT INTO user_management_logs 
            (user_id, action, performed_by, reason, ip_address, user_agent, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            'paused',
            current_user['id'],
            action.reason,
            request.client.host,
            request.headers.get('user-agent'),
            {'send_notification': action.send_notification}
        ))
        
        conn.commit()
        return {"message": "User paused successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error pausing user: {e}")
        raise HTTPException(status_code=500, detail="Failed to pause user")

@router.post("/users/{user_id}/unpause")
async def unpause_user(
    user_id: int,
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db_connection)
):
    """Unpause a user account"""
    cursor = conn.cursor()
    
    try:
        # Get target user
        cursor.execute("SELECT id, organization_id FROM users WHERE id = %s", (user_id,))
        target_user = cursor.fetchone()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        target_user_dict = {'id': target_user[0], 'organization_id': target_user[1]}
        permissions = check_user_management_permissions(current_user, target_user_dict)
        
        if not permissions.can_pause_users:
            raise HTTPException(status_code=403, detail="You don't have permission to unpause users")
        
        # Unpause the user
        cursor.execute("""
            UPDATE users 
            SET paused_at = NULL,
                paused_by = NULL,
                pause_reason = NULL
            WHERE id = %s
        """, (user_id,))
        
        # Log the action
        cursor.execute("""
            INSERT INTO user_management_logs 
            (user_id, action, performed_by, ip_address, user_agent)
            VALUES (%s, %s, %s, %s, %s)
        """, (
            user_id,
            'unpaused',
            current_user['id'],
            request.client.host,
            request.headers.get('user-agent')
        ))
        
        conn.commit()
        return {"message": "User unpaused successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error unpausing user: {e}")
        raise HTTPException(status_code=500, detail="Failed to unpause user")

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    action: UserManagementAction,
    request: Request,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db_connection)
):
    """Soft delete a user account"""
    if action.action != 'delete':
        raise HTTPException(status_code=400, detail="Invalid action for this endpoint")
    
    cursor = conn.cursor()
    
    try:
        # Get target user
        cursor.execute("SELECT id, organization_id FROM users WHERE id = %s", (user_id,))
        target_user = cursor.fetchone()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        target_user_dict = {'id': target_user[0], 'organization_id': target_user[1]}
        permissions = check_user_management_permissions(current_user, target_user_dict)
        
        if not permissions.can_delete_users:
            raise HTTPException(status_code=403, detail="You don't have permission to delete users")
        
        # Prevent self-deletion
        if user_id == current_user['id']:
            raise HTTPException(status_code=400, detail="You cannot delete your own account")
        
        # Soft delete the user
        cursor.execute("""
            UPDATE users 
            SET is_active = FALSE,
                deleted_at = CURRENT_TIMESTAMP,
                deleted_by = %s
            WHERE id = %s
        """, (current_user['id'], user_id))
        
        # Log the action
        cursor.execute("""
            INSERT INTO user_management_logs 
            (user_id, action, performed_by, reason, ip_address, user_agent, metadata)
            VALUES (%s, %s, %s, %s, %s, %s, %s)
        """, (
            user_id,
            'deleted',
            current_user['id'],
            action.reason,
            request.client.host,
            request.headers.get('user-agent'),
            {'send_notification': action.send_notification}
        ))
        
        conn.commit()
        return {"message": "User deleted successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        conn.rollback()
        logger.error(f"Error deleting user: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete user")

@router.get("/users/{user_id}/logs", response_model=List[UserManagementLog])
async def get_user_logs(
    user_id: int,
    current_user: dict = Depends(get_current_user),
    conn=Depends(get_db_connection)
):
    """Get management logs for a specific user"""
    cursor = conn.cursor()
    
    try:
        # Check permissions
        cursor.execute("SELECT organization_id FROM users WHERE id = %s", (user_id,))
        target_user = cursor.fetchone()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        permissions = check_user_management_permissions(current_user)
        if not permissions.is_system_admin:
            if not (permissions.can_manage_org_users and 
                    target_user[0] == current_user.get('organization_id')):
                raise HTTPException(status_code=403, detail="You don't have permission to view these logs")
        
        # Get logs
        cursor.execute("""
            SELECT id, user_id, action, performed_by, performed_at,
                   reason, metadata, ip_address, user_agent
            FROM user_management_logs
            WHERE user_id = %s
            ORDER BY performed_at DESC
        """, (user_id,))
        
        logs = []
        for row in cursor.fetchall():
            log = UserManagementLog(
                id=row[0],
                user_id=row[1],
                action=row[2],
                performed_by=row[3],
                performed_at=row[4],
                reason=row[5],
                metadata=row[6] or {},
                ip_address=row[7],
                user_agent=row[8]
            )
            logs.append(log)
        
        return logs
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting user logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to get user logs")