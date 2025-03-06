# app/routers/invitations.py - New file

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
from app.config import (
    JWT_SECRET, 
    JWT_ALGORITHM, 
    SMTP_USERNAME, 
    SMTP_PASSWORD, 
    SMTP_SERVER, 
    SMTP_PORT, 
    FRONTEND_URL
)

router = APIRouter(prefix="/organizations/{org_id}/invitations", tags=["Client Invitations"])

@router.post("/", response_model=InvitationResponse)
async def invite_client(
    org_id: int,
    invitation: ClientInvitation,
    user=Depends(require_organization_owner)
):
    """
    Invite a client to join the organization
    - Creates invitation token
    - Sends invitation email
    - Returns invitation details
    """
    # Verify user is the organization owner
    if user.get('organization_id') != org_id:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to invite clients to this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if user already exists
            cur.execute("""
                SELECT id FROM user_profiles WHERE email = %s
            """, (invitation.email,))
            
            existing_user = cur.fetchone()
            
            # Check for existing invitations
            cur.execute("""
                SELECT id, status FROM client_invitations
                WHERE email = %s AND organization_id = %s AND status = 'pending'
            """, (invitation.email, org_id))
            
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
            """, (org_id, invitation.email, invitation_token, expires_at))
            
            invitation_id = cur.fetchone()[0]
            conn.commit()
            
            # Send invitation email
            await send_invitation_email(
                invitation.email, 
                invitation_token,
                org_id,
                existing_user is not None
            )
            
            return {
                "message": "Invitation sent successfully",
                "invitation_id": invitation_id
            }
    finally:
        conn.close()

async def send_invitation_email(email, token, org_id, user_exists):
    """Send invitation email to client"""
    invitation_link = f"{FRONTEND_URL}/accept-invitation?token={token}&org={org_id}"
    
    msg = MIMEMultipart()
    msg['Subject'] = 'You have been invited to join a nutrition organization'
    msg['From'] = SMTP_USERNAME
    msg['To'] = email
    
    # Customize message based on whether user already exists
    if user_exists:
        body = f"""
        You have been invited to join an organization on Smart Meal Planner.
        
        Click the link below to accept the invitation:
        {invitation_link}
        
        This link will expire in 7 days.
        """
    else:
        body = f"""
        You have been invited to join an organization on Smart Meal Planner.
        
        You'll need to create an account first, then you can accept the invitation:
        {invitation_link}
        
        This link will expire in 7 days.
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

@router.get("/accept/{token}")
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
            
            # Verify user email matches invitation email
            cur.execute("""
                SELECT email FROM user_profiles WHERE id = %s
            """, (user_id,))
            
            user_email = cur.fetchone()[0]
            
            if user_email.lower() != invitation[1].lower():
                raise HTTPException(
                    status_code=403,
                    detail="This invitation was sent to a different email address"
                )
            
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
            
            conn.commit()
            
            return {"message": "Invitation accepted successfully"}
    finally:
        conn.close()