/**
 * Simple Shopping List Generator
 * 
 * A streamlined approach to generate AI-powered shopping lists:
 * 1. Takes menu data
 * 2. Converts to plain text representation
 * 3. Sends to OpenAI
 * 4. Returns structured JSON with standardized units
 */

const STANDARD_UNITS = [
  'cup', 'cups', 
  'tbsp', 'tsp', 
  'oz', 'pound', 'lb', 
  'gram', 'g', 'kg',
  'ml', 'l', 'liter',
  'pinch', 'dash',
  'clove', 'cloves'
];

const STANDARD_CATEGORIES = [
  'Produce',
  'Meat & Seafood',
  'Dairy & Eggs',
  'Grains & Bakery',
  'Pantry',
  'Frozen',
  'Beverages',
  'Snacks',
  'Condiments',
  'Spices & Herbs',
  'Other'
];

/**
 * Extract menu ingredients and recipes into plain text format
 * @param {Object} menuData - The menu data object
 * @returns {String} Plain text representation of the menu
 */
export function extractMenuText(menuData) {
  let menuText = "MEAL PLAN INGREDIENTS:\n\n";
  
  // Extract from menu structure
  if (menuData.days && Array.isArray(menuData.days)) {
    menuData.days.forEach((day, index) => {
      menuText += `DAY ${index + 1}:\n`;
      
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          menuText += `${meal.name || "Meal"}:\n`;
          
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            meal.ingredients.forEach(ing => {
              if (typeof ing === 'object') {
                menuText += `- ${ing.name}: ${ing.quantity || ""}\n`;
              } else {
                menuText += `- ${ing}\n`;
              }
            });
          }
          menuText += "\n";
        });
      }
      
      if (day.snacks && Array.isArray(day.snacks)) {
        menuText += "Snacks:\n";
        day.snacks.forEach(snack => {
          if (snack.ingredients && Array.isArray(snack.ingredients)) {
            snack.ingredients.forEach(ing => {
              if (typeof ing === 'object') {
                menuText += `- ${ing.name}: ${ing.quantity || ""}\n`;
              } else {
                menuText += `- ${ing}\n`;
              }
            });
          }
        });
      }
      
      menuText += "\n";
    });
  } 
  // Handle direct ingredient lists
  else if (typeof menuData === 'object' && !Array.isArray(menuData)) {
    Object.entries(menuData).forEach(([category, items]) => {
      menuText += `${category}:\n`;
      
      if (Array.isArray(items)) {
        items.forEach(item => {
          if (typeof item === 'object' && item.name) {
            menuText += `- ${item.name}: ${item.quantity || ""}\n`;
          } else {
            menuText += `- ${item}\n`;
          }
        });
      }
      
      menuText += "\n";
    });
  }
  
  return menuText;
}

/**
 * Generate OpenAI prompt for shopping list
 * @param {String} menuText - Plain text representation of the menu
 * @returns {Object} Prompt object for OpenAI
 */
export function generateShoppingListPrompt(menuText) {
  return {
    model: "gpt-4", // or whichever model you're using
    messages: [
      {
        role: "system",
        content: `You are a helpful assistant that creates grocery shopping lists. 
        Your task is to take a meal plan and convert it into a well-organized, categorized shopping list.
        
        Follow these requirements:
        1. Combine duplicate ingredients, adding up quantities when appropriate
        2. Standardize units of measure to common kitchen units
        3. Ensure quantities make sense for the ingredient (e.g., "3 eggs" not "3 lb eggs")
        4. Categorize each item into one of these departments: ${STANDARD_CATEGORIES.join(", ")}
        5. Return ONLY a JSON array with this exact structure:
        [
          {
            "itemName": "Clear, specific ingredient name",
            "quantity": "Numeric amount",
            "unitOfMeasure": "Standardized unit",
            "category": "Department category"
          },
          ...
        ]
        
        Do not include any explanations, just the JSON array.`
      },
      {
        role: "user",
        content: menuText
      }
    ]
  };
}

/**
 * Generate a shopping list using OpenAI
 * @param {Object} menuData - The menu data
 * @returns {Promise<Object>} Processed shopping list with categories
 */
export async function generateSimpleShoppingList(menuData) {
  try {
    // Convert menu to text format
    const menuText = extractMenuText(menuData);
    console.log("Menu text for AI:", menuText);
    
    // Get token from localStorage
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error("No authentication token available");
    }
    
    // Create API request
    const apiUrl = "https://smartmealplannermulti-production.up.railway.app/ai/simple-shopping-list";
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menu_text: menuText
      })
    });
    
    if (!response.ok) {
      // If API fails, try client-side fallback
      console.warn("API request failed, using client-side fallback");
      return generateLocalShoppingList(menuData);
    }
    
    const result = await response.json();
    console.log("AI shopping list result:", result);
    
    // Process into frontend-friendly format
    return formatShoppingListForDisplay(result.items || result);
    
  } catch (error) {
    console.error("Error generating shopping list:", error);
    // Return locally-processed list as fallback
    return generateLocalShoppingList(menuData);
  }
}

/**
 * Format raw shopping list data for display
 * @param {Array} items - Raw shopping list items
 * @returns {Object} Formatted shopping list with categories
 */
function formatShoppingListForDisplay(items) {
  if (!Array.isArray(items)) {
    console.error("Expected items array, got:", items);
    return { 
      groceryList: [],
      status: "completed",
      cached: false
    };
  }
  
  // Group items by category
  const categorizedItems = {};
  
  items.forEach(item => {
    const category = item.category || 'Other';
    
    if (!categorizedItems[category]) {
      categorizedItems[category] = [];
    }
    
    categorizedItems[category].push({
      name: item.itemName,
      display_name: `${item.itemName}: ${item.quantity} ${item.unitOfMeasure || ''}`.trim(),
      quantity: item.quantity,
      unit: item.unitOfMeasure
    });
  });
  
  // Convert to expected format
  const formattedList = Object.entries(categorizedItems)
    .map(([category, items]) => ({
      category,
      items
    }));
  
  return {
    groceryList: formattedList,
    status: "completed",
    cached: false,
    shoppingTips: [
      "Buy in-season produce for better flavor and nutrition",
      "Check unit prices to find the best value",
      "Organize your shopping by store layout to save time",
      "Choose frozen fruits and vegetables when fresh options are expensive"
    ]
  };
}

/**
 * Fallback function to generate a shopping list locally
 * Much simpler than the original implementation
 * @param {Object} menuData - The menu data
 * @returns {Object} Processed shopping list with categories
 */
function generateLocalShoppingList(menuData) {
  // Extract ingredients from menu
  const ingredients = [];
  
  // Process menu data structure if available
  if (menuData.days && Array.isArray(menuData.days)) {
    menuData.days.forEach(day => {
      // Process meals
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            ingredients.push(...meal.ingredients);
          }
        });
      }
      
      // Process snacks
      if (day.snacks && Array.isArray(day.snacks)) {
        day.snacks.forEach(snack => {
          if (snack.ingredients && Array.isArray(snack.ingredients)) {
            ingredients.push(...snack.ingredients);
          }
        });
      }
    });
  }
  
  // Process flat list if that's what we have
  if (Array.isArray(menuData)) {
    ingredients.push(...menuData);
  }
  
  // Convert to standardized format
  const standardizedItems = ingredients.map(ing => {
    let itemName, quantity, unitOfMeasure;
    
    // Object format
    if (typeof ing === 'object' && ing !== null) {
      itemName = ing.name || '';
      quantity = ing.quantity || '1';
      unitOfMeasure = '';
      
      // Extract unit if embedded in quantity
      if (typeof quantity === 'string') {
        const parts = quantity.split(' ');
        if (parts.length > 1) {
          quantity = parts[0];
          unitOfMeasure = parts.slice(1).join(' ');
        }
      }
    } 
    // String format
    else if (typeof ing === 'string') {
      const colonSplit = ing.split(':');
      
      if (colonSplit.length > 1) {
        itemName = colonSplit[0].trim();
        const quantityPart = colonSplit[1].trim();
        
        // Split quantity and unit
        const quantityMatch = quantityPart.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
        if (quantityMatch) {
          quantity = quantityMatch[1];
          unitOfMeasure = quantityMatch[2];
        } else {
          quantity = quantityPart;
          unitOfMeasure = '';
        }
      } else {
        // No colon, just use as item name
        itemName = ing.trim();
        quantity = '1';
        unitOfMeasure = '';
      }
    }
    
    // Basic categorization (simplified from original)
    let category = 'Other';
    const nameLower = itemName.toLowerCase();
    
    if (/chicken|beef|pork|fish|meat|seafood/.test(nameLower)) {
      category = 'Meat & Seafood';
    } else if (/lettuce|spinach|tomato|onion|potato|fruit|vegetable|apple|banana|carrot/.test(nameLower)) {
      category = 'Produce';
    } else if (/milk|cheese|yogurt|egg|butter|cream/.test(nameLower)) {
      category = 'Dairy & Eggs';
    } else if (/bread|pasta|rice|flour|cereal|grain/.test(nameLower)) {
      category = 'Grains & Bakery';
    } else if (/oil|spice|salt|sugar|canned|dried|bean|sauce/.test(nameLower)) {
      category = 'Pantry';
    } else if (/frozen|ice cream/.test(nameLower)) {
      category = 'Frozen';
    } else if (/water|juice|soda|coffee|tea|drink/.test(nameLower)) {
      category = 'Beverages';
    } else if (/chips|candy|cookie|snack/.test(nameLower)) {
      category = 'Snacks';
    }
    
    return {
      itemName,
      quantity,
      unitOfMeasure,
      category
    };
  });
  
  return formatShoppingListForDisplay(standardizedItems);
}