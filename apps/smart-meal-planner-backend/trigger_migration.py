#!/usr/bin/env python3
"""
Manual migration trigger script
Run this to manually execute pending migrations
"""

import sys
import os
import logging

# Add the app directory to the Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Set up logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

try:
    from app.migrations.migration_runner import run_startup_migrations
    
    logger.info("🚀 Starting manual migration execution...")
    
    result = run_startup_migrations()
    
    if result:
        logger.info("✅ Migration execution completed successfully!")
        logger.info("The client notes system should now be available.")
    else:
        logger.error("❌ Migration execution failed!")
        logger.error("Check the logs above for details.")
        
except Exception as e:
    logger.error(f"💥 Error running migrations: {e}")
    logger.error("Make sure the database connection is available.")

print("\n" + "="*60)
print("Migration execution complete. Check the logs above.")
print("If successful, the client notes API should now work.")
print("="*60)