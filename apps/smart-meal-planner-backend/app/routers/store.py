# app/routers/store.py
from fastapi import APIRouter, HTTPException
from typing import List
from ..integration import kroger, walmart
from pydantic import BaseModel

router = APIRouter(prefix="/store", tags=["Stores"])

class StoreSearchRequest(BaseModel):
    items: List[str]
    store: str

@router.post("/search")
async def store_search(req: StoreSearchRequest):
    """Search for items in either Kroger or Walmart"""
    try:
        store_lower = req.store.lower()
        if store_lower == "kroger":
            token = kroger.get_kroger_access_token()
            if not token:
                raise HTTPException(401, "Failed to get Kroger token")
            
            results = []
            for item in req.items:
                search_resp = kroger.kroger_search_item(token, item)
                if search_resp and "data" in search_resp:
                    # Transform to consistent format
                    for product in search_resp["data"]:
                        price = None
                        if "items" in product and product["items"]:
                            price = product["items"][0].get("price", {}).get("regular")
                        
                        results.append({
                            "id": product.get("productId"),
                            "upc": product.get("upc"),
                            "name": product.get("description"),
                            "brand": product.get("brand"),
                            "price": price,
                            "size": product.get("items", [{}])[0].get("size"),
                            "original_query": item
                        })

            return {
                "status": "success",
                "results": results
            }

        elif store_lower == "walmart":
            # We'll implement Walmart later
            return {"status": "error", "message": "Walmart search not implemented yet"}
        else:
            raise HTTPException(400, "Unsupported store")

    except Exception as e:
        return {"status": "error", "message": str(e)}

@router.post("/cart/add")
async def add_to_store_cart(store: str, item_id: str, quantity: int = 1):
    """Add specific item to store cart"""
    try:
        if store.lower() == "kroger":
            token = kroger.get_kroger_access_token()
            if not token:
                raise HTTPException(401, "Failed to get Kroger token")
                
            result = kroger.add_to_kroger_cart(token, item_id, quantity)
            return {
                "status": "success",
                "message": "Item added to Kroger cart",
                "details": result
            }
        else:
            raise HTTPException(400, "Unsupported store")
            
    except Exception as e:
        return {"status": "error", "message": str(e)}