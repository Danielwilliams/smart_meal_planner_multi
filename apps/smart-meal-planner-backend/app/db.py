"""
Ultra-simplified database connection module.
This version strips away all complexity to ensure reliable operation.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from fastapi import HTTPException
import logging
import time
import threading
from contextlib import contextmanager
from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

# Connection tracking variables
_active_connections = 0
_total_connections = 0
_peak_connections = 0
_last_reset_time = time.time()

# Create a single connection pool with more capacity
# Thread-local storage for tracking connections in each thread
thread_local = threading.local()

# Initialize thread-local storage
thread_local.connection = None

# Connection pool creation with retry logic
def create_connection_pool():
    """Create or recreate the connection pool with retries"""
    global connection_pool
    retry_count = 0
    max_retries = 3

    while retry_count < max_retries:
        try:
            connection_pool = pool.ThreadedConnectionPool(
                minconn=10,     # Minimum connections
                maxconn=100,    # Maximum connections - increased for high concurrency
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT
            )
            logger.info(f"Database connection pool created with 10-100 connections")
            return connection_pool
        except Exception as e:
            retry_count += 1
            logger.error(f"Failed to create database connection pool (attempt {retry_count}/{max_retries}): {str(e)}")
            if retry_count < max_retries:
                time.sleep(1)  # Wait before retrying
            else:
                logger.critical("Failed to create connection pool after maximum retries")
                connection_pool = None
                return None

# Initialize the connection pool
try:
    connection_pool = create_connection_pool()
except Exception as e:
    logger.error(f"Failed to create database connection pool: {str(e)}")
    connection_pool = None

def get_db_connection():
    """Get a database connection from the pool or create a new one"""
    global _active_connections, _total_connections, _peak_connections, connection_pool

    try:
        # Check if thread already has a connection assigned
        if hasattr(thread_local, 'connection') and thread_local.connection is not None:
            # Verify the connection is still valid before using it
            try:
                # Test if the connection is still alive
                if thread_local.connection.closed:
                    logger.warning("Thread-local connection was marked as closed - creating a new one")
                    thread_local.connection = None
                else:
                    # Do a simple test query to verify the connection is still good
                    with thread_local.connection.cursor() as test_cursor:
                        test_cursor.execute("SELECT 1")
                        test_cursor.fetchone()
                        logger.debug("Reusing existing thread-local connection - verified active")
                        return thread_local.connection
            except Exception as e:
                # Connection is not usable - clean it up and get a new one
                logger.warning(f"Thread-local connection test failed: {str(e)} - creating a new one")
                try:
                    thread_local.connection.close()
                except:
                    pass
                thread_local.connection = None

        # Get connection from pool if available
        if connection_pool:
            try:
                # Get connection from pool
                conn = connection_pool.getconn(key=id(threading.current_thread()))

                # Update connection tracking
                _active_connections += 1
                _total_connections += 1
                _peak_connections = max(_peak_connections, _active_connections)

                # Store connection in thread-local storage for potential reuse
                thread_local.connection = conn

                # Log connection stats periodically
                if _total_connections % 100 == 0 or _active_connections > 50:
                    logger.warning(f"Connection stats: active={_active_connections}, peak={_peak_connections}, total={_total_connections}")

                # Make sure connection is in a clean state
                try:
                    conn.rollback()
                except Exception as e:
                    logger.warning(f"Could not rollback connection: {str(e)}")

                return conn
            except Exception as pool_error:
                if "connection pool exhausted" in str(pool_error):
                    logger.critical(f"CONNECTION POOL EXHAUSTED! Active connections: {_active_connections}")
                    # Try to emergency close all connections and recreate pool
                    try:
                        if connection_pool:
                            connection_pool.closeall()
                            logger.critical("Emergency connection pool reset executed")
                            _active_connections = 0

                            # Recreate the pool
                            connection_pool = create_connection_pool()
                            if connection_pool:
                                # Try again with the new pool
                                conn = connection_pool.getconn(key=id(threading.current_thread()))
                                thread_local.connection = conn
                                _active_connections += 1
                                _total_connections += 1
                                return conn
                    except Exception as reset_error:
                        logger.error(f"Failed to reset connection pool: {str(reset_error)}")

                # If pool error handling failed, fall through to direct connection
                logger.error(f"Pool connection failed: {str(pool_error)}")

        # Direct connection as fallback when pool is unavailable or exhausted
        logger.warning("Creating direct connection (pool unavailable or exhausted)")
        conn = psycopg2.connect(
            dbname=DB_NAME,
            user=DB_USER,
            password=DB_PASSWORD,
            host=DB_HOST,
            port=DB_PORT
        )
        # Set statement timeout even for direct connections
        with conn.cursor() as cursor:
            cursor.execute("SET statement_timeout = 30000")  # 30 seconds
        return conn

    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection error")

@contextmanager
def get_db_cursor(dict_cursor=True, autocommit=False, pool_type=None):
    """Context manager for database connections and cursors"""
    global _active_connections

    conn = None
    cursor = None
    pooled = False
    connection_returned = False
    connection_owner = False

    try:
        # Always get a fresh connection for the cursor operation
        # This is safer than reusing thread-local connections at this level
        conn = get_db_connection()
        connection_owner = True
        pooled = connection_pool is not None

        # Set autocommit if requested
        if autocommit:
            was_autocommit = conn.autocommit
            conn.autocommit = True
        else:
            was_autocommit = None

        # Create cursor
        if dict_cursor:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()

        # Set statement timeout to prevent hanging queries (30 seconds)
        try:
            cursor.execute("SET statement_timeout = 30000")  # 30 seconds
        except Exception as e:
            logger.warning(f"Failed to set statement timeout: {str(e)}")

        # Yield cursor and connection
        yield cursor, conn

    except Exception as e:
        # Handle exceptions
        logger.error(f"Database error: {str(e)}")
        if conn:
            try:
                conn.rollback()
                logger.info("Transaction rolled back")
            except Exception as rb_e:
                logger.error(f"Error during rollback: {str(rb_e)}")
        raise

    finally:
        # Clean up resources
        # Always close the cursor
        if cursor:
            try:
                cursor.close()
                logger.debug("Cursor closed")
            except Exception as e:
                logger.warning(f"Error closing cursor: {str(e)}")

        # Reset autocommit if we changed it
        if conn and was_autocommit is not None:
            try:
                conn.autocommit = was_autocommit
            except Exception as e:
                logger.warning(f"Error resetting autocommit: {str(e)}")

        # Handle the connection based on ownership
        if conn and connection_owner:
            # We own the connection, so clean it up
            if pooled and connection_pool:
                try:
                    # Clear thread local connection reference
                    if hasattr(thread_local, 'connection') and thread_local.connection is conn:
                        thread_local.connection = None

                    # Return connection to pool
                    connection_pool.putconn(conn, key=id(threading.current_thread()), close=False)
                    connection_returned = True
                    logger.debug("Connection returned to pool")

                    # Decrement active connections count
                    _active_connections -= 1
                    if _active_connections < 0:  # Sanity check
                        logger.warning("Active connections count went negative - resetting to 0")
                        _active_connections = 0
                except Exception as e:
                    logger.warning(f"Error returning connection to pool: {str(e)}")
            else:
                # Direct connection - close it
                try:
                    conn.close()
                    logger.debug("Direct connection closed")

                    # Clear thread local connection reference
                    if hasattr(thread_local, 'connection') and thread_local.connection is conn:
                        thread_local.connection = None
                except Exception as e:
                    logger.warning(f"Error closing direct connection: {str(e)}")

            # If we failed to return the pooled connection, log it and force cleanup
            if pooled and not connection_returned:
                logger.error("Connection was not returned to pool - possible connection leak!")
                # Force decrement counter to avoid false alarms
                _active_connections -= 1
                if _active_connections < 0:  # Sanity check
                    _active_connections = 0

                # Try one more time to clean up the connection
                try:
                    if hasattr(thread_local, 'connection') and thread_local.connection is conn:
                        thread_local.connection = None
                    conn.close()
                except:
                    pass

def close_all_connections():
    """Close all connections in the pool"""
    global _active_connections, _total_connections, _peak_connections, _last_reset_time, connection_pool

    # Clear any thread-local connections first
    if hasattr(thread_local, 'connection'):
        try:
            if thread_local.connection:
                try:
                    if not thread_local.connection.closed:
                        thread_local.connection.close()
                        logger.info("Closed thread-local connection")
                except Exception as e:
                    logger.warning(f"Error closing thread-local connection: {str(e)}")
            thread_local.connection = None
        except Exception as e:
            logger.error(f"Error handling thread-local connection during closeall: {str(e)}")

    # Try to clear thread-local storage for all active threads
    try:
        active_threads = threading.enumerate()
        logger.info(f"Attempting to clear connections for {len(active_threads)} active threads")
        for thread in active_threads:
            thread_id = id(thread)
            if hasattr(thread, 'connection'):
                try:
                    if thread.connection and not thread.connection.closed:
                        thread.connection.close()
                        logger.info(f"Closed connection for thread {thread_id}")
                    thread.connection = None
                except:
                    pass
    except Exception as e:
        logger.warning(f"Error clearing thread connections: {str(e)}")

    # Close the pool
    if connection_pool:
        try:
            connection_pool.closeall()
            logger.info("All database connections closed")

            # Reset connection counters
            _active_connections = 0
            _total_connections = 0
            _peak_connections = 0
            _last_reset_time = time.time()

            # Recreate the pool
            connection_pool = create_connection_pool()
            if connection_pool:
                logger.info("Connection pool recreated after closeall")
                return True
            else:
                logger.error("Failed to recreate connection pool after closeall")
                return False
        except Exception as e:
            logger.error(f"Error closing all connections: {str(e)}")
            return False
    return False

def get_connection_stats():
    """Get current connection statistics for monitoring"""
    return {
        "active_connections": _active_connections,
        "peak_connections": _peak_connections,
        "total_connections": _total_connections,
        "uptime_seconds": time.time() - _last_reset_time,
        "pool_status": "active" if connection_pool else "unavailable"
    }

# Recipe interaction functions
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
        logger.error(f"Error tracking recipe interaction: {str(e)}")
        return None

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
        logger.error(f"Error checking if recipe is saved: {str(e)}")
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
                
            row = cur.fetchone()
            return row[0] if row else None
    except Exception as e:
        logger.error(f"Error getting saved recipe ID: {str(e)}")
        return None

def save_recipe(user_id, menu_id=None, recipe_id=None, recipe_name=None, day_number=None, 
               meal_time=None, notes=None, macros=None, ingredients=None, 
               instructions=None, complexity_level=None, appliance_used=None, servings=None,
               scraped_recipe_id=None, recipe_source=None):
    """Save a recipe or entire menu to user's favorites with complete recipe data"""
    try:
        logger.info(f"Saving recipe: user={user_id}, menu={menu_id}, recipe={recipe_id}, meal_time={meal_time}")
        
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
            
            # Convert complex objects to JSON
            import json
            macros_json = json.dumps(macros) if macros else None
            ingredients_json = json.dumps(ingredients) if ingredients else None
            instructions_json = json.dumps(instructions) if instructions else None
            
            if existing:
                # Update if already exists
                saved_id = existing[0]
                cur.execute("""
                    UPDATE saved_recipes SET
                    recipe_name = COALESCE(%s, recipe_name),
                    day_number = COALESCE(%s, day_number),
                    notes = COALESCE(%s, notes),
                    macros = COALESCE(%s, macros),
                    ingredients = COALESCE(%s, ingredients),
                    instructions = COALESCE(%s, instructions),
                    complexity_level = COALESCE(%s, complexity_level),
                    appliance_used = COALESCE(%s, appliance_used),
                    servings = COALESCE(%s, servings),
                    updated_at = CURRENT_TIMESTAMP
                    WHERE id = %s
                    RETURNING id
                """, (
                    recipe_name, day_number, notes, macros_json, ingredients_json, 
                    instructions_json, complexity_level, appliance_used, servings, saved_id
                ))
            else:
                # Insert new saved recipe
                cur.execute("""
                    INSERT INTO saved_recipes (
                        user_id, menu_id, recipe_id, recipe_name, day_number,
                        meal_time, notes, macros, ingredients, instructions,
                        complexity_level, appliance_used, servings, scraped_recipe_id, recipe_source
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (
                    user_id, menu_id, recipe_id, recipe_name, day_number,
                    meal_time, notes, macros_json, ingredients_json, instructions_json,
                    complexity_level, appliance_used, servings, scraped_recipe_id, recipe_source
                ))
            
            saved_id = cur.fetchone()[0]
            conn.commit()
            return saved_id
    except Exception as e:
        logger.error(f"Error saving recipe: {str(e)}")
        return None

def unsave_recipe(user_id, saved_id=None, menu_id=None, recipe_id=None, meal_time=None, scraped_recipe_id=None):
    """Remove a saved recipe"""
    try:
        logger.info(f"Unsaving recipe: user={user_id}, saved_id={saved_id}, menu={menu_id}, recipe={recipe_id}")
        with get_db_cursor() as (cur, conn):
            if saved_id:
                # Delete by direct ID
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE id = %s AND user_id = %s
                    RETURNING id
                """, (saved_id, user_id))
            elif scraped_recipe_id:
                # Delete by scraped recipe ID
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND scraped_recipe_id = %s
                    RETURNING id
                """, (user_id, scraped_recipe_id))
            elif recipe_id and menu_id and meal_time:
                # Delete by recipe, menu and meal time
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                    RETURNING id
                """, (user_id, menu_id, recipe_id, meal_time))
            elif menu_id:
                # Delete entire menu
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                    RETURNING id
                """, (user_id, menu_id))
            else:
                logger.warning("No valid identifiers provided for recipe deletion")
                return False
                
            deleted = cur.fetchone()
            conn.commit()
            return deleted is not None
    except Exception as e:
        logger.error(f"Error unsaving recipe: {str(e)}")
        return False

def get_user_saved_recipes(user_id):
    """Get all saved recipes for a user"""
    try:
        logger.info(f"Getting saved recipes for user: {user_id}")
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            try:
                # Use a simpler query first to verify we can access the saved_recipes table
                cur.execute("SELECT COUNT(*) FROM saved_recipes WHERE user_id = %s", (user_id,))
                count = cur.fetchone()
                logger.info(f"Found {count['count']} saved recipes for user {user_id}")

                # Now execute the full query
                cur.execute("""
                    SELECT
                        sr.id, sr.user_id, sr.menu_id, sr.recipe_id, sr.recipe_name,
                        sr.day_number, sr.meal_time, sr.notes, sr.macros, sr.ingredients,
                        sr.instructions, sr.complexity_level, sr.appliance_used, sr.servings,
                        sr.created_at, sr.updated_at, sr.scraped_recipe_id, sr.recipe_source,
                        m.nickname as menu_nickname
                    FROM
                        saved_recipes sr
                    LEFT JOIN
                        menus m ON sr.menu_id = m.id
                    WHERE
                        sr.user_id = %s
                    ORDER BY
                        sr.updated_at DESC
                """, (user_id,))

                recipes = cur.fetchall()
                logger.info(f"Successfully fetched {len(recipes)} saved recipes for user {user_id}")
                return recipes
            except Exception as inner_e:
                logger.error(f"Error in saved recipes query: {str(inner_e)}")
                # Try a simpler query without the join to identify the issue
                try:
                    cur.execute("""
                        SELECT * FROM saved_recipes
                        WHERE user_id = %s
                        LIMIT 10
                    """, (user_id,))
                    simple_recipes = cur.fetchall()
                    logger.info(f"Simple query found {len(simple_recipes)} recipes")
                except Exception as simple_e:
                    logger.error(f"Even simple query failed: {str(simple_e)}")
                raise inner_e
    except Exception as e:
        logger.error(f"Error getting saved recipes: {str(e)}", exc_info=True)
        # Return empty list instead of failing
        return []

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
        logger.error(f"Error getting saved recipe by ID: {str(e)}")
        return None