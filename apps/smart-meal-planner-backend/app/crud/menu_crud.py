# app/crud/menu_crud.py

import json
from ..db import get_db_connection

def create_menu_in_db(menu_plan_dict: dict) -> int:
    """
    Insert a new row into the 'menus' table with the entire meal plan as JSON.
    Return the new menu ID.
    """
    menu_plan_str = json.dumps(menu_plan_dict)

    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO menus (meal_plan_json)
                VALUES (%s)
                RETURNING id
            """, (menu_plan_str,))
            new_id = cur.fetchone()[0]
        conn.commit()
        return new_id
    finally:
        conn.close()


def get_menu_by_id(menu_id: int) -> dict:
    """
    Fetch the row from 'menus' table by ID, parse the meal_plan_json back to a dict.
    Return a dict: {"id": ..., "meal_plan_dict": ...}
    or None if not found.
    """
    conn = get_db_connection()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT id, meal_plan_json FROM menus WHERE id = %s", (menu_id,))
            row = cur.fetchone()

        if not row:
            return None

        # row = [id, meal_plan_json_string]
        meal_plan_dict = json.loads(row[1])
        return {
            "id": row[0],
            "meal_plan_dict": meal_plan_dict
        }
    finally:
        conn.close()
