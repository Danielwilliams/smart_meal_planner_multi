// Emergency fix for the AI shopping list

/**
 * Fixes quantities and units and properly categorizes grocery items
 * @param {Array} items - The grocery items array
 * @returns {Array} - Array of category objects with items
 */
export function fixAndCategorizeItems(items) {
  // Create categories
  const categories = {
    "Produce": [],
    "Protein": [],
    "Dairy": [],
    "Grains": [],
    "Pantry": [],
    "Other": []
  };
  
  // Process each item
  items.forEach(item => {
    // Get the item as a string
    let itemStr = typeof item === 'string' ? item : 
                (item && item.name ? item.name : String(item));
    
    // Fix meat quantities - convert unrealistic pounds to ounces
    const lowerItem = itemStr.toLowerCase();
    const weightRegex = /(\d+)\s*(lb|lbs|pound|pounds)/i;
    const match = lowerItem.match(weightRegex);
    
    if (match) {
      const quantity = parseInt(match[1], 10);
      // If quantity is very large for pounds (like 96 lbs of chicken)
      if (quantity > 5 && (
          lowerItem.includes('chicken') || 
          lowerItem.includes('beef') ||
          lowerItem.includes('steak') ||
          lowerItem.includes('salmon') ||
          lowerItem.includes('pork') ||
          lowerItem.includes('almond') ||
          lowerItem.includes('butter')
      )) {
        // Convert to ounces instead
        console.log(`Converting ${quantity} lbs to oz for ${itemStr}`);
        itemStr = itemStr.replace(weightRegex, `${quantity} oz`);
      }
    }
    
    // Add default units if missing
    if (/^\w+:\s*\d+\s*$/.test(itemStr) || 
        /^[\w\s]+:\s*\d+\s*$/.test(itemStr) ||
        /^[\w\s]+\s+\d+\s*$/.test(itemStr)) {
      
      // Extract the name and quantity
      let name, qty;
      if (itemStr.includes(':')) {
        [name, qty] = itemStr.split(':').map(s => s.trim());
      } else {
        const parts = itemStr.trim().split(/\s+/);
        qty = parts.pop(); // Last part is quantity
        name = parts.join(' '); // Rest is name
      }
      
      // Skip if we couldn't parse properly
      if (!name || !qty) {
        name = itemStr;
        qty = "";
      }
      
      // Default units based on item type
      if (name.toLowerCase().includes('chicken') || 
          name.toLowerCase().includes('beef') || 
          name.toLowerCase().includes('meat') || 
          name.toLowerCase().includes('fish') ||
          name.toLowerCase().includes('salmon') ||
          name.toLowerCase().includes('turkey') ||
          name.toLowerCase().includes('protein')) {
        itemStr = `${name}: ${qty} oz`;
      } 
      else if (name.toLowerCase().includes('milk') || 
              name.toLowerCase().includes('cream') || 
              name.toLowerCase().includes('sauce') || 
              name.toLowerCase().includes('soy') ||
              name.toLowerCase().includes('oil') ||
              name.toLowerCase().includes('vinegar') ||
              name.toLowerCase().includes('salsa')) {
        itemStr = `${name}: ${qty} cups`;
      }
      else if (name.toLowerCase().includes('rice') || 
              name.toLowerCase().includes('quinoa') || 
              name.toLowerCase().includes('pasta') || 
              name.toLowerCase().includes('beans')) {
        itemStr = `${name}: ${qty} cups`;
      }
      else if (name.toLowerCase().includes('cheese')) {
        itemStr = `${name}: ${qty} oz`;
      }
      else if (name.toLowerCase().includes('egg')) {
        itemStr = `${name}: ${qty} large`;
      }
      else if (name.toLowerCase().includes('tomato') ||
              name.toLowerCase().includes('onion') ||
              name.toLowerCase().includes('pepper') ||
              name.toLowerCase().includes('cucumber') ||
              name.toLowerCase().includes('avocado') ||
              name.toLowerCase().includes('banana') ||
              name.toLowerCase().includes('apple')) {
        itemStr = `${name}: ${qty} medium`;
      }
      else if (name.toLowerCase().includes('garlic')) {
        itemStr = `${name}: ${qty} cloves`;
      }
      else if (name.toLowerCase().includes('spice') ||
              name.toLowerCase().includes('powder') ||
              name.toLowerCase().includes('salt') ||
              name.toLowerCase().includes('pepper') ||
              name.toLowerCase().includes('cumin') ||
              name.toLowerCase().includes('paprika')) {
        itemStr = `${name}: ${qty} tsp`;
      }
    }
    
    // Very basic categorization
    if (lowerItem.includes('chicken') || 
        lowerItem.includes('beef') || 
        lowerItem.includes('meat') || 
        lowerItem.includes('fish') ||
        lowerItem.includes('salmon') ||
        lowerItem.includes('turkey') ||
        lowerItem.includes('bacon') ||
        lowerItem.includes('protein') ||
        lowerItem.includes('thigh') ||
        lowerItem.includes('breast')) {
      categories["Protein"].push(itemStr);
    } 
    else if (lowerItem.includes('milk') || 
            lowerItem.includes('cheese') || 
            lowerItem.includes('egg') || 
            lowerItem.includes('yogurt') ||
            lowerItem.includes('cream') ||
            lowerItem.includes('butter')) {
      categories["Dairy"].push(itemStr);
    } 
    else if (lowerItem.includes('apple') || 
            lowerItem.includes('banana') || 
            lowerItem.includes('vegetable') || 
            lowerItem.includes('tomato') ||
            lowerItem.includes('lettuce') || 
            lowerItem.includes('onion') ||
            lowerItem.includes('garlic') ||
            lowerItem.includes('pepper') ||
            lowerItem.includes('cucumber') ||
            lowerItem.includes('avocado') ||
            lowerItem.includes('carrot') ||
            lowerItem.includes('spinach') ||
            lowerItem.includes('broccoli') ||
            lowerItem.includes('berries') ||
            lowerItem.includes('cilantro') ||
            lowerItem.includes('parsley') ||
            lowerItem.includes('basil') ||
            lowerItem.includes('herb') ||
            lowerItem.includes('ginger') ||
            lowerItem.includes('lime') ||
            lowerItem.includes('potato')) {
      categories["Produce"].push(itemStr);
    } 
    else if (lowerItem.includes('bread') || 
            lowerItem.includes('rice') || 
            lowerItem.includes('pasta') || 
            lowerItem.includes('cereal') ||
            lowerItem.includes('tortilla') ||
            lowerItem.includes('oat') ||
            lowerItem.includes('quinoa') ||
            lowerItem.includes('flour') ||
            lowerItem.includes('crumb')) {
      categories["Grains"].push(itemStr);
    } 
    else if (lowerItem.includes('oil') || 
            lowerItem.includes('sauce') || 
            lowerItem.includes('vinegar') || 
            lowerItem.includes('spice') ||
            lowerItem.includes('powder') ||
            lowerItem.includes('sugar') ||
            lowerItem.includes('salt') ||
            lowerItem.includes('pepper') ||
            lowerItem.includes('honey') ||
            lowerItem.includes('soy') ||
            lowerItem.includes('broth') ||
            lowerItem.includes('cumin') ||
            lowerItem.includes('paprika') ||
            lowerItem.includes('salsa')) {
      categories["Pantry"].push(itemStr);
    }
    else {
      categories["Other"].push(itemStr);
    }
  });
  
  // Format for the UI
  return Object.entries(categories)
    .filter(([_, items]) => items.length > 0)
    .map(([category, items]) => ({
      category,
      items: items.map(item => ({
        name: item,
        display_name: item
      }))
    }));
}

/**
 * Extracts grocery items from API response
 * @param {Object} result - API response
 * @returns {Array} - Array of grocery items as strings
 */
export function extractItemsFromResponse(result) {
  let items = [];
  
  if (!result) return items;
  
  // Try different properties where items might be found
  if (result?.ingredient_list && Array.isArray(result.ingredient_list)) {
    console.log("Using ingredient_list array");
    items = result.ingredient_list;
  } else if (result?.items && Array.isArray(result.items)) {
    console.log("Using items array");
    items = result.items;
  } else if (result?.groceryList && Array.isArray(result.groceryList)) {
    console.log("Using groceryList array - flattening categories");
    // If we got a categorized list, flatten it
    result.groceryList.forEach(category => {
      if (category.items && Array.isArray(category.items)) {
        category.items.forEach(item => {
          if (typeof item === 'string') {
            items.push(item);
          } else if (item && typeof item === 'object') {
            items.push(item.name || item.ingredient || JSON.stringify(item));
          }
        });
      }
    });
  } else if (Array.isArray(result)) {
    console.log("Using root array");
    items = result;
  } else if (result?.data && Array.isArray(result.data)) {
    console.log("Using data array");
    items = result.data;
  } else {
    // Last resort: try to extract from any object structure
    console.log("Trying deep scan for items");
    for (const key in result) {
      if (Array.isArray(result[key])) {
        console.log(`Found array in '${key}' with ${result[key].length} items`);
        if (result[key].length > 0) {
          items = result[key];
          break;
        }
      }
    }
  }
  
  // Normalize items to strings
  return items.map(item => {
    if (typeof item === 'string') {
      return item;
    } else if (item && typeof item === 'object') {
      if (item.name) return item.name;
      if (item.ingredient) return item.ingredient;
      return JSON.stringify(item);
    } else {
      return String(item);
    }
  });
}

/**
 * Complete function to fetch and process a shopping list
 * @param {number} menuId - The menu ID to fetch
 * @param {function} setAiShoppingLoading - State setter for loading
 * @param {function} setAiShoppingData - State setter for data
 * @param {function} setActiveTab - State setter for active tab
 * @param {function} setUsingAiList - State setter for using AI list flag
 * @param {function} showSnackbar - Function to show notification
 */
export async function emergencyShoppingListFetch(
  menuId, 
  setAiShoppingLoading, 
  setAiShoppingData, 
  setActiveTab, 
  setUsingAiList,
  showSnackbar
) {
  console.log("EMERGENCY FIX: Fetching shopping list for", menuId);
  try {
    // Get the token
    const token = localStorage.getItem('token');
    
    // Direct API call
    const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/grocery-list`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    
    // Basic error handling
    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }
    
    // Parse the response
    const result = await response.json();
    console.log("EMERGENCY FIX: Got shopping list:", result);
    
    // Extract items
    const items = extractItemsFromResponse(result);
    
    if (!items || items.length === 0) {
      throw new Error("No items found in response");
    }
    
    // Fix and categorize items
    const formattedCategories = fixAndCategorizeItems(items);
    
    // If we somehow got no categories, create a fallback
    if (formattedCategories.length === 0 && items.length > 0) {
      formattedCategories.push({
        category: "All Items",
        items: items.map(item => ({
          name: item,
          display_name: item
        }))
      });
    }
    
    // Update state
    setAiShoppingLoading(false);
    setAiShoppingData({
      groceryList: formattedCategories,
      menuId: menuId,
      status: "completed",
      cached: true,
      nutritionTips: [
        "Try to prioritize whole foods over processed options.",
        "Choose lean proteins for healthier meal options.",
        "Look for whole grain alternatives to refined grains."
      ],
      recommendations: [
        "Shop the perimeter of the store first for fresh foods.",
        "Check your pantry before shopping to avoid duplicates.",
        "Consider buying in-season produce for better flavor and value."
      ]
    });
    setActiveTab(1);
    setUsingAiList(true);
    
    if (showSnackbar) {
      showSnackbar("Shopping list updated with improved categorization");
    }
    
    return true;
  } catch (error) {
    console.error("EMERGENCY FIX: Error:", error);
    setAiShoppingLoading(false);
    
    // Even on error, provide something to show
    setAiShoppingData({
      groceryList: [{
        category: "All Items",
        items: [{ name: "Error fetching items", display_name: "Please try again" }]
      }],
      menuId: menuId,
      status: "error",
      cached: false,
      nutritionTips: ["Error fetching shopping list."],
      recommendations: ["Please try refreshing the page."]
    });
    
    if (showSnackbar) {
      showSnackbar("Error fetching shopping list: " + error.message);
    }
    
    return false;
  }
}