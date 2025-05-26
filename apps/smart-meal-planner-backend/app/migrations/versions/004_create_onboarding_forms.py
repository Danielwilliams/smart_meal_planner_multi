"""
Migration: Create Custom Onboarding Forms Tables
ID: 004_create_onboarding_forms
Created: 2024
Description: Create tables for custom onboarding forms and responses
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
        logger.info("Starting custom onboarding forms tables creation migration...")
        
        with conn.cursor() as cur:
            # Create onboarding_forms table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS onboarding_forms (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Form metadata
                    name VARCHAR(255) NOT NULL,
                    description TEXT,
                    is_active BOOLEAN DEFAULT TRUE,
                    is_required BOOLEAN DEFAULT FALSE,
                    
                    -- Form structure stored as JSON
                    form_fields JSONB NOT NULL DEFAULT '[]',
                    
                    -- Form settings
                    settings JSONB DEFAULT '{}',
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER REFERENCES user_profiles(id),
                    
                    -- Ensure organization can have multiple forms
                    UNIQUE(organization_id, name)
                )
            """)
            
            # Create onboarding_responses table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS onboarding_responses (
                    id SERIAL PRIMARY KEY,
                    form_id INTEGER REFERENCES onboarding_forms(id) ON DELETE CASCADE,
                    client_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Response data stored as JSON
                    response_data JSONB NOT NULL DEFAULT '{}',
                    
                    -- Response metadata
                    status VARCHAR(50) DEFAULT 'completed', -- 'draft', 'completed', 'reviewed'
                    completed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    reviewed_by INTEGER REFERENCES user_profiles(id),
                    reviewed_at TIMESTAMP,
                    
                    -- Notes from organization
                    notes TEXT,
                    
                    -- Ensure one response per client per form
                    UNIQUE(form_id, client_id)
                )
            """)
            
            # Create indexes for performance
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_onboarding_forms_org_id 
                ON onboarding_forms(organization_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_onboarding_forms_active 
                ON onboarding_forms(organization_id, is_active) 
                WHERE is_active = TRUE
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_onboarding_responses_form_id 
                ON onboarding_responses(form_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_onboarding_responses_client_id 
                ON onboarding_responses(client_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_onboarding_responses_org_id 
                ON onboarding_responses(organization_id)
            """)
            
            # Create trigger function for updating updated_at timestamp
            cur.execute("""
                CREATE OR REPLACE FUNCTION update_onboarding_forms_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            """)
            
            # Create trigger
            cur.execute("""
                DROP TRIGGER IF EXISTS update_onboarding_forms_updated_at ON onboarding_forms
            """)
            
            cur.execute("""
                CREATE TRIGGER update_onboarding_forms_updated_at
                    BEFORE UPDATE ON onboarding_forms
                    FOR EACH ROW
                    EXECUTE FUNCTION update_onboarding_forms_updated_at()
            """)
            
            # Add comments to tables for documentation
            cur.execute("""
                COMMENT ON TABLE onboarding_forms IS 
                'Custom onboarding forms created by organizations for client intake'
            """)
            
            cur.execute("""
                COMMENT ON COLUMN onboarding_forms.form_fields IS 
                'JSON array of form field definitions with type, label, validation, etc.'
            """)
            
            cur.execute("""
                COMMENT ON TABLE onboarding_responses IS 
                'Client responses to custom onboarding forms'
            """)
            
            cur.execute("""
                COMMENT ON COLUMN onboarding_responses.response_data IS 
                'JSON object containing client responses mapped to form field IDs'
            """)
            
            conn.commit()
            logger.info("✅ Created onboarding forms tables successfully")
        
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
        logger.info("Rolling back onboarding forms tables creation migration...")
        
        with conn.cursor() as cur:
            # Drop triggers
            cur.execute("DROP TRIGGER IF EXISTS update_onboarding_forms_updated_at ON onboarding_forms")
            
            # Drop function
            cur.execute("DROP FUNCTION IF EXISTS update_onboarding_forms_updated_at()")
            
            # Drop indexes
            cur.execute("DROP INDEX IF EXISTS idx_onboarding_forms_org_id")
            cur.execute("DROP INDEX IF EXISTS idx_onboarding_forms_active")
            cur.execute("DROP INDEX IF EXISTS idx_onboarding_responses_form_id")
            cur.execute("DROP INDEX IF EXISTS idx_onboarding_responses_client_id")
            cur.execute("DROP INDEX IF EXISTS idx_onboarding_responses_org_id")
            
            # Drop tables (responses first due to foreign key)
            cur.execute("DROP TABLE IF EXISTS onboarding_responses")
            cur.execute("DROP TABLE IF EXISTS onboarding_forms")
            
            conn.commit()
            logger.info("✅ Dropped onboarding forms tables and related objects")
            
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