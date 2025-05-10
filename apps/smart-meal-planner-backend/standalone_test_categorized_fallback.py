import json
import sys
import re
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def create_categorized_fallback(grocery_list):
    """
    Create a categorized version of the grocery list as a fallback when AI processing fails.
    
    Args:
        grocery_list: The basic grocery list (list of items)
        
    Returns:
        A list of categories, each containing items that belong to that category
    """
    # Define common categories and keywords that belong to each
    categories = {
        "Produce": [
            "apple", "banana", "orange", "grape", "berry", "berries", "lemon", "lime", 
            "lettuce", "spinach", "kale", "arugula", "tomato", "potato", "onion", "garlic",
            "carrot", "cucumber", "zucchini", "squash", "pepper", "eggplant", "broccoli",
            "cauliflower", "celery", "asparagus", "avocado", "mushroom", "ginger", "herbs",
            "cilantro", "parsley", "mint", "basil", "thyme", "rosemary", "fruit", "vegetable"
        ],
        "Meat and Proteins": [
            "chicken", "beef", "pork", "lamb", "turkey", "fish", "salmon", "tuna", "shrimp",
            "tofu", "tempeh", "seitan", "eggs", "sausage", "bacon", "ground", "steak",
            "tenderloin", "fillet", "meat", "protein", "ribs", "chuck", "sirloin"
        ],
        "Dairy": [
            "milk", "cheese", "yogurt", "cream", "butter", "margarine", "ghee", "cheddar",
            "mozzarella", "parmesan", "ricotta", "cottage", "sour cream", "half and half",
            "creamer", "buttermilk", "whey", "dairy"
        ],
        "Grains and Bread": [
            "bread", "roll", "bun", "bagel", "tortilla", "wrap", "pita", "naan", "rice", 
            "quinoa", "pasta", "noodle", "flour", "oats", "oatmeal", "cereal", "grain",
            "barley", "couscous", "cracker", "panko", "breadcrumb", "cornmeal"
        ],
        "Canned and Packaged": [
            "can", "beans", "chickpea", "lentil", "pea", "tomato sauce", "paste", "broth", 
            "stock", "soup", "tuna", "salmon", "sardine", "sauce", "salsa", "jam", "jelly",
            "peanut butter", "nutella", "spread", "conserve"
        ],
        "Condiments and Oils": [
            "oil", "olive oil", "vegetable oil", "coconut oil", "vinegar", "mustard", 
            "ketchup", "mayonnaise", "hot sauce", "soy sauce", "tamari", "fish sauce", 
            "worcestershire", "salad dressing", "dressing", "marinade", "barbecue", "bbq"
        ],
        "Spices and Herbs": [
            "salt", "pepper", "spice", "herb", "seasoning", "paprika", "cumin", "oregano",
            "basil", "thyme", "rosemary", "sage", "cinnamon", "nutmeg", "clove", "cardamom",
            "turmeric", "curry", "powder", "flake", "seed", "anise", "bay leaf", "chili",
            "garlic powder", "onion powder", "vanilla"
        ],
        "Baking Supplies": [
            "sugar", "brown sugar", "powdered sugar", "honey", "maple syrup", "molasses",
            "flour", "baking powder", "baking soda", "yeast", "chocolate chip", "cocoa",
            "vanilla extract", "almond extract", "food coloring", "sprinkle", "frosting"
        ],
        "Snacks and Desserts": [
            "chip", "crisp", "pretzel", "popcorn", "nut", "almond", "cashew", "peanut",
            "walnut", "pecan", "cookie", "cracker", "candy", "chocolate", "ice cream", 
            "sweet", "snack", "granola", "bar", "dessert", "treat"
        ],
        "Beverages": [
            "water", "juice", "soda", "pop", "coffee", "tea", "milk", "almond milk",
            "soy milk", "oat milk", "drink", "beverage", "smoothie", "beer", "wine",
            "alcohol", "liquor", "cocktail", "mixer"
        ],
        "Frozen Foods": [
            "frozen", "ice cream", "fries", "pizza", "meal", "veggie burger", "waffle"
        ],
        "Breakfast Items": [
            "cereal", "oatmeal", "pancake", "waffle", "syrup", "breakfast", "bacon", "egg"
        ]
    }
    
    # Create a function to determine which category an item belongs to
    def determine_category(item_name):
        item_name_lower = item_name.lower()
        
        # Check each category's keywords
        for category, keywords in categories.items():
            for keyword in keywords:
                if keyword in item_name_lower:
                    return category
        
        # Default category if no match found
        return "Other"
    
    # Initialize result structure with empty categories
    result = [{"category": category, "items": []} for category in categories.keys()]
    result.append({"category": "Other", "items": []})  # Add "Other" category
    
    # Create a mapping from category name to index in result
    category_indices = {cat["category"]: i for i, cat in enumerate(result)}
    
    # Process each grocery item
    for item in grocery_list:
        try:
            # Extract the item name from string or dictionary format
            if isinstance(item, dict) and "name" in item:
                # If it's already a dict with a name field, use that
                item_name = item["name"]
                item_obj = item
            elif isinstance(item, str):
                # If it's a string, use it directly and create a dict
                item_name = item
                item_obj = {"name": item, "quantity": "1", "unit": ""}
            else:
                # Convert any other type to string
                item_name = str(item)
                item_obj = {"name": item_name, "quantity": "1", "unit": ""}
            
            # Clean up item name if it contains quantity info
            if ":" in item_name:
                parts = item_name.split(":")
                item_name = parts[0].strip()
                item_obj["name"] = item_name
                
                # If there's quantity info after the colon, extract it
                if len(parts) > 1:
                    qty_info = parts[1].strip()
                    # Try to extract quantity and unit
                    qty_match = re.match(r'^([\d./]+)\s*(.*)$', qty_info)
                    if qty_match:
                        item_obj["quantity"] = qty_match.group(1)
                        item_obj["unit"] = qty_match.group(2).strip()
            
            # Determine which category this item belongs to
            category = determine_category(item_name)
            
            # Ensure each item has a display_name
            if "display_name" not in item_obj:
                unit_str = f" {item_obj.get('unit', '')}" if item_obj.get('unit') else ""
                item_obj["display_name"] = f"{item_name}: {item_obj.get('quantity', '1')}{unit_str}".strip()
            
            # Add the item to the appropriate category
            result[category_indices[category]]["items"].append(item_obj)
            
        except Exception as e:
            logger.error(f"Error categorizing item {item}: {str(e)}")
            # If there's an error, add it to the "Other" category
            other_index = category_indices["Other"]
            if isinstance(item, dict) and "name" in item:
                result[other_index]["items"].append(item)
            else:
                result[other_index]["items"].append({"name": str(item), "quantity": "1", "unit": ""})
    
    # Remove empty categories
    result = [cat for cat in result if len(cat["items"]) > 0]
    
    # Log the results
    logger.info(f"Created fallback categorized list with {len(result)} non-empty categories")
    for cat in result:
        logger.info(f"  Category: {cat['category']} - {len(cat['items'])} items")
    
    return result

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