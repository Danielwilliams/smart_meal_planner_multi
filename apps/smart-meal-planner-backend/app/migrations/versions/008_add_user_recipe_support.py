"""
Migration: Add User Recipe Support to Organization Recipes
ID: 008_add_user_recipe_support
Created: 2024
Description: Add user_recipe_id field to organization_recipes table to support custom recipes
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
        logger.info("Adding user recipe support to organization recipes...")
        
        with conn.cursor() as cur:
            # Add user_recipe_id column to organization_recipes table
            cur.execute("""
                ALTER TABLE organization_recipes 
                ADD COLUMN user_recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE CASCADE
            """)
            
            # Update the constraint to ensure recipe is either scraped OR user, not both
            cur.execute("""
                ALTER TABLE organization_recipes 
                ADD CONSTRAINT check_recipe_type CHECK (
                    (recipe_id IS NOT NULL AND user_recipe_id IS NULL) OR
                    (recipe_id IS NULL AND user_recipe_id IS NOT NULL)
                )
            """)
            
            # Add index for user_recipe_id
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipes_user_recipe_id 
                ON organization_recipes(organization_id, user_recipe_id)
            """)
            
            # Update the unique constraint to handle both types
            cur.execute("""
                ALTER TABLE organization_recipes 
                DROP CONSTRAINT organization_recipes_organization_id_recipe_id_key
            """)
            
            cur.execute("""
                CREATE UNIQUE INDEX idx_org_recipes_unique_scraped 
                ON organization_recipes(organization_id, recipe_id) 
                WHERE recipe_id IS NOT NULL
            """)
            
            cur.execute("""
                CREATE UNIQUE INDEX idx_org_recipes_unique_user 
                ON organization_recipes(organization_id, user_recipe_id) 
                WHERE user_recipe_id IS NOT NULL
            """)
            
            # Add comment
            cur.execute("""
                COMMENT ON COLUMN organization_recipes.user_recipe_id IS 
                'Reference to user-created recipe (either recipe_id OR user_recipe_id must be set, not both)'
            """)
            
            conn.commit()
            logger.info("✅ Added user recipe support to organization recipes successfully")
        
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
        logger.info("Rolling back user recipe support...")
        
        with conn.cursor() as cur:
            # Drop indexes
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_user_recipe_id")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_unique_scraped")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_unique_user")
            
            # Drop constraint
            cur.execute("ALTER TABLE organization_recipes DROP CONSTRAINT IF EXISTS check_recipe_type")
            
            # Restore original unique constraint
            cur.execute("""
                ALTER TABLE organization_recipes 
                ADD CONSTRAINT organization_recipes_organization_id_recipe_id_key 
                UNIQUE (organization_id, recipe_id)
            """)
            
            # Drop user_recipe_id column
            cur.execute("ALTER TABLE organization_recipes DROP COLUMN IF EXISTS user_recipe_id")
            
            conn.commit()
            logger.info("✅ Rolled back user recipe support")
            
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