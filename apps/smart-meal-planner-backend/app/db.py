"""
Ultra-simplified database connection module.
This version strips away all complexity to ensure reliable operation.
"""

import psycopg2
from psycopg2.extras import RealDictCursor
from psycopg2 import pool
from fastapi import HTTPException
import logging
from contextlib import contextmanager
from app.config import DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

# Create a single connection pool
try:
    connection_pool = pool.ThreadedConnectionPool(
        minconn=5,     # Minimum connections
        maxconn=30,    # Maximum connections 
        dbname=DB_NAME,
        user=DB_USER,
        password=DB_PASSWORD,
        host=DB_HOST,
        port=DB_PORT
    )
    logger.info(f"Database connection pool created with 5-30 connections")
except Exception as e:
    logger.error(f"Failed to create database connection pool: {str(e)}")
    connection_pool = None

def get_db_connection():
    """Get a database connection from the pool or create a new one"""
    try:
        if connection_pool:
            # Get connection from pool
            conn = connection_pool.getconn()
            
            # Make sure connection is in a clean state
            try:
                conn.rollback()
            except Exception as e:
                logger.warning(f"Could not rollback connection: {str(e)}")
                
            return conn
        else:
            # Direct connection as fallback
            conn = psycopg2.connect(
                dbname=DB_NAME,
                user=DB_USER,
                password=DB_PASSWORD,
                host=DB_HOST,
                port=DB_PORT
            )
            return conn
            
    except Exception as e:
        logger.error(f"Failed to connect to database: {str(e)}")
        raise HTTPException(status_code=500, detail="Database connection error")

@contextmanager
def get_db_cursor(dict_cursor=True, autocommit=False, pool_type=None):
    """Context manager for database connections and cursors"""
    conn = None
    cursor = None
    pooled = False
    
    try:
        # Get connection
        conn = get_db_connection()
        pooled = connection_pool is not None
        
        # Set autocommit if requested
        if autocommit:
            conn.autocommit = True
            
        # Create cursor
        if dict_cursor:
            cursor = conn.cursor(cursor_factory=RealDictCursor)
        else:
            cursor = conn.cursor()
            
        # Set statement timeout to prevent hanging queries (10 seconds)
        try:
            cursor.execute("SET statement_timeout = 10000")
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
        if cursor:
            try:
                cursor.close()
                logger.debug("Cursor closed")
            except Exception as e:
                logger.warning(f"Error closing cursor: {str(e)}")
                
        if conn:
            if pooled and connection_pool:
                try:
                    connection_pool.putconn(conn)
                    logger.debug("Connection returned to pool")
                except Exception as e:
                    logger.warning(f"Error returning connection to pool: {str(e)}")
            else:
                try:
                    conn.close()
                    logger.debug("Connection closed")
                except Exception as e:
                    logger.warning(f"Error closing connection: {str(e)}")

def close_all_connections():
    """Close all connections in the pool"""
    if connection_pool:
        try:
            connection_pool.closeall()
            logger.info("All database connections closed")
            return True
        except Exception as e:
            logger.error(f"Error closing all connections: {str(e)}")
            return False
    return False

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
        with get_db_cursor(dict_cursor=True) as (cur, conn):
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
            return recipes
    except Exception as e:
        logger.error(f"Error getting saved recipes: {str(e)}")
        return []