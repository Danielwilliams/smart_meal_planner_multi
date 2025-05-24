import json
import sys
import logging
from app.routers.grocery_list import create_categorized_fallback

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def test_categorized_fallback():
    """Test the fallback categorization with sample grocery items"""
    
    # Sample grocery list with various formats
    sample_grocery_list = [
        {"name": "Chicken Breast: 2 lb", "quantity": "2", "unit": "lb"},
        {"name": "Spinach: 1 cup", "quantity": "1", "unit": "cup"},
        {"name": "Olive Oil", "quantity": "2", "unit": "tbsp"},
        {"name": "Bell Pepper: 2 medium", "quantity": "2", "unit": "medium"},
        {"name": "Rice: 1.5 cups", "quantity": "1.5", "unit": "cups"},
        "Garlic: 3 cloves",
        "Salt",
        "Black Pepper",
        "Cheddar Cheese: 8 oz",
        "Milk: 1 cup",
        "Flour: 2 cups",
        "Sugar: 0.5 cup",
        "Baking Powder: 1 tsp",
        "Chocolate Chips: 1 cup",
        "Peanut Butter: 2 tbsp",
        "Beans: 1 can",
        "Broccoli: 2 cups"
    ]
    
    # Call the function to categorize the list
    categorized = create_categorized_fallback(sample_grocery_list)
    
    # Print the results
    print(f"\nCategorized {len(sample_grocery_list)} items into {len(categorized)} categories:\n")
    
    for category in categorized:
        print(f"{category['category']} ({len(category['items'])} items):")
        for item in category['items']:
            display = item.get('display_name', item.get('name', 'Unknown'))
            print(f"  - {display}")
        print()
    
    # Return the categorized list for further analysis
    return categorized

if __name__ == "__main__":
    result = test_categorized_fallback()
    
    # If requested, dump the full JSON result
    if len(sys.argv) > 1 and sys.argv[1] == "--json":
        print(json.dumps(result, indent=2))