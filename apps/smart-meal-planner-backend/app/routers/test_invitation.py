# app/routers/test_invitation.py
from fastapi import APIRouter, Request
from app.config import FRONTEND_URL

router = APIRouter(prefix="/test-invitation", tags=["Testing"])

@router.get("/generate-links")
async def generate_test_invitation_links(request: Request):
    """
    Generate test invitation links for debugging purposes
    """
    # Use a mock invitation token
    token = "test_token_123456"
    org_id = 1
    
    # Get the request base URL or use configured FRONTEND_URL
    host = request.headers.get("host", "localhost:8000")
    scheme = request.headers.get("x-forwarded-proto", "http")
    base_url = f"{scheme}://{host}"
    
    # Create different invitation links
    frontend_url = FRONTEND_URL or base_url
    
    # Generate links with both configurations
    existing_user_accept = f"{frontend_url}/accept-invitation?token={token}&org={org_id}"
    new_user_client_signup = f"{frontend_url}/client-signup?token={token}&org={org_id}"
    login_with_invitation = f"{frontend_url}/login?invitation=true&token={token}&org={org_id}"
    
    # Return all the links and configuration info
    return {
        "config": {
            "frontend_url": FRONTEND_URL,
            "base_url": base_url,
        },
        "links": {
            "existing_user_accept": existing_user_accept,
            "new_user_client_signup": new_user_client_signup,
            "login_with_invitation": login_with_invitation,
        },
        "test_instructions": "Use these links to test the invitation flow. They use a mock token and organization ID."
    }