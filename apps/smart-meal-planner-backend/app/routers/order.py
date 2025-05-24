from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List, Dict, Any
from ..db import get_db_connection

router = APIRouter(prefix="/order", tags=["Order"])

def place_order_at_store(store_name: str, user_id: int, items: List[dict]) -> dict:
    """
    Pseudo-code to integrate with store's actual checkout.
    Return store_order_id and status from the store.
    """
    if store_name.lower() == "kroger":
        return {"store_order_id": "KRO-123", "status": "Order Placed"}
    elif store_name.lower() == "walmart":
        return {"store_order_id": "WMT-789", "status": "Order Placed"}
    else:
        return {"store_order_id": "MOCK-ORDER", "status": "Order Placed"}

class OrderRequest(BaseModel):
    user_id: int
    store_name: str
    items: List[Dict[str, Any]]  # e.g. { product_id, price, quantity }
    total_cost: float

@router.post("/")
def create_order(order_req: OrderRequest):
    try:
        # 1. Place order at store
        result = place_order_at_store(order_req.store_name, order_req.user_id, order_req.items)
        store_order_id = result["store_order_id"]
        status = result["status"]

        # 2. Insert into 'orders' table
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO orders (user_id, store_name, order_status, order_total)
            VALUES (%s, %s, %s, %s)
            RETURNING id;
        """, (order_req.user_id, order_req.store_name, status, order_req.total_cost))
        new_order_id = cursor.fetchone()[0]
        conn.commit()
        cursor.close()
        conn.close()

        return {
            "order_id": new_order_id,
            "store_order_id": store_order_id,
            "status": status
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
