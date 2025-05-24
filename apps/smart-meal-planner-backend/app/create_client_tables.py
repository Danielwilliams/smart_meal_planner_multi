# app/create_client_tables.py
from app.db import get_db_connection
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_tables():
    """
    Create or update tables related to client functionality
    """
    logger.info("Creating or updating client-related tables...")
    conn = get_db_connection()
    
    try:
        with conn.cursor() as cur:
            # Add shared_with_organization column to menus table if it doesn't exist
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'menus' AND column_name = 'shared_with_organization'
            """)
            
            if not cur.fetchone():
                cur.execute("""
                    ALTER TABLE menus
                    ADD COLUMN shared_with_organization BOOLEAN DEFAULT FALSE
                """)
                logger.info("Added shared_with_organization column to menus table")
            
            # Add shared_with_organization column to saved_recipes table if it doesn't exist
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'saved_recipes' AND column_name = 'shared_with_organization'
            """)
            
            if not cur.fetchone():
                cur.execute("""
                    ALTER TABLE saved_recipes
                    ADD COLUMN shared_with_organization BOOLEAN DEFAULT FALSE
                """)
                logger.info("Added shared_with_organization column to saved_recipes table")
            
            # Add organization_id column to user_profiles table if it doesn't exist
            cur.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'user_profiles' AND column_name = 'organization_id'
            """)
            
            if not cur.fetchone():
                cur.execute("""
                    ALTER TABLE user_profiles
                    ADD COLUMN organization_id INTEGER REFERENCES organizations(id) ON DELETE SET NULL
                """)
                logger.info("Added organization_id column to user_profiles table")
            
            # Create shared_recipes table if it doesn't exist
            cur.execute("""
                CREATE TABLE IF NOT EXISTS shared_recipes (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER REFERENCES saved_recipes(id) ON DELETE CASCADE,
                    shared_with INTEGER REFERENCES user_profiles(id) ON DELETE CASCADE,
                    organization_id INTEGER REFERENCES organizations(id) ON DELETE CASCADE,
                    permission_level VARCHAR(20) DEFAULT 'read',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (recipe_id, shared_with),
                    UNIQUE (recipe_id, organization_id)
                )
            """)
            logger.info("Created or verified shared_recipes table exists")
            
            # Commit changes
            conn.commit()
            logger.info("Client database schema updates completed successfully")
            
    except Exception as e:
        logger.error(f"Error creating client tables: {str(e)}")
        conn.rollback()
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    create_tables()