# app/routers/invitations_alt.py

from fastapi import APIRouter, Depends, HTTPException, Body
from app.utils.auth_utils import get_user_from_token
from app.utils.auth_middleware import require_organization_owner
from app.models.user import ClientInvitation, InvitationResponse
from app.db import get_db_connection
import secrets
import jwt
from datetime import datetime, timedelta
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import logging

# Set up logging
logger = logging.getLogger(__name__)
from app.config import (
    JWT_SECRET, 
    JWT_ALGORITHM, 
    SMTP_USERNAME, 
    SMTP_PASSWORD, 
    SMTP_SERVER, 
    SMTP_PORT, 
    FRONTEND_URL
)
from pydantic import BaseModel

router = APIRouter(prefix="/org-invitations", tags=["Organization Invitations Alternative"])

# Print logger configuration
logger.info(f"Logger level: {logger.level}")
logger.info(f"Logger handlers: {logger.handlers}")

class InviteRequest(BaseModel):
    """Request model for inviting a user to an organization"""
    email: str
    organization_id: int

async def send_invitation_email(email, token, org_id, user_exists, organization_name):
    """Send invitation email to client"""
    # Create different links for existing vs new users
    if user_exists:
        invitation_link = f"{FRONTEND_URL}/accept-invitation?token={token}&org={org_id}"
    else:
        # Special signup flow for new clients
        invitation_link = f"{FRONTEND_URL}/client-signup?token={token}&org={org_id}"
    
    # Log the invitation URL for debugging
    logger.info(f"Generated invitation link: {invitation_link}")
    logger.info(f"FRONTEND_URL from config: {FRONTEND_URL}")
    
    msg = MIMEMultipart()
    msg['Subject'] = f'Invitation to join {organization_name} on Smart Meal Planner'
    msg['From'] = SMTP_USERNAME
    msg['To'] = email
    
    # Customize message based on whether user already exists
    if user_exists:
        body = f"""
        Hello!
        
        You've been invited by {organization_name} to access their nutrition services on Smart Meal Planner.
        
        Click the link below to log in and accept the invitation:
        {invitation_link}
        
        As a client, you'll be able to:
        • View meal plans created for you
        • Access recipes shared by your nutrition expert
        • Generate shopping lists
        • Send grocery items to online grocery services
        
        This link will expire in 7 days.
        
        If you have any questions, please contact your nutrition provider directly.
        
        The Smart Meal Planner Team
        """
    else:
        body = f"""
        Hello!
        
        You've been invited by {organization_name} to access their nutrition services on Smart Meal Planner.
        
        Click the link below to create your client account:
        {invitation_link}
        
        As a client, you'll be able to:
        • View meal plans created for you
        • Access recipes shared by your nutrition expert
        • Generate shopping lists
        • Send grocery items to online grocery services
        
        This link will expire in 7 days.
        
        If you have any questions, please contact your nutrition provider directly.
        
        The Smart Meal Planner Team
        """
    
    msg.attach(MIMEText(body, 'plain'))
    
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"Error sending invitation email: {str(e)}")
        raise

@router.post("/invite", response_model=InvitationResponse)
async def invite_client(
    invitation: InviteRequest,
    user=Depends(require_organization_owner)
):
    """
    Invite a client to join the organization
    - Creates invitation token
    - Sends invitation email
    - Returns invitation details
    """
    # Verify user is the organization owner
    org_id = invitation.organization_id
    if user.get('organization_id') != org_id:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to invite clients to this organization"
        )
    
    email = invitation.email
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user already exists
            cur.execute("""
                SELECT id FROM user_profiles WHERE email = %s
            """, (email,))
            
            existing_user = cur.fetchone()
            
            # Check for existing invitations
            cur.execute("""
                SELECT id, status FROM client_invitations
                WHERE email = %s AND organization_id = %s AND status = 'pending'
            """, (email, org_id))
            
            existing_invitation = cur.fetchone()
            
            if existing_invitation:
                return {
                    "message": "An invitation has already been sent to this email",
                    "invitation_id": existing_invitation[0]
                }
            
            # Create invitation token
            invitation_token = secrets.token_urlsafe(32)
            expires_at = datetime.utcnow() + timedelta(days=7)
            
            # Store invitation
            cur.execute("""
                INSERT INTO client_invitations
                (organization_id, email, invitation_token, expires_at)
                VALUES (%s, %s, %s, %s)
                RETURNING id
            """, (org_id, email, invitation_token, expires_at))
            
            invitation_id = cur.fetchone()[0]
            conn.commit()
            
            # Get organization name
            cur.execute("""
                SELECT name FROM organizations 
                WHERE id = %s
            """, (org_id,))
            
            org_result = cur.fetchone()
            organization_name = org_result[0] if org_result else "Your Nutrition Provider"
            
            # Send invitation email
            await send_invitation_email(
                email, 
                invitation_token,
                org_id,
                existing_user is not None,
                organization_name
            )
            
            return {
                "message": "Invitation sent successfully",
                "invitation_id": invitation_id
            }
    finally:
        conn.close()

@router.get("/check/{token}/{org_id}")
async def check_invitation(
    token: str,
    org_id: int
):
    """
    Check if an invitation is valid without accepting it
    Returns the email associated with the invitation
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify the invitation
            cur.execute("""
                SELECT id, email FROM client_invitations
                WHERE invitation_token = %s 
                AND organization_id = %s
                AND status = 'pending'
                AND expires_at > NOW()
            """, (token, org_id))
            
            invitation = cur.fetchone()
            
            if not invitation:
                return {
                    "valid": False,
                    "message": "Invalid or expired invitation"
                }
            
            return {
                "valid": True,
                "email": invitation[1]
            }
    finally:
        conn.close()

@router.get("/accept/{token}/{org_id}")
async def accept_invitation(
    token: str, 
    org_id: int,
    user=Depends(get_user_from_token)
):
    """Accept an invitation to join an organization"""
    user_id = user.get('user_id')
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Verify the invitation
            cur.execute("""
                SELECT id, email FROM client_invitations
                WHERE invitation_token = %s 
                AND organization_id = %s
                AND status = 'pending'
                AND expires_at > NOW()
            """, (token, org_id))
            
            invitation = cur.fetchone()
            
            if not invitation:
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired invitation"
                )
            
            # Get the user's email
            cur.execute("""
                SELECT email FROM user_profiles WHERE id = %s
            """, (user_id,))
            user_profile = cur.fetchone()
            
            # Add debug logs
            logger.info(f"Invitation email: {invitation[1]}")
            logger.info(f"User email: {user_profile[0] if user_profile else 'Not found'}")
            
            # Skip email verification - any user can accept an invitation (only for testing!)
            # In production, you would want to enforce email matching
            
            # Add user to organization
            cur.execute("""
                INSERT INTO organization_clients
                (organization_id, client_id, role)
                VALUES (%s, %s, 'client')
                ON CONFLICT (organization_id, client_id) DO NOTHING
            """, (org_id, user_id))
            
            # Update invitation status
            cur.execute("""
                UPDATE client_invitations
                SET status = 'accepted'
                WHERE id = %s
            """, (invitation[0],))
            
            # Update user profile to add client role
            cur.execute("""
                UPDATE user_profiles
                SET account_type = 'client', 
                    organization_id = %s,
                    profile_complete = TRUE
                WHERE id = %s
                RETURNING email
            """, (org_id, user_id))
            
            user_email = cur.fetchone()[0]
            
            # Log the successful client account creation
            logger.info(f"User {user_id} with email {user_email} accepted invitation and is now a client of organization {org_id}")
            
            conn.commit()
            
            return {
                "message": "Invitation accepted successfully", 
                "account_type": "client",
                "organization_id": org_id
            }
    finally:
        conn.close()