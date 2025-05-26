"""
Migration: Create Client Notes System
ID: 005_create_client_notes
Created: 2024
Description: Create table for organization notes about their clients
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
        logger.info("Starting client notes system creation migration...")
        
        with conn.cursor() as cur:
            # Create client_notes table
            cur.execute("""
                CREATE TABLE IF NOT EXISTS client_notes (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    client_id INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
                    
                    -- Note content and metadata
                    title VARCHAR(255),
                    content TEXT NOT NULL,
                    note_type VARCHAR(50) DEFAULT 'general', -- 'general', 'consultation', 'preference', 'goal', 'observation'
                    priority VARCHAR(20) DEFAULT 'normal', -- 'low', 'normal', 'high', 'urgent'
                    
                    -- Privacy and visibility
                    is_private BOOLEAN DEFAULT TRUE, -- Private to organization, not visible to client
                    is_archived BOOLEAN DEFAULT FALSE,
                    
                    -- Tags and categories
                    tags JSONB DEFAULT '[]', -- Flexible tagging system
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER REFERENCES user_profiles(id),
                    updated_by INTEGER REFERENCES user_profiles(id),
                    
                    -- Note: Organization-client relationship validation handled in application logic
                )
            """)
            
            # Create indexes for performance
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_org_id 
                ON client_notes(organization_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_client_id 
                ON client_notes(client_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_org_client 
                ON client_notes(organization_id, client_id)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_type 
                ON client_notes(organization_id, note_type) 
                WHERE is_archived = FALSE
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_priority 
                ON client_notes(organization_id, priority) 
                WHERE is_archived = FALSE AND priority IN ('high', 'urgent')
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_tags 
                ON client_notes USING GIN(tags)
            """)
            
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_client_notes_created_at 
                ON client_notes(organization_id, created_at DESC)
            """)
            
            # Create trigger function for updating updated_at timestamp
            cur.execute("""
                CREATE OR REPLACE FUNCTION update_client_notes_updated_at()
                RETURNS TRIGGER AS $$
                BEGIN
                    NEW.updated_at = CURRENT_TIMESTAMP;
                    NEW.updated_by = NEW.updated_by; -- Will be set by application
                    RETURN NEW;
                END;
                $$ language 'plpgsql'
            """)
            
            # Create trigger
            cur.execute("""
                DROP TRIGGER IF EXISTS update_client_notes_updated_at ON client_notes
            """)
            
            cur.execute("""
                CREATE TRIGGER update_client_notes_updated_at
                    BEFORE UPDATE ON client_notes
                    FOR EACH ROW
                    EXECUTE FUNCTION update_client_notes_updated_at()
            """)
            
            # Create note templates table for common note types
            cur.execute("""
                CREATE TABLE IF NOT EXISTS client_note_templates (
                    id SERIAL PRIMARY KEY,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    
                    -- Template details
                    name VARCHAR(255) NOT NULL,
                    template_content TEXT NOT NULL,
                    note_type VARCHAR(50) DEFAULT 'general',
                    suggested_tags JSONB DEFAULT '[]',
                    
                    -- Usage tracking
                    is_active BOOLEAN DEFAULT TRUE,
                    usage_count INTEGER DEFAULT 0,
                    
                    -- Metadata
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    created_by INTEGER REFERENCES user_profiles(id),
                    
                    UNIQUE(organization_id, name)
                )
            """)
            
            # Index for note templates
            cur.execute("""
                CREATE INDEX IF NOT EXISTS idx_note_templates_org_id 
                ON client_note_templates(organization_id, is_active)
            """)
            
            # Add comments to tables for documentation
            cur.execute("""
                COMMENT ON TABLE client_notes IS 
                'Private notes that organizations can keep about their clients'
            """)
            
            cur.execute("""
                COMMENT ON COLUMN client_notes.is_private IS 
                'TRUE means only organization can see, FALSE means client can also see'
            """)
            
            cur.execute("""
                COMMENT ON COLUMN client_notes.tags IS 
                'JSON array of tags for categorizing and searching notes'
            """)
            
            cur.execute("""
                COMMENT ON TABLE client_note_templates IS 
                'Reusable note templates for common client note scenarios'
            """)
            
            # Insert some default note templates (skip if organizations table structure unknown)
            try:
                cur.execute("""
                    INSERT INTO client_note_templates 
                    (organization_id, name, template_content, note_type, suggested_tags, created_by)
                    SELECT 
                        o.id,
                        'Initial Consultation',
                        'Client Goals:\n- \n\nCurrent Challenges:\n- \n\nKey Observations:\n- \n\nNext Steps:\n- ',
                        'consultation',
                        '["initial", "consultation", "goals"]',
                        COALESCE(o.owner_id, o.created_by, 1)
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
                cur.execute("""
                    INSERT INTO client_note_templates 
                    (organization_id, name, template_content, note_type, suggested_tags, created_by)
                    SELECT 
                        o.id,
                        'Progress Check',
                        'Progress Since Last Session:\n- \n\nChallenges Discussed:\n- \n\nAdjustments Made:\n- \n\nNext Session Goals:\n- ',
                        'consultation',
                        '["progress", "follow-up", "consultation"]',
                        COALESCE(o.owner_id, o.created_by, 1)
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
                
                cur.execute("""
                    INSERT INTO client_note_templates 
                    (organization_id, name, template_content, note_type, suggested_tags, created_by)
                    SELECT 
                        o.id,
                        'Preference Update',
                        'Updated Preferences:\n- \n\nReason for Change:\n- \n\nImpact on Meal Plans:\n- \n\nClient Feedback:\n- ',
                        'preference',
                        '["preferences", "update", "dietary"]',
                        COALESCE(o.owner_id, o.created_by, 1)
                    FROM organizations o
                    WHERE o.id IS NOT NULL
                    ON CONFLICT (organization_id, name) DO NOTHING
                """)
            except Exception as template_error:
                logger.warning(f"Could not create default templates: {template_error}")
                # Continue without templates - they can be created later
            
            conn.commit()
            logger.info("✅ Created client notes system successfully")
        
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
        logger.info("Rolling back client notes system creation migration...")
        
        with conn.cursor() as cur:
            # Drop triggers
            cur.execute("DROP TRIGGER IF EXISTS update_client_notes_updated_at ON client_notes")
            
            # Drop function
            cur.execute("DROP FUNCTION IF EXISTS update_client_notes_updated_at()")
            
            # Drop indexes
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_org_id")
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_client_id")
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_org_client")
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_type")
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_priority")
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_tags")
            cur.execute("DROP INDEX IF EXISTS idx_client_notes_created_at")
            cur.execute("DROP INDEX IF EXISTS idx_note_templates_org_id")
            
            # Drop tables
            cur.execute("DROP TABLE IF EXISTS client_note_templates")
            cur.execute("DROP TABLE IF EXISTS client_notes")
            
            conn.commit()
            logger.info("✅ Dropped client notes system tables and related objects")
            
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