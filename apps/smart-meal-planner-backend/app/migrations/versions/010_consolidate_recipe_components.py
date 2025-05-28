"""
Migration 010: Consolidate Recipe Components

This migration eliminates the redundant recipe_components table by:
1. Copying any missing component_type data to scraped_recipes.component_type
2. Dropping the recipe_components table
3. Removing any references to the old table

Date: 2025-01-28
"""

import logging
import psycopg2
from psycopg2.extras import RealDictCursor

logger = logging.getLogger(__name__)

def migrate_up(conn):
    """
    Apply the migration: consolidate recipe_components into scraped_recipes
    """
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        logger.info("Starting migration 010: Consolidate recipe components")
        
        # Step 1: Check if recipe_components table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            logger.info("recipe_components table doesn't exist, migration already complete")
            return
        
        # Step 2: Copy missing component_type data from recipe_components to scraped_recipes
        logger.info("Copying component_type data from recipe_components to scraped_recipes...")
        
        cursor.execute("""
            UPDATE scraped_recipes sr 
            SET component_type = rc.component_type
            FROM recipe_components rc 
            WHERE sr.id = rc.recipe_id 
            AND (sr.component_type IS NULL OR sr.component_type = '');
        """)
        
        updated_count = cursor.rowcount
        logger.info(f"Updated {updated_count} recipes with component_type from recipe_components")
        
        # Step 3: Verify data integrity - check for any recipes that would lose component_type
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM recipe_components rc
            LEFT JOIN scraped_recipes sr ON rc.recipe_id = sr.id
            WHERE sr.component_type IS NULL OR sr.component_type = ''
        """)
        
        orphaned_count = cursor.fetchone()['count']
        if orphaned_count > 0:
            logger.warning(f"Found {orphaned_count} recipe_components entries that couldn't be migrated")
            
            # Log the problematic entries for manual review
            cursor.execute("""
                SELECT rc.id, rc.recipe_id, rc.component_type, sr.title
                FROM recipe_components rc
                LEFT JOIN scraped_recipes sr ON rc.recipe_id = sr.id
                WHERE sr.component_type IS NULL OR sr.component_type = ''
                LIMIT 10
            """)
            
            problematic = cursor.fetchall()
            for entry in problematic:
                logger.warning(f"Orphaned component: ID {entry['id']}, Recipe {entry['recipe_id']} ({entry['title']}), Component: {entry['component_type']}")
        
        # Step 4: Log summary of what will be dropped
        cursor.execute("SELECT COUNT(*) as total FROM recipe_components")
        total_components = cursor.fetchone()['total']
        
        cursor.execute("""
            SELECT component_type, COUNT(*) as count 
            FROM recipe_components 
            GROUP BY component_type 
            ORDER BY count DESC
        """)
        component_stats = cursor.fetchall()
        
        logger.info(f"About to drop recipe_components table with {total_components} total entries:")
        for stat in component_stats:
            logger.info(f"  - {stat['component_type']}: {stat['count']} entries")
        
        # Step 5: Drop the recipe_components table and related constraints
        logger.info("Dropping recipe_components table...")
        
        # Drop any foreign key constraints that reference this table
        cursor.execute("""
            SELECT conname, conrelid::regclass as table_name
            FROM pg_constraint 
            WHERE confrelid = 'recipe_components'::regclass
        """)
        
        referencing_constraints = cursor.fetchall()
        for constraint in referencing_constraints:
            logger.info(f"Dropping constraint {constraint['conname']} on table {constraint['table_name']}")
            cursor.execute(f"ALTER TABLE {constraint['table_name']} DROP CONSTRAINT {constraint['conname']}")
        
        # Drop the table itself
        cursor.execute("DROP TABLE recipe_components CASCADE")
        
        logger.info("Successfully dropped recipe_components table")
        
        # Step 6: Verify the migration
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM scraped_recipes 
            WHERE component_type IS NOT NULL AND component_type != ''
        """)
        
        remaining_components = cursor.fetchone()['count']
        logger.info(f"Migration complete: {remaining_components} recipes now have component_type in scraped_recipes")
        
        conn.commit()
        logger.info("Migration 010 completed successfully")
        
    except Exception as e:
        logger.error(f"Error in migration 010: {str(e)}")
        conn.rollback()
        raise

def migrate_down(conn):
    """
    Rollback the migration: recreate recipe_components table
    """
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        logger.info("Rolling back migration 010: Recreating recipe_components table")
        
        # Recreate the recipe_components table
        cursor.execute("""
            CREATE TABLE recipe_components (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                component_type VARCHAR(100) NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (recipe_id)
            )
        """)
        
        # Repopulate it from scraped_recipes
        cursor.execute("""
            INSERT INTO recipe_components (recipe_id, name, component_type, is_verified)
            SELECT id, title, component_type, is_verified
            FROM scraped_recipes 
            WHERE component_type IS NOT NULL AND component_type != ''
        """)
        
        inserted_count = cursor.rowcount
        logger.info(f"Recreated recipe_components table with {inserted_count} entries")
        
        conn.commit()
        logger.info("Migration 010 rollback completed successfully")
        
    except Exception as e:
        logger.error(f"Error rolling back migration 010: {str(e)}")
        conn.rollback()
        raise

# Migration metadata
MIGRATION_ID = "010"
MIGRATION_NAME = "consolidate_recipe_components"
MIGRATION_DESCRIPTION = "Eliminate redundant recipe_components table by consolidating into scraped_recipes.component_type"