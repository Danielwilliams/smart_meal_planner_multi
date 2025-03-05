# app/utils/auth_utils.py

from fastapi import HTTPException, Request
import jwt
import logging
from app.config import JWT_SECRET, JWT_ALGORITHM

logger = logging.getLogger(__name__)

async def get_user_from_token(request: Request):
    """Enhanced token validation"""
    auth_header = request.headers.get('Authorization')
    if not auth_header:
        logger.error("No Authorization header found")
        raise HTTPException(status_code=401, detail="No authorization token")
    
    try:
        # Properly handle 'Bearer ' prefix
        if auth_header.startswith('Bearer '):
            token = auth_header.split(' ')[1]
        else:
            token = auth_header
            
        # Add logging for debugging
        logger.debug(f"Attempting to decode token: {token[:10]}...")
        
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        
        # Validate payload contents
        if not payload.get('user_id'):
            logger.error("Token payload missing user_id")
            raise HTTPException(status_code=401, detail="Invalid token payload")
            
        return payload
        
    except jwt.ExpiredSignatureError:
        logger.error("Token has expired")
        raise HTTPException(status_code=401, detail="Token has expired")
    except jwt.JWTError as e:
        logger.error(f"JWT validation error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        logger.error(f"Unexpected error in token validation: {str(e)}")
        raise HTTPException(status_code=401, detail="Token validation error")