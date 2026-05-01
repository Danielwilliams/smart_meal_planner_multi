"""
Migration: Add Other Proteins Custom Text Field
ID: 012_add_other_proteins
Created: 2024
Description: Add other_proteins JSONB field to user_profiles table for custom protein text inputs
"""

import os
import sys
import logging

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.db import get_db_connection

logger = logging.getLogger(__name__)

def upgrade():
    """Apply the migration"""
    conn = get_db_connection()
    try:
        logger.info("Starting other proteins migration...")
        
        with conn.cursor() as cur:
            # Add other_proteins JSONB column to user_profiles
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN IF NOT EXISTS other_proteins JSONB DEFAULT '{}'
            """)
            
            # Initialize default other proteins for all users
            default_other_proteins = {
                "meat": "",
                "seafood": "",
                "vegetarian_vegan": "",
                "other": ""
            }
            
            # Update existing records that don't have other_proteins settings
            cur.execute("""
                UPDATE user_profiles 
                SET other_proteins = %s
                WHERE other_proteins = '{}'::jsonb OR other_proteins IS NULL
            """, [default_other_proteins])
            
            # Update preferred_proteins to include "other" options for existing users
            cur.execute("""
                UPDATE user_profiles 
                SET preferred_proteins = jsonb_set(
                    jsonb_set(
                        jsonb_set(
                            jsonb_set(
                                COALESCE(preferred_proteins, '{}'::jsonb),
                                '{meat,other}', 'false'::jsonb, true
                            ),
                            '{seafood,other}', 'false'::jsonb, true
                        ),
                        '{vegetarian_vegan,other}', 'false'::jsonb, true
                    ),
                    '{other,other}', 'false'::jsonb, true
                )
                WHERE preferred_proteins IS NOT NULL
            """)
            
            # Create index for efficient other proteins queries
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_other_proteins 
                ON user_profiles USING gin(other_proteins)
            """)
            
            conn.commit()
            logger.info("✅ Added other_proteins column and updated preferred_proteins structure")
        
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

def downgrade():
    """Rollback the migration"""
    conn = get_db_connection()
    try:
        logger.info("Rolling back other proteins migration...")
        
        with conn.cursor() as cur:
            # Drop the index
            cur.execute("DROP INDEX IF EXISTS idx_user_profiles_other_proteins")
            
            # Remove the column
            cur.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS other_proteins")
            
            # Remove "other" options from preferred_proteins
            cur.execute("""
                UPDATE user_profiles 
                SET preferred_proteins = (
                    preferred_proteins 
                    #- '{meat,other}' 
                    #- '{seafood,other}' 
                    #- '{vegetarian_vegan,other}' 
                    #- '{other,other}'
                )
                WHERE preferred_proteins IS NOT NULL
            """)
            
            conn.commit()
            logger.info("✅ Removed other_proteins column and cleaned preferred_proteins")
            
    except Exception as e:
        logger.error(f"Rollback failed: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    # Allow running this migration directly for testing
    logging.basicConfig(level=logging.INFO)
    upgrade()