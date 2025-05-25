#!/usr/bin/env python3
"""
Migration runner for Smart Meal Planner backend.

This module handles running database migrations on server startup,
tracking which migrations have been applied, and ensuring they only
run once per deployment.
"""

import os
import sys
import logging
import importlib
from typing import List, Dict, Any, Optional
from datetime import datetime
from psycopg2.extras import RealDictCursor

# Add the parent directory to the path so we can import from app
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.db import get_db_connection

logger = logging.getLogger(__name__)

class MigrationRunner:
    def __init__(self):
        self.migrations_table = "applied_migrations"
        self.migrations_dir = os.path.dirname(__file__)
        
    def ensure_migrations_table(self):
        """Create the migrations tracking table if it doesn't exist."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    CREATE TABLE IF NOT EXISTS {self.migrations_table} (
                        id SERIAL PRIMARY KEY,
                        migration_name VARCHAR(255) UNIQUE NOT NULL,
                        applied_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
                        status VARCHAR(50) DEFAULT 'success',
                        error_message TEXT,
                        execution_time_seconds FLOAT
                    );
                """)
                
                # Create index for faster lookups
                cur.execute(f"""
                    CREATE INDEX IF NOT EXISTS idx_applied_migrations_name 
                    ON {self.migrations_table}(migration_name);
                """)
                
                conn.commit()
                logger.info("Migrations tracking table is ready")
        except Exception as e:
            logger.error(f"Failed to create migrations table: {e}")
            conn.rollback()
            raise
        finally:
            conn.close()
    
    def get_applied_migrations(self) -> List[str]:
        """Get list of already applied migrations."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    SELECT migration_name 
                    FROM {self.migrations_table} 
                    WHERE status = 'success'
                    ORDER BY applied_at;
                """)
                return [row[0] for row in cur.fetchall()]
        except Exception as e:
            logger.error(f"Failed to get applied migrations: {e}")
            return []
        finally:
            conn.close()
    
    def record_migration(self, migration_name: str, status: str = 'success', 
                        error_message: str = None, execution_time: float = None):
        """Record a migration as applied."""
        conn = get_db_connection()
        try:
            with conn.cursor() as cur:
                cur.execute(f"""
                    INSERT INTO {self.migrations_table} 
                    (migration_name, status, error_message, execution_time_seconds)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (migration_name) 
                    DO UPDATE SET 
                        status = EXCLUDED.status,
                        error_message = EXCLUDED.error_message,
                        execution_time_seconds = EXCLUDED.execution_time_seconds,
                        applied_at = CURRENT_TIMESTAMP;
                """, (migration_name, status, error_message, execution_time))
                conn.commit()
        except Exception as e:
            logger.error(f"Failed to record migration {migration_name}: {e}")
            conn.rollback()
        finally:
            conn.close()
    
    def get_pending_migrations(self) -> List[str]:
        """Get list of migrations that need to be applied."""
        # Get all migration files
        migration_files = []
        migrations_path = os.path.join(os.path.dirname(__file__), 'versions')
        
        if os.path.exists(migrations_path):
            for filename in sorted(os.listdir(migrations_path)):
                if filename.endswith('.py') and not filename.startswith('__'):
                    migration_name = filename[:-3]  # Remove .py extension
                    migration_files.append(migration_name)
        
        # Get already applied migrations
        applied_migrations = self.get_applied_migrations()
        
        # Return pending migrations
        pending = [m for m in migration_files if m not in applied_migrations]
        logger.info(f"Found {len(pending)} pending migrations: {pending}")
        
        return pending
    
    def run_migration(self, migration_name: str) -> bool:
        """Run a single migration."""
        start_time = datetime.now()
        
        try:
            logger.info(f"Running migration: {migration_name}")
            
            # Import the migration module
            module_path = f"app.migrations.versions.{migration_name}"
            migration_module = importlib.import_module(module_path)
            
            # Check if migration has required functions
            if not hasattr(migration_module, 'upgrade'):
                raise Exception(f"Migration {migration_name} missing 'upgrade' function")
            
            # Run the upgrade function
            migration_module.upgrade()
            
            # Calculate execution time
            execution_time = (datetime.now() - start_time).total_seconds()
            
            # Record successful migration
            self.record_migration(migration_name, 'success', None, execution_time)
            
            logger.info(f"Migration {migration_name} completed successfully in {execution_time:.2f}s")
            return True
            
        except Exception as e:
            execution_time = (datetime.now() - start_time).total_seconds()
            error_msg = str(e)
            
            logger.error(f"Migration {migration_name} failed: {error_msg}")
            
            # Record failed migration
            self.record_migration(migration_name, 'failed', error_msg, execution_time)
            
            return False
    
    def run_all_pending_migrations(self, stop_on_error: bool = True) -> Dict[str, Any]:
        """Run all pending migrations."""
        logger.info("Starting migration process...")
        
        # Ensure migrations table exists
        self.ensure_migrations_table()
        
        # Get pending migrations
        pending_migrations = self.get_pending_migrations()
        
        if not pending_migrations:
            logger.info("No pending migrations to run")
            return {
                "status": "success",
                "message": "No pending migrations",
                "migrations_run": [],
                "total_time": 0
            }
        
        start_time = datetime.now()
        successful_migrations = []
        failed_migrations = []
        
        for migration_name in pending_migrations:
            success = self.run_migration(migration_name)
            
            if success:
                successful_migrations.append(migration_name)
            else:
                failed_migrations.append(migration_name)
                if stop_on_error:
                    break
        
        total_time = (datetime.now() - start_time).total_seconds()
        
        result = {
            "status": "success" if not failed_migrations else "partial" if successful_migrations else "failed",
            "migrations_run": successful_migrations,
            "failed_migrations": failed_migrations,
            "total_time": total_time
        }
        
        if failed_migrations:
            result["message"] = f"Failed migrations: {failed_migrations}"
            logger.error(result["message"])
        else:
            result["message"] = f"Successfully ran {len(successful_migrations)} migrations"
            logger.info(result["message"])
        
        return result

# Singleton instance
migration_runner = MigrationRunner()

def run_startup_migrations():
    """Entry point for running migrations on server startup."""
    try:
        # Import configuration here to avoid circular imports
        from app.migrations_config import get_migration_config
        
        config = get_migration_config()
        config.log_configuration()
        
        # Check if migrations should run
        if not config.should_run_migrations():
            logger.info("Migrations skipped based on environment configuration")
            return True
        
        logger.info("Running startup migrations...")
        result = migration_runner.run_all_pending_migrations()
        
        if result["status"] == "failed":
            logger.error("Critical: Migration failures detected on startup!")
            logger.error(f"Failed migrations: {result.get('failed_migrations', [])}")
            
            # In production, this might warrant stopping the server
            # In development, we log and continue
            if config.environment in ("production", "prod"):
                logger.error("Production migration failure - manual intervention required")
            
            return False
        elif result["status"] == "partial":
            logger.warning("Some migrations failed but others succeeded")
            logger.warning(f"Failed migrations: {result.get('failed_migrations', [])}")
            logger.info(f"Successful migrations: {result.get('migrations_run', [])}")
            return True
        else:
            logger.info(f"All migrations completed successfully: {result.get('migrations_run', [])}")
            return True
        
    except Exception as e:
        logger.error(f"Critical error during startup migrations: {e}")
        return False