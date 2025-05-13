/**
 * EMERGENCY DIRECT FIX FOR AI SHOPPING LIST
 * 
 * This script provides a direct immediate fix for the categorized shopping list problem.
 * Apply these changes to fix the issues with categories not displaying in the UI.
 */

// Apply this fix in the developer console when the shopping list is displayed
function applySmartShoppingListFix() {
  console.log("Applying emergency shopping list fix...");
  
  // Directly access the aiShoppingData state
  let shoppingListData = window.aiShoppingData;
  
  if (!shoppingListData) {
    console.log("No shopping list data found - scanning for data...");
    
    // Try to locate data in any global or application state
    if (window.lastAiShoppingList) {
      shoppingListData = window.lastAiShoppingList;
    }
  }
  
  if (!shoppingListData) {
    console.error("Shopping list data not found");
    return;
  }
  
  console.log("Original shopping list data:", shoppingListData);
  
  // Check if it already has categories and has "All Items" category
  if (shoppingListData.categories && shoppingListData.categories["All Items"]) {
    // We need to convert All Items to proper categories
    const allItems = shoppingListData.categories["All Items"];
    
    // Define category keywords for classification
    const categoryKeywords = {
      "Protein": ["chicken", "beef", "turkey", "salmon", "fish", "pork", "tofu", "bacon", "meat", "ground"],
      "Produce": ["pepper", "onion", "garlic", "broccoli", "carrot", "lettuce", "tomato", "spinach", "cucumber", 
                  "avocado", "potato", "berry", "lime", "lemon", "ginger", "vegetable", "fruit", "herb"],
      "Dairy": ["cheese", "yogurt", "milk", "cream", "butter", "egg", "parmesan", "cheddar", "mozzarella"],
      "Grains": ["rice", "pasta", "quinoa", "oat", "bread", "tortilla", "flour", "grain"],
      "Pantry": ["oil", "spice", "salt", "pepper", "sugar", "honey", "cornstarch", "vinegar", "sauce", 
                "can", "broth", "stock", "bean", "nut"],
      "Condiments": ["salsa", "sauce", "soy sauce", "dressing", "marinade"]
    };
    
    // Create new categorized structure
    const newCategories = {};
    
    // Categorize each item
    for (const item of allItems) {
      // Skip empty items
      if (!item) continue;
      
      // Normalize item text for categorization
      let itemText = '';
      if (typeof item === 'string') {
        itemText = item.toLowerCase();
      } else if (item.name) {
        itemText = item.name.toLowerCase();
      } else {
        itemText = String(item).toLowerCase();
      }
      
      // Find matching category
      let category = "Other";
      for (const [cat, keywords] of Object.entries(categoryKeywords)) {
        if (keywords.some(keyword => itemText.includes(keyword))) {
          category = cat;
          break;
        }
      }
      
      // Add to category
      if (!newCategories[category]) {
        newCategories[category] = [];
      }
      newCategories[category].push(item);
    }
    
    // Replace the categories in the shopping list data
    shoppingListData.categories = newCategories;
    
    console.log("Fixed shopping list data:", shoppingListData);
    
    // Store the fixed data for later use
    window.fixedShoppingListData = shoppingListData;
    
    // This data would need to be manually passed to your SmartShoppingList component
    return shoppingListData;
  }
  
  console.log("Shopping list data doesn't contain 'All Items' category");
  return shoppingListData;
}

// Apply the fix and refresh the UI
applySmartShoppingListFix();

/**
 * INSTRUCTIONS FOR DEVELOPERS:
 * 
 * 1. In the React component rendering your shopping list, check if categories exist
 * 2. Make sure to:
 *    - Properly pass the categories to SmartShoppingList
 *    - Directly use the categories in the UI rather than flattening them
 *    - Check console for detailed errors
 *
 * Apply this fix for immediate problems while implementing proper adapter fixes
 */