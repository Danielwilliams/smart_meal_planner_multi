/**
 * SIMPLE SHOPPING LIST FIX
 * 
 * This is a simplified replacement for the shopping list functionality
 * that focuses on just what's needed:
 * 
 * 1. Generate a shopping list with proper "Item: Quantity-Unit" format
 * 2. Include healthy alternatives
 * 3. Include shopping tips
 * 4. Work reliably without complex backend interactions
 *
 * To use this, simply copy and paste this code into a new file in your src/utils folder,
 * then import and use the generateShoppingList function directly.
 */

// Simple categorization for grocery items
const CATEGORIES = {
  "Produce": ["apple", "avocado", "banana", "berry", "broccoli", "carrot", "garlic", "kale", "lettuce", "onion", "pepper", "potato", "spinach", "tomato", "vegetable", "fruit"],
  "Meat and Proteins": ["beef", "chicken", "fish", "pork", "salmon", "shrimp", "tofu", "turkey", "ham", "meat", "protein", "steak", "ground", "burger"],
  "Dairy": ["butter", "cheese", "cream", "egg", "milk", "yogurt"],
  "Grains": ["bread", "cereal", "flour", "oat", "pasta", "rice", "tortilla", "quinoa", "grain"],
  "Spices and Herbs": ["basil", "cilantro", "cinnamon", "herb", "oregano", "parsley", "rosemary", "salt", "pepper", "spice", "thyme"],
  "Condiments": ["honey", "ketchup", "mayo", "mustard", "oil", "sauce", "vinegar", "salsa", "dressing"],
  "Canned Goods": ["beans", "soup", "tuna", "tomato sauce", "canned", "jar"],
  "Frozen Foods": ["frozen", "ice cream"],
  "Snacks": ["chip", "cookie", "cracker", "nut", "popcorn", "pretzel", "snack"]
};

// Common healthy alternatives for certain ingredients
const HEALTHY_ALTERNATIVES = [
  {
    original: "Sour Cream",
    alternative: "Non-Fat Plain Greek Yogurt",
    benefit: "Higher protein, lower fat"
  },
  {
    original: "Mayo",
    alternative: "Mashed Avocado",
    benefit: "Heart-healthy fats"
  },
  {
    original: "White Rice",
    alternative: "Brown Rice",
    benefit: "More fiber and nutrients"
  },
  {
    original: "Ground Beef",
    alternative: "Ground Turkey",
    benefit: "Lower fat content"
  },
  {
    original: "White Bread",
    alternative: "Whole Grain Bread",
    benefit: "More fiber and nutrients"
  },
  {
    original: "Regular Pasta",
    alternative: "Whole Wheat Pasta",
    benefit: "More fiber and nutrients"
  },
  {
    original: "Cream Cheese",
    alternative: "Neufchatel Cheese",
    benefit: "Lower fat content"
  },
  {
    original: "Heavy Cream",
    alternative: "Evaporated Skim Milk",
    benefit: "Lower fat content"
  },
  {
    original: "Butter",
    alternative: "Olive Oil",
    benefit: "Heart-healthy fats"
  }
];

// Common shopping tips
const SHOPPING_TIPS = [
  "Buy in-season produce for better flavor and nutrition",
  "Check unit prices to find the best value",
  "Look for sales on staple items you can stock up on",
  "Buy whole foods instead of pre-cut to save money",
  "Choose frozen fruits and vegetables when fresh options are expensive",
  "Make a shopping list and stick to it to avoid impulse purchases",
  "Shop the perimeter of the store first for fresh foods"
];

/**
 * Generate a shopping list with categorized items, healthy alternatives, and tips
 * 
 * @param {Array} ingredients - Array of ingredient strings or objects
 * @returns {Object} - Formatted shopping list with categories and recommendations
 */
function generateShoppingList(ingredients) {
  if (!ingredients || ingredients.length === 0) {
    return { groceryList: [] };
  }

  // Step 1: Extract ingredient names from various formats
  const cleanedIngredients = ingredients.map(item => {
    if (typeof item === 'string') {
      return item.trim();
    } else if (item && typeof item === 'object' && item.name) {
      return item.name.trim();
    } else {
      return String(item).trim();
    }
  }).filter(Boolean);

  // Step 2: Categorize the ingredients
  const categorizedItems = {};
  
  // Initialize categories
  Object.keys(CATEGORIES).forEach(category => {
    categorizedItems[category] = [];
  });
  categorizedItems["Other"] = []; // For items that don't match any category
  
  // Categorize each ingredient
  cleanedIngredients.forEach(ingredient => {
    let matched = false;
    
    // Find matching category
    for (const [category, keywords] of Object.entries(CATEGORIES)) {
      if (keywords.some(keyword => ingredient.toLowerCase().includes(keyword))) {
        matched = true;
        categorizedItems[category].push(formatIngredient(ingredient));
        break;
      }
    }
    
    // If no category matched, put in Other
    if (!matched) {
      categorizedItems["Other"].push(formatIngredient(ingredient));
    }
  });
  
  // Step 3: Format as groceryList array
  const groceryList = Object.entries(categorizedItems)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({
      category,
      items: items.map(item => ({
        name: item.name,
        quantity: item.quantity,
        unit: item.unit,
        display_name: `${item.name}: ${item.quantity}-${item.unit}`
      }))
    }));
  
  // Step 4: Add recommendations and tips
  return {
    groceryList,
    healthyAlternatives: HEALTHY_ALTERNATIVES,
    shoppingTips: SHOPPING_TIPS,
    recommendations: [
      "Shop from a list to reduce impulse purchases",
      "Compare prices between stores for best deals",
      "Check your pantry before shopping to avoid duplicates"
    ],
    nutritionTips: [
      "Choose colorful produce for a variety of nutrients",
      "Include lean proteins with each meal",
      "Opt for whole grains instead of refined options"
    ],
    status: "completed",
    cached: false
  };
}

/**
 * Format an ingredient with name, quantity and unit
 * 
 * @param {string} ingredient - Ingredient string
 * @returns {Object} - Formatted ingredient object
 */
function formatIngredient(ingredient) {
  // If ingredient already contains quantity (like "2 onions" or "Chicken: 2 lb")
  const colonFormat = ingredient.match(/^(.+?):\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (colonFormat) {
    const [_, name, quantity, unit] = colonFormat;
    return {
      name: capitalizeFirstLetters(name.trim()),
      quantity: quantity.trim() || "1",
      unit: unit.trim() || getDefaultUnit(name)
    };
  }
  
  // Check for "2 cups flour" format
  const spaceFormat = ingredient.match(/^(\d+(?:\.\d+)?)\s+(?:(\w+)\s+)?(.+)$/);
  if (spaceFormat) {
    const [_, quantity, possibleUnit, name] = spaceFormat;
    const unit = possibleUnit || getDefaultUnit(name);
    return {
      name: capitalizeFirstLetters(name.trim()),
      quantity: quantity.trim(),
      unit: unit.toLowerCase()
    };
  }
  
  // Default: Just the ingredient name with default quantity and unit
  return {
    name: capitalizeFirstLetters(ingredient),
    quantity: "1",
    unit: getDefaultUnit(ingredient)
  };
}

/**
 * Get default unit for an ingredient based on its name
 * 
 * @param {string} ingredient - Ingredient name
 * @returns {string} - Default unit
 */
function getDefaultUnit(ingredient) {
  const name = ingredient.toLowerCase();
  
  // Produce
  if (name.includes("onion") || name.includes("potato") || name.includes("tomato") || 
      name.includes("avocado") || name.includes("pepper") || name.includes("apple")) {
    return "medium";
  }
  
  // Meat
  if (name.includes("chicken") || name.includes("beef") || name.includes("pork") || 
      name.includes("turkey") || name.includes("meat") || name.includes("steak")) {
    return "lb";
  }
  
  // Dairy
  if (name.includes("milk") || name.includes("cream") || name.includes("yogurt")) {
    return "cups";
  }
  if (name.includes("cheese")) {
    return "oz";
  }
  if (name.includes("egg")) {
    return "large";
  }
  
  // Grains
  if (name.includes("rice") || name.includes("quinoa") || name.includes("oat")) {
    return "cups";
  }
  if (name.includes("bread") || name.includes("tortilla")) {
    return "slices";
  }
  
  // Spices and herbs
  if (name.includes("spice") || name.includes("salt") || name.includes("pepper") || 
      name.includes("cinnamon") || name.includes("nutmeg")) {
    return "tsp";
  }
  if (name.includes("basil") || name.includes("parsley") || name.includes("cilantro")) {
    return "cup";
  }
  
  // Condiments
  if (name.includes("oil") || name.includes("vinegar") || name.includes("sauce") || 
      name.includes("ketchup") || name.includes("mustard") || name.includes("mayo")) {
    return "tbsp";
  }
  
  // Default
  return "item";
}

/**
 * Capitalize the first letter of each word in a string
 * 
 * @param {string} str - String to capitalize
 * @returns {string} - Capitalized string
 */
function capitalizeFirstLetters(str) {
  return str.split(' ').map(word => 
    word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
  ).join(' ');
}

// Export the function
export { generateShoppingList };