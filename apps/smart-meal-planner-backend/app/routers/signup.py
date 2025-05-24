# app/routers/auth.py
import requests
from fastapi import APIRouter, HTTPException
from app.config import RECAPTCHA_SECRET_KEY

router = APIRouter()


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
