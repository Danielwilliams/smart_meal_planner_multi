#!/usr/bin/env python3
"""
Simple script to run the reset_password_token migration
"""
import psycopg2
import os
from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

def run_migration():
    """Run the reset_password_token migration"""
    try:
        print(f"Connecting to database at {DB_HOST}:{DB_PORT}")
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        
        with conn.cursor() as cursor:
            print("Running migration to add reset_password_token column...")
            
            # Read and execute the migration SQL
            with open('add_reset_password_token.sql', 'r') as f:
                migration_sql = f.read()
            
            cursor.execute(migration_sql)
            conn.commit()
            
            print("✅ Migration completed successfully!")
            
            # Verify the column was added
            cursor.execute("""
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles' AND column_name = 'reset_password_token'
            """)
            
            result = cursor.fetchone()
            if result:
                print(f"✅ Verified: Column 'reset_password_token' exists with type '{result[1]}'")
            else:
                print("❌ Warning: Column 'reset_password_token' was not found after migration")
            
    except Exception as e:
        print(f"❌ Migration failed: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    run_migration()