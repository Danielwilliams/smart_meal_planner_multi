#!/usr/bin/env python3
"""
Direct database connection to add reset_password_token column
Uses psycopg2-binary which should be available
"""
import os
import sys

# Try to import psycopg2
try:
    import psycopg2
except ImportError:
    print("psycopg2 not available, trying psycopg2-binary...")
    try:
        import psycopg2
    except ImportError:
        print("Neither psycopg2 nor psycopg2-binary available. Please install one.")
        sys.exit(1)

def add_reset_password_token_column():
    """Add reset_password_token column directly to production database"""
    
    # For Railway deployment, the database URL should be set in environment
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ DATABASE_URL environment variable not set")
        return False
    
    try:
        print(f"🔗 Connecting to database...")
        conn = psycopg2.connect(database_url)
        
        with conn.cursor() as cursor:
            print("📋 Checking if reset_password_token column already exists...")
            
            # Check if column already exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles' AND column_name = 'reset_password_token'
            """)
            
            existing = cursor.fetchone()
            
            if existing:
                print("✅ Column 'reset_password_token' already exists")
                return True
            
            print("➕ Adding reset_password_token column...")
            
            # Add the column
            cursor.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN reset_password_token TEXT;
            """)
            
            print("📊 Creating index for performance...")
            
            # Add index for performance
            cursor.execute("""
                CREATE INDEX idx_user_profiles_reset_token 
                ON user_profiles(reset_password_token) 
                WHERE reset_password_token IS NOT NULL;
            """)
            
            conn.commit()
            print("✅ Successfully added reset_password_token column and index")
            
            # Verify the column was added
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles' AND column_name = 'reset_password_token'
            """)
            
            result = cursor.fetchone()
            if result:
                print(f"✅ Verified: Column '{result[0]}' exists with type '{result[1]}'")
                return True
            else:
                print("❌ Warning: Column was not found after creation")
                return False
            
    except Exception as e:
        print(f"❌ Error: {e}")
        if 'conn' in locals():
            conn.rollback()
        return False
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    success = add_reset_password_token_column()
    sys.exit(0 if success else 1)