# app/routers/custom_menu.py
from fastapi import APIRouter, HTTPException, Depends, Query, Request
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
import json
from ..db import get_db_connection
from ..utils.auth_utils import get_user_from_token
from ..utils.grocery_aggregator import aggregate_grocery_list
from ..ai.custom_meal_builder import suggest_custom_meal
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/custom-menu", tags=["CustomMenu"])

class CustomRecipe(BaseModel):
    recipe_id: Optional[int] = None  # For scraped recipes
    menu_recipe_id: Optional[str] = None  # For existing generated menu recipes
    saved_recipe_id: Optional[int] = None  # For user's saved recipes
    title: str
    ingredients: Optional[List[Any]] = []  # Made more flexible to accept different formats
    instructions: Optional[List[Any]] = []  # Made more flexible to accept different formats
    meal_time: str  # breakfast, lunch, dinner, snack
    servings: Optional[int] = 1
    macros: Optional[Dict[str, Any]] = None
    image_url: Optional[str] = None
    day: Optional[int] = None  # Which day this recipe is assigned to

class CustomMealPlanRequest(BaseModel):
    user_id: int
    for_client_id: Optional[int] = None  # Added for multi-user support
    recipes: List[CustomRecipe]
    duration_days: int = 7
    nickname: Optional[str] = None

@router.post("/generate-debug")
async def debug_custom_menu_request(
    request: Request,
    user = Depends(get_user_from_token)
):
    """Debug endpoint to see raw request data"""
    try:
        raw_data = await request.json()
        logger.info(f"Raw custom menu request data: {raw_data}")
        logger.info(f"Data type: {type(raw_data)}")
        for key, value in raw_data.items():
            logger.info(f"Key '{key}': {value} (type: {type(value)})")
        return {"status": "debug", "received_data": raw_data}
    except Exception as e:
        logger.error(f"Debug endpoint error: {e}")
        raise HTTPException(500, str(e))

@router.post("/generate")
def generate_custom_meal_plan(req: CustomMealPlanRequest, user = Depends(get_user_from_token)):
    """
    Generate a custom meal plan from user-selected recipes
    """
    logger.info(f"Custom menu generation request received")
    logger.info(f"Request data: {req.dict()}")
    logger.info(f"User info: {user}")

    try:
        # Ensure the user is authorized
        user_id = user.get('user_id')
        organization_id = user.get('organization_id')
        
        if user_id != req.user_id and user.get('role') != 'owner':
            raise HTTPException(status_code=403, detail="Not authorized to generate menus for this user")
        
        # Organization owners can create menus for clients
        client_id = None
        if req.for_client_id and user.get('role') == 'owner':
            client_id = req.for_client_id
            
            # Verify this client belongs to the organization
            conn = get_db_connection()
            cursor = conn.cursor()
            
            cursor.execute("""
                SELECT id FROM organization_clients
                WHERE organization_id = %s AND client_id = %s
            """, (organization_id, client_id))
            
            if not cursor.fetchone():
                cursor.close()
                conn.close()
                raise HTTPException(
                    status_code=404,
                    detail="Client not found in your organization"
                )
                
            cursor.close()
            conn.close()
            
        conn = get_db_connection()
        cursor = conn.cursor()

        # Group recipes by meal time
        meal_plan = {"days": []}

        # Distribute recipes across days
        for day_number in range(1, req.duration_days + 1):
            day_recipes = {
                "dayNumber": day_number,
                "meals": [],
                "snacks": []
            }

            # Get recipes assigned to this specific day
            day_recipes_for_day = [
                recipe for recipe in req.recipes
                if recipe.day == day_number
            ]

            logger.info(f"Day {day_number}: Looking for recipes with day={day_number}")
            logger.info(f"Available recipes: {[(r.title, r.day) for r in req.recipes]}")
            logger.info(f"Matching recipes: {[r.title for r in day_recipes_for_day]}")

            for recipe in day_recipes_for_day:
                # Transform recipe to match expected menu format
                recipe_data = {
                    "id": recipe.recipe_id or recipe.menu_recipe_id or f"custom_{hash(recipe.title)}",
                    "title": recipe.title,
                    "ingredients": recipe.ingredients or [],
                    "instructions": recipe.instructions or [],
                    "servings": recipe.servings or 1,
                    "meal_time": recipe.meal_time,
                    "image_url": recipe.image_url,
                    # Add nutrition data with defaults to prevent frontend crashes
                    "calories": recipe.macros.get("calories", 0) if recipe.macros else 0,
                    "protein": recipe.macros.get("protein", "0g") if recipe.macros else "0g",
                    "carbs": recipe.macros.get("carbs", "0g") if recipe.macros else "0g",
                    "fat": recipe.macros.get("fat", "0g") if recipe.macros else "0g",
                    # Include full macros for compatibility
                    "macros": recipe.macros or {}
                }

                if recipe.meal_time.lower() == 'snack':
                    day_recipes["snacks"].append(recipe_data)
                else:
                    day_recipes["meals"].append(recipe_data)

            # If no recipes assigned to this day, you might want to add a placeholder
            meal_plan["days"].append(day_recipes)

        # Save the custom meal plan to database
        cursor.execute("""
            INSERT INTO custom_menus (
                user_id,
                organization_id,
                for_client_id,
                title,
                meal_plan_json
            ) VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            req.user_id,
            organization_id,
            client_id,
            req.nickname or f"Custom Menu ({datetime.now().strftime('%Y-%m-%d')})",
            json.dumps(meal_plan)
        ))

        menu_id = cursor.fetchone()[0]
        conn.commit()

        return {
            "menu_id": menu_id,
            "meal_plan": meal_plan
        }

    except Exception as e:
        logger.error(f"Error generating custom meal plan: {str(e)}")
        if "not authorized" in str(e).lower() or "not found" in str(e).lower():
            raise
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.post("/{menu_id}/add-recipe")
def add_recipe_to_existing_menu(
    menu_id: int, 
    recipe: CustomRecipe,
    user = Depends(get_user_from_token)
):
    """
    Add a recipe to an existing menu
    """
    try:
        user_id = user.get('user_id')
        
        conn = get_db_connection()
        cursor = conn.cursor()

        # Fetch existing custom menu and check authorization
        cursor.execute("SELECT user_id, meal_plan_json FROM custom_menus WHERE id = %s", (menu_id,))
        menu_data = cursor.fetchone()

        if not menu_data:
            raise HTTPException(status_code=404, detail="Custom menu not found")

        # Check if user is authorized to modify this menu
        menu_owner_id = menu_data[0]
        if menu_owner_id != user_id and user.get('role') != 'owner':
            raise HTTPException(status_code=403, detail="Not authorized to modify this menu")

        # Parse existing meal plan
        meal_plan = json.loads(menu_data[1])

        # Add recipe to an appropriate day
        # Here you might want more sophisticated logic for adding
        selected_day = meal_plan['days'][0]  # Default to first day
        
        # Decide whether to add to meals or snacks
        if recipe.meal_time.lower() == 'snack':
            selected_day['snacks'].append(recipe.dict())
        else:
            selected_day['meals'].append(recipe.dict())

        # Update the custom menu in database
        cursor.execute("""
            UPDATE custom_menus
            SET meal_plan_json = %s, updated_at = CURRENT_TIMESTAMP
            WHERE id = %s
        """, (json.dumps(meal_plan), menu_id))

        conn.commit()

        return {
            "status": "success",
            "message": "Recipe added to menu",
            "updated_menu": meal_plan
        }

    except Exception as e:
        logger.error(f"Error adding recipe to menu: {str(e)}")
        if "not authorized" in str(e).lower() or "not found" in str(e).lower():
            raise
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@router.get("/{menu_id}")
def get_custom_menu_details(
    menu_id: int,
    user = Depends(get_user_from_token)
):
    """Retrieve full custom menu details for a specific custom menu"""
    try:
        user_id = user.get('user_id')
        organization_id = user.get('organization_id')

        conn = get_db_connection()
        cursor = conn.cursor()

        # Fetch the custom menu details
        cursor.execute("""
            SELECT
                id,
                user_id,
                organization_id,
                for_client_id,
                title,
                meal_plan_json,
                created_at,
                updated_at
            FROM custom_menus
            WHERE id = %s
        """, (menu_id,))

        menu_data = cursor.fetchone()

        if not menu_data:
            raise HTTPException(status_code=404, detail="Custom menu not found")

        # Check authorization
        menu_user_id, menu_org_id, menu_client_id = menu_data[1], menu_data[2], menu_data[3]

        # User can access if:
        # 1. They created the menu
        # 2. It's for them as a client
        # 3. They're an org owner and menu belongs to their org
        can_access = (
            menu_user_id == user_id or
            menu_client_id == user_id or
            (user.get('role') == 'owner' and menu_org_id == organization_id)
        )

        if not can_access:
            raise HTTPException(status_code=403, detail="Not authorized to view this menu")

        # Parse meal plan JSON
        meal_plan = json.loads(menu_data[5]) if isinstance(menu_data[5], str) else menu_data[5]

        return {
            "menu_id": menu_data[0],
            "user_id": menu_data[1],
            "organization_id": menu_data[2],
            "for_client_id": menu_data[3],
            "title": menu_data[4],
            "nickname": menu_data[4],  # For compatibility
            "meal_plan": meal_plan,
            "meal_plan_json": meal_plan,  # For compatibility
            "created_at": menu_data[6],
            "updated_at": menu_data[7]
        }

    except Exception as e:
        logger.error(f"Error retrieving custom menu: {str(e)}")
        if "not authorized" in str(e).lower() or "not found" in str(e).lower():
            raise
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/suggest-meal")
def suggest_meal(user = Depends(get_user_from_token)):
    """
    Suggest a custom meal based on component compatibility
    """
    try:
        user_id = user.get('user_id')
        
        meal = suggest_custom_meal(user_id)
        
        if not meal:
            return {
                "status": "no_suggestion",
                "message": "Could not generate a meal suggestion. Try again later."
            }
        
        return {
            "status": "success",
            "meal": meal
        }
        
    except Exception as e:
        logger.error(f"Error suggesting meal: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/generate-for-client/{client_id}")
async def generate_custom_menu_for_client(
    client_id: int,
    req: CustomMealPlanRequest,
    user = Depends(get_user_from_token)
):
    """Generate a custom meal plan for a specific client"""
    try:
        # Verify user is an organization owner
        user_id = user.get('user_id')
        org_id = user.get('organization_id')
        role = user.get('role', '')
        
        if role != 'owner':
            raise HTTPException(
                status_code=403, 
                detail="Only organization owners can generate menus for clients"
            )
        
        # Verify client belongs to this organization
        conn = get_db_connection()
        cursor = conn.cursor()
        
        try:
            cursor.execute("""
                SELECT id 
                FROM organization_clients 
                WHERE organization_id = %s AND client_id = %s AND status = 'active'
            """, (org_id, client_id))
            
            client_record = cursor.fetchone()
            if not client_record:
                raise HTTPException(
                    status_code=404, 
                    detail="Client not found or not active in your organization"
                )
                
            # Set the client_id in the request
            req.for_client_id = client_id
            req.user_id = user_id
            
            # Call the existing custom meal plan generation function
            return generate_custom_meal_plan(req, user)
            
        finally:
            cursor.close()
            conn.close()
            
    except Exception as e:
        logger.error(f"Error generating custom menu for client: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))