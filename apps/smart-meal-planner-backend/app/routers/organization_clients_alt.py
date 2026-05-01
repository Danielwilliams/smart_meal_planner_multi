# app/routers/organization_clients_alt.py

from fastapi import APIRouter, Depends, HTTPException, Body
from app.utils.auth_utils import get_user_from_token
from app.utils.auth_middleware import require_organization_owner
from app.models.user import UserWithRole
from app.db import get_db_cursor
from typing import List, Dict, Any
from pydantic import BaseModel, EmailStr
import logging

router = APIRouter(prefix="/organization-clients", tags=["Organization Clients Alternative"])

class ClientAddRequest(BaseModel):
    """Request model for adding a client to an organization"""
    email: str
    role: str = "client"
    organization_id: int

class ClientStatusUpdate(BaseModel):
    """Request model for updating client status"""
    status: str  # 'active' or 'inactive'

@router.get("/{org_id}")
@router.post("/{org_id}")  # Add POST method support too
async def get_organization_clients(
    org_id: int,
    user=Depends(get_user_from_token)  # Use regular token check instead of strict owner check
):
    """
    Get all clients for an organization.
    This endpoint supports both GET and POST methods.
    """
    # Enhanced logging for debugging permission issues
    logger = logging.getLogger(__name__)
    logger.info(f"get_organization_clients called for org_id={org_id}")
    logger.info(f"User token contains: {user}")
    
    # If user is not authenticated, return 401
    if not user:
        logger.warning("Unauthenticated request to get_organization_clients")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    # Check either:
    # 1. User is the organization owner 
    # 2. User has admin role
    is_authorized = False
    
    # Check if token has organization_id matching requested org_id
    if user.get('organization_id') == org_id and user.get('role') == 'owner':
        is_authorized = True
        logger.info("Access granted: User is organization owner")
    
    # Check if user is a system admin
    elif user.get('is_admin') == True:
        is_authorized = True
        logger.info("Access granted: User is system admin")
    
    # If not authorized through token, check database directly
    if not is_authorized:
        try:
            with get_db_cursor(autocommit=True) as (cur, conn):
                # Check if user is org owner
                cur.execute("""
                    SELECT 1 FROM organizations 
                    WHERE id = %s AND owner_id = %s
                """, (org_id, user.get('user_id')))
                
                if cur.fetchone():
                    is_authorized = True
                    logger.info("Access granted: Database confirms user is organization owner")
        except Exception as e:
            logger.error(f"Error checking organization ownership: {str(e)}")
            raise HTTPException(
                status_code=500,
                detail=f"Database error: {str(e)}"
            )
    
    # If still not authorized, return 403
    if not is_authorized:
        logger.warning(f"Access denied for user_id={user.get('user_id')} to org_id={org_id}")
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this organization"
        )
    
    # If we get here, the user is authorized
    try:
        with get_db_cursor(autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT up.id, up.email, up.name, up.profile_complete, 
                       oc.organization_id, oc.role, oc.status
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE oc.organization_id = %s
            """, (org_id,))
            
            clients = cur.fetchall()
            
            # Log number of clients found
            logger.info(f"Found {len(clients)} clients for org_id={org_id}")
            
            client_list = [{
                "id": client["id"],
                "email": client["email"],
                "name": client["name"],
                "profile_complete": client["profile_complete"],
                "organization_id": client["organization_id"],
                "role": client["role"],
                "status": client["status"]
            } for client in clients]
            
            return {
                "clients": client_list,
                "total": len(client_list),
                "organization_id": org_id
            }
    except Exception as e:
        logger.error(f"Error fetching organization clients: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.post("/{org_id}/{client_id}")
async def add_client_to_organization_by_id(
    org_id: int,
    client_id: int,
    role: str = Body("client", embed=True),
    user=Depends(require_organization_owner)
):
    """Add a client to an organization by ID (owner only)"""
    if user.get('organization_id') != org_id:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this organization"
        )
    
    try:
        with get_db_cursor() as (cur, conn):
            # Check if client exists
            cur.execute("SELECT 1 FROM user_profiles WHERE id = %s", (client_id,))
            if not cur.fetchone():
                raise HTTPException(
                    status_code=404,
                    detail="User not found"
                )
            
            # Check if client is already in this organization
            cur.execute("""
                SELECT 1 FROM organization_clients
                WHERE organization_id = %s AND client_id = %s
            """, (org_id, client_id))
            
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="User is already a client of this organization"
                )
            
            # Check if the client is already in the organization
            cur.execute("""
                SELECT id FROM organization_clients
                WHERE organization_id = %s AND client_id = %s
            """, (org_id, client_id))
            
            existing_record = cur.fetchone()
            
            if existing_record:
                # Update existing record
                cur.execute("""
                    UPDATE organization_clients
                    SET status = 'active', role = %s
                    WHERE organization_id = %s AND client_id = %s
                """, (role, org_id, client_id))
            else:
                # Insert new record
                cur.execute("""
                    INSERT INTO organization_clients (organization_id, client_id, role, status)
                    VALUES (%s, %s, %s, 'active')
                """, (org_id, client_id, role))
            
            conn.commit()
            return {"message": "Client added to organization successfully"}
    except Exception as e:
        logger.error(f"Error adding client to organization: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.post("/add-by-email")
async def add_client_by_email(
    client_data: ClientAddRequest,
    user=Depends(require_organization_owner)
):
    """Add a client to an organization by email"""
    org_id = client_data.organization_id
    
    if user.get('organization_id') != org_id:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this organization"
        )
    
    try:
        with get_db_cursor() as (cur, conn):
            # Check if user with email exists
            cur.execute("SELECT id FROM user_profiles WHERE email = %s", (client_data.email,))
            user_result = cur.fetchone()
            
            if not user_result:
                raise HTTPException(
                    status_code=404,
                    detail="No user found with that email"
                )
            
            client_id = user_result["id"]
            
            # Check if client is already in this organization
            cur.execute("""
                SELECT 1 FROM organization_clients
                WHERE organization_id = %s AND client_id = %s
            """, (org_id, client_id))
            
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="User is already a client of this organization"
                )
            
            # Check if the client is already in the organization
            cur.execute("""
                SELECT id FROM organization_clients
                WHERE organization_id = %s AND client_id = %s
            """, (org_id, client_id))
            
            existing_record = cur.fetchone()
            
            if existing_record:
                # Update existing record
                cur.execute("""
                    UPDATE organization_clients
                    SET status = 'active', role = %s
                    WHERE organization_id = %s AND client_id = %s
                """, (client_data.role, org_id, client_id))
            else:
                # Insert new record
                cur.execute("""
                    INSERT INTO organization_clients (organization_id, client_id, role, status)
                    VALUES (%s, %s, %s, 'active')
                """, (org_id, client_id, client_data.role))
            
            conn.commit()
            return {
                "message": "Client added to organization successfully",
                "client_id": client_id
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error adding client by email: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )

@router.put("/{org_id}/clients/{client_id}/status")
async def update_client_status(
    org_id: int,
    client_id: int,
    status_update: ClientStatusUpdate,
    user=Depends(get_user_from_token)
):
    """
    Update a client's status (active/inactive) - only accessible by organization owner
    """
    logger = logging.getLogger(__name__)
    logger.info(f"update_client_status called for org_id={org_id}, client_id={client_id}, status={status_update.status}")
    
    # Validate status value
    if status_update.status not in ['active', 'inactive']:
        raise HTTPException(
            status_code=400,
            detail="Status must be 'active' or 'inactive'"
        )
    
    # Check if user is authenticated
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    # Check if user is organization owner
    if user.get('organization_id') != org_id or user.get('role') != 'owner':
        raise HTTPException(
            status_code=403,
            detail="Only organization owners can update client status"
        )
    
    try:
        with get_db_cursor() as (cur, conn):
            # Verify the client belongs to this organization
            cur.execute("""
                SELECT id, status FROM organization_clients
                WHERE organization_id = %s AND client_id = %s
            """, (org_id, client_id))
            
            client_record = cur.fetchone()
            if not client_record:
                raise HTTPException(
                    status_code=404,
                    detail="Client not found in this organization"
                )
            
            current_status = client_record["status"]
            
            # Update the client status
            cur.execute("""
                UPDATE organization_clients
                SET status = %s
                WHERE organization_id = %s AND client_id = %s
            """, (status_update.status, org_id, client_id))
            
            # Get client info for response
            cur.execute("""
                SELECT up.name, up.email
                FROM user_profiles up
                WHERE up.id = %s
            """, (client_id,))
            
            client_info = cur.fetchone()
            client_name = client_info["name"] if client_info else "Unknown"
            client_email = client_info["email"] if client_info else "Unknown"
            
            conn.commit()
            
            logger.info(f"Client {client_id} status updated from {current_status} to {status_update.status}")
            
            return {
                "message": f"Client status updated successfully",
                "client_id": client_id,
                "client_name": client_name,
                "client_email": client_email,
                "old_status": current_status,
                "new_status": status_update.status
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating client status: {str(e)}")
        if 'conn' in locals():
            try:
                conn.rollback()
            except:
                pass
        raise HTTPException(
            status_code=500,
            detail=f"Database error: {str(e)}"
        )