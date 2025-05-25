"""
Migration: Add reset_password_token column to user_profiles table

This migration adds the reset_password_token column to support
forgot password functionality with JWT tokens.
"""

from app.db import get_db_connection
import logging

logger = logging.getLogger(__name__)

def upgrade():
    """Add reset_password_token column to user_profiles table."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            logger.info("Adding reset_password_token column to user_profiles table...")
            
            # Add the reset_password_token column
            cursor.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN IF NOT EXISTS reset_password_token TEXT;
            """)
            
            # Add index for performance on reset_password_token lookups
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_reset_token 
                ON user_profiles(reset_password_token) 
                WHERE reset_password_token IS NOT NULL;
            """)
            
            conn.commit()
            logger.info("✅ Successfully added reset_password_token column and index")
            
    except Exception as e:
        logger.error(f"❌ Failed to add reset_password_token column: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

def downgrade():
    """Remove reset_password_token column from user_profiles table."""
    conn = get_db_connection()
    try:
        with conn.cursor() as cursor:
            logger.info("Removing reset_password_token column from user_profiles table...")
            
            # Drop the index first
            cursor.execute("""
                DROP INDEX IF EXISTS idx_user_profiles_reset_token;
            """)
            
            # Drop the column
            cursor.execute("""
                ALTER TABLE user_profiles 
                DROP COLUMN IF EXISTS reset_password_token;
            """)
            
            conn.commit()
            logger.info("✅ Successfully removed reset_password_token column and index")
            
    except Exception as e:
        logger.error(f"❌ Failed to remove reset_password_token column: {e}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    # Allow running this migration directly
    upgrade()