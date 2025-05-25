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
    # Direct link to client signup page - simplest approach
    invitation_link = f"{FRONTEND_URL}/client-signup?token={token}&org={org_id}"
    
    # Log the invitation URL for debugging
    logger.info(f"Generated invitation link: {invitation_link}")
    logger.info(f"FRONTEND_URL from config: {FRONTEND_URL}")
    
    msg = MIMEMultipart()
    msg['Subject'] = f'Invitation to join {organization_name} on Smart Meal Planner'
    msg['From'] = SMTP_USERNAME
    msg['To'] = email
    
    # One clear message regardless of user status
    body = f"""
    Hello!
    
    You've been invited by {organization_name} to join their nutrition services as a client on Smart Meal Planner.
    
    Click the link below to set up your client account:
    {invitation_link}
    
    As a client, you'll be able to:
    • View meal plans created for you
    • Access recipes shared by your nutrition expert
    • Generate shopping lists
    • Send grocery items to online grocery services
    
    Important: This link takes you directly to the client registration page, making it clear
    that you're signing up as a client of {organization_name}.
    
    This invitation link will expire in 7 days.
    
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
    # Check if user is not None
    if not user:
        logger.error(f"No authenticated user found when accepting invitation for org_id {org_id}")
        raise HTTPException(
            status_code=401,
            detail="Authentication required to accept invitation"
        )
    
    user_id = user.get('user_id')
    logger.info(f"Accept invitation called with token: {token[:10]}... org_id: {org_id}, user_id: {user_id}")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Log user details for debugging
            cur.execute("""
                SELECT id, email, account_type, organization_id, profile_complete 
                FROM user_profiles WHERE id = %s
            """, (user_id,))
            user_details = cur.fetchone()
            if user_details:
                logger.info(f"User details: id={user_details[0]}, email={user_details[1]}, "
                           f"account_type={user_details[2]}, organization_id={user_details[3]}, "
                           f"profile_complete={user_details[4]}")
            else:
                logger.error(f"User with ID {user_id} not found in database")
            
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
                logger.error(f"Invalid invitation - token: {token[:10]}..., org_id: {org_id}")
                raise HTTPException(
                    status_code=400,
                    detail="Invalid or expired invitation"
                )
            
            logger.info(f"Valid invitation found - id: {invitation[0]}, email: {invitation[1]}")
            
            # Get the user's email
            cur.execute("""
                SELECT email FROM user_profiles WHERE id = %s
            """, (user_id,))
            user_profile = cur.fetchone()
            
            # Add debug logs
            logger.info(f"Invitation email: {invitation[1]}")
            logger.info(f"User email: {user_profile[0] if user_profile else 'Not found'}")
            
            # Skip email verification for development - any user can accept an invitation
            # In production, you would want to enforce email matching
            
            try:
                # Check if the user is already in the organization
                cur.execute("""
                    SELECT id FROM organization_clients
                    WHERE organization_id = %s AND client_id = %s
                """, (org_id, user_id))
                
                existing_record = cur.fetchone()
                
                if existing_record:
                    # Update existing record
                    cur.execute("""
                        UPDATE organization_clients
                        SET status = 'active', role = 'client'
                        WHERE organization_id = %s AND client_id = %s
                        RETURNING id
                    """, (org_id, user_id))
                else:
                    # Insert new record
                    cur.execute("""
                        INSERT INTO organization_clients
                        (organization_id, client_id, role, status)
                        VALUES (%s, %s, 'client', 'active')
                        RETURNING id
                    """, (org_id, user_id))
                
                org_client_id = cur.fetchone()[0]
                logger.info(f"User added to organization_clients - id: {org_client_id}")
                
                # Update invitation status
                cur.execute("""
                    UPDATE client_invitations
                    SET status = 'accepted'
                    WHERE id = %s
                    RETURNING id
                """, (invitation[0],))
                
                invitation_id = cur.fetchone()[0]
                logger.info(f"Invitation status updated to accepted - id: {invitation_id}")
                
                # Update user profile to add client role
                cur.execute("""
                    UPDATE user_profiles
                    SET account_type = 'client', 
                        organization_id = %s,
                        profile_complete = TRUE
                    WHERE id = %s
                    RETURNING email, id
                """, (org_id, user_id))
                
                user_result = cur.fetchone()
                user_email = user_result[0]
                user_updated_id = user_result[1]
                
                logger.info(f"User profile updated - email: {user_email}, id: {user_updated_id}, "
                           f"account_type: client, organization_id: {org_id}")
                
                conn.commit()
                logger.info("Transaction committed successfully")
                
                # Verify the updates
                cur.execute("""
                    SELECT account_type, organization_id FROM user_profiles WHERE id = %s
                """, (user_id,))
                user_verify = cur.fetchone()
                logger.info(f"After update verification - account_type: {user_verify[0]}, "
                           f"organization_id: {user_verify[1]}")
                
                cur.execute("""
                    SELECT status FROM organization_clients 
                    WHERE organization_id = %s AND client_id = %s
                """, (org_id, user_id))
                client_verify = cur.fetchone()
                logger.info(f"Organization client verification - status: {client_verify[0] if client_verify else 'Not found'}")
                
                return {
                    "message": "Invitation accepted successfully", 
                    "account_type": "client",
                    "organization_id": org_id,
                    "user_id": user_id
                }
            except Exception as e:
                logger.error(f"Database error during invitation acceptance: {str(e)}")
                raise HTTPException(
                    status_code=500,
                    detail=f"Error accepting invitation: {str(e)}"
                )
    except Exception as e:
        logger.error(f"Unexpected error in accept_invitation: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"An unexpected error occurred: {str(e)}"
        )
    finally:
        conn.close()

@router.get("/list/{org_id}")
async def list_invitations(
    org_id: int,
    user=Depends(require_organization_owner)
):
    """List all invitations for an organization"""
    # Verify user is the organization owner
    if user.get('organization_id') != org_id:
        raise HTTPException(
            status_code=403,
            detail="You don't have permission to view invitations for this organization"
        )
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get all invitations for the organization with additional details
            cur.execute("""
                SELECT 
                    ci.id,
                    ci.email,
                    ci.status,
                    ci.created_at,
                    ci.expires_at,
                    ci.invitation_token,
                    up.id as user_id,
                    up.name as user_name,
                    up.account_type,
                    oc.status as client_status
                FROM client_invitations ci
                LEFT JOIN user_profiles up ON ci.email = up.email
                LEFT JOIN organization_clients oc ON (up.id = oc.client_id AND oc.organization_id = %s)
                WHERE ci.organization_id = %s
                ORDER BY ci.created_at DESC
            """, (org_id, org_id))
            
            invitations = cur.fetchall()
            
            result = []
            for inv in invitations:
                invitation_data = {
                    "id": inv[0],
                    "email": inv[1],
                    "status": inv[2],
                    "created_at": inv[3].isoformat() if inv[3] else None,
                    "expires_at": inv[4].isoformat() if inv[4] else None,
                    "is_expired": inv[4] < datetime.utcnow() if inv[4] else False,
                    "user_exists": inv[6] is not None,
                    "user_name": inv[7],
                    "user_account_type": inv[8],
                    "client_status": inv[9],
                    "is_attached": inv[9] == 'active' if inv[9] else False
                }
                result.append(invitation_data)
            
            return {
                "invitations": result,
                "total": len(result)
            }
    finally:
        conn.close()

@router.post("/resend/{invitation_id}")
async def resend_invitation(
    invitation_id: int,
    user=Depends(require_organization_owner)
):
    """Resend an invitation email"""
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Get invitation details and verify ownership
            cur.execute("""
                SELECT 
                    ci.id,
                    ci.email,
                    ci.organization_id,
                    ci.invitation_token,
                    ci.status,
                    ci.expires_at,
                    o.name as organization_name
                FROM client_invitations ci
                JOIN organizations o ON ci.organization_id = o.id
                WHERE ci.id = %s
            """, (invitation_id,))
            
            invitation = cur.fetchone()
            
            if not invitation:
                raise HTTPException(status_code=404, detail="Invitation not found")
            
            org_id = invitation[2]
            
            # Verify user is the organization owner
            if user.get('organization_id') != org_id:
                raise HTTPException(
                    status_code=403,
                    detail="You don't have permission to resend this invitation"
                )
            
            email = invitation[1]
            current_token = invitation[3]
            current_status = invitation[4]
            expires_at = invitation[5]
            organization_name = invitation[6]
            
            # Check if invitation is already accepted
            if current_status == 'accepted':
                raise HTTPException(
                    status_code=400,
                    detail="Cannot resend an already accepted invitation"
                )
            
            # Generate new token and extend expiration if needed
            new_token = secrets.token_urlsafe(32)
            new_expires_at = datetime.utcnow() + timedelta(days=7)
            
            # Update invitation with new token and expiration
            cur.execute("""
                UPDATE client_invitations
                SET invitation_token = %s, expires_at = %s, status = 'pending'
                WHERE id = %s
            """, (new_token, new_expires_at, invitation_id))
            
            conn.commit()
            
            # Check if user already exists
            cur.execute("""
                SELECT id FROM user_profiles WHERE email = %s
            """, (email,))
            user_exists = cur.fetchone() is not None
            
            # Send the invitation email with new token
            await send_invitation_email(email, new_token, org_id, user_exists, organization_name)
            
            return {
                "message": "Invitation resent successfully",
                "email": email,
                "new_expires_at": new_expires_at.isoformat()
            }
    finally:
        conn.close()