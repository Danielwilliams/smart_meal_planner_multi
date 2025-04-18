# app/utils/auth_utils.py

from fastapi import HTTPException, Request
import jwt
import logging
from psycopg2.extras import RealDictCursor  # Add this import
from app.config import JWT_SECRET, JWT_ALGORITHM
from app.db import get_db_connection  # Add this import

logger = logging.getLogger(__name__)

async def get_user_from_token(request: Request, use_cache=True):
    """
    Enhanced token validation with organization role checking
    Allows optional authentication for public endpoints
    
    Args:
        request: The FastAPI request object
        use_cache: Whether to use cached token data
        
    Returns:
        dict: User payload with organization data, or None if no valid token
    """
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        logger.error("No Authorization header found")
        # For endpoints that allow anonymous access, return None instead of raising
        return None
    
    try:
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            token = auth_header
            
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        if not payload.get('user_id'):
            logger.error("Token payload missing user_id")
            raise HTTPException(status_code=401, detail="Invalid token payload")
        
        # Get user's organization info if any
        user_id = payload.get('user_id')
        organization_data = await get_user_organization_role(user_id)
        
        # Add organization data to the payload
        payload.update(organization_data)
            
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        # For endpoints that allow anonymous access, return None instead of raising
        if 'allow_anonymous' in locals() and allow_anonymous:
            return None
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        # For endpoints that allow anonymous access, return None instead of raising
        return None
    except Exception as e:
        logger.error(f"Unexpected error in token validation: {str(e)}")
        # For endpoints that allow anonymous access, return None instead of raising
        return None

async def get_user_organization_role(user_id: int):
    """Get user's organization and role if any"""
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if user is an organization owner
            cur.execute("""
                SELECT id as organization_id FROM organizations 
                WHERE owner_id = %s
            """, (user_id,))
            org_owner = cur.fetchone()
            
            if org_owner:
                return {
                    "organization_id": org_owner["organization_id"],
                    "role": "owner"
                }
            
            # Check if user is a client of any organization
            cur.execute("""
                SELECT organization_id, role FROM organization_clients
                WHERE client_id = %s AND status = 'active'
            """, (user_id,))
            org_client = cur.fetchone()
            
            if org_client:
                return {
                    "organization_id": org_client["organization_id"],
                    "role": org_client["role"]
                }
            
            # User has no organizational affiliation
            return {
                "organization_id": None,
                "role": None
            }
    finally:
        conn.close()
        
async def is_organization_admin(user_id: int) -> bool:
    """
    Check if a user is an organization admin (owner or admin role)
    
    Args:
        user_id: The user ID to check
        
    Returns:
        bool: True if the user is an organization admin, False otherwise
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Check if user is an organization owner
            cur.execute("""
                SELECT id FROM organizations 
                WHERE owner_id = %s
            """, (user_id,))
            org_owner = cur.fetchone()
            
            if org_owner:
                return True
            
            # Check if user is an organization admin
            cur.execute("""
                SELECT organization_id, role FROM organization_clients
                WHERE client_id = %s AND role = 'admin' AND status = 'active'
            """, (user_id,))
            org_admin = cur.fetchone()
            
            return org_admin is not None
    finally:
        conn.close()