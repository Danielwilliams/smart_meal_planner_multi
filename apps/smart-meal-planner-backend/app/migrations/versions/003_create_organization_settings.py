"""
Migration: Create Organization Settings Table
ID: 002_create_organization_settings
Created: 2024
Description: Create organization_settings table for storing organization-level configurations
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
        logger.info("Starting organization settings table creation migration...")
        
        with conn.cursor() as cur:
            # Create organization_settings table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS organization_settings (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Default Client Preferences (JSON fields for flexibility)
                    default_client_preferences JSONB DEFAULT '{}',
                    
                    -- Client Management Settings
                    max_client_capacity INTEGER DEFAULT NULL, -- NULL means unlimited
                    invitation_approval_required BOOLEAN DEFAULT FALSE,
                    auto_assign_default_preferences BOOLEAN DEFAULT TRUE,
                    
                    -- Basic Organization Information
                    business_type VARCHAR(100) DEFAULT NULL, -- 'nutritionist', 'meal_prep', 'corporate_wellness', 'healthcare'
                    service_area TEXT DEFAULT NULL, -- Geographic regions or delivery zones
                    operating_hours JSONB DEFAULT '{}', -- Store business hours as JSON
                    timezone VARCHAR(50) DEFAULT 'UTC',
                    
                    -- Contact and Profile
                    contact_email VARCHAR(255) DEFAULT NULL,
                    contact_phone VARCHAR(20) DEFAULT NULL,
                    website_url VARCHAR(255) DEFAULT NULL,
                    logo_url VARCHAR(255) DEFAULT NULL,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    
                    -- Ensure one settings record per organization
                    UNIQUE(organization_id)
                )
            """)
            
            # Create index for efficient lookups
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_organization_settings_org_id 
                ON organization_settings(organization_id)
            """)
            
            # Create trigger function for updating updated_at timestamp
            cur.execute("""
                CREATE OR REPLACE FUNCTION update_organization_settings_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            """)
            
            # Create trigger
            cur.execute("""
                DROP TRIGGER IF EXISTS update_organization_settings_updated_at ON organization_settings
            """)
            
            cur.execute("""
                CREATE TRIGGER update_organization_settings_updated_at
                    BEFORE UPDATE ON organization_settings
                    FOR EACH ROW
                    EXECUTE FUNCTION update_organization_settings_updated_at()
            """)
            
            # Insert default settings for existing organizations
            cur.execute("""
                INSERT INTO organization_settings (organization_id)
                SELECT id FROM organizations
                WHERE id NOT IN (SELECT organization_id FROM organization_settings WHERE organization_id IS NOT NULL)
            """)
            
            conn.commit()
            logger.info("✅ Created organization_settings table with default records for existing organizations")
        
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
        logger.info("Rolling back organization settings table creation migration...")
        
        with conn.cursor() as cur:
            # Drop trigger
            cur.execute("DROP TRIGGER IF EXISTS update_organization_settings_updated_at ON organization_settings")
            
            # Drop function
            cur.execute("DROP FUNCTION IF EXISTS update_organization_settings_updated_at()")
            
            # Drop index
            cur.execute("DROP INDEX IF EXISTS idx_organization_settings_org_id")
            
            # Drop table
            cur.execute("DROP TABLE IF EXISTS organization_settings")
            
            conn.commit()
            logger.info("✅ Dropped organization_settings table and related objects")
            
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