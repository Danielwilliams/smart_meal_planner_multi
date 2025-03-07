# app/utils/auth_utils.py

from fastapi import HTTPException, Request
import jwt
import logging
from psycopg2.extras import RealDictCursor  # Add this import
from app.config import JWT_SECRET, JWT_ALGORITHM
from app.db import get_db_connection  # Add this import

logger = logging.getLogger(__name__)

async def get_user_from_token(request: Request):
    """Enhanced token validation with organization role checking"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        logger.error("No Authorization header found")
        raise HTTPException(status_code=401, detail="No authorization token")
    
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
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.PyJWTError as e:  # Changed from JWTError to PyJWTError
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Unexpected error in token validation: {str(e)}")
        raise HTTPException(status_code=401, detail="Token validation error")

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