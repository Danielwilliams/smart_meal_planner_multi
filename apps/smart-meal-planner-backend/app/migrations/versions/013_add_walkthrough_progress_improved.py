"""
Migration 013: Add improved walkthrough progress tracking to user_profiles table

This migration adds fields to track completion of the onboarding walkthrough:
- walkthrough_preferences_completed: Boolean flag for preferences step completion
- walkthrough_menu_completed: Boolean flag for menu generation step completion  
- walkthrough_recipe_browser_completed: Boolean flag for recipe browser step completion
- walkthrough_shopping_completed: Boolean flag for shopping list step completion
- walkthrough_completed: Boolean flag for entire walkthrough completion
- walkthrough_started_at: Timestamp when walkthrough was first started
- walkthrough_completed_at: Timestamp when walkthrough was completed

These fields enable:
1. Tracking user progress through onboarding steps
2. Conditional display of walkthrough overlays
3. Analytics on onboarding completion rates
4. Ability to resume walkthrough from last completed step
"""

import logging
from app.db import get_db_connection

logger = logging.getLogger(__name__)

def upgrade():
    """Add walkthrough progress tracking fields to user_profiles table"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            logger.info("Starting migration 013: Adding improved walkthrough progress fields")
            
            # Add walkthrough progress columns to user_profiles table
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN IF NOT EXISTS walkthrough_preferences_completed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS walkthrough_menu_completed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS walkthrough_recipe_browser_completed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS walkthrough_shopping_completed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS walkthrough_completed BOOLEAN DEFAULT FALSE,
                ADD COLUMN IF NOT EXISTS walkthrough_started_at TIMESTAMP,
                ADD COLUMN IF NOT EXISTS walkthrough_completed_at TIMESTAMP
            """)
            
            logger.info("Successfully added walkthrough progress columns to user_profiles table")
            
            # Create index for walkthrough completion queries
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_walkthrough_completed 
                ON user_profiles(walkthrough_completed, walkthrough_completed_at)
            """)
            
            logger.info("Created index for walkthrough completion tracking")
            
            # Update existing users who have completed basic onboarding steps
            # Mark walkthrough as completed for users who have all basic progress flags
            cur.execute("""
                UPDATE user_profiles 
                SET walkthrough_completed = TRUE,
                    walkthrough_preferences_completed = TRUE,
                    walkthrough_menu_completed = TRUE,
                    walkthrough_shopping_completed = TRUE,
                    walkthrough_completed_at = CURRENT_TIMESTAMP
                WHERE has_preferences = TRUE 
                  AND has_generated_menu = TRUE 
                  AND has_shopping_list = TRUE
                  AND walkthrough_completed IS NOT TRUE
            """)
            
            rows_updated = cur.rowcount
            logger.info(f"Updated {rows_updated} existing users with completed walkthrough status")
            
            # Mark partial completion for users who have started but not finished
            cur.execute("""
                UPDATE user_profiles 
                SET walkthrough_preferences_completed = has_preferences,
                    walkthrough_menu_completed = has_generated_menu,
                    walkthrough_shopping_completed = has_shopping_list,
                    walkthrough_started_at = created_at
                WHERE (has_preferences = TRUE OR has_generated_menu = TRUE OR has_shopping_list = TRUE)
                  AND walkthrough_started_at IS NULL
            """)
            
            partial_rows_updated = cur.rowcount
            logger.info(f"Updated {partial_rows_updated} users with partial walkthrough progress")
            
            conn.commit()
            logger.info("Migration 013 completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"Migration 013 failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def downgrade():
    """Remove walkthrough progress tracking fields"""
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cur:
            logger.info("Starting downgrade of migration 013")
            
            # Drop the index first
            cur.execute("DROP INDEX IF EXISTS idx_user_profiles_walkthrough_completed")
            
            # Remove the columns
            cur.execute("""
                ALTER TABLE user_profiles 
                DROP COLUMN IF EXISTS walkthrough_preferences_completed,
                DROP COLUMN IF EXISTS walkthrough_menu_completed,
                DROP COLUMN IF EXISTS walkthrough_recipe_browser_completed,
                DROP COLUMN IF EXISTS walkthrough_shopping_completed,
                DROP COLUMN IF EXISTS walkthrough_completed,
                DROP COLUMN IF EXISTS walkthrough_started_at,
                DROP COLUMN IF EXISTS walkthrough_completed_at
            """)
            
            conn.commit()
            logger.info("Migration 013 downgrade completed successfully")
            return True
            
    except Exception as e:
        logger.error(f"Migration 013 downgrade failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

# Migration metadata
migration_id = "013_add_walkthrough_progress_improved"
dependencies = ["012_add_other_proteins"]