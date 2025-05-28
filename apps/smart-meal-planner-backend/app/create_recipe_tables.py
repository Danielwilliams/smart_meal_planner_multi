# app/create_recipe_tables.py
import logging
import psycopg2
from psycopg2.extras import RealDictCursor
from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

def get_db_connection():
    """Get database connection using configuration settings"""
    try:
        logger.info(f"Attempting to connect to database at {DB_HOST}:{DB_PORT}")
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        return conn
    except psycopg2.OperationalError as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        logger.error(f"Database connection parameters: host={DB_HOST}, port={DB_PORT}, dbname={DB_NAME}, user={DB_USER}")
        raise Exception("Unable to connect to database. Please check your connection settings.")
    except Exception as e:
        logger.error(f"Unexpected error connecting to database: {str(e)}")
        raise Exception(f"An unexpected error occurred while connecting to database: {str(e)}")

def create_tables():
    """Create recipe-related tables if they don't exist"""
    conn = None
    try:
        conn = get_db_connection()
        conn.autocommit = False  # Start transaction
        cursor = conn.cursor()
        
        # Create scraped_recipes table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS scraped_recipes (
                id SERIAL PRIMARY KEY,
                title VARCHAR(255) NOT NULL,
                source VARCHAR(100),
                source_url TEXT,
                complexity VARCHAR(50),
                cuisine VARCHAR(100),
                image_url TEXT,
                prep_time INTEGER,
                cook_time INTEGER,
                total_time INTEGER,
                servings INTEGER,
                is_verified BOOLEAN DEFAULT FALSE,
                instructions TEXT,
                date_scraped TIMESTAMP,
                date_processed TIMESTAMP,
                component_type VARCHAR(100),
                diet_tags JSONB DEFAULT '[]',
                categories JSONB DEFAULT '{}',
                metadata JSONB DEFAULT '{}',
                flavor_profile JSONB DEFAULT '{}',
                raw_content TEXT,
                cooking_method VARCHAR(100),
                meal_part VARCHAR(100)
            )
        """)
        logger.info("Created scraped_recipes table (if it didn't exist)")
        
        # Create recipe_ingredients table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recipe_ingredients (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                amount VARCHAR(50),
                unit VARCHAR(50),
                is_main_ingredient BOOLEAN DEFAULT TRUE,
                UNIQUE (recipe_id, name)
            )
        """)
        logger.info("Created recipe_ingredients table (if it didn't exist)")
        
        # Create recipe_tags table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recipe_tags (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE CASCADE,
                tag VARCHAR(100) NOT NULL,
                UNIQUE (recipe_id, tag)
            )
        """)
        logger.info("Created recipe_tags table (if it didn't exist)")
        
        # Create recipe_nutrition table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recipe_nutrition (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE CASCADE,
                calories INTEGER DEFAULT 0,
                protein FLOAT DEFAULT 0,
                carbs FLOAT DEFAULT 0,
                fat FLOAT DEFAULT 0,
                servings_per_recipe INTEGER DEFAULT 1,
                is_calculated BOOLEAN DEFAULT FALSE,
                UNIQUE (recipe_id)
            )
        """)
        logger.info("Created recipe_nutrition table (if it didn't exist)")
        
        # Create recipe_components table
        cursor.execute("""
            CREATE TABLE IF NOT EXISTS recipe_components (
                id SERIAL PRIMARY KEY,
                recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE CASCADE,
                name VARCHAR(255) NOT NULL,
                component_type VARCHAR(100) NOT NULL,
                is_verified BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (recipe_id)
            )
        """)
        logger.info("Created recipe_components table (if it didn't exist)")
        
        # Check if saved_recipes already exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'saved_recipes'
            )
        """)
        saved_recipes_exists = cursor.fetchone()[0]
        
        if saved_recipes_exists:
            # Add scraped_recipe_id column to saved_recipes if it doesn't exist
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_schema = 'public' 
                    AND table_name = 'saved_recipes' 
                    AND column_name = 'scraped_recipe_id'
                )
            """)
            scraped_recipe_id_exists = cursor.fetchone()[0]
            
            if not scraped_recipe_id_exists:
                # Add scraped_recipe_id column to saved_recipes
                cursor.execute("""
                    ALTER TABLE saved_recipes 
                    ADD COLUMN scraped_recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE SET NULL
                """)
                logger.info("Added scraped_recipe_id column to saved_recipes table")
        
        # Check if recipe_interactions already exists
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_interactions'
            )
        """)
        recipe_interactions_exists = cursor.fetchone()[0]
        
        if not recipe_interactions_exists:
            # Create recipe_interactions table
            cursor.execute("""
                CREATE TABLE IF NOT EXISTS recipe_interactions (
                    id SERIAL PRIMARY KEY,
                    user_id INTEGER NOT NULL,
                    recipe_id INTEGER NOT NULL,
                    interaction_type VARCHAR(50) NOT NULL,
                    rating INTEGER,
                    timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                )
            """)
            logger.info("Created recipe_interactions table")
        
        # Create indexes for better performance
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id 
            ON recipe_ingredients(recipe_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_recipe_tags_recipe_id 
            ON recipe_tags(recipe_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_saved_recipes_user_id 
            ON saved_recipes(user_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_saved_recipes_scraped_recipe_id 
            ON saved_recipes(scraped_recipe_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_recipe_interactions_user_id 
            ON recipe_interactions(user_id)
        """)
        
        cursor.execute("""
            CREATE INDEX IF NOT EXISTS idx_recipe_interactions_recipe_id 
            ON recipe_interactions(recipe_id)
        """)
        
        logger.info("Created all necessary indexes")
        
        # Commit the transaction
        conn.commit()
        logger.info("All tables and indexes created successfully")
        
    except Exception as e:
        logger.error(f"Error creating tables: {str(e)}")
        if conn:
            conn.rollback()
        raise
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    try:
        logger.info("Starting recipe tables migration script")
        create_tables()
        logger.info("Recipe tables migration completed successfully")
    except Exception as e:
        logger.error(f"Migration failed: {str(e)}")