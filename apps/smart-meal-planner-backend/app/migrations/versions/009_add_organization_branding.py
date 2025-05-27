"""
Migration: Add Organization Branding Settings
ID: 009_add_organization_branding
Created: 2024
Description: Add branding_settings JSONB field to organization_settings table for white-label customization
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
        logger.info("Starting organization branding settings migration...")
        
        with conn.cursor() as cur:
            # Add branding_settings JSONB column to organization_settings
            cur.execute("""
                ALTER TABLE organization_settings 
                ADD COLUMN IF NOT EXISTS branding_settings JSONB DEFAULT '{}'
            """)
            
            # Initialize default branding settings for existing organizations
            default_branding = {
                "visual": {
                    "primaryColor": "#4caf50",
                    "secondaryColor": "#ff9800",
                    "accentColor": "#2196f3",
                    "logoUrl": None,
                    "faviconUrl": None,
                    "backgroundImageUrl": None,
                    "fontFamily": "Roboto",
                    "customCSS": ""
                },
                "layout": {
                    "headerStyle": "standard",
                    "sidebarStyle": "full", 
                    "cardStyle": "rounded",
                    "buttonStyle": "filled"
                },
                "messaging": {
                    "platformName": None,
                    "tagline": None,
                    "footerText": None,
                    "supportEmail": None,
                    "supportPhone": None
                },
                "features": {
                    "showPoweredBy": True,
                    "hideDefaultLogo": False,
                    "customDomain": None
                }
            }
            
            # Update existing records that don't have branding settings
            cur.execute("""
                UPDATE organization_settings 
                SET branding_settings = %s
                WHERE branding_settings = '{}'::jsonb OR branding_settings IS NULL
            """, [default_branding])
            
            # Create index for efficient branding queries
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_organization_settings_branding 
                ON organization_settings USING gin(branding_settings)
            """)
            
            conn.commit()
            logger.info("✅ Added branding_settings column with default values")
        
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
        logger.info("Rolling back organization branding settings migration...")
        
        with conn.cursor() as cur:
            # Drop the index
            cur.execute("DROP INDEX IF EXISTS idx_organization_settings_branding")
            
            # Remove the column
            cur.execute("ALTER TABLE organization_settings DROP COLUMN IF EXISTS branding_settings")
            
            conn.commit()
            logger.info("✅ Removed branding_settings column")
            
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