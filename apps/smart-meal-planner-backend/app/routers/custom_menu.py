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

            # Distribute recipes to this day
            day_recipes_for_day = [
                recipe for recipe in req.recipes 
                if (day_number - 1) % req.duration_days == len(meal_plan["days"]) % req.duration_days
            ]

            for recipe in day_recipes_for_day:
                if recipe.meal_time.lower() == 'snack':
                    day_recipes["snacks"].append(recipe.dict())
                else:
                    day_recipes["meals"].append(recipe.dict())

            # If no recipes assigned to this day, you might want to add a placeholder
            meal_plan["days"].append(day_recipes)

        # Save the custom meal plan to database
        cursor.execute("""
            INSERT INTO menus (
                user_id, 
                meal_plan_json, 
                duration_days, 
                nickname,
                for_client_id
            ) VALUES (%s, %s, %s, %s, %s)
            RETURNING id;
        """, (
            req.user_id, 
            json.dumps(meal_plan), 
            req.duration_days,
            req.nickname or f"Custom Menu ({datetime.now().strftime('%Y-%m-%d')})",
            client_id
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

        # Fetch existing menu and check authorization
        cursor.execute("SELECT user_id, meal_plan_json FROM menus WHERE id = %s", (menu_id,))
        menu_data = cursor.fetchone()

        if not menu_data:
            raise HTTPException(status_code=404, detail="Menu not found")
            
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

        # Update the menu in database
        cursor.execute("""
            UPDATE menus 
            SET meal_plan_json = %s
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