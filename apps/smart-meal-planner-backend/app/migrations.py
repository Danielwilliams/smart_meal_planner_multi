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
    create_ai_model_tables()
    create_recipe_component_tables()
    
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

def create_ai_model_tables():
    """
    Create tables needed for AI model functionality
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Create model_training_state table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS model_training_state (
                    id SERIAL PRIMARY KEY,
                    last_trained TIMESTAMP,
                    recipe_count INTEGER,
                    status VARCHAR(50),
                    model_path TEXT,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create ai_models table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS ai_models (
                    id SERIAL PRIMARY KEY,
                    model_name VARCHAR(100) NOT NULL,
                    model_type VARCHAR(50) NOT NULL,
                    model_path TEXT,
                    is_active BOOLEAN DEFAULT FALSE,
                    version VARCHAR(50),
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    metadata JSONB DEFAULT '{}'
                )
            """)
            
            # Create user_model_preferences table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS user_model_preferences (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    preferred_model VARCHAR(100) DEFAULT 'default',
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            conn.commit()
            logger.info("AI model tables created successfully")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error creating AI model tables: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()

def create_recipe_component_tables():
    """
    Create tables needed for recipe component extraction and custom meal building
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Create recipe_components table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_components (
                    id SERIAL PRIMARY KEY,
                    recipe_id INTEGER,
                    name VARCHAR(255) NOT NULL,
                    component_type VARCHAR(100) NOT NULL,
                    cuisine_type VARCHAR(100),
                    is_verified BOOLEAN DEFAULT FALSE,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create component_compatibility table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS component_compatibility (
                    id SERIAL PRIMARY KEY,
                    component1_id INTEGER REFERENCES recipe_components(id) ON DELETE CASCADE,
                    component2_id INTEGER REFERENCES recipe_components(id) ON DELETE CASCADE,
                    compatibility_score INTEGER DEFAULT 0,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    UNIQUE (component1_id, component2_id)
                )
            """)
            
            # Create custom_menus table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS custom_menus (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    organization_id INTEGER,
                    for_client_id INTEGER,
                    title VARCHAR(255),
                    meal_plan_json JSONB NOT NULL,
                    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            
            # Create indexes for better performance
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_recipe_components_recipe_id 
                ON recipe_components(recipe_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_component_compatibility_component1_id 
                ON component_compatibility(component1_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_component_compatibility_component2_id 
                ON component_compatibility(component2_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_custom_menus_user_id 
                ON custom_menus(user_id)
            """)
            
            cursor.execute("""
                CREATE INDEX IF NOT EXISTS idx_custom_menus_for_client_id 
                ON custom_menus(for_client_id)
            """)
            
            conn.commit()
            logger.info("Recipe component tables created successfully")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error creating recipe component tables: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()