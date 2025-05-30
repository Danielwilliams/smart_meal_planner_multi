# app/routers/organizations.py - New file

from fastapi import APIRouter, Depends, HTTPException, Body
import logging
from app.utils.auth_utils import get_user_from_token
from app.utils.auth_middleware import require_organization_owner
from app.models.user import OrganizationCreate, Organization
from app.db import get_db_connection, get_db_cursor
from typing import List
from app.utils.auth_middleware import require_organization_owner, require_organization_member
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.post("/", response_model=Organization)
async def create_organization(
    org_data: OrganizationCreate, 
    user=Depends(get_user_from_token)
):
    """Create a new organization with the current user as owner"""
    user_id = user.get('user_id')
    
    try:
        with get_db_cursor() as (cur, conn):
            # Check if user already owns an organization
            cur.execute("""
                SELECT id FROM organizations WHERE owner_id = %s
            """, (user_id,))
            
            if cur.fetchone():
                raise HTTPException(
                    status_code=400,
                    detail="User already owns an organization"
                )
            
            # Create the organization
            cur.execute("""
                INSERT INTO organizations (name, description, owner_id)
                VALUES (%s, %s, %s) RETURNING id, name, description, owner_id, created_at
            """, (org_data.name, org_data.description, user_id))
            
            new_org = cur.fetchone()
            conn.commit()
            
            return {
                "id": new_org[0],
                "name": new_org[1],
                "description": new_org[2],
                "owner_id": new_org[3],
                "created_at": new_org[4].isoformat()
            }
    except Exception as e:
        logger.error(f"Error creating organization: {str(e)}")
        raise HTTPException(status_code=500, detail="Error creating organization")

@router.get("/", response_model=List[Organization])
async def get_user_organizations(user=Depends(get_user_from_token)):
    """
    Get organizations the user belongs to:
    - If owner: returns owned organization
    - If client: returns organizations where user is a client
    """
    user_id = user.get('user_id')
    
    try:
        with get_db_cursor() as (cur, conn):
            # Check if user is an owner
            cur.execute("""
                SELECT id, name, description, owner_id, created_at
                FROM organizations WHERE owner_id = %s
            """, (user_id,))
            
            owned_orgs = cur.fetchall()
            if owned_orgs:
                return [{
                    "id": org[0],
                    "name": org[1],
                    "description": org[2],
                    "owner_id": org[3],
                    "created_at": org[4].isoformat()
                } for org in owned_orgs]
            
            # Check if user is a client
            cur.execute("""
                SELECT o.id, o.name, o.description, o.owner_id, o.created_at
                FROM organizations o
                JOIN organization_clients oc ON o.id = oc.organization_id
                WHERE oc.client_id = %s AND oc.status = 'active'
            """, (user_id,))
            
            client_orgs = cur.fetchall()
            return [{
                "id": org[0],
                "name": org[1],
                "description": org[2],
                "owner_id": org[3],
                "created_at": org[4].isoformat()
            } for org in client_orgs]
    except Exception as e:
        logger.error(f"Error getting user organizations: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching organizations")

@router.get("/{org_id}")
async def get_organization(
    org_id: int,
    user=Depends(get_user_from_token, use_cache=False)
):
    """Get organization details (basic info is public for invitation flow)"""
    # For non-authenticated requests or invitation flow, allow access to basic info
    if not user:
        # This is a public request, only return minimal information
        is_public_request = True
    else:
        # For authenticated users, check permissions
        is_public_request = False
        # Only perform this check for authenticated users
        if user.get('organization_id') != org_id:
            # For normal authenticated users who don't belong to this org, restrict access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this organization"
            )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT id, name, description, owner_id, created_at
                FROM organizations WHERE id = %s
            """, (org_id,))
            
            org = cur.fetchone()
            if not org:
                raise HTTPException(
                    status_code=404,
                    detail="Organization not found"
                )
            
            # For public requests (invitation flow), only return name and id
            if 'is_public_request' in locals() and is_public_request:
                return {
                    "id": org[0],
                    "name": org[1]
                }
            else:
                # For authenticated users, return full details
                return {
                    "id": org[0],
                    "name": org[1],
                    "description": org[2],
                    "owner_id": org[3],
                    "created_at": org[4].isoformat()
                }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting organization: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching organization")

@router.get("/clients/{client_id}")
async def get_client_details(
    client_id: int,
    user=Depends(get_user_from_token)
):
    """Get detailed information about a client"""
    user_id = user.get('user_id')
    org_id = user.get('organization_id')
    
    # Check if user is organization owner or the client themselves
    if user_id != int(client_id) and user.get('role') != 'owner':
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to view this client's details"
        )
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Get client details
            cur.execute("""
                SELECT 
                    up.id, 
                    up.email, 
                    up.name, 
                    up.account_type,
                    up.profile_complete,
                    oc.organization_id,
                    oc.role,
                    oc.status
                FROM user_profiles up
                LEFT JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s
            """, (client_id,))
            
            client = cur.fetchone()
            if not client:
                raise HTTPException(
                    status_code=404,
                    detail="Client not found"
                )
            
            # If requesting a client from a different organization, only the owner can view
            if client['organization_id'] and client['organization_id'] != org_id and user.get('role') != 'owner':
                raise HTTPException(
                    status_code=403,
                    detail="This client belongs to a different organization"
                )
            
            return client
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting client details: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching client details")

