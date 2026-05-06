#!/usr/bin/env python3
"""
Simple script to run the recipe_components migration directly

This script runs the SQL commands directly without complex imports.
"""

import sys
import os
import logging
import psycopg2
from psycopg2.extras import RealDictCursor

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def get_db_connection():
    """Get database connection using environment variables"""
    try:
        # Try to get connection details from environment
        conn = psycopg2.connect(
            dbname=os.getenv('DB_NAME', 'postgres'),
            user=os.getenv('DB_USER', 'postgres'), 
            password=os.getenv('DB_PASSWORD', ''),
            host=os.getenv('DB_HOST', 'localhost'),
            port=os.getenv('DB_PORT', '5432')
        )
        return conn
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        logger.info("Please check your database connection settings.")
        logger.info("You may need to set environment variables: DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT")
        raise

def run_migration():
    """Run the recipe components migration"""
    logger.info("=" * 60)
    logger.info("RECIPE COMPONENTS MIGRATION 010")
    logger.info("=" * 60)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Step 1: Check if recipe_components table exists
        logger.info("Step 1: Checking if recipe_components table exists...")
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if not table_exists:
            logger.info("✅ recipe_components table doesn't exist - migration already complete!")
            return True
        
        # Step 2: Check current data
        logger.info("Step 2: Analyzing current data...")
        cursor.execute("SELECT COUNT(*) as total FROM recipe_components")
        total_components = cursor.fetchone()['total']
        
        cursor.execute("""
            SELECT component_type, COUNT(*) as count 
            FROM recipe_components 
            GROUP BY component_type 
            ORDER BY count DESC
        """)
        component_stats = cursor.fetchall()
        
        logger.info(f"Found {total_components} total components:")
        for stat in component_stats:
            logger.info(f"  - {stat['component_type']}: {stat['count']} entries")
        
        # Step 3: Copy data to scraped_recipes
        logger.info("Step 3: Copying component_type data to scraped_recipes...")
        cursor.execute("""
            UPDATE scraped_recipes sr 
            SET component_type = rc.component_type
            FROM recipe_components rc 
            WHERE sr.id = rc.recipe_id 
            AND (sr.component_type IS NULL OR sr.component_type = '');
        """)
        updated_count = cursor.rowcount
        logger.info(f"✅ Updated {updated_count} recipes with component_type")
        
        # Step 4: Verify no data loss
        logger.info("Step 4: Verifying data integrity...")
        cursor.execute("""
            SELECT COUNT(*) as count
            FROM recipe_components rc
            LEFT JOIN scraped_recipes sr ON rc.recipe_id = sr.id
            WHERE sr.component_type IS NULL OR sr.component_type = ''
        """)
        orphaned_count = cursor.fetchone()['count']
        
        if orphaned_count > 0:
            logger.error(f"❌ DANGER: {orphaned_count} components would lose data!")
            logger.error("Migration aborted to prevent data loss.")
            return False
        
        # Step 5: Drop foreign key constraints
        logger.info("Step 5: Dropping foreign key constraints...")
        cursor.execute("""
            SELECT conname, conrelid::regclass as table_name
            FROM pg_constraint 
            WHERE confrelid = 'recipe_components'::regclass
        """)
        constraints = cursor.fetchall()
        
        for constraint in constraints:
            logger.info(f"Dropping constraint {constraint['conname']} on {constraint['table_name']}")
            cursor.execute(f"ALTER TABLE {constraint['table_name']} DROP CONSTRAINT {constraint['conname']}")
        
        # Step 6: Drop the table
        logger.info("Step 6: Dropping recipe_components table...")
        cursor.execute("DROP TABLE recipe_components CASCADE")
        
        # Step 7: Final verification
        logger.info("Step 7: Final verification...")
        cursor.execute("""
            SELECT COUNT(*) as count 
            FROM scraped_recipes 
            WHERE component_type IS NOT NULL AND component_type != ''
        """)
        remaining_components = cursor.fetchone()['count']
        
        # Commit all changes
        conn.commit()
        
        logger.info("=" * 60)
        logger.info("✅ MIGRATION COMPLETED SUCCESSFULLY!")
        logger.info("=" * 60)
        logger.info(f"📊 Final result: {remaining_components} recipes have component_type")
        logger.info("🗑️  recipe_components table eliminated")
        logger.info("✨ Database schema simplified")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Migration failed: {str(e)}")
        if conn:
            conn.rollback()
            logger.info("🔄 Transaction rolled back")
        return False
    finally:
        if conn:
            conn.close()

def rollback_migration():
    """Rollback the migration by recreating recipe_components"""
    logger.info("=" * 60)
    logger.info("ROLLING BACK MIGRATION 010")
    logger.info("=" * 60)
    
    conn = None
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Recreate recipe_components table
        logger.info("Recreating recipe_components table...")
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
        
        # Repopulate from scraped_recipes
        logger.info("Repopulating recipe_components from scraped_recipes...")
        cursor.execute("""
            INSERT INTO recipe_components (recipe_id, name, component_type, is_verified)
            SELECT id, title, component_type, is_verified
            FROM scraped_recipes 
            WHERE component_type IS NOT NULL AND component_type != ''
        """)
        inserted_count = cursor.rowcount
        
        conn.commit()
        
        logger.info("=" * 60)
        logger.info("✅ ROLLBACK COMPLETED SUCCESSFULLY!")
        logger.info("=" * 60)
        logger.info(f"📊 Recreated recipe_components with {inserted_count} entries")
        
        return True
        
    except Exception as e:
        logger.error(f"❌ Rollback failed: {str(e)}")
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def main():
    """Main function"""
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        # Rollback mode
        response = input("🚨 Are you sure you want to ROLLBACK the migration? (yes/no): ").lower().strip()
        if response == 'yes':
            success = rollback_migration()
            sys.exit(0 if success else 1)
        else:
            logger.info("Rollback cancelled")
            sys.exit(0)
    else:
        # Migration mode
        response = input("🚀 Are you sure you want to run the migration? (yes/no): ").lower().strip()
        if response == 'yes':
            success = run_migration()
            sys.exit(0 if success else 1)
        else:
            logger.info("Migration cancelled")
            sys.exit(0)

if __name__ == "__main__":
    main()