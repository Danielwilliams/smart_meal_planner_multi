# smart_meal_planner/meal_planner_backend/app/routers/grocery_list.py

from fastapi import APIRouter, HTTPException
from psycopg2.extras import RealDictCursor
from ..db import get_db_connection
from ..utils.grocery_aggregator import aggregate_grocery_list
import json

router = APIRouter(prefix="/menu", tags=["MenuGrocery"])


@router.get("/{menu_id}")
def get_menu_details(menu_id: int):
    """
    Retrieve full menu details for a specific menu
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the full menu details
            cur.execute("""
                SELECT 
                    id AS menu_id, 
                    meal_plan_json, 
                    user_id, 
                    created_at, 
                    nickname
                FROM menus 
                WHERE id = %s
            """, (menu_id,))
            menu = cur.fetchone()
        
        if not menu:
            raise HTTPException(status_code=404, detail="Menu not found")
        
        # Ensure meal_plan_json is parsed
        menu['meal_plan'] = json.loads(menu['meal_plan_json']) if isinstance(menu['meal_plan_json'], str) else menu['meal_plan_json']
        
        return menu
    except Exception as e:
        print("Error retrieving menu details:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()


@router.get("/{menu_id}/grocery-list")
def get_grocery_list(menu_id: int):
    """
    1) Connect to PostgreSQL via psycopg2
    2) Retrieve 'meal_plan_json' from the 'menus' table
    3) Parse it to a Python dict
    4) Call aggregate_grocery_list(menu_dict)
    5) Return the aggregated results
    """
    conn = get_db_connection()
    try:
        with conn.cursor(cursor_factory=RealDictCursor) as cur:
            # Fetch the meal_plan_json field
            cur.execute("SELECT meal_plan_json FROM menus WHERE id=%s", (menu_id,))
            row = cur.fetchone()

        if not row:
            raise HTTPException(status_code=404, detail="Menu not found")

        # parse the JSON text into a Python dict
        menu_data = row["meal_plan_json"]

        # aggregate
        grocery_list = aggregate_grocery_list(menu_data)
        return {"groceryList": grocery_list}

    except Exception as e:
        print("Error retrieving grocery list:", e)
        raise HTTPException(status_code=500, detail="Internal server error")
    finally:
        conn.close()

@router.get("/latest/{user_id}")
def get_latest_grocery_list(user_id: int):
    """
    Generate grocery list from the most recent menu.
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("""
        SELECT id, meal_plan_json
        FROM menus
        WHERE user_id = %s
        ORDER BY created_at DESC
        LIMIT 1;
    """, (user_id,))

    menu = cursor.fetchone()
    cursor.close()
    conn.close()

    if not menu:
        raise HTTPException(status_code=404, detail="No menu found for this user.")

    # Process grocery list from the latest menu
    grocery_list = aggregate_grocery_list(menu["meal_plan_json"])
    return {"menu_id": menu["id"], "groceryList": grocery_list}


        
