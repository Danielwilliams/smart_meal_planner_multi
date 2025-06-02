# app/utils/auth_utils.py

from fastapi import HTTPException, Request, Depends
import jwt
import logging
from psycopg2.extras import RealDictCursor
from app.config import JWT_SECRET, JWT_ALGORITHM
from app.db_super_simple import get_db_connection, get_db_cursor

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
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user is an organization owner
            cur.execute("""
                SELECT id as organization_id FROM organizations 
                WHERE owner_id = %s
            """, (user_id,))
            org_owner = cur.fetchone()
            
            if org_owner:
                return {
                    "organization_id": org_owner["organization_id"],
                    "role": "owner",
                    "is_admin": True
                }
            
            # Check if user is a client of any organization (including inactive)
            cur.execute("""
                SELECT organization_id, role, status FROM organization_clients
                WHERE client_id = %s
            """, (user_id,))
            org_client = cur.fetchone()
            
            if org_client:
                if org_client["status"] == 'active':
                    return {
                        "organization_id": org_client["organization_id"],
                        "role": org_client["role"],
                        "is_admin": org_client["role"] == "admin",
                        "client_status": "active"
                    }
                else:
                    # Return inactive status info for proper error handling
                    return {
                        "organization_id": org_client["organization_id"],
                        "role": org_client["role"],
                        "is_admin": False,
                        "client_status": "inactive"
                    }
            
            # Check if user has admin role in the system
            cur.execute("""
                SELECT role FROM users
                WHERE id = %s
            """, (user_id,))
            user_record = cur.fetchone()
            
            is_admin = False
            if user_record and user_record.get("role") == "admin":
                is_admin = True
                return {
                    "organization_id": None,
                    "role": "admin",
                    "is_admin": True,
                    "Role": "admin"  # Add Role field for frontend compatibility
                }
            
            # User has no organizational affiliation
            return {
                "organization_id": None,
                "role": None,
                "is_admin": is_admin
            }
    except Exception as e:
        logger.error(f"Error in get_user_organization_role: {str(e)}")
        raise
        
async def is_organization_admin(user_id: int) -> bool:
    """
    Check if a user is an organization admin (owner or admin role)
    
    Args:
        user_id: The user ID to check
        
    Returns:
        bool: True if the user is an organization admin, False otherwise
    """
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
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
    except Exception as e:
        logger.error(f"Error in is_organization_admin: {str(e)}")
        return False

def admin_required(user = Depends(get_user_from_token)):
    """Middleware to require admin permissions"""
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    if not user.get("is_admin"):
        raise HTTPException(
            status_code=403,
            detail="Admin permissions required"
        )
    
    return user