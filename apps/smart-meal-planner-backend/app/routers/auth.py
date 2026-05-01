# app/routers/auth.py
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from datetime import datetime, timedelta
from ..models.user import UserSignUp, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, UserProgress, ResendVerificationRequest
from ..db import get_db_connection, get_db_cursor
from pydantic import EmailStr
import bcrypt
import secrets
import jwt
import requests
from app.config import RECAPTCHA_SECRET_KEY, JWT_SECRET, JWT_ALGORITHM
from email.mime.text import MIMEText
import smtplib
from app.config import SMTP_USERNAME, SMTP_PASSWORD, SMTP_SERVER, SMTP_PORT, FRONTEND_URL
from app.utils.auth_utils import get_user_from_token
from typing import Dict, Any, Optional, List
from psycopg2.extras import RealDictCursor
import logging

# Setup logging
logger = logging.getLogger(__name__)

# Define router only once at the top
router = APIRouter(prefix="/auth", tags=["Auth"])

async def send_verification_email(email: str, verification_token: str):
    try:
        verification_link = f"{FRONTEND_URL}/verify-email?token={verification_token}"
        
        msg = MIMEText(f"""
        Welcome to Smart Meal Planner!
        
        Please verify your email by clicking the link below:
        {verification_link}
        
        This link will expire in 24 hours.
        
        If you didn't create this account, please ignore this email.
        """)
        
        msg['Subject'] = 'Verify your Smart Meal Planner account'
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        raise

@router.post("/signup")
async def sign_up(user_data: UserSignUp, background_tasks: BackgroundTasks):
    try:
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cursor, conn):
            # Autocommit is enabled at connection creation time
            
            # Check if email already exists
            cursor.execute("SELECT id FROM user_profiles WHERE email = %s", (user_data.email,))
            if cursor.fetchone():
                raise HTTPException(status_code=400, detail="Email already registered")
            
            # Create verification token
            verification_token = jwt.encode({
                'email': user_data.email,
                'exp': datetime.utcnow() + timedelta(hours=24)
            }, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            # Hash password
            hashed_password = bcrypt.hashpw(user_data.password.encode('utf-8'), bcrypt.gensalt())
            
            # Insert user with verified=False
            cursor.execute("""
                INSERT INTO user_profiles 
                (email, name, hashed_password, verified, verification_token, account_type)
                VALUES (%s, %s, %s, %s, %s, %s)
                RETURNING id
            """, (
                user_data.email,
                user_data.name,
                hashed_password.decode('utf-8'),
                False,
                verification_token,
                user_data.account_type
            ))
            
            user_id = cursor.fetchone()[0]
            
            # If this is an organization account, create the organization
            if user_data.account_type == "organization" and user_data.organization_name:
                cursor.execute("""
                    INSERT INTO organizations (name, owner_id)
                    VALUES (%s, %s)
                    RETURNING id
                """, (user_data.organization_name, user_id))
                organization_id = cursor.fetchone()[0]
                
                # Create a trial subscription for the organization
                from app.models.subscription import migrate_to_free_tier
                migrate_to_free_tier(organization_id=organization_id, days_until_expiration=7)  # 7-day trial
            else:
                # Create a trial subscription for individual user
                from app.models.subscription import migrate_to_free_tier
                migrate_to_free_tier(user_id=user_id, days_until_expiration=7)  # 7-day trial
        
        # Send verification email in background
        background_tasks.add_task(send_verification_email, user_data.email, verification_token)
        
        return {
            "message": "Please check your email to verify your account",
            "email": user_data.email,
            "account_type": user_data.account_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/verify-email/{token}")
async def verify_email(token: str):
    try:
        print(f"🔍 Verifying email with token: {token[:20]}...")
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get('email')
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        
        print(f"🔍 Token decoded successfully for email: {email}")
        
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cursor, conn):
            # Autocommit is enabled at connection creation time

            # First, check if user exists and current verification status
            cursor.execute("""
                SELECT id, verified, verification_token
                FROM user_profiles
                WHERE email = %s
            """, (email,))
            
            user_result = cursor.fetchone()
            if not user_result:
                print(f"❌ User not found for email: {email}")
                raise HTTPException(status_code=400, detail="User not found")
            
            user_id, is_verified, stored_token = user_result
            print(f"🔍 User found - ID: {user_id}, Verified: {is_verified}, Has token: {bool(stored_token)}")
            
            if is_verified:
                print(f"✅ User {email} is already verified")
                return {"message": "Email already verified"}
            
            # Check if stored token matches
            if stored_token != token:
                print(f"❌ Token mismatch for {email}")
                print(f"   Stored token: {stored_token[:20] if stored_token else 'None'}...")
                print(f"   Provided token: {token[:20]}...")
                raise HTTPException(status_code=400, detail="Invalid verification token")
            
            # Update user verification status
            cursor.execute("""
                UPDATE user_profiles
                SET verified = true, verification_token = NULL
                WHERE email = %s AND verification_token = %s
                RETURNING id
            """, (email, token))
            
            if cursor.rowcount == 0:
                print(f"❌ Update failed for {email}")
                raise HTTPException(status_code=400, detail="Failed to verify email")
        print(f"✅ Email verification successful for {email}")
        return {"message": "Email verified successfully"}
        
    except jwt.ExpiredSignatureError:
        print(f"❌ Token expired for verification")
        raise HTTPException(status_code=400, detail="Verification token has expired")
    except jwt.JWTError as e:
        print(f"❌ JWT decode error: {e}")
        raise HTTPException(status_code=400, detail="Invalid verification token")
    except Exception as e:
        print(f"❌ Unexpected error in email verification: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/resend-verification")
async def resend_verification_email(request: ResendVerificationRequest, background_tasks: BackgroundTasks):
    """Resend the verification email for a user account"""
    try:
        email = request.email
        
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cursor, conn):
            # Autocommit is enabled at connection creation time

            # Check if user exists and is not verified
            cursor.execute("""
                SELECT id, verified, verification_token 
                FROM user_profiles 
                WHERE email = %s
            """, (email,))
            
            user = cursor.fetchone()
            
            if not user:
                raise HTTPException(status_code=404, detail="Account not found")
            
            user_id, verified, existing_token = user
            
            if verified:
                raise HTTPException(status_code=400, detail="Account is already verified")
            
            # Generate a new verification token if needed
            if not existing_token:
                verification_token = jwt.encode({
                    'email': email,
                    'exp': datetime.utcnow() + timedelta(hours=24)
                }, JWT_SECRET, algorithm=JWT_ALGORITHM)
                
                cursor.execute("""
                    UPDATE user_profiles
                    SET verification_token = %s
                    WHERE id = %s
                """, (verification_token, user_id))
            else:
                verification_token = existing_token
        
        # Send verification email in background
        background_tasks.add_task(send_verification_email, email, verification_token)
        
        return {"message": "Verification email sent successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Resend verification error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/login")
async def login(user_data: UserLogin):
    try:
        with get_db_cursor(dict_cursor=False, autocommit=True) as (cursor, conn):
            # Autocommit is enabled at connection creation time
            
            logger.info("DB connection established")
            logger.info("Cursor created")

            # Updated query to include verified status and walkthrough progress
            cursor.execute("""
                SELECT
                    id,
                    email,
                    name,
                    hashed_password,
                    profile_complete,
                    has_preferences,
                    has_generated_menu,
                    has_shopping_list,
                    verified,
                    account_type,
                    COALESCE(walkthrough_preferences_completed, FALSE) as walkthrough_preferences_completed,
                    COALESCE(walkthrough_menu_completed, FALSE) as walkthrough_menu_completed,
                    COALESCE(walkthrough_recipe_browser_completed, FALSE) as walkthrough_recipe_browser_completed,
                    COALESCE(walkthrough_shopping_completed, FALSE) as walkthrough_shopping_completed,
                    COALESCE(walkthrough_completed, FALSE) as walkthrough_completed
                FROM user_profiles
                WHERE email = %s
            """, (user_data.email,))

            logger.info("Query executed, checking results")

            user = cursor.fetchone()

            logger.info(f"User found: {bool(user)}")

            if not user:
                raise HTTPException(
                    status_code=401,
                    detail="Invalid email or password"
                )

            # Unpack user data (added verified and walkthrough progress)
            user_id, email, name, stored_hash, profile_complete, has_prefs, has_menu, has_list, verified, account_type, walkthrough_prefs, walkthrough_menu, walkthrough_browser, walkthrough_shopping, walkthrough_complete = user

            # Check if email is verified
            if not verified:
                raise HTTPException(
                    status_code=401,
                    detail="Please verify your email before logging in"
                )

            logger.info("Verifying password")

            # Verify password
            if not bcrypt.checkpw(user_data.password.encode('utf-8'), stored_hash.encode('utf-8')):
                raise HTTPException(
                    status_code=401,
                    detail="Invalid email or password"
                )

            # Update last login timestamp
            cursor.execute("""
                UPDATE user_profiles
                SET last_login = CURRENT_TIMESTAMP
                WHERE id = %s
            """, (user_id,))

        logger.info("Generating token")

        # Generate JWT token
        token_payload = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "profile_complete": profile_complete,
            "account_type": account_type,
            "exp": datetime.utcnow() + timedelta(hours=12)
        }

        token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

        logger.info("Token generated, returning response")

        # Return successful response
        return {
            "access_token": token,
            "profile_complete": profile_complete,
            "account_type": account_type,
            "progress": {
                "has_preferences": has_prefs,
                "has_generated_menu": has_menu,
                "has_shopping_list": has_list
            },
            "walkthrough": {
                "walkthrough_preferences_completed": walkthrough_prefs,
                "walkthrough_menu_completed": walkthrough_menu,
                "walkthrough_recipe_browser_completed": walkthrough_browser,
                "walkthrough_shopping_completed": walkthrough_shopping,
                "walkthrough_completed": walkthrough_complete
            },
            "user": {
                "id": user_id,
                "email": email,
                "name": name
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Login error: {str(e)}")  # Add logging
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )

@router.get("/account-info")
@router.post("/account-info") 
async def get_account_info(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """
    Get the current user's account information.
    This endpoint supports both GET and POST methods.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cursor, conn):
            # Autocommit is enabled at connection creation time
            
            # Get user details from database including walkthrough progress
            cursor.execute("""
                SELECT 
                    id, 
                    email, 
                    name, 
                    profile_complete, 
                    account_type, 
                    created_at,
                    has_preferences, 
                    has_generated_menu, 
                    has_shopping_list,
                    COALESCE(walkthrough_preferences_completed, FALSE) as walkthrough_preferences_completed,
                    COALESCE(walkthrough_menu_completed, FALSE) as walkthrough_menu_completed,
                    COALESCE(walkthrough_recipe_browser_completed, FALSE) as walkthrough_recipe_browser_completed,
                    COALESCE(walkthrough_shopping_completed, FALSE) as walkthrough_shopping_completed,
                    COALESCE(walkthrough_completed, FALSE) as walkthrough_completed
                FROM user_profiles 
                WHERE id = %s
            """, (current_user["user_id"],))
            
            user_data = cursor.fetchone()
            
            if not user_data:
                raise HTTPException(status_code=404, detail="User not found")
            
            # Convert to dictionary if needed
            if not isinstance(user_data, dict):
                user_data = dict(user_data)
            
            # Get organization information if applicable
            org_id = current_user.get('organization_id')
            is_organization_owner = False
            
            if org_id:
                # Check if user is an organization owner
                cursor.execute("""
                    SELECT id, name, owner_id FROM organizations 
                    WHERE id = %s
                """, (org_id,))
                
                org_data = cursor.fetchone()
                
                if org_data and org_data['owner_id'] == current_user["user_id"]:
                    is_organization_owner = True
                    
                    # Get organization details
                    user_data["organization"] = {
                        "id": org_data["id"],
                        "name": org_data["name"]
                    }
            
            # Update data with token information
            user_data.update({
                "is_organization": is_organization_owner,
                "organization_id": org_id,
                "role": current_user.get("role")
            })
            
            # Include JWT claims data for debugging
            user_data["token_data"] = {k: v for k, v in current_user.items() 
                                     if k not in ["organization_id", "role", "is_admin"]}
            
            return user_data
        
    except Exception as e:
        logger.error(f"Error retrieving account info: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")

@router.get("/me")
@router.post("/me")
async def get_current_user(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """
    Simple endpoint to get current user info from token.
    This endpoint supports both GET and POST methods.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    # Just return user info from the token
    return {
        "id": current_user.get("user_id"),
        "email": current_user.get("email"),
        "name": current_user.get("name"),
        "account_type": current_user.get("account_type"),
        "is_organization": current_user.get("role") == "owner" or current_user.get("account_type") == "organization",
        "organization_id": current_user.get("organization_id"),
        "role": current_user.get("role"),
        "token_data": current_user
    }

@router.patch("/{user_id}/progress")
async def update_user_progress(user_id: int, progress: UserProgress):
    """Update user progress flags in the database"""
    try:
        with get_db_cursor(dict_cursor=False) as (cursor, conn):
            # Build dynamic update query
            update_fields = []
            params = []
            
            # Handle basic progress flags
            if progress.has_preferences is not None:
                update_fields.append("has_preferences = %s")
                params.append(progress.has_preferences)
            if progress.has_generated_menu is not None:
                update_fields.append("has_generated_menu = %s")
                params.append(progress.has_generated_menu)
            if progress.has_shopping_list is not None:
                update_fields.append("has_shopping_list = %s")
                params.append(progress.has_shopping_list)
            
            # Handle walkthrough progress flags
            if progress.walkthrough_preferences_completed is not None:
                update_fields.append("walkthrough_preferences_completed = %s")
                params.append(progress.walkthrough_preferences_completed)
            if progress.walkthrough_menu_completed is not None:
                update_fields.append("walkthrough_menu_completed = %s")
                params.append(progress.walkthrough_menu_completed)
            if progress.walkthrough_recipe_browser_completed is not None:
                update_fields.append("walkthrough_recipe_browser_completed = %s")
                params.append(progress.walkthrough_recipe_browser_completed)
            if progress.walkthrough_shopping_completed is not None:
                update_fields.append("walkthrough_shopping_completed = %s")
                params.append(progress.walkthrough_shopping_completed)
            if progress.walkthrough_completed is not None:
                update_fields.append("walkthrough_completed = %s")
                params.append(progress.walkthrough_completed)
                # Set completion timestamp if walkthrough is being marked complete
                if progress.walkthrough_completed:
                    update_fields.append("walkthrough_completed_at = CURRENT_TIMESTAMP")
            
            # Set walkthrough_started_at if any walkthrough field is being set for the first time
            if any([progress.walkthrough_preferences_completed, progress.walkthrough_menu_completed, 
                   progress.walkthrough_recipe_browser_completed, progress.walkthrough_shopping_completed]):
                update_fields.append("walkthrough_started_at = COALESCE(walkthrough_started_at, CURRENT_TIMESTAMP)")
            
            if not update_fields:
                return {"status": "success", "message": "No fields to update"}
            
            # Build and execute query
            query = f"""
                UPDATE user_profiles 
                SET {', '.join(update_fields)}
                WHERE id = %s
                RETURNING id
            """
            params.append(user_id)
            
            cursor.execute(query, params)
            conn.commit()

            if cursor.rowcount == 0:
                raise HTTPException(status_code=404, detail="User not found")

            return {"status": "success", "message": "User progress updated"}

    except Exception as e:
        logger.error(f"Error updating user progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user progress")

@router.put("/progress")
async def update_current_user_progress(progress: UserProgress, current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """Update current user's progress flags"""
    try:
        user_id = current_user.get("user_id")
        if not user_id:
            raise HTTPException(status_code=400, detail="User ID not found in token")
        
        # Reuse the existing logic
        return await update_user_progress(user_id, progress)
    except Exception as e:
        logger.error(f"Error updating current user progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user progress")

@router.post("/forgot-password")
async def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks):
    """Send a password reset email to the user"""
    try:
        email = request.email
        
        with get_db_cursor(dict_cursor=False) as (cursor, conn):
            # Check if user exists
            cursor.execute("""
                SELECT id, name, verified
                FROM user_profiles 
                WHERE email = %s
            """, (email,))
            
            user = cursor.fetchone()
            
            if not user:
                # Return success even if email doesn't exist (security best practice)
                return {"message": "If an account with that email exists, we've sent a password reset link."}
            
            user_id, name, verified = user
            
            if not verified:
                raise HTTPException(status_code=400, detail="Please verify your email before resetting your password")
            
            # Generate password reset token
            reset_token = jwt.encode({
                'user_id': user_id,
                'email': email,
                'type': 'password_reset',
                'exp': datetime.utcnow() + timedelta(hours=1)  # Token expires in 1 hour
            }, JWT_SECRET, algorithm=JWT_ALGORITHM)
            
            # Store reset token in database
            cursor.execute("""
                UPDATE user_profiles
                SET reset_password_token = %s
                WHERE id = %s
            """, (reset_token, user_id))
            conn.commit()
        
        # Send password reset email in background
        background_tasks.add_task(send_password_reset_email, email, name, reset_token)
        
        return {"message": "If an account with that email exists, we've sent a password reset link."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Forgot password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

@router.post("/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset user password using reset token"""
    try:
        reset_token = request.reset_token
        new_password = request.new_password
        
        # Verify and decode the reset token
        try:
            payload = jwt.decode(reset_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get('user_id')
            email = payload.get('email')
            token_type = payload.get('type')
            
            if token_type != 'password_reset':
                raise HTTPException(status_code=400, detail="Invalid reset token")
                
        except jwt.ExpiredSignatureError:
            raise HTTPException(status_code=400, detail="Reset token has expired")
        except jwt.JWTError:
            raise HTTPException(status_code=400, detail="Invalid reset token")
        
        with get_db_cursor(dict_cursor=False) as (cursor, conn):
            # Verify token exists in database and user exists
            cursor.execute("""
                SELECT id, reset_password_token
                FROM user_profiles 
                WHERE id = %s AND email = %s
            """, (user_id, email))
            
            user = cursor.fetchone()
            
            if not user or user[1] != reset_token:
                raise HTTPException(status_code=400, detail="Invalid or expired reset token")
            
            # Hash new password
            hashed_password = bcrypt.hashpw(new_password.encode('utf-8'), bcrypt.gensalt())
            
            # Update password and clear reset token
            cursor.execute("""
                UPDATE user_profiles
                SET hashed_password = %s, reset_password_token = NULL
                WHERE id = %s
            """, (hashed_password.decode('utf-8'), user_id))
            
            conn.commit()
        
        return {"message": "Password reset successful. You can now log in with your new password."}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Reset password error: {str(e)}")
        raise HTTPException(status_code=500, detail="Internal server error")

async def send_password_reset_email(email: str, name: str, reset_token: str):
    """Send password reset email to user"""
    try:
        reset_link = f"{FRONTEND_URL}/reset-password?token={reset_token}"
        
        msg = MIMEText(f"""
        Hi {name},
        
        We received a request to reset your password for your Smart Meal Planner account.
        
        Click the link below to reset your password:
        {reset_link}
        
        This link will expire in 1 hour for security reasons.
        
        If you didn't request this password reset, please ignore this email.
        Your password will not be changed unless you click the link above.
        
        Best regards,
        Smart Meal Planner Team
        """)
        
        msg['Subject'] = 'Reset your Smart Meal Planner password'
        msg['From'] = SMTP_USERNAME
        msg['To'] = email
        
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            
    except Exception as e:
        logger.error(f"Error sending password reset email: {str(e)}")
        raise

# User Management Endpoints
@router.get("/user-management/admin/permissions")
async def admin_permissions(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """Get admin user management permissions"""
    if current_user.get('account_type') != 'admin':
        return {
            "can_pause_users": False,
            "can_delete_users": False,
            "can_restore_users": False,
            "can_view_all_users": False,
            "can_manage_org_users": False,
            "is_system_admin": False
        }
    
    return {
        "can_pause_users": True,
        "can_delete_users": True,
        "can_restore_users": True,
        "can_view_all_users": True,
        "can_manage_org_users": True,
        "is_system_admin": True
    }

@router.get("/user-management/org/permissions")
async def org_permissions(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """Get organization user management permissions"""
    if current_user.get('account_type') != 'organization':
        return {
            "can_pause_users": False,
            "can_delete_users": False,
            "can_restore_users": False,
            "can_view_all_users": False,
            "can_manage_org_users": False,
            "is_system_admin": False
        }
    
    return {
        "can_pause_users": True,
        "can_delete_users": True,
        "can_restore_users": True,
        "can_view_all_users": False,
        "can_manage_org_users": True,
        "is_system_admin": False
    }

@router.get("/user-management/admin/users")
async def list_all_users(
    limit: int = 25,
    offset: int = 0,
    search_query: str = None,
    role: str = None,
    is_active: bool = None,
    is_paused: bool = None,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """List all users (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Build query conditions
            conditions = []
            params = []
            
            if search_query:
                conditions.append("(up.name ILIKE %s OR up.email ILIKE %s)")
                params.extend([f"%{search_query}%", f"%{search_query}%"])
            
            if role:
                conditions.append("up.account_type = %s")
                params.append(role)
            
            if is_active is not None:
                conditions.append("up.is_active = %s")
                params.append(is_active)
            
            if is_paused is not None:
                if is_paused:
                    conditions.append("up.paused_at IS NOT NULL")
                else:
                    conditions.append("up.paused_at IS NULL")
            
            where_clause = "WHERE " + " AND ".join(conditions) if conditions else ""
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*) 
                FROM user_profiles up
                LEFT JOIN organizations o ON up.organization_id = o.id
                {where_clause}
            """
            cur.execute(count_query, params)
            total_count = cur.fetchone()['count']
            
            # Get users with pagination
            query = f"""
                SELECT 
                    up.id,
                    up.name,
                    up.email,
                    up.account_type as role,
                    up.is_active,
                    up.paused_at,
                    up.pause_reason,
                    up.created_at,
                    o.name as organization_name
                FROM user_profiles up
                LEFT JOIN organizations o ON up.organization_id = o.id
                {where_clause}
                ORDER BY up.created_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, params)
            users = cur.fetchall()
            
            return {
                "users": [dict(user) for user in users],
                "total_count": total_count
            }
    
    except Exception as e:
        logger.error(f"Error listing users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching users")

@router.get("/user-management/org/users")
async def list_org_users(
    limit: int = 25,
    offset: int = 0,
    search_query: str = None,
    role: str = None,
    is_active: bool = None,
    is_paused: bool = None,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """List organization users (organization owners only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Build query conditions
            conditions = ["oc.organization_id = %s"]
            params = [org_id]
            
            if search_query:
                conditions.append("(up.name ILIKE %s OR up.email ILIKE %s)")
                params.extend([f"%{search_query}%", f"%{search_query}%"])
            
            if role:
                conditions.append("oc.role = %s")
                params.append(role)
            
            if is_active is not None:
                conditions.append("up.is_active = %s")
                params.append(is_active)
            
            if is_paused is not None:
                if is_paused:
                    conditions.append("up.paused_at IS NOT NULL")
                else:
                    conditions.append("up.paused_at IS NULL")
            
            where_clause = "WHERE " + " AND ".join(conditions)
            
            # Get total count
            count_query = f"""
                SELECT COUNT(*) 
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                {where_clause}
            """
            cur.execute(count_query, params)
            total_count = cur.fetchone()['count']
            
            # Get users with pagination
            query = f"""
                SELECT 
                    up.id,
                    up.name,
                    up.email,
                    oc.role,
                    up.is_active,
                    up.paused_at,
                    up.pause_reason,
                    up.created_at,
                    o.name as organization_name
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                JOIN organizations o ON oc.organization_id = o.id
                {where_clause}
                ORDER BY up.created_at DESC
                LIMIT %s OFFSET %s
            """
            params.extend([limit, offset])
            cur.execute(query, params)
            users = cur.fetchall()
            
            return {
                "users": [dict(user) for user in users],
                "total_count": total_count
            }
    
    except Exception as e:
        logger.error(f"Error listing organization users: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching organization users")

@router.post("/user-management/admin/users/{user_id}/pause")
async def pause_user_admin(
    user_id: int,
    action: str,
    reason: str = None,
    send_notification: bool = False,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Pause a user (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NOW(), 
                    paused_by = %s, 
                    pause_reason = %s
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, email
            """, (current_user['user_id'], reason, user_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found or already inactive")
            
            # Log action
            cur.execute("""
                INSERT INTO user_management_logs 
                (user_id, action, performed_by, reason, performed_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (user_id, 'paused', current_user['user_id'], reason))
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been paused"}
    
    except Exception as e:
        logger.error(f"Error pausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error pausing user")

@router.post("/user-management/admin/users/{user_id}/unpause")
async def unpause_user_admin(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Unpause a user (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NULL, 
                    paused_by = NULL, 
                    pause_reason = NULL
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, email
            """, (user_id,))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found or inactive")
            
            # Log action
            cur.execute("""
                INSERT INTO user_management_logs 
                (user_id, action, performed_by, performed_at)
                VALUES (%s, %s, %s, NOW())
            """, (user_id, 'unpaused', current_user['user_id']))
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been unpaused"}
    
    except Exception as e:
        logger.error(f"Error unpausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error unpausing user")

@router.delete("/user-management/admin/users/{user_id}")
async def delete_user_admin(
    user_id: int,
    action: str,
    reason: str = None,
    send_notification: bool = False,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Soft delete a user (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET is_active = FALSE, 
                    deleted_at = NOW(), 
                    deleted_by = %s
                WHERE id = %s AND is_active = TRUE
                RETURNING id, name, email
            """, (current_user['user_id'], user_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found or already deleted")
            
            # Log action
            cur.execute("""
                INSERT INTO user_management_logs 
                (user_id, action, performed_by, reason, performed_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (user_id, 'deleted', current_user['user_id'], reason))
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been deleted"}
    
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting user")

@router.get("/user-management/admin/users/{user_id}/logs")
async def get_user_logs_admin(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Get user management logs (admin only)"""
    if current_user.get('account_type') != 'admin':
        raise HTTPException(status_code=403, detail="Admin access required")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            cur.execute("""
                SELECT 
                    uml.id,
                    uml.action,
                    uml.reason,
                    uml.performed_at,
                    up.name as performed_by
                FROM user_management_logs uml
                JOIN user_profiles up ON uml.performed_by = up.id
                WHERE uml.user_id = %s
                ORDER BY uml.performed_at DESC
            """, (user_id,))
            
            logs = cur.fetchall()
            return [dict(log) for log in logs]
    
    except Exception as e:
        logger.error(f"Error fetching user logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching user logs")

# Organization endpoints (simplified versions)
@router.post("/user-management/org/users/{user_id}/pause")
async def pause_user_org(
    user_id: int,
    action: str,
    reason: str = None,
    send_notification: bool = False,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Pause a user (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT up.id, up.name, up.email
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s AND oc.organization_id = %s AND up.is_active = TRUE
            """, (user_id, org_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NOW(), 
                    paused_by = %s, 
                    pause_reason = %s
                WHERE id = %s
            """, (current_user['user_id'], reason, user_id))
            
            # Log action
            cur.execute("""
                INSERT INTO user_management_logs 
                (user_id, action, performed_by, reason, performed_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (user_id, 'paused', current_user['user_id'], reason))
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been paused"}
    
    except Exception as e:
        logger.error(f"Error pausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error pausing user")

@router.post("/user-management/org/users/{user_id}/unpause")
async def unpause_user_org(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Unpause a user (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT up.id, up.name, up.email
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s AND oc.organization_id = %s AND up.is_active = TRUE
            """, (user_id, org_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET paused_at = NULL, 
                    paused_by = NULL, 
                    pause_reason = NULL
                WHERE id = %s
            """, (user_id,))
            
            # Log action
            cur.execute("""
                INSERT INTO user_management_logs 
                (user_id, action, performed_by, performed_at)
                VALUES (%s, %s, %s, NOW())
            """, (user_id, 'unpaused', current_user['user_id']))
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been unpaused"}
    
    except Exception as e:
        logger.error(f"Error unpausing user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error unpausing user")

@router.delete("/user-management/org/users/{user_id}")
async def delete_user_org(
    user_id: int,
    action: str,
    reason: str = None,
    send_notification: bool = False,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Soft delete a user (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT up.id, up.name, up.email
                FROM user_profiles up
                JOIN organization_clients oc ON up.id = oc.client_id
                WHERE up.id = %s AND oc.organization_id = %s AND up.is_active = TRUE
            """, (user_id, org_id))
            
            user = cur.fetchone()
            if not user:
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            # Update user
            cur.execute("""
                UPDATE user_profiles 
                SET is_active = FALSE, 
                    deleted_at = NOW(), 
                    deleted_by = %s
                WHERE id = %s
            """, (current_user['user_id'], user_id))
            
            # Log action
            cur.execute("""
                INSERT INTO user_management_logs 
                (user_id, action, performed_by, reason, performed_at)
                VALUES (%s, %s, %s, %s, NOW())
            """, (user_id, 'deleted', current_user['user_id'], reason))
            
            conn.commit()
            return {"status": "success", "message": f"User {user['name']} has been deleted"}
    
    except Exception as e:
        logger.error(f"Error deleting user: {str(e)}")
        raise HTTPException(status_code=500, detail="Error deleting user")

@router.get("/user-management/org/users/{user_id}/logs")
async def get_user_logs_org(
    user_id: int,
    current_user: Dict[str, Any] = Depends(get_user_from_token)
):
    """Get user management logs (organization only)"""
    if current_user.get('account_type') != 'organization':
        raise HTTPException(status_code=403, detail="Organization access required")
    
    org_id = current_user.get('organization_id')
    if not org_id:
        raise HTTPException(status_code=400, detail="User not associated with an organization")
    
    try:
        with get_db_cursor(dict_cursor=True) as (cur, conn):
            # Check if user belongs to organization
            cur.execute("""
                SELECT 1
                FROM organization_clients oc
                WHERE oc.client_id = %s AND oc.organization_id = %s
            """, (user_id, org_id))
            
            if not cur.fetchone():
                raise HTTPException(status_code=404, detail="User not found in your organization")
            
            cur.execute("""
                SELECT 
                    uml.id,
                    uml.action,
                    uml.reason,
                    uml.performed_at,
                    up.name as performed_by
                FROM user_management_logs uml
                JOIN user_profiles up ON uml.performed_by = up.id
                WHERE uml.user_id = %s
                ORDER BY uml.performed_at DESC
            """, (user_id,))
            
            logs = cur.fetchall()
            return [dict(log) for log in logs]
    
    except Exception as e:
        logger.error(f"Error fetching user logs: {str(e)}")
        raise HTTPException(status_code=500, detail="Error fetching user logs")

