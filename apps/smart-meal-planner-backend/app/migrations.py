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
    create_recipe_interactions_table()
    check_saved_recipes_table()
    add_ai_model_used_to_menus()
    create_shared_menus_table()
    add_prep_time_to_saved_recipes()
    add_notes_to_scraped_recipes()
    update_recipe_components_structure()
    add_enhanced_preferences_to_user_profiles()
    
    logger.info("Database migrations completed successfully")

def update_recipe_components_structure():
    """
    Update the recipe_components table to make the name field optional
    and ensure proper structure for component type updates
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # First check if the table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'recipe_components'
                )
            """)
            
            if not cursor.fetchone()[0]:
                logger.info("recipe_components table does not exist yet, skipping update")
                return
                
            # Check if name column exists and is NOT NULL
            cursor.execute("""
                SELECT column_name, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components' 
                AND column_name = 'name'
            """)
            name_column = cursor.fetchone()
            
            if name_column and name_column[1] == 'NO':  # 'NO' means NOT NULL
                logger.info("Making name column optional in recipe_components table")
                cursor.execute("""
                    ALTER TABLE recipe_components 
                    ALTER COLUMN name DROP NOT NULL
                """)
                conn.commit()
                
            # Check if component_type allows NULL values
            cursor.execute("""
                SELECT column_name, is_nullable 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'recipe_components' 
                AND column_name = 'component_type'
            """)
            component_type_column = cursor.fetchone()
            
            if component_type_column and component_type_column[1] == 'YES':  # 'YES' means nullable
                logger.info("Making component_type column required in recipe_components table")
                # First set any NULL values to 'unknown'
                cursor.execute("""
                    UPDATE recipe_components
                    SET component_type = 'unknown'
                    WHERE component_type IS NULL
                """)
                
                # Then make it NOT NULL
                cursor.execute("""
                    ALTER TABLE recipe_components 
                    ALTER COLUMN component_type SET NOT NULL
                """)
                conn.commit()
            
            logger.info("Successfully updated recipe_components table structure")
            
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error updating recipe_components structure: {str(e)}")
    finally:
        if conn:
            conn.close()

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

def create_recipe_interactions_table():
    """
    Create recipe_interactions table if it doesn't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if the table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'recipe_interactions'
                )
            """)
            
            if not cursor.fetchone()[0]:
                logger.info("Creating recipe_interactions table")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS recipe_interactions (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        recipe_id INTEGER,
                        interaction_type VARCHAR(50) NOT NULL,
                        rating INTEGER,
                        timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                """)
                
                # Create indexes for better performance
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_recipe_interactions_user_id 
                    ON recipe_interactions(user_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_recipe_interactions_recipe_id 
                    ON recipe_interactions(recipe_id)
                """)
                
                conn.commit()
                logger.info("recipe_interactions table created successfully")
            else:
                logger.info("recipe_interactions table already exists")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error creating recipe_interactions table: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()

def check_saved_recipes_table():
    """
    Check if saved_recipes table has all required columns and add them if missing
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # First check if the table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'saved_recipes'
                )
            """)
            
            if not cursor.fetchone()[0]:
                logger.info("saved_recipes table doesn't exist - it will be created by other migrations")
                return
            
            # Check for required columns
            required_columns = [
                "scraped_recipe_id", "recipe_source", "macros", 
                "ingredients", "instructions", "complexity_level", 
                "appliance_used", "servings"
            ]
            
            for column in required_columns:
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'saved_recipes' 
                        AND column_name = %s
                    )
                """, (column,))
                
                if not cursor.fetchone()[0]:
                    logger.info(f"Adding missing column '{column}' to saved_recipes table")
                    
                    if column == "scraped_recipe_id":
                        cursor.execute("""
                            ALTER TABLE saved_recipes 
                            ADD COLUMN scraped_recipe_id INTEGER
                        """)
                    elif column == "recipe_source":
                        cursor.execute("""
                            ALTER TABLE saved_recipes 
                            ADD COLUMN recipe_source VARCHAR(50)
                        """)
                    elif column in ["macros", "ingredients", "instructions"]:
                        cursor.execute(f"""
                            ALTER TABLE saved_recipes 
                            ADD COLUMN {column} JSONB
                        """)
                    elif column in ["complexity_level", "appliance_used"]:
                        cursor.execute(f"""
                            ALTER TABLE saved_recipes 
                            ADD COLUMN {column} VARCHAR(100)
                        """)
                    elif column == "servings":
                        cursor.execute("""
                            ALTER TABLE saved_recipes 
                            ADD COLUMN servings INTEGER
                        """)
            
            conn.commit()
            logger.info("saved_recipes table check completed")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error checking saved_recipes table: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()
            
def create_shared_menus_table():
    """
    Create shared_menus table if it doesn't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if the table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'shared_menus'
                )
            """)
            
            if not cursor.fetchone()[0]:
                logger.info("Creating shared_menus table")
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS shared_menus (
                        id SERIAL PRIMARY KEY,
                        menu_id INTEGER NOT NULL,
                        client_id INTEGER NOT NULL,
                        organization_id INTEGER NOT NULL,
                        shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                        permission_level VARCHAR(20) DEFAULT 'read',
                        message TEXT,
                        is_active BOOLEAN DEFAULT TRUE
                    )
                """)
                
                # Create indexes for better performance
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_shared_menus_menu_id 
                    ON shared_menus(menu_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_shared_menus_client_id 
                    ON shared_menus(client_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_shared_menus_organization_id 
                    ON shared_menus(organization_id)
                """)
                
                cursor.execute("""
                    CREATE INDEX IF NOT EXISTS idx_shared_menus_is_active 
                    ON shared_menus(is_active)
                """)
                
                conn.commit()
                logger.info("shared_menus table created successfully")
            else:
                # Check if we need to update the table schema
                logger.info("shared_menus table already exists, checking for schema updates")
                
                # Check for client_id column
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'shared_menus' 
                        AND column_name = 'client_id'
                    )
                """)
                
                has_client_id = cursor.fetchone()[0]
                
                # Check for shared_with column (old schema)
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'shared_menus' 
                        AND column_name = 'shared_with'
                    )
                """)
                
                has_shared_with = cursor.fetchone()[0]
                
                # Check for created_by column (old schema)
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'shared_menus' 
                        AND column_name = 'created_by'
                    )
                """)
                
                has_created_by = cursor.fetchone()[0]
                
                # Check for is_active column
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'shared_menus' 
                        AND column_name = 'is_active'
                    )
                """)
                
                has_is_active = cursor.fetchone()[0]
                
                # Add missing columns
                if not has_client_id and has_shared_with:
                    logger.info("Migrating shared_with to client_id")
                    cursor.execute("""
                        ALTER TABLE shared_menus
                        ADD COLUMN client_id INTEGER
                    """)
                    
                    cursor.execute("""
                        UPDATE shared_menus
                        SET client_id = shared_with
                    """)
                    
                    cursor.execute("""
                        ALTER TABLE shared_menus
                        ALTER COLUMN client_id SET NOT NULL
                    """)
                
                if not has_is_active:
                    logger.info("Adding is_active column")
                    cursor.execute("""
                        ALTER TABLE shared_menus
                        ADD COLUMN is_active BOOLEAN DEFAULT TRUE
                    """)
                    
                    cursor.execute("""
                        CREATE INDEX IF NOT EXISTS idx_shared_menus_is_active 
                        ON shared_menus(is_active)
                    """)
                
                # Check for message column
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'shared_menus' 
                        AND column_name = 'message'
                    )
                """)
                
                if not cursor.fetchone()[0]:
                    logger.info("Adding message column")
                    cursor.execute("""
                        ALTER TABLE shared_menus
                        ADD COLUMN message TEXT
                    """)
                
                # Check for shared_at column
                cursor.execute("""
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_schema = 'public' 
                        AND table_name = 'shared_menus' 
                        AND column_name = 'shared_at'
                    )
                """)
                
                if not cursor.fetchone()[0]:
                    logger.info("Adding shared_at column")
                    cursor.execute("""
                        ALTER TABLE shared_menus
                        ADD COLUMN shared_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    """)
                
                conn.commit()
                logger.info("shared_menus table schema updated")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error creating/updating shared_menus table: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()

def add_ai_model_used_to_menus():
    """
    Add the ai_model_used column to the menus table if it doesn't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if the column already exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_name = 'menus' AND column_name = 'ai_model_used';
            """)
            
            if not cursor.fetchone():
                logger.info("Adding ai_model_used column to menus table")
                cursor.execute("""
                    ALTER TABLE menus 
                    ADD COLUMN ai_model_used VARCHAR(50) DEFAULT 'default';
                """)
                conn.commit()
                logger.info("ai_model_used column added successfully")
            else:
                logger.info("ai_model_used column already exists in menus table")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error adding ai_model_used column: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()

def add_prep_time_to_saved_recipes():
    """
    Add the prep_time column to the saved_recipes table if it doesn't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if the table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'saved_recipes'
                )
            """)
            
            if not cursor.fetchone()[0]:
                logger.warning("saved_recipes table doesn't exist - skipping prep_time column addition")
                return
                
            # Check if the column already exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                  AND table_name = 'saved_recipes' 
                  AND column_name = 'prep_time'
            """)
            
            if not cursor.fetchone():
                logger.info("Adding prep_time column to saved_recipes table")
                cursor.execute("""
                    ALTER TABLE saved_recipes 
                    ADD COLUMN prep_time INTEGER DEFAULT 0
                """)
                conn.commit()
                logger.info("prep_time column added successfully to saved_recipes table")
            else:
                logger.info("prep_time column already exists in saved_recipes table")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error adding prep_time column to saved_recipes: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()
            
def add_notes_to_scraped_recipes():
    """
    Add the notes column to the scraped_recipes table if it doesn't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Check if the table exists
            cursor.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'scraped_recipes'
                )
            """)
            
            if not cursor.fetchone()[0]:
                logger.warning("scraped_recipes table doesn't exist - skipping notes column addition")
                return
                
            # Check if the column already exists
            cursor.execute("""
                SELECT column_name 
                FROM information_schema.columns 
                WHERE table_schema = 'public'
                  AND table_name = 'scraped_recipes' 
                  AND column_name = 'notes'
            """)
            
            if not cursor.fetchone():
                logger.info("Adding notes column to scraped_recipes table")
                cursor.execute("""
                    ALTER TABLE scraped_recipes 
                    ADD COLUMN notes TEXT DEFAULT NULL
                """)
                conn.commit()
                logger.info("notes column added successfully to scraped_recipes table")
            else:
                logger.info("notes column already exists in scraped_recipes table")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error adding notes column to scraped_recipes: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()

def add_enhanced_preferences_to_user_profiles():
    """
    Add enhanced preference columns to user_profiles table if they don't exist
    """
    conn = None
    try:
        conn = get_db_connection()
        with conn.cursor() as cursor:
            # Define the columns to add
            columns_to_add = [
                ("flavor_preferences", "JSONB"),
                ("spice_level", "VARCHAR(20)"),
                ("recipe_type_preferences", "JSONB"),
                ("meal_time_preferences", "JSONB"),
                ("time_constraints", "JSONB"),
                ("prep_preferences", "JSONB")
            ]
            
            for column_name, column_type in columns_to_add:
                # Check if the column already exists
                cursor.execute("""
                    SELECT column_name 
                    FROM information_schema.columns 
                    WHERE table_schema = 'public'
                      AND table_name = 'user_profiles' 
                      AND column_name = %s
                """, (column_name,))
                
                if not cursor.fetchone():
                    logger.info(f"Adding {column_name} column to user_profiles table")
                    cursor.execute(f"""
                        ALTER TABLE user_profiles 
                        ADD COLUMN {column_name} {column_type} DEFAULT NULL
                    """)
                    conn.commit()
                    logger.info(f"{column_name} column added successfully to user_profiles table")
                else:
                    logger.info(f"{column_name} column already exists in user_profiles table")
                    
        # All columns added successfully
        logger.info("Enhanced preference columns added to user_profiles table")
                
    except Exception as e:
        if conn:
            conn.rollback()
        logger.error(f"Error adding enhanced preference columns to user_profiles: {str(e)}")
        # Don't re-raise, just log the error
    finally:
        if conn:
            conn.close()
