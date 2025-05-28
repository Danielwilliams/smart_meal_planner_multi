#!/usr/bin/env python3
"""
Direct script to run ONLY the recipe components migration (010)
This bypasses the migration runner to avoid issues with other pending migrations.
"""

import os
import sys
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
        raise

def check_migration_status():
    """Check if our migration has already been applied"""
    conn = get_db_connection()
    try:
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Check if applied_migrations table exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'applied_migrations'
            )
        """)
        table_exists = cursor.fetchone()['exists']
        
        if table_exists:
            # Check if our migration was applied
            cursor.execute("""
                SELECT status FROM applied_migrations 
                WHERE migration_name = '010_consolidate_recipe_components'
            """)
            result = cursor.fetchone()
            if result:
                return result['status']
        
        return None
    finally:
        conn.close()

def run_recipe_components_migration():
    """Run the recipe components migration directly"""
    logger.info("=" * 60)
    logger.info("RECIPE COMPONENTS MIGRATION 010 - DIRECT RUN")
    logger.info("=" * 60)
    
    # Check current status
    status = check_migration_status()
    if status == 'success':
        logger.info("✅ Migration 010 already completed successfully!")
        return True
    elif status == 'failed':
        logger.warning("⚠️  Migration 010 previously failed - attempting to retry")
    
    conn = get_db_connection()
    try:
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
            
            # Mark as completed if not already marked
            ensure_migrations_table(cursor)
            cursor.execute("""
                INSERT INTO applied_migrations (migration_name, status) 
                VALUES ('010_consolidate_recipe_components', 'success')
                ON CONFLICT (migration_name) DO UPDATE SET 
                    status = 'success',
                    applied_at = CURRENT_TIMESTAMP
            """)
            conn.commit()
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
        
        # Step 8: Record the migration
        ensure_migrations_table(cursor)
        cursor.execute("""
            INSERT INTO applied_migrations (migration_name, status) 
            VALUES ('010_consolidate_recipe_components', 'success')
            ON CONFLICT (migration_name) DO UPDATE SET 
                status = 'success',
                applied_at = CURRENT_TIMESTAMP
        """)
        
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
        conn.rollback()
        return False
    finally:
        conn.close()

def ensure_migrations_table(cursor):
    """Ensure the applied_migrations table exists"""
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS applied_migrations (
            id SERIAL PRIMARY KEY,
            migration_name VARCHAR(255) UNIQUE NOT NULL,
            applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
            status VARCHAR(50) DEFAULT 'success',
            error_message TEXT,
            execution_time_seconds FLOAT
        )
    """)

def main():
    """Main function"""
    response = input("🚀 Run recipe components migration (010) directly? (yes/no): ").lower().strip()
    if response == 'yes':
        success = run_recipe_components_migration()
        if success:
            print("\n🎉 Migration completed! You can now test the tag editing system.")
        else:
            print("\n❌ Migration failed. Check the logs above for details.")
        sys.exit(0 if success else 1)
    else:
        logger.info("Migration cancelled")
        sys.exit(0)

if __name__ == "__main__":
    main()