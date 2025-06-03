"""
Migration: Add Preferred Proteins to User Preferences
ID: 011_add_preferred_proteins
Created: 2024
Description: Add preferred_proteins JSONB field to user_profiles table for protein selection functionality
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
        logger.info("Starting preferred proteins migration...")
        
        with conn.cursor() as cur:
            # Add preferred_proteins JSONB column to user_profiles
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN IF NOT EXISTS preferred_proteins JSONB DEFAULT '{}'
            """)
            
            # Initialize default preferred proteins for all users
            default_proteins = {
                "meat": {
                    "chicken": False,
                    "beef": False,
                    "pork": False,
                    "turkey": False,
                    "lamb": False,
                    "bison": False
                },
                "seafood": {
                    "salmon": False,
                    "tuna": False,
                    "cod": False,
                    "shrimp": False,
                    "crab": False,
                    "mussels": False
                },
                "vegetarian_vegan": {
                    "tofu": False,
                    "tempeh": False,
                    "seitan": False,
                    "lentils": False,
                    "chickpeas": False,
                    "black_beans": False
                },
                "other": {
                    "eggs": False,
                    "dairy_milk": False,
                    "dairy_yogurt": False,
                    "protein_powder_whey": False,
                    "protein_powder_pea": False,
                    "quinoa": False
                }
            }
            
            # Update existing records that don't have preferred_proteins settings
            cur.execute("""
                UPDATE user_profiles 
                SET preferred_proteins = %s
                WHERE preferred_proteins = '{}'::jsonb OR preferred_proteins IS NULL
            """, [default_proteins])
            
            # Create index for efficient protein preference queries
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_preferred_proteins 
                ON user_profiles USING gin(preferred_proteins)
            """)
            
            conn.commit()
            logger.info("✅ Added preferred_proteins column with default values")
        
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
        logger.info("Rolling back preferred proteins migration...")
        
        with conn.cursor() as cur:
            # Drop the index
            cur.execute("DROP INDEX IF EXISTS idx_user_profiles_preferred_proteins")
            
            # Remove the column
            cur.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS preferred_proteins")
            
            conn.commit()
            logger.info("✅ Removed preferred_proteins column")
            
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