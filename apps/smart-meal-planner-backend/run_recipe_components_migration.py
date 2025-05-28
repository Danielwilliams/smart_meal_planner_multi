#!/usr/bin/env python3
"""
Script to run the recipe_components table elimination migration

This script runs migration 010 to eliminate the redundant recipe_components table
and consolidate component_type data into the scraped_recipes table.

Usage:
    python run_recipe_components_migration.py

Make sure to backup your database before running this migration!
"""

import sys
import os
import logging
from pathlib import Path

# Add the app directory to the Python path
sys.path.append(str(Path(__file__).parent / "app"))

from app.db import get_db_connection
from app.migrations.versions import migration_010_consolidate_recipe_components

# Set up logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

def main():
    """Run the migration"""
    try:
        logger.info("=" * 60)
        logger.info("STARTING RECIPE COMPONENTS MIGRATION")
        logger.info("=" * 60)
        logger.info("This migration will:")
        logger.info("1. Copy component_type data from recipe_components to scraped_recipes")
        logger.info("2. Drop the recipe_components table")
        logger.info("3. Update all related code to use scraped_recipes.component_type")
        logger.info("")
        
        # Get user confirmation
        response = input("Are you sure you want to proceed? (yes/no): ").lower().strip()
        if response != 'yes':
            logger.info("Migration cancelled by user")
            return
        
        # Connect to database
        logger.info("Connecting to database...")
        conn = get_db_connection()
        
        try:
            # Run the migration
            logger.info("Running migration 010: Consolidate recipe components...")
            migration_010_consolidate_recipe_components.migrate_up(conn)
            
            logger.info("=" * 60)
            logger.info("MIGRATION COMPLETED SUCCESSFULLY!")
            logger.info("=" * 60)
            logger.info("Changes made:")
            logger.info("✓ Component type data migrated to scraped_recipes.component_type")
            logger.info("✓ recipe_components table dropped")
            logger.info("✓ AI meal builder updated to use scraped_recipes")
            logger.info("✓ Admin endpoints updated to use scraped_recipes")
            logger.info("✓ Frontend queries updated")
            logger.info("")
            logger.info("Next steps:")
            logger.info("1. Test the application thoroughly")
            logger.info("2. Verify that component tagging works correctly")
            logger.info("3. Check that meal suggestions still work")
            logger.info("4. If issues occur, you can rollback with migrate_down()")
            
        except Exception as e:
            logger.error(f"Migration failed: {str(e)}")
            logger.info("Database transaction was rolled back")
            raise
        finally:
            conn.close()
            
    except KeyboardInterrupt:
        logger.info("Migration cancelled by user")
    except Exception as e:
        logger.error(f"Error running migration: {str(e)}")
        sys.exit(1)

def rollback():
    """Rollback the migration if needed"""
    try:
        logger.info("=" * 60)
        logger.info("ROLLING BACK RECIPE COMPONENTS MIGRATION")
        logger.info("=" * 60)
        logger.warning("This will recreate the recipe_components table")
        logger.warning("Make sure you understand the implications!")
        
        response = input("Are you sure you want to rollback? (yes/no): ").lower().strip()
        if response != 'yes':
            logger.info("Rollback cancelled by user")
            return
        
        conn = get_db_connection()
        try:
            migration_010_consolidate_recipe_components.migrate_down(conn)
            logger.info("Rollback completed successfully")
        finally:
            conn.close()
            
    except Exception as e:
        logger.error(f"Error during rollback: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) > 1 and sys.argv[1] == "rollback":
        rollback()
    else:
        main()