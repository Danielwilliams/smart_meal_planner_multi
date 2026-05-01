# app/utils/subscription_middleware.py
from fastapi import HTTPException, Depends
from typing import Dict, Any
import logging
from app.utils.auth_utils import get_user_from_token
from app.models.subscription import check_user_subscription_access

logger = logging.getLogger(__name__)

def require_active_subscription(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """
    Middleware to require an active subscription for accessing premium features.
    
    Handles hierarchical subscription model:
    - Client accounts: Check their organization's subscription
    - Organization accounts: Check their own subscription  
    - Individual accounts: Check their own subscription
    
    Args:
        current_user: User data from JWT token
        
    Returns:
        current_user if subscription is active
        
    Raises:
        HTTPException: If no active subscription found
    """
    user_id = current_user.get('user_id')
    account_type = current_user.get('account_type')
    organization_id = current_user.get('organization_id')
    
    try:
        # Check subscription access using hierarchical model
        has_access = check_user_subscription_access(
            user_id=user_id,
            account_type=account_type, 
            organization_id=organization_id,
            include_free_tier=True
        )
        
        if not has_access:
            logger.warning(f"User {user_id} ({account_type}) denied access - no active subscription")
            raise HTTPException(
                status_code=402,  # Payment Required
                detail={
                    "error": "subscription_required",
                    "message": "An active subscription is required to access this feature",
                    "account_type": account_type,
                    "user_id": user_id
                }
            )
        
        logger.info(f"User {user_id} ({account_type}) has valid subscription access")
        return current_user
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking subscription for user {user_id}: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="Error verifying subscription status"
        )

def get_subscription_info(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """
    Get subscription information for the current user.
    
    Returns subscription details considering organizational hierarchies.
    """
    user_id = current_user.get('user_id')
    account_type = current_user.get('account_type')
    organization_id = current_user.get('organization_id')
    
    try:
        has_access = check_user_subscription_access(
            user_id=user_id,
            account_type=account_type,
            organization_id=organization_id,
            include_free_tier=True
        )
        
        return {
            "user_id": user_id,
            "account_type": account_type,
            "organization_id": organization_id,
            "has_subscription_access": has_access,
            "subscription_source": "organization" if account_type == "client" else "direct"
        }
        
    except Exception as e:
        logger.error(f"Error getting subscription info for user {user_id}: {str(e)}")
        return {
            "user_id": user_id,
            "account_type": account_type,
            "organization_id": organization_id,
            "has_subscription_access": False,
            "subscription_source": None,
            "error": str(e)
        }