#!/usr/bin/env python3
"""
Test script to debug email verification issues
"""
import jwt
import psycopg2
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# JWT Configuration
JWT_SECRET = os.getenv('JWT_SECRET', 'fallback-secret-key')
JWT_ALGORITHM = "HS256"

def get_db_connection():
    """Get database connection"""
    DATABASE_URL = os.getenv('DATABASE_URL', 'postgresql://postgres:password@localhost:5432/smart_meal_planner')
    return psycopg2.connect(DATABASE_URL)

def test_verification_tokens():
    """Test the verification token logic"""
    print("Testing email verification tokens...")
    
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        
        # Get users with verification tokens but not verified
        cursor.execute("""
            SELECT id, email, verification_token, verified
            FROM user_profiles 
            WHERE verification_token IS NOT NULL AND verified = false
            LIMIT 5
        """)
        
        users = cursor.fetchall()
        
        print(f"Found {len(users)} unverified users with tokens")
        
        for user_id, email, stored_token, verified in users:
            print(f"\n--- User: {email} ---")
            print(f"User ID: {user_id}")
            print(f"Verified: {verified}")
            print(f"Stored token length: {len(stored_token) if stored_token else 0}")
            
            if stored_token:
                try:
                    # Try to decode the stored token
                    payload = jwt.decode(stored_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    token_email = payload.get('email')
                    token_exp = payload.get('exp')
                    
                    print(f"Token email: {token_email}")
                    print(f"Token matches user email: {token_email == email}")
                    
                    if token_exp:
                        exp_time = datetime.fromtimestamp(token_exp)
                        is_expired = datetime.utcnow() > exp_time
                        print(f"Token expires: {exp_time}")
                        print(f"Token expired: {is_expired}")
                    
                    # Test the current verification logic
                    print(f"\n--- Testing current verification logic ---")
                    
                    # This is what the current endpoint does:
                    cursor.execute("""
                        SELECT id FROM user_profiles
                        WHERE email = %s AND verification_token = %s
                    """, (token_email, stored_token))
                    
                    result = cursor.fetchone()
                    print(f"Current logic would find user: {result is not None}")
                    
                except jwt.ExpiredSignatureError:
                    print("Token is expired")
                except jwt.JWTError as e:
                    print(f"Token decode error: {e}")
                except Exception as e:
                    print(f"Error processing token: {e}")
        
        cursor.close()
        conn.close()
        
    except Exception as e:
        print(f"Database error: {e}")

if __name__ == "__main__":
    test_verification_tokens()