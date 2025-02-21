@router.post("/compare")
def compare_prices(req: CompareRequest):
    """
    For each ingredient, query each store in 'stores' to get price details,
    and return a comparison list for the frontend to display.
    """
    comparison = []

    for ingr in req.ingredients:
        store_options = []
        for store in req.stores:
            info = get_item_price_from_store(store, ingr)
            store_options.append({
                "store_name": store,
                "price": info["price"],
                "image_url": info["image_url"],
                "product_id": info["product_id"]
            })
        comparison.append({
            "ingredient": ingr,
            "options": store_options
        })

    return {"comparison": comparison}
