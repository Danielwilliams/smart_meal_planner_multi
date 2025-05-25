"""
Migration: Hash Kroger Passwords
ID: 001_hash_kroger_passwords
Created: 2024
Description: Add columns for hashed Kroger passwords and migrate existing plain text passwords
"""

import os
import sys
import logging
from psycopg2.extras import RealDictCursor

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.db import get_db_connection
from app.utils.password_utils import hash_kroger_password, is_password_hashed

logger = logging.getLogger(__name__)

def upgrade():
    """Apply the migration - add columns and hash existing passwords."""
    conn = get_db_connection()
    try:
        logger.info("Starting Kroger password hashing migration...")
        
        # Step 1: Add new columns if they don't exist
        add_password_columns(conn)
        
        # Step 2: Hash existing plain text passwords
        hash_existing_passwords(conn)
        
        logger.info("Kroger password hashing migration completed successfully")
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

def add_password_columns(conn):
    """Add kroger_password_hash and kroger_password_salt columns."""
    with conn.cursor() as cur:
        # Check if columns already exist
        cur.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'user_profiles' 
            AND table_schema = 'public'
            AND column_name IN ('kroger_password_hash', 'kroger_password_salt');
        """)
        existing_columns = [row[0] for row in cur.fetchall()]
        
        if 'kroger_password_hash' not in existing_columns:
            logger.info("Adding kroger_password_hash column...")
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN kroger_password_hash VARCHAR(255);
            """)
            
        if 'kroger_password_salt' not in existing_columns:
            logger.info("Adding kroger_password_salt column...")
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN kroger_password_salt VARCHAR(255);
            """)
        
        # Add indexes for performance
        cur.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_profiles_kroger_password_hash 
            ON user_profiles(kroger_password_hash) 
            WHERE kroger_password_hash IS NOT NULL;
        """)
        
        # Add comments
        cur.execute("""
            COMMENT ON COLUMN user_profiles.kroger_password_hash IS 
            'Hashed Kroger password using PBKDF2-HMAC-SHA256';
        """)
        cur.execute("""
            COMMENT ON COLUMN user_profiles.kroger_password_salt IS 
            'Salt used for hashing Kroger password';
        """)
        
        conn.commit()
        logger.info("Successfully added password hash columns and indexes")

def hash_existing_passwords(conn):
    """Hash all existing plain text Kroger passwords."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        # Get users with plain text passwords that haven't been hashed yet
        cur.execute("""
            SELECT id, kroger_username, kroger_password, kroger_password_hash
            FROM user_profiles 
            WHERE kroger_password IS NOT NULL 
            AND kroger_password != ''
            AND kroger_password_hash IS NULL;
        """)
        users_to_migrate = cur.fetchall()
        
        if not users_to_migrate:
            logger.info("No plain text passwords found to migrate")
            return
        
        logger.info(f"Found {len(users_to_migrate)} users with plain text passwords to migrate")
        
        updated_count = 0
        error_count = 0
        
        for user in users_to_migrate:
            user_id = user['id']
            username = user['kroger_username']
            plain_password = user['kroger_password']
            
            try:
                # Skip if password appears to be already hashed
                if is_password_hashed(plain_password):
                    logger.warning(f"User {user_id} ({username}) password appears to be already hashed, skipping")
                    continue
                
                # Hash the password
                hashed_password, salt = hash_kroger_password(plain_password)
                
                if not hashed_password or not salt:
                    logger.error(f"Failed to hash password for user {user_id} ({username})")
                    error_count += 1
                    continue
                
                # Update the database with hashed password
                cur.execute("""
                    UPDATE user_profiles 
                    SET kroger_password_hash = %s, 
                        kroger_password_salt = %s
                    WHERE id = %s;
                """, (hashed_password, salt, user_id))
                
                updated_count += 1
                logger.info(f"Hashed password for user {user_id} ({username})")
                
            except Exception as e:
                logger.error(f"Error processing user {user_id} ({username}): {str(e)}")
                error_count += 1
                # Continue with other users rather than failing the entire migration
                continue
        
        conn.commit()
        
        logger.info(f"Password migration complete:")
        logger.info(f"  Successfully migrated: {updated_count}")
        logger.info(f"  Errors: {error_count}")
        
        if error_count > 0:
            logger.warning(f"Migration completed with {error_count} errors - check logs for details")

def downgrade():
    """Rollback the migration - remove hash columns (NOT RECOMMENDED)."""
    logger.warning("Downgrade requested for Kroger password hashing migration")
    logger.warning("This will remove password hash columns but keep plain text passwords")
    logger.warning("This is NOT RECOMMENDED for security reasons")
    
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            # Remove the hash columns (this is destructive!)
            cur.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS kroger_password_hash;")
            cur.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS kroger_password_salt;")
            
            conn.commit()
            logger.warning("Password hash columns removed - security downgraded!")
            
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