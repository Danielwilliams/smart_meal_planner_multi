"""Add user management fields

This migration adds fields needed for user management including:
- is_active flag for soft delete/pause functionality
- deleted_at timestamp for soft deletes
- deleted_by for audit trail
- paused_at for temporary suspension
- paused_by for audit trail
- pause_reason for documentation
"""

from datetime import datetime
import logging

logger = logging.getLogger(__name__)

def upgrade(conn):
    """Add user management fields to users table"""
    cursor = conn.cursor()
    
    try:
        # Add is_active field for soft delete/pause
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE
        """)
        
        # Add soft delete fields
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP DEFAULT NULL
        """)
        
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS deleted_by INTEGER DEFAULT NULL
        """)
        
        # Add pause/suspension fields
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS paused_at TIMESTAMP DEFAULT NULL
        """)
        
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS paused_by INTEGER DEFAULT NULL
        """)
        
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS pause_reason TEXT DEFAULT NULL
        """)
        
        # Add index for active users
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_profiles_is_active 
            ON user_profiles(is_active)
        """)
        
        # Add index for organization users
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_profiles_organization_active 
            ON user_profiles(organization_id, is_active) 
            WHERE organization_id IS NOT NULL
        """)
        
        # Create user_management_logs table for audit trail
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS user_management_logs (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL,
                action VARCHAR(50) NOT NULL, -- 'paused', 'unpaused', 'deleted', 'restored'
                performed_by INTEGER NOT NULL,
                performed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                reason TEXT,
                metadata JSONB DEFAULT '{}',
                ip_address VARCHAR(45),
                user_agent TEXT,
                FOREIGN KEY (user_id) REFERENCES user_profiles(id),
                FOREIGN KEY (performed_by) REFERENCES user_profiles(id)
            )
        """)
        
        # Add indexes for audit logs
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_management_logs_user_id 
            ON user_management_logs(user_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_management_logs_performed_by 
            ON user_management_logs(performed_by)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_management_logs_action 
            ON user_management_logs(action)
        """)
        
        # Add role field for system administrators
        cursor.execute("""
            ALTER TABLE user_profiles 
            ADD COLUMN IF NOT EXISTS system_role VARCHAR(50) DEFAULT NULL
        """)
        
        # Create index for system roles
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_user_profiles_system_role 
            ON user_profiles(system_role) 
            WHERE system_role IS NOT NULL
        """)
        
        conn.commit()
        logger.info("Successfully added user management fields")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error adding user management fields: {e}")
        raise

def downgrade(conn):
    """Remove user management fields"""
    cursor = conn.cursor()
    
    try:
        # Drop indexes first
        cursor.execute("DROP INDEX IF EXISTS idx_user_profiles_is_active")
        cursor.execute("DROP INDEX IF EXISTS idx_user_profiles_organization_active")
        cursor.execute("DROP INDEX IF EXISTS idx_user_management_logs_user_id")
        cursor.execute("DROP INDEX IF EXISTS idx_user_management_logs_performed_by")
        cursor.execute("DROP INDEX IF EXISTS idx_user_management_logs_action")
        cursor.execute("DROP INDEX IF EXISTS idx_user_profiles_system_role")
        
        # Drop user_management_logs table
        cursor.execute("DROP TABLE IF EXISTS user_management_logs")
        
        # Drop columns from users table
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS is_active")
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS deleted_at")
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS deleted_by")
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS paused_at")
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS paused_by")
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS pause_reason")
        cursor.execute("ALTER TABLE user_profiles DROP COLUMN IF EXISTS system_role")
        
        conn.commit()
        logger.info("Successfully removed user management fields")
        
    except Exception as e:
        conn.rollback()
        logger.error(f"Error removing user management fields: {e}")
        raise