# app/routers/saved_recipes.py
from fastapi import APIRouter, HTTPException, Depends, Body, Query
from pydantic import validator
from typing import Optional
import logging
from ..db import (
    save_recipe, 
    unsave_recipe, 
    get_user_saved_recipes, 
    is_recipe_saved, 
    get_saved_recipe_by_id,
    get_saved_recipe_id,
    get_db_connection
)
from ..utils.auth_utils import get_user_from_token
from ..models.user import SaveRecipeRequest

logger = logging.getLogger(__name__)

def parse_optional_int(value: str = None) -> Optional[int]:
    """Parse optional integer, handling 'null' strings"""
    if value is None or value == "null" or value == "":
        return None
    try:
        return int(value)
    except (ValueError, TypeError):
        return None

router = APIRouter(prefix="/saved-recipes", tags=["SavedRecipes"])

@router.get("/test")
async def test_endpoint():
    """Test endpoint to verify routing works"""
    return {"status": "saved-recipes route working"}

@router.post("/")
async def add_saved_recipe(
    req: SaveRecipeRequest,
    user = Depends(get_user_from_token),
    client_id: Optional[int] = Query(None)  # Optional client ID for organization owners
):
    """Save a recipe or entire menu to user's favorites with complete recipe data"""
    user_id = user.get('user_id')
    logger.info(f"POST /saved-recipes/ called for user {user_id}")
    logger.info(f"Request data: {req.dict()}")
    
    try:
        # Log the incoming request data in detail
        logger.info(f"Received recipe save request: {req}")
        logger.info(f"Recipe source: {req.recipe_source}, Scraped ID: {req.scraped_recipe_id}")
        logger.info(f"Client ID (if any): {client_id}")
        
        # Log all request fields individually for debugging
        for field, value in req.dict().items():
            logger.info(f"Field '{field}': {value}")
        
        # If client_id is provided, verify the user is an organization owner
        # and has access to this client
        if client_id:
            conn = get_db_connection()
            try:
                with conn.cursor() as cur:
                    # Check if user is an organization owner
                    cur.execute("""
                        SELECT id FROM organizations WHERE owner_id = %s
                    """, (user_id,))
                    
                    org = cur.fetchone()
                    if not org:
                        raise HTTPException(
                            status_code=403,
                            detail="Only organization owners can save recipes for clients"
                        )
                        
                    org_id = org[0]
                    
                    # Check if client belongs to this organization
                    cur.execute("""
                        SELECT 1 FROM organization_clients
                        WHERE organization_id = %s AND client_id = %s
                    """, (org_id, client_id))
                    
                    if not cur.fetchone():
                        raise HTTPException(
                            status_code=403,
                            detail="This client does not belong to your organization"
                        )
                    
                    # Use the client_id instead of the owner's id
                    user_id = client_id
            finally:
                conn.close()
        
        # Determine the recipe source
        recipe_source = req.recipe_source
        if not recipe_source:
            if req.scraped_recipe_id:
                recipe_source = 'scraped'
            else:
                recipe_source = 'menu'
        
        # Save the recipe with all available data
        saved_id = save_recipe(
            user_id=user_id,
            menu_id=req.menu_id,
            recipe_id=req.recipe_id,
            recipe_name=req.recipe_name,
            day_number=req.day_number,
            meal_time=req.meal_time,
            notes=req.notes,
            macros=req.macros,
            ingredients=req.ingredients,
            instructions=req.instructions,
            complexity_level=req.complexity_level,
            appliance_used=req.appliance_used,
            servings=req.servings,
            scraped_recipe_id=req.scraped_recipe_id,
            recipe_source=recipe_source
        )
        
        if saved_id:
            return {
                "status": "success", 
                "message": "Recipe saved successfully", 
                "saved_id": saved_id,
                "macros": req.macros,
                "for_client": client_id is not None
            }
        else:
            raise HTTPException(
                status_code=500, 
                detail="Failed to save recipe"
            )
    
    except Exception as e:
        logger.error(f"Error saving recipe: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error saving recipe: {str(e)}"
        )

@router.delete("/{saved_id}")
async def remove_saved_recipe(
    saved_id: int,
    user = Depends(get_user_from_token)
):
    """Remove a recipe from saved/favorites"""
    user_id = user.get('user_id')
    
    try:
        success = unsave_recipe(user_id=user_id, saved_id=saved_id)
        
        if success:
            return {
                "status": "success", 
                "message": "Recipe removed from favorites"
            }
        else:
            raise HTTPException(
                status_code=404, 
                detail="Saved recipe not found or already removed"
            )
    
    except Exception as e:
        logger.error(f"Error removing saved recipe: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error removing saved recipe: {str(e)}"
        )

@router.get("/")
async def list_saved_recipes(
    user = Depends(get_user_from_token)
):
    """Get all saved recipes for current user"""
    user_id = user.get('user_id')
    
    try:
        saved_recipes = get_user_saved_recipes(user_id)
        
        return {
            "status": "success", 
            "saved_recipes": saved_recipes
        }
    
    except Exception as e:
        logger.error(f"Error fetching saved recipes: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching saved recipes: {str(e)}"
        )

@router.get("/client/{client_id}")
async def get_client_saved_recipes(
    client_id: int,
    user = Depends(get_user_from_token)
):
    """
    Get all saved recipes for a specific client.
    Only accessible by organization owners for their clients.
    """
    trainer_id = user.get('user_id')
    
    try:
        # Verify the trainer has access to this client
        conn = get_db_connection()
        
        try:
            with conn.cursor() as cur:
                # Check if user is an organization owner
                cur.execute("""
                    SELECT id FROM organizations WHERE owner_id = %s
                """, (trainer_id,))
                
                org_result = cur.fetchone()
                if not org_result:
                    logger.warning(f"User {trainer_id} attempted to access client {client_id} saved recipes but is not an organization owner")
                    raise HTTPException(
                        status_code=403,
                        detail="Only organization owners can access client saved recipes"
                    )
                    
                org_id = org_result[0]
                
                # Check if client belongs to this organization
                cur.execute("""
                    SELECT 1 FROM organization_clients
                    WHERE organization_id = %s AND client_id = %s
                """, (org_id, client_id))
                
                if not cur.fetchone():
                    logger.warning(f"User {trainer_id} attempted to access client {client_id} saved recipes but client is not in their organization")
                    raise HTTPException(
                        status_code=403,
                        detail="This client does not belong to your organization"
                    )
        finally:
            conn.close()
        
        # Now get the client's saved recipes
        saved_recipes = get_user_saved_recipes(client_id)
        
        return {
            "status": "success",
            "client_id": client_id,
            "saved_recipes": saved_recipes
        }
    
    except HTTPException:
        # Re-raise HTTP exceptions
        raise
    except Exception as e:
        logger.error(f"Error fetching client saved recipes: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching client saved recipes: {str(e)}"
        )

@router.get("/check")
async def check_recipe_saved(
    menu_id: Optional[str] = Query(None),
    recipe_id: Optional[str] = Query(None),
    meal_time: Optional[str] = Query(None),
    scraped_recipe_id: Optional[str] = Query(None),
    user = Depends(get_user_from_token)
):
    """
    Check if a recipe is saved by the current user.
    
    Required parameters:
    - Either menu_id OR scraped_recipe_id must be provided
    """
    """Check if a recipe is saved by the current user"""
    user_id = user.get('user_id')

    # Parse string parameters to proper types
    parsed_menu_id = parse_optional_int(menu_id)
    parsed_scraped_recipe_id = parse_optional_int(scraped_recipe_id)

    logger.info(f"Check recipe saved - menu_id: {menu_id} -> {parsed_menu_id}, scraped_recipe_id: {scraped_recipe_id} -> {parsed_scraped_recipe_id}")

    try:
        # Logic to check if recipe is saved
        if parsed_scraped_recipe_id:
            # Special check for scraped recipes using direct query
            conn = get_db_connection()
            cursor = conn.cursor()
            
            try:
                cursor.execute("""
                    SELECT id FROM saved_recipes
                    WHERE user_id = %s AND scraped_recipe_id = %s
                """, (user_id, parsed_scraped_recipe_id))
                
                result = cursor.fetchone()
                is_saved = result is not None
                saved_id = result[0] if result else None
                
                recipe_source = 'scraped'
            finally:
                cursor.close()
                conn.close()
        elif parsed_menu_id:
            # Regular menu recipe check
            is_saved = is_recipe_saved(
                user_id=user_id,
                menu_id=parsed_menu_id,
                recipe_id=recipe_id,
                meal_time=meal_time
            )
            
            # If saved, also return the saved ID for easier deletion
            saved_id = None
            if is_saved:
                saved_id = get_saved_recipe_id(
                    user_id=user_id,
                    menu_id=parsed_menu_id,
                    recipe_id=recipe_id,
                    meal_time=meal_time
                )
                
            recipe_source = 'menu'
        else:
            # Neither menu_id nor scraped_recipe_id provided
            raise HTTPException(
                status_code=400,
                detail="Either menu_id or scraped_recipe_id must be provided"
            )
            
        return {
            "is_saved": is_saved,
            "saved_id": saved_id,
            "recipe_source": recipe_source
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error checking saved status: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error checking saved status: {str(e)}"
        )

@router.get("/{saved_id}")
async def get_saved_recipe_details(
    saved_id: int,
    user = Depends(get_user_from_token)
):
    """Get details of a specific saved recipe"""
    user_id = user.get('user_id')
    
    try:
        recipe = get_saved_recipe_by_id(user_id, saved_id)
        
        if not recipe:
            raise HTTPException(
                status_code=404, 
                detail="Saved recipe not found"
            )
            
        return {
            "status": "success",
            "recipe": recipe
        }
    
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error fetching saved recipe details: {str(e)}")
        raise HTTPException(
            status_code=500, 
            detail=f"Error fetching saved recipe details: {str(e)}"
        )