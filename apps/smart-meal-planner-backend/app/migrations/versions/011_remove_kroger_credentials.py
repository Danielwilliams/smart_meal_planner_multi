"""
Migration: Remove Kroger Credentials
ID: 011_remove_kroger_credentials
Created: 2025
Description: Remove unused Kroger username and password fields from the database
"""

import os
import sys
import logging
from psycopg2.extras import RealDictCursor

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.db import get_db_connection

logger = logging.getLogger(__name__)

def upgrade():
    """Apply the migration - remove unused Kroger credential fields."""
    conn = get_db_connection()
    try:
        logger.info("Starting migration to remove Kroger credential fields...")
        
        # Count how many users have these fields filled
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT 
                    COUNT(*) as total_users,
                    COUNT(kroger_username) as users_with_username,
                    COUNT(kroger_password) as users_with_plaintext_password,
                    COUNT(kroger_password_hash) as users_with_hashed_password,
                    COUNT(kroger_password_salt) as users_with_salt
                FROM user_profiles;
            """)
            stats = cur.fetchone()
            
            logger.info(f"Database stats before migration:")
            logger.info(f"  Total users: {stats['total_users']}")
            logger.info(f"  Users with Kroger username: {stats['users_with_username']}")
            logger.info(f"  Users with plaintext password: {stats['users_with_plaintext_password']}")
            logger.info(f"  Users with hashed password: {stats['users_with_hashed_password']}")
            logger.info(f"  Users with password salt: {stats['users_with_salt']}")
        
        # Drop the columns
        with conn.cursor() as cur:
            # Check if columns exist first
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles' 
                AND table_schema = 'public'
                AND column_name IN ('kroger_username', 'kroger_password', 'kroger_password_hash', 'kroger_password_salt');
            """)
            existing_columns = [row[0] for row in cur.fetchall()]
            
            if 'kroger_username' in existing_columns:
                logger.info("Removing kroger_username column...")
                cur.execute("ALTER TABLE user_profiles DROP COLUMN kroger_username;")
                
            if 'kroger_password' in existing_columns:
                logger.info("Removing kroger_password column...")
                cur.execute("ALTER TABLE user_profiles DROP COLUMN kroger_password;")
                
            if 'kroger_password_hash' in existing_columns:
                logger.info("Removing kroger_password_hash column...")
                cur.execute("ALTER TABLE user_profiles DROP COLUMN kroger_password_hash;")
                
            if 'kroger_password_salt' in existing_columns:
                logger.info("Removing kroger_password_salt column...")
                cur.execute("ALTER TABLE user_profiles DROP COLUMN kroger_password_salt;")
            
            # Also drop any related indexes
            cur.execute("""
                SELECT indexname 
                FROM pg_indexes 
                WHERE tablename = 'user_profiles' 
                AND indexname LIKE '%kroger_password%';
            """)
            indexes = [row[0] for row in cur.fetchall()]
            
            for index in indexes:
                logger.info(f"Dropping index {index}...")
                cur.execute(f"DROP INDEX IF EXISTS {index};")
                
        conn.commit()
        logger.info("Migration completed successfully - Kroger credential fields removed")
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

def downgrade():
    """Rollback the migration - add back Kroger credential fields."""
    logger.warning("Downgrade requested for Kroger credentials removal migration")
    logger.warning("This will add back the credential fields")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Check if columns don't exist
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles' 
                AND table_schema = 'public'
                AND column_name IN ('kroger_username', 'kroger_password', 'kroger_password_hash', 'kroger_password_salt');
            """)
            existing_columns = [row[0] for row in cur.fetchall()]
            
            if 'kroger_username' not in existing_columns:
                logger.info("Adding back kroger_username column...")
                cur.execute("ALTER TABLE user_profiles ADD COLUMN kroger_username VARCHAR(255);")
                
            if 'kroger_password' not in existing_columns:
                logger.info("Adding back kroger_password column...")
                cur.execute("ALTER TABLE user_profiles ADD COLUMN kroger_password VARCHAR(255);")
                
            if 'kroger_password_hash' not in existing_columns:
                logger.info("Adding back kroger_password_hash column...")
                cur.execute("ALTER TABLE user_profiles ADD COLUMN kroger_password_hash VARCHAR(255);")
                
            if 'kroger_password_salt' not in existing_columns:
                logger.info("Adding back kroger_password_salt column...")
                cur.execute("ALTER TABLE user_profiles ADD COLUMN kroger_password_salt VARCHAR(255);")
            
            # Recreate the index
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_kroger_password_hash 
                ON user_profiles(kroger_password_hash) 
                WHERE kroger_password_hash IS NOT NULL;
            """)
            
        conn.commit()
        logger.warning("Downgrade completed - Kroger credential fields added back (but empty)")
        
    except Exception as e:
        logger.error(f"Downgrade failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    # Allow running this migration directly for testing
    logging.basicConfig(level=logging.INFO)
    upgrade()