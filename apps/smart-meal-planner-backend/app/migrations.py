"""
Database migration functions to update the schema when needed
"""
import logging
import psycopg2
from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

logger = logging.getLogger(__name__)

def get_db_connection():
    """Get a direct database connection for migrations"""
    return psycopg2.connect(
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )

def run_migrations():
    """
    Run all necessary database migrations
    """
    logger.info("Starting database migrations...")
    
    # Run all migrations in sequence
    add_for_client_id_to_menus()
    
    logger.info("Database migrations completed successfully")

def add_for_client_id_to_menus():
    """
    Add the for_client_id column to the menus table if it doesn't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if the column already exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'menus' AND column_name = 'for_client_id';
            """)
            
            if not cursor.fetchone():
                logger.info("Adding for_client_id column to menus table")
                cursor.execute("""
                    ALTER TABLE menus 
                    ADD COLUMN for_client_id INTEGER DEFAULT NULL;
                """)
                conn.commit()
                logger.info("for_client_id column added successfully")
            else:
                logger.info("for_client_id column already exists in menus table")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error adding for_client_id column: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()