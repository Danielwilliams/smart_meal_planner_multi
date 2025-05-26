"""
Migration: Create User Recipes System
ID: 007_create_user_recipes
Created: 2024
Description: Create tables for user-created custom recipes that users and organizations can create
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
        logger.info("Starting user recipes system creation...")
        
        with conn.cursor() as cur:
            # Create user_recipes table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_recipes (
                    id SERIAL PRIMARY KEY,
                    
                    -- Ownership (either user OR organization can own a recipe)
                    created_by_user_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
                    created_by_organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Recipe Basic Info (similar to scraped_recipes)
                    title VARCHAR(255) NOT NULL,
                    description TEXT,
                    instructions TEXT,
                    
                    -- Timing
                    prep_time INTEGER, -- minutes
                    cook_time INTEGER, -- minutes  
                    total_time INTEGER, -- minutes
                    servings INTEGER,
                    
                    -- Categories & Tags
                    cuisine VARCHAR(100),
                    complexity VARCHAR(50), -- 'easy', 'medium', 'hard'
                    meal_category VARCHAR(50), -- 'breakfast', 'lunch', 'dinner', 'snack'
                    diet_tags JSONB DEFAULT '[]', -- ['vegetarian', 'gluten-free', etc.]
                    custom_tags JSONB DEFAULT '[]', -- user-defined tags
                    
                    -- Media
                    image_url TEXT,
                    
                    -- Nutritional Info (optional - users can add estimates)
                    calories_per_serving INTEGER,
                    protein_grams FLOAT,
                    carbs_grams FLOAT,
                    fat_grams FLOAT,
                    fiber_grams FLOAT,
                    
                    -- Recipe Status
                    is_public BOOLEAN DEFAULT FALSE, -- if true, other users can see/copy this recipe
                    is_verified BOOLEAN DEFAULT FALSE, -- for quality control
                    is_active BOOLEAN DEFAULT TRUE,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Ensure recipe is owned by either user OR organization, not both
                    CONSTRAINT check_single_owner CHECK (
                        (created_by_user_id IS NOT NULL AND created_by_organization_id IS NULL) OR
                        (created_by_user_id IS NULL AND created_by_organization_id IS NOT NULL)
                    )
                )
            """)
            
            # Create user_recipe_ingredients table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_recipe_ingredients (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE CASCADE,
                    name VARCHAR(255) NOT NULL,
                    amount VARCHAR(50), -- e.g., "2", "1/2", "1.5"
                    unit VARCHAR(50), -- e.g., "cups", "tbsp", "oz", "lbs"
                    notes TEXT, -- e.g., "finely chopped", "room temperature"
                    sort_order INTEGER DEFAULT 0,
                    is_optional BOOLEAN DEFAULT FALSE
                )
            """)
            
            # Create user_recipe_steps table  
            cur.execute("""
                CREATE TABLE IF NOT EXISTS user_recipe_steps (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES user_recipes(id) ON DELETE CASCADE,
                    step_number INTEGER NOT NULL,
                    instruction TEXT NOT NULL,
                    notes TEXT, -- additional tips for this step
                    estimated_time INTEGER -- minutes for this step
                )
            """)
            
            # Create indexes for performance
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipes_user_id 
                ON user_recipes(created_by_user_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipes_org_id 
                ON user_recipes(created_by_organization_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipes_public 
                ON user_recipes(is_public, is_active) 
                WHERE is_public = TRUE AND is_active = TRUE
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipes_cuisine 
                ON user_recipes(cuisine, is_active)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipes_meal_category 
                ON user_recipes(meal_category, is_active)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipe_ingredients_recipe 
                ON user_recipe_ingredients(recipe_id, sort_order)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_user_recipe_steps_recipe 
                ON user_recipe_steps(recipe_id, step_number)
            """)
            
            # Create trigger function for updating updated_at timestamp
            cur.execute("""
                CREATE OR REPLACE FUNCTION update_user_recipes_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            """)
            
            # Create trigger
            cur.execute("""
                DROP TRIGGER IF EXISTS update_user_recipes_updated_at ON user_recipes
            """)
            
            cur.execute("""
                CREATE TRIGGER update_user_recipes_updated_at
                    BEFORE UPDATE ON user_recipes
                    FOR EACH ROW
                    EXECUTE FUNCTION update_user_recipes_updated_at()
            """)
            
            # Add table comments
            cur.execute("""
                COMMENT ON TABLE user_recipes IS 
                'Custom recipes created by users and organizations'
            """)
            
            cur.execute("""
                COMMENT ON TABLE user_recipe_ingredients IS 
                'Ingredients for user-created recipes with amounts and units'
            """)
            
            cur.execute("""
                COMMENT ON TABLE user_recipe_steps IS 
                'Step-by-step cooking instructions for user-created recipes'
            """)
            
            conn.commit()
            logger.info("✅ Created user recipes system successfully")
        
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
        logger.info("Rolling back user recipes system...")
        
        with conn.cursor() as cur:
            # Drop trigger
            cur.execute("DROP TRIGGER IF EXISTS update_user_recipes_updated_at ON user_recipes")
            
            # Drop function
            cur.execute("DROP FUNCTION IF EXISTS update_user_recipes_updated_at()")
            
            # Drop indexes
            cur.execute("DROP INDEX IF EXISTS idx_user_recipes_user_id")
            cur.execute("DROP INDEX IF EXISTS idx_user_recipes_org_id")
            cur.execute("DROP INDEX IF EXISTS idx_user_recipes_public")
            cur.execute("DROP INDEX IF EXISTS idx_user_recipes_cuisine")
            cur.execute("DROP INDEX IF EXISTS idx_user_recipes_meal_category")
            cur.execute("DROP INDEX IF EXISTS idx_user_recipe_ingredients_recipe")
            cur.execute("DROP INDEX IF EXISTS idx_user_recipe_steps_recipe")
            
            # Drop tables in correct order (respecting foreign keys)
            cur.execute("DROP TABLE IF EXISTS user_recipe_steps")
            cur.execute("DROP TABLE IF EXISTS user_recipe_ingredients")
            cur.execute("DROP TABLE IF EXISTS user_recipes")
            
            conn.commit()
            logger.info("✅ Dropped user recipes system")
            
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