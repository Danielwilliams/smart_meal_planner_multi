# app/routers/auth.py
from fastapi import APIRouter, HTTPException, Depends, BackgroundTasks
from datetime import datetime, timedelta
from ..models.user import UserSignUp, UserLogin, ForgotPasswordRequest, ResetPasswordRequest, UserProgress
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
            (email, name, hashed_password, verified, verification_token,  account_type)
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
        user_id, email, name, stored_hash, profile_complete, has_prefs, has_menu, has_list, verified, account_type = user
        
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
        conn.close()

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

@router.post("/login")
async def login(user_data: UserLogin):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
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
        
        user = cursor.fetchone()
        
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
        conn.close()

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

