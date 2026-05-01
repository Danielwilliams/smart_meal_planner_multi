# app/routers/saved_recipes_debug.py
from fastapi import APIRouter, HTTPException, Depends, Query
import logging
from typing import Optional
from ..db import get_db_connection, get_db_cursor, connection_pool, get_connection_stats
from ..utils.auth_utils import get_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/saved-recipes-debug", tags=["SavedRecipesDebug"])

@router.get("/")
async def debug_saved_recipes(user = Depends(get_user_from_token)):
    """Debug endpoint to check saved recipes table status"""
    # Check if user is authenticated
    if not user:
        logger.error("Authentication required for saved recipes debug")
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    user_id = user.get('user_id')
    logger.info(f"DEBUG: Checking saved recipes for user {user_id}")
    
    result = {
        "user_id": user_id,
        "table_info": {},
        "user_recipes": {},
        "schema": {}
    }
    
    try:
        # Get connection stats
        result["connection_stats"] = get_connection_stats()
        
        # Check if the saved_recipes table exists
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Check table exists
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' 
                    AND table_name = 'saved_recipes'
                ) as table_exists
            """)
            table_exists = cur.fetchone()['table_exists']
            result["table_info"]["table_exists"] = table_exists
            
            # Get table schema information
            cur.execute("""
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns
                WHERE table_schema = 'public'
                AND table_name = 'saved_recipes'
                ORDER BY ordinal_position
            """)
            
            columns = cur.fetchall()
            result["schema"]["columns"] = columns
            result["schema"]["has_updated_at"] = any(col["column_name"] == "updated_at" for col in columns)
            
            if table_exists:
                # Count total recipes
                cur.execute("SELECT COUNT(*) as total FROM saved_recipes")
                result["table_info"]["total_recipes"] = cur.fetchone()['total']
                
                # Count user's recipes
                cur.execute("SELECT COUNT(*) as user_recipes FROM saved_recipes WHERE user_id = %s", (user_id,))
                result["user_recipes"]["count"] = cur.fetchone()['user_recipes']
                
                # Try a direct user ID check to see if it exists
                cur.execute("SELECT EXISTS (SELECT 1 FROM user_profiles WHERE id = %s) as user_exists", (user_id,))
                result["user_info"] = {
                    "user_exists": cur.fetchone()['user_exists']
                }
                
                # Get recipe IDs if any exist
                if result["user_recipes"]["count"] > 0:
                    cur.execute("""
                        SELECT id, recipe_name, created_at 
                        FROM saved_recipes 
                        WHERE user_id = %s
                        ORDER BY created_at DESC
                        LIMIT 10
                    """, (user_id,))
                    result["user_recipes"]["samples"] = cur.fetchall()
                else:
                    result["user_recipes"]["samples"] = []
                    
                    # Try to get any recipes at all to see if table has data
                    cur.execute("""
                        SELECT id, recipe_name, user_id, created_at
                        FROM saved_recipes
                        ORDER BY created_at DESC
                        LIMIT 5
                    """)
                    result["table_info"]["sample_recipes"] = cur.fetchall()
        
        # Try a direct query against user_id 2 (assuming that's the user having issues)
        try:
            with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
                cur.execute("""
                    SELECT COUNT(*) as count 
                    FROM saved_recipes 
                    WHERE user_id = 2
                """)
                result["direct_check"] = {
                    "user_id_2_count": cur.fetchone()['count']
                }
                
                if result["direct_check"]["user_id_2_count"] > 0:
                    cur.execute("""
                        SELECT id, recipe_name, created_at 
                        FROM saved_recipes 
                        WHERE user_id = 2
                        ORDER BY created_at DESC
                        LIMIT 5
                    """)
                    result["direct_check"]["samples"] = cur.fetchall()
        except Exception as e:
            logger.error(f"Error in direct check: {str(e)}")
            result["direct_check"] = {"error": str(e)}
        
        return result
    except Exception as e:
        logger.error(f"Error in debug endpoint: {str(e)}")
        return {
            "error": str(e),
            "user_id": user_id
        }

@router.get("/schema")
async def get_table_schema(user = Depends(get_user_from_token)):
    """Get detailed schema information for debugging"""
    # Check if user is authenticated
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Authentication required"
        )
    
    try:
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            # Get table schema details
            cur.execute("""
                SELECT 
                    table_name,
                    column_name,
                    data_type,
                    is_nullable,
                    column_default
                FROM 
                    information_schema.columns
                WHERE 
                    table_name = 'saved_recipes'
                ORDER BY 
                    ordinal_position
            """)
            
            schema = cur.fetchall()
            
            # Get indexes
            cur.execute("""
                SELECT
                    indexname,
                    indexdef
                FROM
                    pg_indexes
                WHERE
                    tablename = 'saved_recipes'
            """)
            
            indexes = cur.fetchall()
            
            # Get constraints
            cur.execute("""
                SELECT
                    conname as constraint_name,
                    contype as constraint_type,
                    pg_get_constraintdef(c.oid) as constraint_definition
                FROM
                    pg_constraint c
                JOIN
                    pg_class t ON c.conrelid = t.oid
                WHERE
                    t.relname = 'saved_recipes'
            """)
            
            constraints = cur.fetchall()
            
            return {
                "schema": schema,
                "indexes": indexes,
                "constraints": constraints
            }
            
    except Exception as e:
        logger.error(f"Error getting schema: {str(e)}")
        return {
            "error": str(e)
        }
        
@router.post("/fix-schema")
async def fix_schema(user = Depends(get_user_from_token)):
    """Attempt to add missing updated_at column if needed"""
    # Check if user is authenticated and admin
    if not user or not user.get('is_admin'):
        raise HTTPException(
            status_code=403,
            detail="Admin access required"
        )
    
    try:
        # Check if column exists first
        with get_db_cursor(dict_cursor=True, autocommit=True) as (cur, conn):
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.columns 
                    WHERE table_name = 'saved_recipes' 
                    AND column_name = 'updated_at'
                ) as column_exists
            """)
            
            column_exists = cur.fetchone()['column_exists']
            
            if column_exists:
                return {
                    "status": "unchanged",
                    "message": "updated_at column already exists"
                }
            
            # Add the column
            cur.execute("""
                ALTER TABLE saved_recipes 
                ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
            """)
            
            # Update existing rows to set updated_at = created_at
            cur.execute("""
                UPDATE saved_recipes 
                SET updated_at = created_at 
                WHERE updated_at IS NULL
            """)
            
            return {
                "status": "success",
                "message": "updated_at column added and initialized"
            }
            
    except Exception as e:
        logger.error(f"Error fixing schema: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }