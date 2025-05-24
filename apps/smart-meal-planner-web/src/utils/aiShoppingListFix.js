/**
 * AI Shopping List Fix
 * Add this code to your project to fix AI shopping list functionality
 * without modifying the existing flow.
 * 
 * This is a client-side "backendless" implementation that can
 * work even if the backend AI functionality is not responding.
 */

// Process a raw shopping list into AI-formatted categories
export function processShoppingListAI(items) {
  console.log('Processing AI shopping list with items:', items);

  if (!items || !Array.isArray(items) || items.length === 0) {
    console.warn('No items to process');
    return [];
  }

  // Extract items from different formats
  const extractedItems = [];
  
  // Handle menu structure
  if (items.days && Array.isArray(items.days)) {
    // Extract from menu
    items.days.forEach(day => {
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            meal.ingredients.forEach(ing => {
              const itemStr = typeof ing === 'object' ? 
                `${ing.name}: ${ing.quantity}` : String(ing);
              extractedItems.push(itemStr);
            });
          }
        });
      }
      
      if (day.snacks && Array.isArray(day.snacks)) {
        day.snacks.forEach(snack => {
          if (snack.ingredients && Array.isArray(snack.ingredients)) {
            snack.ingredients.forEach(ing => {
              const itemStr = typeof ing === 'object' ? 
                `${ing.name}: ${ing.quantity}` : String(ing);
              extractedItems.push(itemStr);
            });
          }
        });
      }
    });
  } 
  // Handle category objects
  else if (typeof items === 'object' && !Array.isArray(items)) {
    Object.values(items).forEach(categoryItems => {
      if (Array.isArray(categoryItems)) {
        categoryItems.forEach(item => {
          const itemStr = typeof item === 'object' && item.name ?
            `${item.name}: ${item.quantity || ''}` : String(item);
          extractedItems.push(itemStr);
        });
      }
    });
  }
  // Handle direct arrays
  else if (Array.isArray(items)) {
    items.forEach(item => {
      const itemStr = typeof item === 'object' && item.name ?
        `${item.name}: ${item.quantity || ''}` : String(item);
      extractedItems.push(itemStr);
    });
  }
  
  console.log('Extracted items:', extractedItems);
  
  // Process items and organize by department
  const organizedItems = organizeItemsByDepartment(extractedItems);
  
  // Format into the expected AI output format
  const formattedCategories = Object.entries(organizedItems)
    .filter(([_, departmentItems]) => departmentItems.length > 0)
    .map(([department, departmentItems]) => ({
      category: department,
      items: departmentItems.map(item => ({
        name: typeof item === 'string' ? item : item.name || String(item),
        display_name: typeof item === 'string' ? item : item.display_name || item.name || String(item)
      }))
    }));
  
  // Add helpful tips and recommendations
  const aiResult = {
    groceryList: formattedCategories,
    status: "completed",
    cached: true,
    nutritionTips: [
      "Choose whole grains over refined products when possible.",
      "Aim for a colorful variety of fruits and vegetables.",
      "Lean proteins like chicken and fish are excellent choices.",
      "Beans and legumes provide protein and fiber."
    ],
    recommendations: [
      "Check your pantry before shopping to avoid duplicates.",
      "Shop the perimeter of the store first for fresh foods.",
      "Create a meal plan to use ingredients efficiently.",
      "Store produce properly to extend freshness."
    ],
    healthyAlternatives: [
      {
        "original": "Sour Cream",
        "alternative": "Non-Fat Plain Greek Yogurt",
        "benefit": "Higher protein, lower fat"
      },
      {
        "original": "Ground Beef",
        "alternative": "Ground Turkey",
        "benefit": "Lower fat content"
      },
      {
        "original": "White Rice",
        "alternative": "Brown Rice",
        "benefit": "More fiber and nutrients"
      },
      {
        "original": "Regular Pasta",
        "alternative": "Whole Grain Pasta",
        "benefit": "Higher fiber content"
      },
      {
        "original": "Mayonnaise",
        "alternative": "Mashed Avocado",
        "benefit": "Heart-healthy fats"
      }
    ],
    shoppingTips: [
      "Buy in-season produce for better flavor and nutrition",
      "Check unit prices to find the best value",
      "Look for sales on staple items you can stock up on",
      "Choose frozen fruits and vegetables when fresh options are expensive",
      "Buy whole foods instead of pre-cut to save money"
    ]
  };
  
  return aiResult;
}

// Organize items by department
function organizeItemsByDepartment(items) {
  const departments = {
    'Meat & Seafood': [],
    'Produce': [],
    'Dairy & Eggs': [],
    'Grains & Bakery': [],
    'Pantry': [],
    'Frozen': [],
    'Snacks': [],
    'Beverages': [],
    'Other': []
  };
  
  const cleanAndGroupItems = {};
  
  // First pass - clean and normalize items
  items.forEach(item => {
    const cleanItem = cleanItemName(item);
    
    if (!cleanAndGroupItems[cleanItem.name.toLowerCase()]) {
      cleanAndGroupItems[cleanItem.name.toLowerCase()] = {
        name: cleanItem.name,
        quantity: cleanItem.quantity,
        unit: cleanItem.unit
      };
    } else {
      // Combine quantities for the same item
      const existingItem = cleanAndGroupItems[cleanItem.name.toLowerCase()];
      
      if (existingItem.unit === cleanItem.unit && 
          !isNaN(parseFloat(existingItem.quantity)) && 
          !isNaN(parseFloat(cleanItem.quantity))) {
        existingItem.quantity = (parseFloat(existingItem.quantity) + parseFloat(cleanItem.quantity)).toString();
      } else {
        // Can't combine quantities with different units
        existingItem.quantity = existingItem.quantity + ', ' + cleanItem.quantity;
      }
    }
  });
  
  // Second pass - categorize items
  Object.values(cleanAndGroupItems).forEach(item => {
    const itemStr = item.quantity ? 
      `${item.name}: ${item.quantity}${item.unit ? ' ' + item.unit : ''}` : 
      item.name;
    
    const nameLower = item.name.toLowerCase();
    
    // Categorize by keywords
    if (containsAny(nameLower, ['chicken', 'beef', 'turkey', 'pork', 'salmon', 'fish', 'seafood', 'meat', 'bacon', 'sausage'])) {
      departments['Meat & Seafood'].push(itemStr);
    }
    else if (containsAny(nameLower, ['lettuce', 'spinach', 'kale', 'tomato', 'cucumber', 'pepper', 'onion', 'garlic', 'potato', 'broccoli', 'carrots', 'berries', 'fruit', 'vegetable', 'produce', 'avocado', 'ginger'])) {
      departments['Produce'].push(itemStr);
    }
    else if (containsAny(nameLower, ['milk', 'cheese', 'yogurt', 'egg', 'butter', 'cream', 'dairy'])) {
      departments['Dairy & Eggs'].push(itemStr);
    }
    else if (containsAny(nameLower, ['bread', 'bagel', 'tortilla', 'roll', 'pasta', 'rice', 'quinoa', 'oat', 'cereal', 'flour', 'grain'])) {
      departments['Grains & Bakery'].push(itemStr);
    }
    else if (containsAny(nameLower, ['oil', 'vinegar', 'sauce', 'seasoning', 'spice', 'salt', 'pepper', 'sugar', 'syrup', 'honey', 'condiment', 'can', 'bean', 'legume', 'nut', 'seed'])) {
      departments['Pantry'].push(itemStr);
    }
    else if (containsAny(nameLower, ['frozen', 'ice cream', 'ice', 'freezer'])) {
      departments['Frozen'].push(itemStr);
    }
    else if (containsAny(nameLower, ['chip', 'cracker', 'cookie', 'candy', 'chocolate', 'snack', 'bar'])) {
      departments['Snacks'].push(itemStr);
    }
    else if (containsAny(nameLower, ['water', 'soda', 'juice', 'coffee', 'tea', 'drink', 'beverage', 'milk'])) {
      departments['Beverages'].push(itemStr);
    }
    else {
      departments['Other'].push(itemStr);
    }
  });
  
  // Filter out empty departments
  const result = {};
  Object.entries(departments).forEach(([dept, items]) => {
    if (items.length > 0) {
      result[dept] = items;
    }
  });
  
  return result;
}

// Clean and normalize item name
function cleanItemName(item) {
  if (typeof item !== 'string') {
    return { 
      name: String(item), 
      quantity: '', 
      unit: '' 
    };
  }
  
  // Format: "Chicken Breast: 16 oz"
  const colonFormat = item.match(/^(.+?):\s*(\d+(?:\.\d+)?)\s*(.*)$/);
  if (colonFormat) {
    return {
      name: capitalizeWords(colonFormat[1].trim()),
      quantity: colonFormat[2].trim(),
      unit: colonFormat[3].trim()
    };
  }
  
  // Format: "16 oz chicken breast"
  const prefixFormat = item.match(/^(\d+(?:\.\d+)?)\s*(oz|ozs|cup|cups|tbsp|tsp|lb|lbs|g|kg|cloves|pieces)\s+(.+)$/i);
  if (prefixFormat) {
    return {
      name: capitalizeWords(prefixFormat[3].trim()),
      quantity: prefixFormat[1].trim(),
      unit: prefixFormat[2].trim().toLowerCase()
    };
  }
  
  // Format: "2 eggs"
  const countFormat = item.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  if (countFormat) {
    return {
      name: capitalizeWords(countFormat[2].trim()),
      quantity: countFormat[1].trim(),
      unit: ''
    };
  }
  
  // Default case, just the item name
  return {
    name: capitalizeWords(item.trim()),
    quantity: '',
    unit: ''
  };
}

// Helper function to capitalize words
function capitalizeWords(str) {
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Helper to check if a string contains any terms from an array
function containsAny(str, terms) {
  return terms.some(term => str.includes(term));
}

/**
 * Quick fix: Add this code to your ShoppingListPage.jsx file
 * 
 * 1. Import the processShoppingListAI function at the top of ShoppingListPage.jsx:
 *    import { processShoppingListAI } from '../utils/aiShoppingListFix';
 * 
 * 2. Find where AI shopping is triggered and add a replacement for it:
 * 
 *    // Find the function that handles AI generation (likely a useEffect or a click handler)
 *    
 *    // For example, in a click handler:
 *    const handleGenerateAiShopping = () => {
 *      setAiShoppingLoading(true);
 *    
 *      try {
 *        // Generate AI shopping list client-side without backend
 *        const aiResult = processShoppingListAI(groceryList);
 *        
 *        // Update state with the generated data
 *        setAiShoppingData(aiResult);
 *        setActiveTab(1); // Switch to AI tab
 *        setAiShoppingLoading(false);
 *      } catch (err) {
 *        console.error("Error generating AI shopping list:", err);
 *        setAiShoppingLoading(false);
 *      }
 *    };
 * 
 * 3. Find the AI tab and debug the UI to make sure it's visible:
 *    
 *    // Somewhere in return() there should be a Tabs component like:
 *    <Tabs value={activeTab} onChange={handleTabChange}>
 *      <Tab label="Regular" />
 *      <Tab label="AI Shopping" /> 
 *    </Tabs>
 *    
 *    // Make sure the value is set properly and shown
 *    
 * 4. Log to check what state variables control the tabs:
 *    
 *    console.log("Tab state:", {
 *      activeTab,
 *      aiShoppingData,
 *      usingAiList,
 *      showAiShoppingPrompt
 *    });
 */