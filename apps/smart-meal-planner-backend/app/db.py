import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from fastapi import HTTPException
import logging
from contextlib import contextmanager
from app.config import RECAPTCHA_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

# Create a connection pool for better concurrency handling
# This allows multiple concurrent operations to use separate connections
try:
    connection_pool = pool.ThreadedConnectionPool(
        minconn=10,     # Minimum number of connections in the pool - increased for better concurrency
        maxconn=50,     # Maximum number of connections in the pool - increased for concurrent operations
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"Database connection pool created with 10-50 connections")
except Exception as e:
    logger.error(f"Failed to create database connection pool: {str(e)}")
    # We'll fall back to direct connections if the pool creation fails
    connection_pool = None

def get_db_connection():
    """Get database connection using configuration settings or from the connection pool"""
    try:
        if connection_pool:
            # Get a connection from the pool
            logger.debug("Getting connection from pool")
            conn = connection_pool.getconn()
            logger.debug("Connection obtained from pool")
            return conn
        else:
            # Fall back to direct connection if pool is not available
            logger.info(f"Connecting directly to database at {DB_HOST}:{DB_PORT}")
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
        raise HTTPException(
            status_code=500,
            detail="Unable to connect to database. Please try again later."
        )
    except Exception as e:
        logger.error(f"Unexpected error connecting to database: {str(e)}")
        raise HTTPException(
            status_code=500,
            detail="An unexpected error occurred while connecting to database."
        )

@contextmanager
def get_db_cursor(dict_cursor=True):
    """
    Context manager for safely handling database connections and cursors.

    Usage:
    ```
    with get_db_cursor() as (cursor, conn):
        cursor.execute("SELECT * FROM table")
        results = cursor.fetchall()
        conn.commit()  # if needed
    ```

    Args:
        dict_cursor (bool): If True, uses RealDictCursor, otherwise uses regular cursor

    Yields:
        tuple: (cursor, connection) tuple for use in the with block
    """
    conn = None
    cursor = None
    pooled = False
    try:
        # Get connection from pool or directly
        logger.info(f"Attempting to connect to database at {DB_HOST}:{DB_PORT}")
        conn = get_db_connection()
        pooled = connection_pool is not None

        # Create cursor
        if dict_cursor:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()

        # Yield the cursor and connection
        yield cursor, conn

    except Exception as e:
        # Handle exception and rollback if needed
        logger.error(f"Database error in context manager: {str(e)}", exc_info=True)
        if conn:
            try:
                conn.rollback()
                logger.info("Transaction rolled back due to error")
            except Exception as rb_e:
                logger.error(f"Error during rollback: {str(rb_e)}")
        raise

    finally:
        # Always clean up resources
        if cursor:
            try:
                cursor.close()
                logger.debug("Database cursor closed successfully")
            except Exception as e:
                logger.warning(f"Error closing cursor: {str(e)}")

        if conn:
            try:
                if pooled and connection_pool:
                    # Return the connection to the pool instead of closing it
                    connection_pool.putconn(conn)
                    logger.debug("Database connection returned to pool")
                else:
                    # If not using a pool, close the connection directly
                    conn.close()
                    logger.debug("Database connection closed successfully")
            except Exception as e:
                logger.warning(f"Error handling connection cleanup: {str(e)}")

def close_all_connections():
    """Close all connections in the pool when shutting down the application"""
    if connection_pool:
        try:
            connection_pool.closeall()
            logger.info("All database connections in the pool have been closed")
        except Exception as e:
            logger.error(f"Error closing connection pool: {str(e)}")

def save_recipe(user_id, menu_id=None, recipe_id=None, recipe_name=None, day_number=None, 
               meal_time=None, notes=None, macros=None, ingredients=None, 
               instructions=None, complexity_level=None, appliance_used=None, servings=None,
               scraped_recipe_id=None, recipe_source=None):
    """Save a recipe or entire menu to user's favorites with complete recipe data"""
    try:
        logger.info(f"Saving recipe: user={user_id}, menu={menu_id}, recipe={recipe_id}, meal_time={meal_time}, scraped_id={scraped_recipe_id}, source={recipe_source}")
        logger.info(f"With ingredients: {ingredients}")
        logger.info(f"With instructions: {instructions}")
        logger.info(f"With macros: {macros}")
        
        with get_db_cursor() as (cur, conn):
            # Check if already saved
            if recipe_source == 'scraped':
                # For scraped recipes
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND scraped_recipe_id = %s
                """, (user_id, scraped_recipe_id))
            elif recipe_id and menu_id:
                # For regular menu recipes with recipe_id
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                """, (user_id, menu_id, recipe_id, meal_time))
            elif menu_id:
                # For entire menu
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                """, (user_id, menu_id))
            elif scraped_recipe_id:
                # Backup check for scraped recipes without recipe_source
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND scraped_recipe_id = %s
                """, (user_id, scraped_recipe_id))
            else:
                logger.warning("No valid identifiers provided for recipe checking")
                
            existing = cur.fetchone()
            logger.info(f"Existing saved recipe check: {existing}")
            
            # Convert complex objects to JSON
            import json
            macros_json = json.dumps(macros) if macros else None
            ingredients_json = json.dumps(ingredients) if ingredients else None
            instructions_json = json.dumps(instructions) if instructions else None
            
            if existing:
                # Update if already exists
                if recipe_source == 'scraped' or scraped_recipe_id:
                    cur.execute("""
                        UPDATE saved_recipes
                        SET notes = %s, created_at = CURRENT_TIMESTAMP
                        WHERE user_id = %s AND scraped_recipe_id = %s
                        RETURNING id
                    """, (notes, user_id, scraped_recipe_id))
                elif recipe_id and menu_id:
                    cur.execute("""
                        UPDATE saved_recipes
                        SET notes = %s, created_at = CURRENT_TIMESTAMP
                        WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                        RETURNING id
                    """, (notes, user_id, menu_id, recipe_id, meal_time))
                else:
                    cur.execute("""
                        UPDATE saved_recipes
                        SET notes = %s, created_at = CURRENT_TIMESTAMP
                        WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                        RETURNING id
                    """, (notes, user_id, menu_id))
            else:
                # Insert new saved recipe
                logger.info(f"Inserting new recipe with source: {recipe_source}")
                
                # Check if the saved_recipes table has all the columns we need
                cur.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = 'saved_recipes'
                """)
                columns = [row[0] for row in cur.fetchall()]
                
                # Check if scraped_recipe_id exists in the table
                if 'scraped_recipe_id' not in columns:
                    # Add the column if it doesn't exist
                    cur.execute("""
                        ALTER TABLE saved_recipes 
                        ADD COLUMN IF NOT EXISTS scraped_recipe_id INTEGER REFERENCES scraped_recipes(id) ON DELETE SET NULL,
                        ADD COLUMN IF NOT EXISTS recipe_source VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS macros JSONB,
                        ADD COLUMN IF NOT EXISTS ingredients JSONB,
                        ADD COLUMN IF NOT EXISTS instructions JSONB,
                        ADD COLUMN IF NOT EXISTS complexity_level VARCHAR(50),
                        ADD COLUMN IF NOT EXISTS appliance_used VARCHAR(100),
                        ADD COLUMN IF NOT EXISTS servings INTEGER
                    """)
                    logger.info("Added missing columns to saved_recipes table")
                
                # Determine if to use the full insert with all columns
                has_extended_columns = all(col in columns for col in ['macros', 'ingredients', 'instructions'])
                
                if has_extended_columns or 'scraped_recipe_id' in columns:
                    # Extended insert with all columns
                    cur.execute("""
                        INSERT INTO saved_recipes
                        (user_id, menu_id, recipe_id, recipe_name, day_number, meal_time, 
                         notes, macros, ingredients, instructions, complexity_level, 
                         appliance_used, servings, scraped_recipe_id, recipe_source)
                        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (user_id, menu_id, recipe_id, recipe_name, day_number, meal_time, 
                          notes, macros_json, ingredients_json, instructions_json,
                          complexity_level, appliance_used, servings, scraped_recipe_id, recipe_source))
                else:
                    # Basic insert with original columns only
                    cur.execute("""
                        INSERT INTO saved_recipes
                        (user_id, menu_id, recipe_id, recipe_name, day_number, meal_time, notes)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        RETURNING id
                    """, (user_id, menu_id, recipe_id, recipe_name, day_number, meal_time, notes))
            
            saved_id = cur.fetchone()[0]
            logger.info(f"Successfully saved/updated recipe with ID: {saved_id}")
            
            # Check if recipe_interactions table exists and create it if it doesn't
            try:
                cur.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.tables 
                        WHERE table_schema = 'public' AND table_name = 'recipe_interactions'
                    )
                """)
                
                if not cur.fetchone()[0]:
                    logger.info("Creating recipe_interactions table on the fly")
                    cur.execute("""
                        CREATE TABLE IF NOT EXISTS recipe_interactions (
                            id SERIAL PRIMARY KEY,
                            user_id INTEGER NOT NULL,
                            recipe_id INTEGER,
                            interaction_type VARCHAR(50) NOT NULL,
                            rating INTEGER,
                            timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                        )
                    """)
                
                # Now try to log the interaction
                try:
                    cur.execute("""
                        INSERT INTO recipe_interactions
                        (user_id, recipe_id, interaction_type, timestamp)
                        VALUES (%s, %s, 'saved', CURRENT_TIMESTAMP)
                    """, (user_id, recipe_id or scraped_recipe_id or menu_id))
                except Exception as e:
                    logger.warning(f"Could not log recipe interaction: {e}")
            except Exception as e:
                logger.warning(f"Could not check/create recipe_interactions table: {e}")
            
            conn.commit()
            return saved_id
    except Exception as e:
        logger.error(f"Error saving recipe: {str(e)}", exc_info=True)
        return None

def unsave_recipe(user_id, saved_id=None, menu_id=None, recipe_id=None, meal_time=None, scraped_recipe_id=None):
    """Remove a recipe from saved/favorites"""
    try:
        logger.info(f"Unsaving recipe: user={user_id}, saved_id={saved_id}, menu={menu_id}, recipe={recipe_id}, scraped={scraped_recipe_id}")
        with get_db_cursor() as (cur, conn):
            if saved_id:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE id = %s AND user_id = %s
                    RETURNING id, recipe_id, menu_id, scraped_recipe_id
                """, (saved_id, user_id))
            elif scraped_recipe_id:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND scraped_recipe_id = %s
                    RETURNING id, recipe_id, menu_id, scraped_recipe_id
                """, (user_id, scraped_recipe_id))
            elif recipe_id and meal_time:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                    RETURNING id, recipe_id, menu_id, scraped_recipe_id
                """, (user_id, menu_id, recipe_id, meal_time))
            else:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                    RETURNING id, recipe_id, menu_id, scraped_recipe_id
                """, (user_id, menu_id))
            
            result = cur.fetchone()
            
            if result:
                # Handle the result with or without scraped_recipe_id
                if len(result) >= 4:
                    deleted_id, recipe_id_val, menu_id_val, scraped_id_val = result
                else:
                    deleted_id, recipe_id_val, menu_id_val = result
                    scraped_id_val = None
                
                logger.info(f"Successfully removed saved recipe with ID: {deleted_id}")
                
                # Check if recipe_interactions table exists and create it if it doesn't
                try:
                    cur.execute("""
                        SELECT EXISTS (
                            SELECT FROM information_schema.tables 
                            WHERE table_schema = 'public' AND table_name = 'recipe_interactions'
                        )
                    """)
                    
                    if not cur.fetchone()[0]:
                        logger.info("Creating recipe_interactions table on the fly")
                        cur.execute("""
                            CREATE TABLE IF NOT EXISTS recipe_interactions (
                                id SERIAL PRIMARY KEY,
                                user_id INTEGER NOT NULL,
                                recipe_id INTEGER,
                                interaction_type VARCHAR(50) NOT NULL,
                                rating INTEGER,
                                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                            )
                        """)
                    
                    # Now try to log the interaction
                    reference_id = scraped_id_val or recipe_id_val or menu_id_val
                    cur.execute("""
                        INSERT INTO recipe_interactions
                        (user_id, recipe_id, interaction_type, timestamp)
                        VALUES (%s, %s, 'unsaved', CURRENT_TIMESTAMP)
                    """, (user_id, reference_id))
                except Exception as e:
                    logger.warning(f"Could not log recipe interaction: {e}")
                
                conn.commit()
                return True
            
            logger.info("No saved recipe found to remove")
            return False
    except Exception as e:
        logger.error(f"Error unsaving recipe: {str(e)}", exc_info=True)
        return False

def get_user_saved_recipes(user_id):
    """Get all saved recipes for a user"""
    try:
        logger.info(f"Getting saved recipes for user: {user_id}")
        with get_db_cursor() as (cur, conn):
            cur.execute("""
                SELECT sr.*, m.nickname as menu_nickname, sc.image_url, sc.title as scraped_title,
                       sc.complexity as scraped_complexity, sc.cuisine
                FROM saved_recipes sr
                LEFT JOIN menus m ON sr.menu_id = m.id
                LEFT JOIN scraped_recipes sc ON sr.scraped_recipe_id = sc.id
                WHERE sr.user_id = %s
                ORDER BY sr.created_at DESC
            """, (user_id,))
            
            results = cur.fetchall()
            logger.info(f"Found {len(results)} saved recipes for user {user_id}")
            return results
    except Exception as e:
        logger.error(f"Error getting saved recipes: {str(e)}", exc_info=True)
        return []

def is_recipe_saved(user_id, menu_id, recipe_id=None, meal_time=None):
    """Check if a recipe is saved by the user"""
    try:
        logger.info(f"Checking if recipe is saved: user={user_id}, menu={menu_id}, recipe={recipe_id}")
        with get_db_cursor(dict_cursor=False) as (cur, conn):
            if recipe_id and meal_time:
                cur.execute("""
                    SELECT COUNT(*) FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                """, (user_id, menu_id, recipe_id, meal_time))
            else:
                cur.execute("""
                    SELECT COUNT(*) FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                """, (user_id, menu_id))
                
            count = cur.fetchone()[0]
            logger.info(f"Recipe saved status: {bool(count)}")
            return count > 0
    except Exception as e:
        logger.error(f"Error checking if recipe is saved: {str(e)}", exc_info=True)
        return False

def get_saved_recipe_id(user_id, menu_id, recipe_id=None, meal_time=None):
    """Get the saved_id for a recipe if it exists"""
    try:
        logger.info(f"Getting saved recipe ID: user={user_id}, menu={menu_id}, recipe={recipe_id}")
        with get_db_cursor(dict_cursor=False) as (cur, conn):
            if recipe_id and meal_time:
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                """, (user_id, menu_id, recipe_id, meal_time))
            else:
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                """, (user_id, menu_id))
                
            result = cur.fetchone()
            saved_id = result[0] if result else None
            logger.info(f"Found saved recipe ID: {saved_id}")
            return saved_id
    except Exception as e:
        logger.error(f"Error getting saved recipe ID: {str(e)}", exc_info=True)
        return None

def get_saved_recipe_by_id(user_id, saved_id):
    """Get saved recipe details by ID"""
    try:
        logger.info(f"Getting saved recipe by ID: {saved_id}")
        with get_db_cursor() as (cur, conn):
            cur.execute("""
                SELECT sr.*, m.nickname as menu_nickname
                FROM saved_recipes sr
                LEFT JOIN menus m ON sr.menu_id = m.id
                WHERE sr.id = %s AND sr.user_id = %s
            """, (saved_id, user_id))
            
            result = cur.fetchone()
            logger.info(f"Found saved recipe: {result is not None}")
            return result
    except Exception as e:
        logger.error(f"Error getting saved recipe by ID: {str(e)}", exc_info=True)
        return None

def track_recipe_interaction(user_id, recipe_id, interaction_type, rating=None):
    """Record user interaction with a recipe"""
    try:
        logger.info(f"Tracking recipe interaction: user={user_id}, recipe={recipe_id}, type={interaction_type}")
        with get_db_cursor(dict_cursor=False) as (cur, conn):
            cur.execute("""
                INSERT INTO recipe_interactions 
                (user_id, recipe_id, interaction_type, rating, timestamp)
                VALUES (%s, %s, %s, %s, CURRENT_TIMESTAMP)
                RETURNING id
            """, (user_id, recipe_id, interaction_type, rating))
            interaction_id = cur.fetchone()[0]
            conn.commit()
            logger.info(f"Recorded interaction with ID: {interaction_id}")
            return interaction_id
    except Exception as e:
        logger.error(f"Error tracking recipe interaction: {str(e)}", exc_info=True)
        return None