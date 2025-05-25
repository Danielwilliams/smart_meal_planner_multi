#!/usr/bin/env python3
"""
Migration script to hash existing plain text Kroger passwords in the database.

This script will:
1. Find all users with plain text Kroger passwords
2. Hash those passwords using secure password hashing
3. Add new columns for hashed password and salt
4. Update the database with hashed passwords
5. Optionally clear the plain text passwords

Usage:
    python migrate_kroger_passwords.py [--dry-run] [--clear-plaintext]
    
Options:
    --dry-run: Show what would be done without making changes
    --clear-plaintext: Clear the original plain text passwords after hashing
"""

import sys
import os
import argparse
import logging
from psycopg2.extras import RealDictCursor

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.db import get_db_connection
from app.utils.password_utils import hash_kroger_password, is_password_hashed

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def add_kroger_password_columns(conn):
    """Add new columns for hashed Kroger passwords if they don't exist."""
    with conn.cursor() as cur:
        try:
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
                
            conn.commit()
            logger.info("Successfully added new columns for hashed passwords")
            
        except Exception as e:
            logger.error(f"Error adding columns: {str(e)}")
            conn.rollback()
            raise

def get_users_with_kroger_passwords(conn):
    """Get all users that have Kroger passwords."""
    with conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute("""
            SELECT id, kroger_username, kroger_password, kroger_password_hash, kroger_password_salt
            FROM user_profiles 
            WHERE kroger_password IS NOT NULL 
            AND kroger_password != '';
        """)
        return cur.fetchall()

def hash_user_kroger_passwords(conn, users, dry_run=False, clear_plaintext=False):
    """Hash Kroger passwords for the given users."""
    
    updated_count = 0
    skipped_count = 0
    error_count = 0
    
    for user in users:
        user_id = user['id']
        username = user['kroger_username']
        plain_password = user['kroger_password']
        existing_hash = user['kroger_password_hash']
        existing_salt = user['kroger_password_salt']
        
        try:
            # Skip if password is already hashed
            if existing_hash and existing_salt:
                logger.info(f"User {user_id} ({username}) already has hashed password, skipping")
                skipped_count += 1
                continue
                
            # Skip if password appears to be already hashed
            if is_password_hashed(plain_password):
                logger.warning(f"User {user_id} ({username}) password appears to be already hashed, skipping")
                skipped_count += 1
                continue
                
            # Hash the password
            hashed_password, salt = hash_kroger_password(plain_password)
            
            if not hashed_password or not salt:
                logger.error(f"Failed to hash password for user {user_id} ({username})")
                error_count += 1
                continue
                
            if dry_run:
                logger.info(f"[DRY RUN] Would hash password for user {user_id} ({username})")
                updated_count += 1
                continue
                
            # Update the database
            with conn.cursor() as cur:
                if clear_plaintext:
                    # Clear the plain text password
                    cur.execute("""
                        UPDATE user_profiles 
                        SET kroger_password_hash = %s, 
                            kroger_password_salt = %s,
                            kroger_password = NULL
                        WHERE id = %s;
                    """, (hashed_password, salt, user_id))
                    logger.info(f"Updated and cleared plain text password for user {user_id} ({username})")
                else:
                    # Keep the plain text password for now
                    cur.execute("""
                        UPDATE user_profiles 
                        SET kroger_password_hash = %s, 
                            kroger_password_salt = %s
                        WHERE id = %s;
                    """, (hashed_password, salt, user_id))
                    logger.info(f"Updated password hash for user {user_id} ({username}), kept plain text")
                
                conn.commit()
                updated_count += 1
                
        except Exception as e:
            logger.error(f"Error processing user {user_id} ({username}): {str(e)}")
            error_count += 1
            conn.rollback()
            
    return updated_count, skipped_count, error_count

def main():
    parser = argparse.ArgumentParser(description='Migrate Kroger passwords to hashed format')
    parser.add_argument('--dry-run', action='store_true', 
                        help='Show what would be done without making changes')
    parser.add_argument('--clear-plaintext', action='store_true',
                        help='Clear plain text passwords after hashing')
    
    args = parser.parse_args()
    
    if args.dry_run:
        logger.info("Running in DRY RUN mode - no changes will be made")
    
    if args.clear_plaintext and not args.dry_run:
        logger.warning("Plain text passwords will be cleared after hashing")
        response = input("Are you sure you want to continue? (yes/no): ")
        if response.lower() != 'yes':
            logger.info("Migration cancelled")
            return
            
    try:
        # Connect to the database
        conn = get_db_connection()
        logger.info("Connected to database")
        
        # Add new columns if they don't exist
        if not args.dry_run:
            add_kroger_password_columns(conn)
        else:
            logger.info("[DRY RUN] Would add kroger_password_hash and kroger_password_salt columns")
        
        # Get users with Kroger passwords
        users = get_users_with_kroger_passwords(conn)
        logger.info(f"Found {len(users)} users with Kroger passwords")
        
        if not users:
            logger.info("No users with Kroger passwords found, nothing to migrate")
            return
            
        # Hash the passwords
        updated, skipped, errors = hash_user_kroger_passwords(
            conn, users, args.dry_run, args.clear_plaintext
        )
        
        logger.info(f"Migration complete:")
        logger.info(f"  Updated: {updated}")
        logger.info(f"  Skipped: {skipped}")
        logger.info(f"  Errors: {errors}")
        
        if args.dry_run:
            logger.info("This was a dry run - no actual changes were made")
            
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        sys.exit(1)
    finally:
        if 'conn' in locals():
            conn.close()

if __name__ == "__main__":
    main()