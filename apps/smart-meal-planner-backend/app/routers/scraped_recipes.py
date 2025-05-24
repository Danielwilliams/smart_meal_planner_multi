"""
Router for scraped recipes endpoints
"""
import logging
from fastapi import APIRouter, Depends, HTTPException, Query
from psycopg2.extras import RealDictCursor
from typing import List, Optional, Dict, Any
import json
from ..db import get_db_connection
from ..utils.auth_utils import get_user_from_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/scraped-recipes", tags=["ScrapedRecipes"])

@router.get("/")
async def get_scraped_recipes(
    search: Optional[str] = None,
    cuisine: Optional[str] = None,
    complexity: Optional[str] = None,
    tags: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user = Depends(get_user_from_token)
):
    """
    Get scraped recipes with optional filtering
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Base query - don't use DISTINCT as it can limit results
        query = """
            SELECT 
                r.id, r.title, r.complexity, r.source, r.cuisine,
                r.prep_time, r.cook_time, r.total_time, r.image_url, 
                r.is_verified, r.date_scraped, rc.component_type
            FROM scraped_recipes r
            LEFT JOIN recipe_components rc ON r.id = rc.recipe_id
        """
        
        where_clauses = []
        params = []
        joins = []
        
        # Add filters
        if search:
            where_clauses.append("r.title ILIKE %s")
            params.append(f"%{search}%")
            
        if cuisine:
            where_clauses.append("r.cuisine ILIKE %s")
            params.append(f"%{cuisine}%")
            
        if complexity:
            where_clauses.append("r.complexity = %s")
            params.append(complexity)
            
        if tags:
            # Filter by one or more tags (comma-separated)
            tag_list = [t.strip() for t in tags.split(',')]
            joins.append("JOIN recipe_tags t ON r.id = t.recipe_id")
            placeholders = ', '.join(['%s'] * len(tag_list))
            where_clauses.append(f"t.tag IN ({placeholders})")
            params.extend(tag_list)
        
        # Add joins to query if needed
        if joins:
            query += " " + " ".join(joins)
            
        # Add where clauses if any
        if where_clauses:
            query += " WHERE " + " AND ".join(where_clauses)
            
        # Add ordering and limits - use ID for consistent pagination
        query += """
            ORDER BY r.id DESC
            LIMIT %s OFFSET %s
        """
        
        params.extend([limit, offset])
        
        # Log the query for debugging
        logger.info(f"Executing query: {query} with params: {params}")
        
        # Execute query
        cursor.execute(query, params)
        recipes = cursor.fetchall()
        
        # Count query for pagination - don't use DISTINCT as it can limit results
        count_query = """
            SELECT COUNT(r.id) as total
            FROM scraped_recipes r
        """
        
        if joins:
            count_query += " " + " ".join(joins)
            
        if where_clauses:
            count_query += " WHERE " + " AND ".join(where_clauses)
            
        cursor.execute(count_query, params[:-2] if params else [])
        total = cursor.fetchone()["total"]
        
        # Check if each recipe is saved by the current user
        user_id = None
        if user:
            user_id = user.get('user_id')
        
        for recipe in recipes:
            # Only query saved status if we have a user_id
            if user_id:
                cursor.execute("""
                    SELECT id FROM saved_recipes 
                    WHERE user_id = %s AND scraped_recipe_id = %s
                """, (user_id, recipe['id']))
                saved = cursor.fetchone()
                if saved:
                    recipe['is_saved'] = True
                    recipe['saved_id'] = saved['id']
                else:
                    recipe['is_saved'] = False
                    recipe['saved_id'] = None
            else:
                # Default for non-authenticated users or system requests
                recipe['is_saved'] = False
                recipe['saved_id'] = None
        
        return {
            "total": total,
            "recipes": recipes,
            "limit": limit,
            "offset": offset
        }
    except Exception as e:
        logger.error(f"Error in get_scraped_recipes: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching recipes: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.get("/count")
async def get_recipe_count(user = Depends(get_user_from_token)):
    """Get the total number of scraped recipes"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        cursor.execute("SELECT COUNT(*) as count FROM scraped_recipes")
        result = cursor.fetchone()
        return {"count": result["count"]}
    except Exception as e:
        logger.error(f"Error in get_recipe_count: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error counting recipes: {str(e)}")
    finally:
        cursor.close()
        conn.close()

@router.get("/{recipe_id}")
async def get_scraped_recipe_by_id(
    recipe_id: int,
    user = Depends(get_user_from_token)
):
    """Get a specific scraped recipe by ID"""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(cursor_factory=RealDictCursor)
        
        # Get the recipe details with comprehensive component type information
        cursor.execute("""
            SELECT 
                r.*, 
                rc.component_type,
                rc.id as component_id,
                rc.name as component_name
            FROM scraped_recipes r
            LEFT JOIN recipe_components rc ON r.id = rc.recipe_id
            WHERE r.id = %s
        """, (recipe_id,))
        
        recipe = cursor.fetchone()
        if not recipe:
            raise HTTPException(status_code=404, detail="Recipe not found")
            
        # Check if recipe is saved by the user (if user is authenticated)
        user_id = None
        if user:
            user_id = user.get('user_id')
            
        if user_id:
            cursor.execute("""
                SELECT id FROM saved_recipes 
                WHERE user_id = %s AND scraped_recipe_id = %s
            """, (user_id, recipe_id))
            saved = cursor.fetchone()
            if saved:
                recipe['is_saved'] = True
                recipe['saved_id'] = saved['id']
            else:
                recipe['is_saved'] = False
                recipe['saved_id'] = None
        else:
            # Default for non-authenticated users or system requests
            recipe['is_saved'] = False
            recipe['saved_id'] = None
            
        # Process metadata if available to extract ingredients
        if recipe.get('metadata'):
            # Extract ingredients from metadata
            if isinstance(recipe['metadata'], str):
                try:
                    metadata = json.loads(recipe['metadata'])
                except:
                    metadata = {}
            else:
                metadata = recipe.get('metadata', {})
            
            # Extract ingredients_list from metadata if present
            if metadata and 'ingredients_list' in metadata:
                recipe['ingredients'] = metadata['ingredients_list']
            
        # Parse instructions if stored as JSON string
        if recipe.get('instructions') and isinstance(recipe['instructions'], str):
            try:
                recipe['instructions'] = json.loads(recipe['instructions'])
            except:
                # If it can't be parsed as JSON, leave it as is
                pass
                
        return recipe
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error in get_scraped_recipe_by_id: {str(e)}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Error fetching recipe: {str(e)}")
    finally:
        cursor.close()
        conn.close()