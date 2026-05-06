import sys
import json
from app.utils.grocery_aggregator import aggregate_grocery_list

def test_grocery_aggregation():
    """
    Test the aggregation of grocery items, focusing on units without quantities
    """
    # Create a test menu with ingredients that have units but no quantities
    test_menu = {
        "days": [
            {
                "meals": [
                    {
                        "title": "Breakfast",
                        "ingredients": [
                            {"name": "cup cheddar cheese"},
                            {"name": "lb ground beef"},
                            {"name": "tsp salt"},
                            {"name": "2 eggs"},
                            {"name": "cup parmesan cheese"},
                            {"name": "clove garlic"}
                        ]
                    },
                    {
                        "title": "Lunch",
                        "ingredients": [
                            {"name": "cup feta cheese"},
                            {"name": "tbsp olive oil"},
                            {"name": "oz cream cheese"},
                            {"name": "slice bread"},
                            {"name": "can black beans"}
                        ]
                    }
                ],
                "snacks": [
                    {
                        "title": "Afternoon Snack",
                        "ingredients": [
                            {"name": "apple"},
                            {"name": "bottle water"}
                        ]
                    }
                ]
            }
        ]
    }
    
    # Expected quantities for specific ingredients
    expected_items = {
        "Cheddar Cheese": "1 cup",
        "Ground Beef": "1 lb",
        "Salt": "1 tsp",
        "Parmesan Cheese": "0.25 cup",
        "Feta Cheese": "0.25 cup",
        "Olive Oil": "1 tbsp",
        "Cream Cheese": "1 oz",
        "Bread": "1 slice",
        "Black Beans": "1 cans",
        "Garlic": "1 cloves"
    }
    
    # Run the aggregation
    print("Testing grocery list aggregation with units without quantities:")
    result = aggregate_grocery_list(test_menu)
    
    if not result:
        print("✗ FAIL: Aggregation returned empty result")
        return 0, 1
    
    # Count successful matches
    passed = 0
    failed = 0
    found_items = set()
    
    print("\nGrocery list results:")
    for item in result:
        item_name = item.get("name", "").split(":")[0].strip()
        item_quantity = None
        
        # Get the quantity - it might be in different places depending on the format
        if ":" in item.get("name", ""):
            # Format: "Name: Quantity Unit"
            parts = item.get("name", "").split(":")
            if len(parts) > 1:
                item_quantity = parts[1].strip()
        elif item.get("quantity"):
            # Format: {"name": "Name", "quantity": "Quantity Unit"}
            item_quantity = item.get("quantity", "")
            
        print(f"  - {item_name}: {item_quantity}")
        
        # Check if this is one of our expected items
        for expected_name, expected_quantity in expected_items.items():
            if expected_name.lower() in item_name.lower():
                found_items.add(expected_name)
                
                # Check if the quantity matches our expectations
                quantity_match = False
                if item_quantity:
                    # Extract just the number from the quantity if needed
                    expected_number = expected_quantity.split()[0]
                    expected_unit = expected_quantity.split()[1] if len(expected_quantity.split()) > 1 else ""
                    
                    # Check if the item quantity contains our expected number and unit
                    if expected_number in item_quantity and (not expected_unit or expected_unit.lower() in item_quantity.lower()):
                        quantity_match = True
                
                if quantity_match:
                    print(f"✓ PASS: '{expected_name}' has correct quantity '{expected_quantity}'")
                    passed += 1
                else:
                    print(f"✗ FAIL: '{expected_name}' has quantity '{item_quantity}', expected '{expected_quantity}'")
                    failed += 1
    
    # Check for missing items
    missing_items = set(expected_items.keys()) - found_items
    for item in missing_items:
        print(f"✗ FAIL: '{item}' was not found in the grocery list")
        failed += 1
    
    print(f"\nResults: {passed} passed, {failed} failed\n")
    return passed, failed

def main():
    print("Testing grocery list aggregation\n" + "="*40)
    
    passed, failed = test_grocery_aggregation()
    
    print(f"Overall Results: {passed} passed, {failed} failed")
    
    if failed > 0:
        print("\nSome tests failed. Please review the output above for details.")
        return 1
    else:
        print("\nAll tests passed! The grocery list aggregation is working correctly.")
        return 0

if __name__ == "__main__":
    sys.exit(main())