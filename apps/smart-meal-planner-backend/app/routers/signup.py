# app/routers/auth.py
import requests
from fastapi import APIRouter, HTTPException
from app.config import RECAPTCHA_SECRET_KEY

router = APIRouter()

@router.post("/signup")
async def sign_up(user_data: UserSignUp, background_tasks: BackgroundTasks):
    conn = None
    cursor = None
    try:
        # Verify reCAPTCHA code...

        conn = get_db_connection()
        cursor = conn.cursor()

        # Check if email exists
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

        # Insert new user
        cursor.execute("""
            INSERT INTO user_profiles 
            (email, name, hashed_password, verified, verification_token) 
            VALUES (%s, %s, %s, %s, %s)
            RETURNING id
        """, (
            user_data.email, 
            user_data.name, 
            hashed_password.decode('utf-8'),
            False,
            verification_token
        ))

        conn.commit()

        # Send verification email
        verification_link = f"{FRONTEND_URL}/verify-email?token={verification_token}"
        email_content = f"""
        Welcome to Smart Meal Planner!
        
        Please click the button below to verify your email address:
        
        {verification_link}
        
        This link will expire in 24 hours.
        
        If you didn't create this account, please ignore this email.
        """

        msg = MIMEText(email_content)
        msg['Subject'] = 'Verify your Smart Meal Planner account'
        msg['From'] = SMTP_USERNAME
        msg['To'] = user_data.email

        # Send email in background
        background_tasks.add_task(
            send_verification_email,
            msg
        )

        return {
            "message": "Registration successful! Please check your email to verify your account.",
            "email": user_data.email
        }

    except HTTPException:
        raise
    except Exception as e:
        print(f"Signup error: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        if cursor:
            cursor.close()
        if conn:
            conn.close()

async def send_verification_email(msg):
    try:
        with smtplib.SMTP(SMTP_SERVER, SMTP_PORT) as server:
            server.starttls()
            server.login(SMTP_USERNAME, SMTP_PASSWORD)
            server.send_message(msg)
            print(f"Verification email sent to {msg['To']}")
    except Exception as e:
        print(f"Error sending verification email: {str(e)}")
        raise
