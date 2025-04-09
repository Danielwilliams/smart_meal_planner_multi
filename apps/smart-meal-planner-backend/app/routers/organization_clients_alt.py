# app/routers/organization_clients_alt.py

from fastapi import APIRouter, Depends, HTTPException, Body
from app.utils.auth_utils import get_user_from_token
from app.utils.auth_middleware import require_organization_owner
from app.models.user import UserWithRole
from app.db import get_db_connection
from typing import List
from pydantic import BaseModel, EmailStr

router = APIRouter(prefix="/organization-clients", tags=["Organization Clients Alternative"])

class ClientAddRequest(BaseModel):
    """Request model for adding a client to an organization"""
    email: str
    role: str = "client"
    organization_id: int

@router.get("/{org_id}")
async def get_organization_clients(
    org_id: int,
    user=Depends(require_organization_owner)
):
    """Get all clients for an organization (owner only)"""
    if user.get('organization_id') != org_id:
        raise HTTPException(
            status_code=403,
            detail="You don't have access to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT up.id, up.email, up.name, up.profile_complete, 
                       oc.organization_id, oc.role
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE oc.organization_id = %s AND oc.status = 'active'
            """, (org_id,))
            
            clients = cur.fetchall()
            return [{
                "id": client[0],
                "email": client[1],
                "name": client[2],
                "profile_complete": client[3],
                "organization_id": client[4],
                "role": client[5]
            } for client in clients]
    finally:
        conn.close()

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
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
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
            
            # Add client to organization
            cur.execute("""
                INSERT INTO organization_clients (organization_id, client_id, role)
                VALUES (%s, %s, %s)
            """, (org_id, client_id, role))
            
            conn.commit()
            return {"message": "Client added to organization successfully"}
    finally:
        conn.close()

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
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user with email exists
            cur.execute("SELECT id FROM user_profiles WHERE email = %s", (client_data.email,))
            user_result = cur.fetchone()
            
            if not user_result:
                raise HTTPException(
                    status_code=404,
                    detail="No user found with that email"
                )
            
            client_id = user_result[0]
            
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
            
            # Add client to organization
            cur.execute("""
                INSERT INTO organization_clients (organization_id, client_id, role)
                VALUES (%s, %s, %s)
            """, (org_id, client_id, client_data.role))
            
            conn.commit()
            return {
                "message": "Client added to organization successfully",
                "client_id": client_id
            }
    finally:
        conn.close()