from fastapi import APIRouter, Depends, HTTPException, Request
from typing import List, Optional
from datetime import datetime
import logging

from ..db import get_db_connection
from app.utils.auth_utils import get_user_from_token
from app.models.user import (
    UserManagementAction, UserManagementLog, UserListFilter,
    UserListResponse, UserWithRole, UserManagementPermissions
)

logger = logging.getLogger(__name__)
router = APIRouter()

async def get_current_user(request: Request):
    """Extract current user from JWT token"""
    auth_header = request.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Authorization header missing")
    
    token = auth_header.split(' ')[1]
    user = get_user_from_token(token)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid token")
    
    return user

def check_user_management_permissions(current_user: dict, target_user: dict = None) -> UserManagementPermissions:
    """Check what user management actions the current user can perform"""
    permissions = UserManagementPermissions()
    
    # Check if user is system admin (can manage all accounts)
    if current_user.get('account_type') == 'admin':
        permissions.is_system_admin = True
        permissions.can_pause_users = True
        permissions.can_delete_users = True
        permissions.can_restore_users = True
        permissions.can_view_all_users = True
        permissions.can_manage_org_users = True
        return permissions
    
    # Check if user is organization account (can manage their clients)
    if current_user.get('account_type') == 'organization':
        permissions.can_manage_org_users = True
        permissions.can_pause_users = True
        permissions.can_delete_users = True  # Organizations can delete their clients
        permissions.can_restore_users = True
        # Can only view users within their organization
        return permissions
    
    # Individual and client accounts have no management permissions
    return permissions

@router.get("/permissions", response_model=UserManagementPermissions)
async def get_user_permissions(request: Request):
    """Get current user's management permissions"""
    current_user = await get_current_user(request)
    return check_user_management_permissions(current_user)

@router.get("/users", response_model=UserListResponse)
async def list_users(
    request: Request,
    filter: UserListFilter = Depends(),
    conn=Depends(get_db_connection)
):
    """List users with filtering and pagination"""
    current_user = await get_current_user(request)
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
            FROM user_profiles u
            LEFT JOIN organization_clients oc ON u.id = oc.client_id
            LEFT JOIN organizations o ON u.organization_id = o.id
            WHERE 1=1
        """
        params = []
        
        # Apply filters based on permissions
        if permissions.is_system_admin:
            # Admin can see all users - no additional filters needed
            # Allow admin to filter by specific organization if requested
            if filter.organization_id is not None:
                query += " AND u.organization_id = %s"
                params.append(filter.organization_id)
        elif current_user.get('account_type') == 'organization':
            # Organizations can only see their clients (users who belong to their organization)
            query += " AND (u.organization_id = %s OR oc.organization_id = %s)"
            params.extend([current_user['id'], current_user['id']])
        else:
            # Individual/client users can only see themselves
            query += " AND u.id = %s"
            params.append(current_user['id'])
        
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
    request: Request,
    action: UserManagementAction,
    conn=Depends(get_db_connection)
):
    """Pause a user account"""
    current_user = await get_current_user(request)
    if action.action != 'pause':
        raise HTTPException(status_code=400, detail="Invalid action for this endpoint")
    
    cursor = conn.cursor()
    
    try:
        # Get target user
        cursor.execute("SELECT id, organization_id FROM user_profiles WHERE id = %s", (user_id,))
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
            
        # Ensure organizations can only manage their clients
        if current_user.get('account_type') == 'organization':
            # Check if target user is a client of this organization
            cursor.execute("""
                SELECT 1 FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s
            """, (current_user['id'], user_id))
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="You can only manage your organization's clients")
        
        # Pause the user
        cursor.execute("""
            UPDATE user_profiles 
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
    conn=Depends(get_db_connection)
):
    """Unpause a user account"""
    current_user = await get_current_user(request)
    cursor = conn.cursor()
    
    try:
        # Get target user
        cursor.execute("SELECT id, organization_id FROM user_profiles WHERE id = %s", (user_id,))
        target_user = cursor.fetchone()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        target_user_dict = {'id': target_user[0], 'organization_id': target_user[1]}
        permissions = check_user_management_permissions(current_user, target_user_dict)
        
        if not permissions.can_pause_users:
            raise HTTPException(status_code=403, detail="You don't have permission to unpause users")
            
        # Ensure organizations can only manage their clients
        if current_user.get('account_type') == 'organization':
            # Check if target user is a client of this organization
            cursor.execute("""
                SELECT 1 FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s
            """, (current_user['id'], user_id))
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="You can only manage your organization's clients")
        
        # Unpause the user
        cursor.execute("""
            UPDATE user_profiles 
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
    request: Request,
    action: UserManagementAction,
    conn=Depends(get_db_connection)
):
    """Soft delete a user account"""
    current_user = await get_current_user(request)
    if action.action != 'delete':
        raise HTTPException(status_code=400, detail="Invalid action for this endpoint")
    
    cursor = conn.cursor()
    
    try:
        # Get target user
        cursor.execute("SELECT id, organization_id FROM user_profiles WHERE id = %s", (user_id,))
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
            
        # Ensure organizations can only manage their clients
        if current_user.get('account_type') == 'organization':
            # Check if target user is a client of this organization
            cursor.execute("""
                SELECT 1 FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s
            """, (current_user['id'], user_id))
            if not cursor.fetchone():
                raise HTTPException(status_code=403, detail="You can only manage your organization's clients")
        
        # Soft delete the user
        cursor.execute("""
            UPDATE user_profiles 
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
    request: Request,
    conn=Depends(get_db_connection)
):
    """Get management logs for a specific user"""
    current_user = await get_current_user(request)
    cursor = conn.cursor()
    
    try:
        # Check permissions
        cursor.execute("SELECT organization_id FROM user_profiles WHERE id = %s", (user_id,))
        target_user = cursor.fetchone()
        
        if not target_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        permissions = check_user_management_permissions(current_user)
        if not permissions.is_system_admin:
            if not permissions.can_manage_org_users:
                raise HTTPException(status_code=403, detail="You don't have permission to view these logs")
                
            # Ensure organizations can only view logs for their clients
            if current_user.get('account_type') == 'organization':
                cursor.execute("""
                    SELECT 1 FROM organization_clients 
                    WHERE organization_id = %s AND client_id = %s
                """, (current_user['id'], user_id))
                if not cursor.fetchone():
                    raise HTTPException(status_code=403, detail="You can only view logs for your organization's clients")
        
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