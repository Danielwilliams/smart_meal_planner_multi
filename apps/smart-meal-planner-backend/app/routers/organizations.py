# app/routers/organizations.py - New file

from fastapi import APIRouter, Depends, HTTPException, Body
from app.utils.auth_utils import get_user_from_token
from app.utils.auth_middleware import require_organization_owner
from app.models.user import OrganizationCreate, Organization
from app.db import get_db_connection
from typing import List

router = APIRouter(prefix="/organizations", tags=["Organizations"])

@router.post("/", response_model=Organization)
async def create_organization(
    org_data: OrganizationCreate, 
    user=Depends(get_user_from_token)
):
    """Create a new organization with the current user as owner"""
    user_id = user.get('user_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
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
    finally:
        conn.close()

@router.get("/", response_model=List[Organization])
async def get_user_organizations(user=Depends(get_user_from_token)):
    """
    Get organizations the user belongs to:
    - If owner: returns owned organization
    - If client: returns organizations where user is a client
    """
    user_id = user.get('user_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
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
    finally:
        conn.close()

@router.get("/{org_id}")
async def get_organization(
    org_id: int,
    user=Depends(require_organization_member)
):
    """Get organization details (must be owner or client)"""
    # Ensure user belongs to this specific organization
    if user.get('organization_id') != org_id:
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
            
            return {
                "id": org[0],
                "name": org[1],
                "description": org[2],
                "owner_id": org[3],
                "created_at": org[4].isoformat()
            }
    finally:
        conn.close()