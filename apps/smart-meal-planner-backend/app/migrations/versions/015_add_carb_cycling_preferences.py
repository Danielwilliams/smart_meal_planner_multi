"""
Migration: Add Carb Cycling Preferences to User Profiles
ID: 015_add_carb_cycling_preferences
Created: 2024
Description: Add carb cycling functionality to user preferences including cycling patterns, carb targets, and weekly schedules
"""

import os
import sys
import logging
import json

# Add the app directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', '..', '..'))

from app.db import get_db_connection

logger = logging.getLogger(__name__)

def upgrade():
    """Apply the migration"""
    conn = get_db_connection()
    try:
        logger.info("Starting carb cycling preferences migration...")
        
        with conn.cursor() as cur:
            # Add carb cycling enabled flag
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN IF NOT EXISTS carb_cycling_enabled BOOLEAN DEFAULT FALSE
            """)
            
            # Add carb cycling configuration JSONB column
            cur.execute("""
                ALTER TABLE user_profiles 
                ADD COLUMN IF NOT EXISTS carb_cycling_config JSONB DEFAULT '{}'
            """)
            
            # Initialize default carb cycling configuration for all users
            default_carb_cycling_config = {
                "pattern": "3-1-3",  # 3 high, 1 moderate, 3 low carb days
                "high_carb_grams": 200,
                "moderate_carb_grams": 100,
                "low_carb_grams": 50,
                "no_carb_grams": 20,  # For advanced users
                "weekly_schedule": {
                    "monday": "high",      # Typically workout day
                    "tuesday": "low",      # Rest day
                    "wednesday": "high",   # Workout day
                    "thursday": "moderate", # Light activity
                    "friday": "high",      # Workout day
                    "saturday": "low",     # Rest day
                    "sunday": "low"        # Rest day
                },
                "sync_with_workouts": False,
                "workout_days": [],  # Will be populated if sync_with_workouts is True
                "custom_pattern": False,  # True if user creates custom weekly schedule
                "pattern_options": [
                    {"name": "3-1-3", "description": "3 High, 1 Moderate, 3 Low carb days"},
                    {"name": "2-2-3", "description": "2 High, 2 Moderate, 3 Low carb days"},
                    {"name": "4-0-3", "description": "4 High, 0 Moderate, 3 Low carb days"},
                    {"name": "5-0-2", "description": "5 High, 0 Moderate, 2 Low carb days"},
                    {"name": "custom", "description": "Create your own custom pattern"}
                ],
                "carb_ranges": {
                    "high": {"min": 150, "max": 300, "description": "High carb days (workout/active days)"},
                    "moderate": {"min": 75, "max": 150, "description": "Moderate carb days (light activity)"},
                    "low": {"min": 25, "max": 75, "description": "Low carb days (rest days)"},
                    "no_carb": {"min": 0, "max": 25, "description": "Very low carb days (advanced)"}
                },
                "goals": {
                    "primary": "fat_loss",  # Options: fat_loss, muscle_gain, performance, maintenance
                    "secondary": "maintain_muscle"  # Options: maintain_muscle, improve_performance, metabolic_flexibility
                },
                "notes": ""  # User notes about their carb cycling approach
            }
            
            # Update existing records that don't have carb cycling settings
            cur.execute("""
                UPDATE user_profiles 
                SET carb_cycling_config = %s
                WHERE carb_cycling_config = '{}'::jsonb OR carb_cycling_config IS NULL
            """, [json.dumps(default_carb_cycling_config)])
            
            # Create indexes for efficient carb cycling queries
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_carb_cycling_enabled 
                ON user_profiles(carb_cycling_enabled)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_profiles_carb_cycling_config 
                ON user_profiles USING gin(carb_cycling_config)
            """)
            
            conn.commit()
            logger.info("✅ Added carb cycling preferences with default values")
            
            # Log statistics
            cur.execute("SELECT COUNT(*) FROM user_profiles WHERE carb_cycling_enabled = FALSE")
            count = cur.fetchone()[0]
            logger.info(f"📊 Updated {count} user profiles with carb cycling preferences")
        
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
        logger.info("Rolling back carb cycling preferences migration...")
        
        with conn.cursor() as cur:
            # Drop the indexes
            cur.execute("DROP INDEX IF EXISTS idx_user_profiles_carb_cycling_enabled")
            cur.execute("DROP INDEX IF EXISTS idx_user_profiles_carb_cycling_config")
            
            # Remove the columns
            cur.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS carb_cycling_enabled")
            cur.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS carb_cycling_config")
            
            conn.commit()
            logger.info("✅ Removed carb cycling preferences columns")
            
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