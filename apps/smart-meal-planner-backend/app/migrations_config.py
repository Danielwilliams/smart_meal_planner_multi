"""
Migration configuration for Smart Meal Planner backend.

This module handles configuration for database migrations, including
environment-specific settings and safety checks.
"""

import os
import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

class MigrationConfig:
    """Configuration class for database migrations."""
    
    def __init__(self):
        self.environment = os.getenv("ENVIRONMENT", "development").lower()
        self.enable_auto_migrations = self._get_auto_migration_setting()
        self.require_confirmation = self._get_confirmation_setting()
        self.backup_before_migration = self._get_backup_setting()
        
    def _get_auto_migration_setting(self) -> bool:
        """Determine if auto migrations should be enabled."""
        # Check environment variable first
        auto_migrate = os.getenv("AUTO_MIGRATE_ON_STARTUP", "").lower()
        
        if auto_migrate in ("true", "1", "yes"):
            return True
        elif auto_migrate in ("false", "0", "no"):
            return False
        
        # Default based on environment
        if self.environment in ("development", "dev", "local"):
            return True
        elif self.environment in ("staging", "test"):
            return True
        elif self.environment in ("production", "prod"):
            # Production requires explicit enablement
            return False
        else:
            # Unknown environment - be conservative
            logger.warning(f"Unknown environment '{self.environment}' - disabling auto migrations")
            return False
    
    def _get_confirmation_setting(self) -> bool:
        """Determine if migrations require confirmation."""
        confirm = os.getenv("MIGRATION_REQUIRE_CONFIRMATION", "").lower()
        
        if confirm in ("true", "1", "yes"):
            return True
        elif confirm in ("false", "0", "no"):
            return False
        
        # Default based on environment
        return self.environment in ("production", "prod")
    
    def _get_backup_setting(self) -> bool:
        """Determine if automatic backup is required before migrations."""
        backup = os.getenv("MIGRATION_BACKUP_BEFORE", "").lower()
        
        if backup in ("true", "1", "yes"):
            return True
        elif backup in ("false", "0", "no"):
            return False
        
        # Default based on environment
        return self.environment in ("production", "prod")
    
    def should_run_migrations(self) -> bool:
        """Determine if migrations should run on startup."""
        if not self.enable_auto_migrations:
            logger.info(f"Auto migrations disabled for {self.environment} environment")
            return False
        
        # Additional safety checks for production
        if self.environment in ("production", "prod"):
            # Check for explicit production migration flag
            prod_flag = os.getenv("ENABLE_PROD_MIGRATIONS", "").lower()
            if prod_flag not in ("true", "1", "yes"):
                logger.warning("Production migrations require ENABLE_PROD_MIGRATIONS=true")
                return False
        
        return True
    
    def get_migration_settings(self) -> Dict[str, Any]:
        """Get all migration settings as a dictionary."""
        return {
            "environment": self.environment,
            "enable_auto_migrations": self.enable_auto_migrations,
            "require_confirmation": self.require_confirmation,
            "backup_before_migration": self.backup_before_migration,
            "should_run_migrations": self.should_run_migrations()
        }
    
    def log_configuration(self):
        """Log the current migration configuration."""
        settings = self.get_migration_settings()
        logger.info("Migration configuration:")
        for key, value in settings.items():
            logger.info(f"  {key}: {value}")

# Global configuration instance
migration_config = MigrationConfig()

def get_migration_config() -> MigrationConfig:
    """Get the global migration configuration instance."""
    return migration_config