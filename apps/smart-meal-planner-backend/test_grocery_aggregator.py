from app.utils.grocery_aggregator import aggregate_grocery_list
import json
import sys
import os

def test_grocery_aggregator():
    # Load the test menu data
    try:
        test_data = {
            "menu_id": 401,
            "meal_plan_json": {
                "days": [
                    {
                        "meals": [
                            {
                                "title": "Avocado Toast with Poached Egg",
                                "ingredients": [
                                    {"name": "Avocado", "quantity": "1/2"},
                                    {"name": "Egg", "quantity": "1"},
                                    {"name": "Whole Wheat Bread", "quantity": "1 slice"}
                                ]
                            },
                            {
                                "title": "Chicken Caesar Salad",
                                "ingredients": [
                                    {"name": "Chicken Breast", "quantity": "3 oz"},
                                    {"name": "Romaine Lettuce", "quantity": "1 cup"},
                                    {"name": "Parmesan Cheese", "quantity": "1 tbsp"},
                                    {"name": "Caesar Dressing", "quantity": "1 tbsp"}
                                ]
                            }
                        ]
                    }
                ]
            }
        }
        
        print(f"Testing with sample menu data")
        
        # Test direct meal_plan_json
        print("\nTest 1: Direct meal_plan_json")
        result1 = aggregate_grocery_list(test_data['meal_plan_json'])
        print(f"Found {len(result1)} ingredients")
        if result1:
            print(f"First ingredients:")
            for item in result1[:3]:
                print(f"  - {item['name']}")
        
        # Test handling of menu_dict with meal_plan_json
        print("\nTest 2: menu_dict with meal_plan_json")
        result2 = aggregate_grocery_list(test_data)
        print(f"Found {len(result2)} ingredients")
        if result2:
            print(f"First ingredients:")
            for item in result2[:3]:
                print(f"  - {item['name']}")
                
        # Try with the real data provided by the user if available
        real_data_path = os.path.join("..", "..", "GeneratedMenu.txt")
        if os.path.exists(real_data_path):
            print("\nTest 3: User-provided menu data")
            try:
                with open(real_data_path, 'r') as f:
                    user_data = json.load(f)
                
                if isinstance(user_data, dict) and "meal_plan" in user_data:
                    result3 = aggregate_grocery_list(user_data["meal_plan"])
                    print(f"Found {len(result3)} ingredients from user data")
                    if result3:
                        print(f"First ingredients:")
                        for item in result3[:3]:
                            print(f"  - {item['name']}")
                else:
                    print(f"User data doesn't have the expected structure")
            except Exception as e:
                print(f"Error with user data: {e}")
        
        # Test successful if we found ingredients in any test
        return len(result1) > 0 or len(result2) > 0
        
    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = test_grocery_aggregator()
    print(f"\nTest {'PASSED' if success else 'FAILED'}")
    sys.exit(0 if success else 1)