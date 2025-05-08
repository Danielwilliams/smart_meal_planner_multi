# app/routers/auth.py
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks, Request
from datetime import datetime, timedelta
from ..models.user import UserSignUp, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, UserProgress, ResendVerificationRequest
from ..db import get_db_connection
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
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
            """, (user_data.organization_name, user_id))
        
        conn.commit()
        
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
    finally:
        cursor.close()


@router.get("/verify-email/{token}")
async def verify_email(token: str):
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        email = payload.get('email')
        
        if not email:
            raise HTTPException(status_code=400, detail="Invalid verification token")
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Update user verification status
        cursor.execute("""
            UPDATE user_profiles
            SET verified = true, verification_token = NULL
            WHERE email = %s AND verification_token = %s
            RETURNING id
        """, (email, token))
        
        if cursor.rowcount == 0:
            raise HTTPException(status_code=400, detail="Invalid or expired verification token")
            
        conn.commit()
        return {"message": "Email verified successfully"}
        
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=400, detail="Verification token has expired")
    except jwt.JWTError:
        raise HTTPException(status_code=400, detail="Invalid verification token")
    finally:
        cursor.close()
        conn.close()

@router.post("/resend-verification")
async def resend_verification_email(request: ResendVerificationRequest, background_tasks: BackgroundTasks):
    """Resend the verification email for a user account"""
    try:
        email = request.email
        
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
            conn.commit()
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
    finally:
        if 'cursor' in locals():
            cursor.close()
        if 'conn' in locals():
            conn.close()

@router.post("/login")
async def login(user_data: UserLogin):
    try:
        conn = get_db_connection()
        print("DB connection established")
        cursor = conn.cursor()
        print("Cursor created")
        
        # Updated query to include verified status
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
                account_type
            FROM user_profiles 
            WHERE email = %s
        """, (user_data.email,))

        print("Query executed, checking results")
        
        user = cursor.fetchone()

        print(f"User found: {bool(user)}")
        
        if not user:
            raise HTTPException(
                status_code=401,
                detail="Invalid email or password"
            )



        # Unpack user data (added verified at the end)
        user_id, email, name, stored_hash, profile_complete, has_prefs, has_menu, has_list, verified, account_type = user
        
        # Check if email is verified
        if not verified:
            raise HTTPException(
                status_code=401,
                detail="Please verify your email before logging in"
            )

        print("Verifying password")

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
        conn.commit()

        print("Generating token")

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

        print("Token generated, returning response")

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
            "user": {
                "id": user_id,
                "email": email,
                "name": name
            }
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Login error: {str(e)}")  # Add logging
        raise HTTPException(
            status_code=500,
            detail=f"Internal server error: {str(e)}"
        )
    finally:
        cursor.close()

@router.get("/account-info")
@router.post("/account-info") 
async def get_account_info(current_user: Dict[str, Any] = Depends(get_user_from_token)):
    """
    Get the current user's account information.
    This endpoint supports both GET and POST methods.
    """
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cursor:
            # Get user details from database
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
                    has_shopping_list
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
    finally:
        conn.close()

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
    conn = get_db_connection()
    try:
        cursor = conn.cursor()
        
        # Update all progress flags
        cursor.execute("""
            UPDATE user_profiles 
            SET 
                has_preferences = COALESCE(%s, has_preferences),
                has_generated_menu = COALESCE(%s, has_generated_menu),
                has_shopping_list = COALESCE(%s, has_shopping_list)
            WHERE id = %s
            RETURNING id
        """, (
            progress.has_preferences,
            progress.has_generated_menu,
            progress.has_shopping_list,
            user_id
        ))
        
        conn.commit()

        if cursor.rowcount == 0:
            raise HTTPException(status_code=404, detail="User not found")

        return {"status": "success", "message": "User progress updated"}

    except Exception as e:
        logger.error(f"Error updating user progress: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update user progress")
    finally:
        cursor.close()
        conn.close()

