"""
Migration: Create Organization Recipe Management System
ID: 006_create_organization_recipes
Created: 2024
Description: Create tables for organization recipe libraries, categories, and menu defaults
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
        logger.info("Starting organization recipe management system creation...")
        
        with conn.cursor() as cur:
            # Create organization_recipe_categories table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organization_recipe_categories (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    name VARCHAR(100) NOT NULL,
                    description TEXT,
                    color VARCHAR(7) DEFAULT '#1976d2', -- Material-UI primary blue
                    sort_order INTEGER DEFAULT 0,
                    is_active BOOLEAN DEFAULT TRUE,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER REFERENCES user_profiles(id),
                    
                    UNIQUE(organization_id, name)
                )
            """)
            
            # Create organization_recipes table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organization_recipes (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE CASCADE,
                    
                    -- Organization-specific recipe data
                    category_id INTEGER REFERENCES organization_recipe_categories(id) ON DELETE SET NULL,
                    is_approved BOOLEAN DEFAULT FALSE,
                    approval_status VARCHAR(20) DEFAULT 'draft', -- 'draft', 'pending', 'approved', 'needs_revision', 'archived'
                    tags JSONB DEFAULT '[]',
                    internal_notes TEXT, -- Private notes for organization staff
                    client_notes TEXT,   -- Notes visible to clients
                    
                    -- Nutritional compliance
                    meets_standards BOOLEAN DEFAULT NULL, -- NULL = not checked, TRUE/FALSE = compliance status
                    compliance_notes TEXT,
                    
                    -- Usage tracking
                    usage_count INTEGER DEFAULT 0,
                    last_used_at TIMESTAMP,
                    
                    -- Approval workflow
                    approved_by INTEGER REFERENCES user_profiles(id),
                    approved_at TIMESTAMP,
                    submitted_for_approval_at TIMESTAMP,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER REFERENCES user_profiles(id),
                    updated_by INTEGER REFERENCES user_profiles(id),
                    
                    UNIQUE(organization_id, recipe_id)
                )
            """)
            
            # Create organization_menu_defaults table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organization_menu_defaults (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Menu planning parameters
                    default_planning_period INTEGER DEFAULT 7, -- days
                    default_meals_per_day INTEGER DEFAULT 3,
                    include_snacks BOOLEAN DEFAULT TRUE,
                    default_snacks_per_day INTEGER DEFAULT 1,
                    
                    -- Serving sizes
                    serving_sizes JSONB DEFAULT '{
                        "breakfast": 1,
                        "lunch": 1,
                        "dinner": 1,
                        "snacks": 1
                    }',
                    
                    -- Nutritional targets
                    nutritional_targets JSONB DEFAULT '{
                        "caloriesPerMeal": {"min": 300, "max": 800},
                        "proteinPercentage": {"min": 15, "max": 35},
                        "carbsPercentage": {"min": 45, "max": 65},
                        "fatPercentage": {"min": 20, "max": 35}
                    }',
                    
                    -- Dietary defaults
                    dietary_defaults JSONB DEFAULT '{
                        "allowedCuisines": ["american", "italian", "mexican"],
                        "restrictedIngredients": [],
                        "preferredCookingMethods": ["baking", "grilling", "sautéing"],
                        "maxPrepTime": 45
                    }',
                    
                    -- Client delivery settings
                    client_delivery_settings JSONB DEFAULT '{
                        "requireApproval": true,
                        "autoGenerateShoppingList": true,
                        "includeNutritionalInfo": true,
                        "includePrepInstructions": true
                    }',
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_by INTEGER REFERENCES user_profiles(id),
                    
                    UNIQUE(organization_id)
                )
            """)
            
            # Create organization_nutritional_standards table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organization_nutritional_standards (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Standard details
                    name VARCHAR(100) NOT NULL, -- e.g., "Weight Loss", "Maintenance", "Athletic Performance"
                    description TEXT,
                    is_default BOOLEAN DEFAULT FALSE,
                    is_active BOOLEAN DEFAULT TRUE,
                    
                    -- Caloric guidelines
                    daily_calorie_target JSONB DEFAULT '{"min": 1200, "max": 2500}',
                    meal_calorie_distribution JSONB DEFAULT '{
                        "breakfast": 25,
                        "lunch": 35,
                        "dinner": 30,
                        "snacks": 10
                    }', -- percentages
                    
                    -- Macronutrient requirements
                    macronutrient_targets JSONB DEFAULT '{
                        "protein": {"min": 15, "max": 35},
                        "carbohydrates": {"min": 45, "max": 65},
                        "fat": {"min": 20, "max": 35}
                    }', -- percentages
                    
                    -- Micronutrient guidelines
                    micronutrient_priorities JSONB DEFAULT '[]', -- ["vitamin_d", "iron", "calcium"]
                    
                    -- Dietary restrictions
                    allergen_restrictions JSONB DEFAULT '[]', -- ["nuts", "dairy", "gluten"]
                    dietary_restrictions JSONB DEFAULT '[]', -- ["vegetarian", "kosher", "halal"]
                    
                    -- Quality standards
                    quality_preferences JSONB DEFAULT '{
                        "preferWholeFoods": true,
                        "limitProcessedFoods": true,
                        "organicPreference": false,
                        "localSourcingPreference": false
                    }',
                    
                    -- Compliance rules
                    compliance_rules JSONB DEFAULT '{
                        "maxSodiumPerMeal": 800,
                        "maxSugarPerMeal": 25,
                        "minFiberPerDay": 25,
                        "maxSaturatedFatPercentage": 10
                    }',
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER REFERENCES user_profiles(id),
                    updated_by INTEGER REFERENCES user_profiles(id),
                    
                    UNIQUE(organization_id, name)
                )
            """)
            
            # Create indexes for performance
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipes_org_id 
                ON organization_recipes(organization_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipes_approval_status 
                ON organization_recipes(organization_id, approval_status) 
                WHERE is_approved = TRUE
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipes_category 
                ON organization_recipes(organization_id, category_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipes_tags 
                ON organization_recipes USING GIN(tags)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipes_usage 
                ON organization_recipes(organization_id, usage_count DESC, last_used_at DESC)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_org_recipe_categories_org 
                ON organization_recipe_categories(organization_id, sort_order ASC)
            """)
            
            # Create trigger function for updating updated_at timestamp
            cur.execute("""
                CREATE OR REPLACE FUNCTION update_organization_recipes_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            """)
            
            # Create triggers
            cur.execute("""
                DROP TRIGGER IF EXISTS update_organization_recipes_updated_at ON organization_recipes
            """)
            
            cur.execute("""
                CREATE TRIGGER update_organization_recipes_updated_at
                    BEFORE UPDATE ON organization_recipes
                    FOR EACH ROW
                    EXECUTE FUNCTION update_organization_recipes_updated_at()
            """)
            
            cur.execute("""
                DROP TRIGGER IF EXISTS update_organization_recipe_categories_updated_at ON organization_recipe_categories
            """)
            
            cur.execute("""
                CREATE TRIGGER update_organization_recipe_categories_updated_at
                    BEFORE UPDATE ON organization_recipe_categories
                    FOR EACH ROW
                    EXECUTE FUNCTION update_organization_recipes_updated_at()
            """)
            
            # Add comments for documentation
            cur.execute("""
                COMMENT ON TABLE organization_recipes IS 
                'Organization-specific recipe library with approval workflow and categorization'
            """)
            
            cur.execute("""
                COMMENT ON TABLE organization_recipe_categories IS 
                'Custom recipe categories defined by each organization'
            """)
            
            cur.execute("""
                COMMENT ON TABLE organization_menu_defaults IS 
                'Default menu generation parameters for each organization'
            """)
            
            cur.execute("""
                COMMENT ON TABLE organization_nutritional_standards IS 
                'Nutritional guidelines and compliance standards for each organization'
            """)
            
            # Insert default categories for existing organizations
            try:
                cur.execute("""
                    INSERT INTO organization_recipe_categories 
                    (organization_id, name, description, color, sort_order, created_by)
                    SELECT 
                        o.id,
                        'Breakfast',
                        'Morning meal recipes',
                        '#FF9800', -- Orange
                        1,
                        o.owner_id
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
                cur.execute("""
                    INSERT INTO organization_recipe_categories 
                    (organization_id, name, description, color, sort_order, created_by)
                    SELECT 
                        o.id,
                        'Lunch',
                        'Midday meal recipes',
                        '#4CAF50', -- Green
                        2,
                        o.owner_id
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
                cur.execute("""
                    INSERT INTO organization_recipe_categories 
                    (organization_id, name, description, color, sort_order, created_by)
                    SELECT 
                        o.id,
                        'Dinner',
                        'Evening meal recipes',
                        '#2196F3', -- Blue
                        3,
                        o.owner_id
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
                cur.execute("""
                    INSERT INTO organization_recipe_categories 
                    (organization_id, name, description, color, sort_order, created_by)
                    SELECT 
                        o.id,
                        'Snacks',
                        'Healthy snack recipes',
                        '#9C27B0', -- Purple
                        4,
                        o.owner_id
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
                # Insert default menu defaults for existing organizations
                cur.execute("""
                    INSERT INTO organization_menu_defaults (organization_id, updated_by)
                    SELECT o.id, o.owner_id
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id) DO NOTHING
                """)
                
                # Insert default nutritional standard for existing organizations
                cur.execute("""
                    INSERT INTO organization_nutritional_standards 
                    (organization_id, name, description, is_default, created_by)
                    SELECT 
                        o.id,
                        'General Healthy Eating',
                        'Balanced nutrition for general health and wellness',
                        TRUE,
                        o.owner_id
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
            except Exception as default_data_error:
                logger.warning(f"Could not create default data: {default_data_error}")
                # Continue without defaults - they can be created later
            
            conn.commit()
            logger.info("✅ Created organization recipe management system successfully")
        
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
        logger.info("Rolling back organization recipe management system...")
        
        with conn.cursor() as cur:
            # Drop triggers
            cur.execute("DROP TRIGGER IF EXISTS update_organization_recipes_updated_at ON organization_recipes")
            cur.execute("DROP TRIGGER IF EXISTS update_organization_recipe_categories_updated_at ON organization_recipe_categories")
            
            # Drop function
            cur.execute("DROP FUNCTION IF EXISTS update_organization_recipes_updated_at()")
            
            # Drop indexes
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_org_id")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_approval_status")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_category")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_tags")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipes_usage")
            cur.execute("DROP INDEX IF EXISTS idx_org_recipe_categories_org")
            
            # Drop tables in correct order (respecting foreign keys)
            cur.execute("DROP TABLE IF EXISTS organization_nutritional_standards")
            cur.execute("DROP TABLE IF EXISTS organization_menu_defaults")
            cur.execute("DROP TABLE IF EXISTS organization_recipes")
            cur.execute("DROP TABLE IF EXISTS organization_recipe_categories")
            
            conn.commit()
            logger.info("✅ Dropped organization recipe management system")
            
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