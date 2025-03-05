import psycopg2
from psycopg2.extras import RealDictCursor
from fastapi import HTTPException
import logging
from app.config import RECAPTCHA_SECRET_KEY, DB_NAME, DB_USER, DB_PASSWORD, DB_HOST, DB_PORT

# Set up logging
logger = logging.getLogger(__name__)

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

def save_recipe(user_id, menu_id, recipe_id=None, recipe_name=None, day_number=None, meal_time=None, notes=None):
    """Save a recipe or entire menu to user's favorites"""
    conn = None
    try:
        logger.info(f"Saving recipe: user={user_id}, menu={menu_id}, recipe={recipe_id}, meal_time={meal_time}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            # Check if already saved
            if recipe_id:
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                """, (user_id, menu_id, recipe_id, meal_time))
            else:
                cur.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                """, (user_id, menu_id))
                
            existing = cur.fetchone()
            logger.info(f"Existing saved recipe check: {existing}")
            
            if existing:
                # Update if already exists
                if recipe_id:
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
                logger.info(f"Inserting new recipe with ID: {recipe_id}")
                cur.execute("""
                    INSERT INTO saved_recipes
                    (user_id, menu_id, recipe_id, recipe_name, day_number, meal_time, notes)
                    VALUES (%s, %s, %s, %s, %s, %s, %s)
                    RETURNING id
                """, (user_id, menu_id, recipe_id, recipe_name, day_number, meal_time, notes))
            
            saved_id = cur.fetchone()[0]
            logger.info(f"Successfully saved/updated recipe with ID: {saved_id}")
            
            # Also log this as an interaction for recommendation system
            cur.execute("""
                INSERT INTO recipe_interactions
                (user_id, recipe_id, interaction_type, timestamp)
                VALUES (%s, %s, 'saved', CURRENT_TIMESTAMP)
            """, (user_id, recipe_id or menu_id))
            
            conn.commit()
            return saved_id
    except Exception as e:
        logger.error(f"Error saving recipe: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()

def unsave_recipe(user_id, saved_id=None, menu_id=None, recipe_id=None, meal_time=None):
    """Remove a recipe from saved/favorites"""
    conn = None
    try:
        logger.info(f"Unsaving recipe: user={user_id}, saved_id={saved_id}, menu={menu_id}, recipe={recipe_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
            if saved_id:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE id = %s AND user_id = %s
                    RETURNING id, recipe_id, menu_id
                """, (saved_id, user_id))
            elif recipe_id and meal_time:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id = %s AND meal_time = %s
                    RETURNING id, recipe_id, menu_id
                """, (user_id, menu_id, recipe_id, meal_time))
            else:
                cur.execute("""
                    DELETE FROM saved_recipes
                    WHERE user_id = %s AND menu_id = %s AND recipe_id IS NULL
                    RETURNING id, recipe_id, menu_id
                """, (user_id, menu_id))
            
            result = cur.fetchone()
            
            if result:
                deleted_id, recipe_id_val, menu_id_val = result
                logger.info(f"Successfully removed saved recipe with ID: {deleted_id}")
                
                # Log this as an "unsaved" interaction
                cur.execute("""
                    INSERT INTO recipe_interactions
                    (user_id, recipe_id, interaction_type, timestamp)
                    VALUES (%s, %s, 'unsaved', CURRENT_TIMESTAMP)
                """, (user_id, recipe_id_val or menu_id_val))
                
                conn.commit()
                return True
            
            logger.info("No saved recipe found to remove")
            return False
    except Exception as e:
        logger.error(f"Error unsaving recipe: {str(e)}", exc_info=True)
        if conn:
            conn.rollback()
        return False
    finally:
        if conn:
            conn.close()

def get_user_saved_recipes(user_id):
    """Get all saved recipes for a user"""
    conn = None
    try:
        logger.info(f"Getting saved recipes for user: {user_id}")
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("""
                SELECT sr.*, m.nickname as menu_nickname
                FROM saved_recipes sr
                LEFT JOIN menus m ON sr.menu_id = m.id
                WHERE sr.user_id = %s
                ORDER BY sr.created_at DESC
            """, (user_id,))
            
            results = cur.fetchall()
            logger.info(f"Found {len(results)} saved recipes for user {user_id}")
            return results
    except Exception as e:
        logger.error(f"Error getting saved recipes: {str(e)}", exc_info=True)
        return []
    finally:
        if conn:
            conn.close()

def is_recipe_saved(user_id, menu_id, recipe_id=None, meal_time=None):
    """Check if a recipe is saved by the user"""
    conn = None
    try:
        logger.info(f"Checking if recipe is saved: user={user_id}, menu={menu_id}, recipe={recipe_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
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
    finally:
        if conn:
            conn.close()

def get_saved_recipe_id(user_id, menu_id, recipe_id=None, meal_time=None):
    """Get the saved_id for a recipe if it exists"""
    conn = None
    try:
        logger.info(f"Getting saved recipe ID: user={user_id}, menu={menu_id}, recipe={recipe_id}")
        conn = get_db_connection()
        with conn.cursor() as cur:
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
    finally:
        if conn:
            conn.close()

def get_saved_recipe_by_id(user_id, saved_id):
    """Get saved recipe details by ID"""
    conn = None
    try:
        logger.info(f"Getting saved recipe by ID: {saved_id}")
        conn = get_db_connection()
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
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
    finally:
        if conn:
            conn.close()

def track_recipe_interaction(user_id, recipe_id, interaction_type, rating=None):
    """Record user interaction with a recipe"""
    conn = None
    try:
        logger.info(f"Tracking recipe interaction: user={user_id}, recipe={recipe_id}, type={interaction_type}")
        conn = get_db_connection()
        with conn.cursor() as cur:
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
        if conn:
            conn.rollback()
        return None
    finally:
        if conn:
            conn.close()