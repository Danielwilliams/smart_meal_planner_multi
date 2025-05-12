// src/utils/shoppingListUtils.js
import CATEGORY_MAPPING from '../data/categoryMapping';
import { standardizeUnits, formatUnitDisplay } from './unitStandardization';

/**
 * Regular expressions for normalizing ingredients
 */
const REGEX_REPLACEMENTS = {
  "\\beggs\\b": "egg",
  "\\bcups\\b": "cup",
  "\\bscoops\\b": "scoop",
  "\\bslices\\b": "slice",
  "\\bheads\\b": "head",
  "\\bcloves\\b": "clove",
  "\\bpeppers\\b": "pepper",
  "\\bonions\\b": "onion",
  "\\bcucumbers\\b": "cucumber",
  "\\bmushrooms\\b": "mushroom",
  "\\bfillets\\b": "fillet",
  "\\bthighs\\b": "thigh",
  "\\bmini bell peppers\\b": "mini bell pepper",
  "\\bbell peppers\\b": "bell pepper",
  "\\btomatoes\\b": "tomato",
  "\\bmuffins\\b": "muffin",
  "\\bavocados\\b": "avocado",
  "\\bzucchinis\\b": "zucchini",
  "\\blemons\\b": "lemon",
  "\\blymes\\b": "lime",
  "\\bpieces\\b": "piece",
  "\\bslices of\\b": "slice",
  "\\bbreasts\\b": "breast",
  "\\bcans\\b": "can",
  "\\bmilks\\b": "milk",
  "\\bcarrots\\b": "carrot",
  "\\bspinaches\\b": "spinach",
  "\\bcilantros\\b": "cilantro",
  "\\bbroccolis\\b": "broccoli",
  "\\bsnap peas\\b": "snap pea",
  "\\bfishes\\b": "fish",
  "\\bshrimps\\b": "shrimp",
  "\\bsteaks\\b": "steak",
  "\\bturkeys\\b": "turkey",
  "\\bbacons\\b": "bacon",
  "\\bloaves\\b": "loaf",
  "\\bloafs\\b": "loaf",
  "\\bpackages\\b": "package",
  "\\bbottles\\b": "bottle",
  "\\bpacks\\b": "pack",
  "\\bsausages\\b": "sausage",
  "\\bherbs\\b": "herb",
  "\\bseasonings\\b": "seasoning",
  "\\bpotatoes\\b": "potato"
};

// Words that end with 's' but are not plurals
const SINGULAR_S_ENDINGS = [
  'hummus', 'berries', 'greens', 'pancreas', 'chassis', 
  'analysis', 'molasses', 'leaves'
];

// Common ingredient synonyms
const INGREDIENT_SYNONYMS = {
  'chicken breast': ['chicken breasts', 'chicken breast, cooked and diced'],
  'beef': ['beef sirloin', 'beef strips', 'ground beef'],
  'onion': ['onions'],
  'bell pepper': ['bell peppers', 'bell peppers, sliced'],
  'potato': ['potatoes', 'potatoes, diced'],
  'garlic': ['garlic, minced'],
  'ginger': ['ginger, grated'],
  'tomato': ['tomatoes'],
  'cherry tomato': ['cherry tomatoes, halved'],
  'cucumber': ['cucumbers, diced'],
  'broccoli': ['broccoli florets'],
  'pasta': ['pasta, cooked'],
  'rice': ['rice, cooked', 'cooked rice']
};

/**
 * Clean ingredient name by removing descriptive words and applying regex replacements
 * @param {string} name - Original ingredient name
 * @return {string} - Cleaned name
 */
function cleanIngredientName(name) {
  if (!name || typeof name !== 'string') return '';
  
  // Skip cleaning if the name consists only of numbers to prevent empty strings
  if (/^\d+(\.\d+)?\s*$/.test(name)) {
    return "Unknown Item"; // Replace all-numeric names with a placeholder
  }
  
  let cleaned = name.trim();
  
  // Apply regex replacements
  for (const [pattern, replacement] of Object.entries(REGEX_REPLACEMENTS)) {
    cleaned = cleaned.replace(new RegExp(pattern, 'gi'), replacement);
  }
  
  // Remove common descriptive words
  cleaned = cleaned.replace(/\b(diced|chopped|minced|sliced|grated|crushed|ground|cooked)\b/g, '');
  
  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  
  // If we've ended up with an empty string, return a placeholder
  if (!cleaned) {
    return "Unknown Item";
  }
  
  return cleaned;
}

/**
 * Normalize ingredient name for comparison
 * @param {string} name - Cleaned ingredient name
 * @return {string} - Normalized name for comparison
 */
function normalizeIngredientName(name) {
  let normalized = name.toLowerCase().trim();
  
  // Handle plurals (except for special cases)
  if (!SINGULAR_S_ENDINGS.some(word => normalized.includes(word))) {
    normalized = normalized.replace(/s$/, '');
  }
  
  // Check for synonyms
  for (const [standard, synonyms] of Object.entries(INGREDIENT_SYNONYMS)) {
    if (synonyms.some(syn => normalized.includes(syn))) {
      return standard;
    }
    // Also check if the normalized name matches the standard
    if (normalized.includes(standard)) {
      return standard;
    }
  }
  
  return normalized;
}

/**
 * Categorize an ingredient based on CATEGORY_MAPPING
 * @param {string} ingredientName - Normalized ingredient name
 * @return {string} - Category name
 */
function categorizeIngredient(ingredientName) {
  // Handle unknown items
  if (ingredientName === "unknown item") {
    return 'other';
  }
  
  for (const [category, items] of Object.entries(CATEGORY_MAPPING)) {
    if (items.some(item => ingredientName.includes(item))) {
      return category;
    }
  }
  
  // Some additional categorization logic for common items
  if (ingredientName.includes('sauce') || 
      ingredientName.includes('dressing') || 
      ingredientName.includes('oil')) {
    return 'condiments';
  }
  
  if (ingredientName.includes('cheese')) {
    return 'dairy-eggs';
  }
  
  return 'other';
}

/**
 * Process a grocery list from the API into a categorized format
 * @param {Array|Object} groceryList - The grocery list from the API
 * @return {Object} - Categorized grocery items
 */
function processGroceryList(groceryList) {
  console.log('Processing grocery list:', groceryList);
  
  // Handle different input formats
  let items = [];
  
  if (Array.isArray(groceryList)) {
    items = groceryList;
  } else if (groceryList && groceryList.groceryList && Array.isArray(groceryList.groceryList)) {
    items = groceryList.groceryList;
  } else if (typeof groceryList === 'object') {
    // Try to extract any array we can find
    const possibleArrays = Object.values(groceryList).filter(val => Array.isArray(val));
    if (possibleArrays.length > 0) {
      items = possibleArrays[0];
    } else {
      console.warn('Unexpected grocery list format', groceryList);
      return {};
    }
  } else {
    console.warn('Unexpected grocery list format', groceryList);
    return {};
  }
  
  console.log('Processing items:', items);
  
  // Process each item
  const processedItems = {};
  const combinedItems = {};
  
  // First pass: clean names and group by normalized name
  items.forEach(item => {
    // Handle different item formats
    let itemName = '';
    let itemQuantity = '';
    
    if (typeof item === 'string') {
      itemName = item;
    } else if (item && item.name) {
      itemName = item.name;
      itemQuantity = item.quantity || '';
    } else {
      console.log('Skipping invalid item:', item);
      return; // Skip invalid items
    }
    
    // Skip items with empty or purely numeric names
    if (!itemName || /^\d+(\.\d+)?\s*$/.test(itemName)) {
      console.warn('Skipping item with invalid name:', item);
      return;
    }
    
    // Clean the name
    const cleanedName = cleanIngredientName(itemName);
    if (!cleanedName) {
      console.log('Skipping item with empty cleaned name:', itemName);
      return; // Skip empty names
    }
    
    // Normalize for grouping
    const normalizedName = normalizeIngredientName(cleanedName);
    
    // For the new format, the quantity is already separate from the name
    // But we still need to handle cases where the backend might be using the old format
    if (!combinedItems[normalizedName]) {
      // Add the item to its category with proper unit extraction
      let itemUnit = "";
      let itemQty = "";

      // Try to extract quantity and unit from the itemQuantity string
      if (itemQuantity) {
        const qtyMatch = itemQuantity.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
        if (qtyMatch) {
          itemQty = qtyMatch[1] || ""; // The numeric part
          itemUnit = qtyMatch[2] || ""; // The unit part (if it exists)
        } else {
          // If it doesn't match the pattern, just use the whole string as quantity
          itemQty = itemQuantity;
        }
      }

      combinedItems[normalizedName] = {
        name: cleanedName,
        displayQuantity: itemQty || '1', // Use parsed qty or default to 1
        unit: itemUnit // Store the unit separately
      };
    } else {
      // If we have duplicates with the same normalized name, keep the first one's name
      // but combine quantities if possible and only if the units match or can be converted

      // Get existing unit (if any)
      const existingUnit = combinedItems[normalizedName].unit || "";
      const currentQty = parseFloat(combinedItems[normalizedName].displayQuantity) || 1;

      // Parse the new quantity and unit
      let newQty = 0;
      let newUnit = "";

      if (itemQuantity) {
        const qtyMatch = itemQuantity.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
        if (qtyMatch) {
          newQty = parseFloat(qtyMatch[1] || "1");
          newUnit = qtyMatch[2] || "";
        } else {
          newQty = parseFloat(itemQuantity) || 1;
        }

        // Check if we need to handle special cases for specific ingredients
        const isSpecialIngredient = normalizedName.includes('chicken') ||
                                  normalizedName.includes('beef') ||
                                  normalizedName.includes('turkey') ||
                                  normalizedName.includes('pork');

        try {
          // Same units - straightforward addition
          if (newUnit === existingUnit || !newUnit || !existingUnit) {
            combinedItems[normalizedName].displayQuantity = (currentQty + newQty).toString();
          }
          // Both are oz - add directly
          else if (newUnit === 'oz' && existingUnit === 'oz') {
            combinedItems[normalizedName].displayQuantity = (currentQty + newQty).toString();
          }
          // Convert pounds to ounces
          else if ((newUnit === 'lb' || newUnit === 'lbs') && existingUnit === 'oz') {
            // Convert pound to oz (1 lb = 16 oz)
            const convertedQty = newQty * 16;
            combinedItems[normalizedName].displayQuantity = (currentQty + convertedQty).toString();
          }
          // Convert ounces to pounds
          else if (newUnit === 'oz' && (existingUnit === 'lb' || existingUnit === 'lbs')) {
            // Convert the existing pounds to oz
            const convertedExistingQty = currentQty * 16;
            // Add the new ounces
            const totalOz = convertedExistingQty + newQty;
            // Store as ounces since that's the preferred unit for this ingredient
            combinedItems[normalizedName].displayQuantity = totalOz.toString();
            combinedItems[normalizedName].unit = 'oz';
          }
          // Can't convert, just concatenate with comma
          else {
            combinedItems[normalizedName].displayQuantity += `, ${itemQuantity}`;
          }
        } catch (e) {
          // If we can't parse quantities, just concatenate the displays with a comma
          combinedItems[normalizedName].displayQuantity += `, ${itemQuantity}`;
        }
      }
    }
  });
  
  console.log('Combined items:', combinedItems);
  
  // Second pass: categorize and format
  Object.values(combinedItems).forEach(item => {
    const category = categorizeIngredient(item.name.toLowerCase());
    
    if (!processedItems[category]) {
      processedItems[category] = [];
    }
    
    // Get the unit from the item (if any)
    const itemUnit = item.unit || '';

    // Standardize units before formatting
    const { quantity, unit } = standardizeUnits(item.displayQuantity, itemUnit, item.name);

    // Apply unit fixes
    let formattedItem;
    if (unit) {
      formattedItem = `${quantity} ${unit} ${item.name}`.trim();
    } else {
      formattedItem = `${quantity} ${item.name}`.trim();
    }

    // Apply final item fix
    formattedItem = fixUnits(formattedItem);

    processedItems[category].push(formattedItem);
  });
  
  console.log('Final processed grocery list:', processedItems);
  
  return processedItems;
}

/**
 * Fixes units for items with unreasonably large quantities (like 96 lbs of chicken)
 * or adds missing units to meat products
 * @param {string} itemName - The name of the grocery item
 * @returns {string} - The item name with fixed units
 */
function fixUnits(itemName) {
  if (!itemName) return itemName;

  const itemLower = itemName.toLowerCase();
  let fixedItem = itemName;

  // Check for unreasonably large quantities (like 96 lbs of chicken)
  const weightRegex = /(\d+)\s*(lb|lbs|pound|pounds)/i;
  const match = itemLower.match(weightRegex);

  if (match) {
    const quantity = parseInt(match[1], 10);
    // If quantity is very large for pounds (like 96 lbs)
    if (quantity > 10 && (
        itemLower.includes('chicken') ||
        itemLower.includes('breast') ||
        itemLower.includes('beef') ||
        itemLower.includes('steak') ||
        itemLower.includes('pork') ||
        itemLower.includes('turkey') ||
        itemLower.includes('meat')
    )) {
      // Convert to ounces for more reasonable unit
      console.log(`Converting ${quantity} lbs to oz for ${itemName}`);
      fixedItem = itemName.replace(weightRegex, `${quantity} oz`);
    }
  }

  // Also check for large numeric quantities without units that should be ounces
  const numberRegex = /(\d+)\s+(?!(oz|ounce|lb|pound|g|gram))/i;
  const numberMatch = itemLower.match(numberRegex);

  if (numberMatch && !match) { // If we have a number without a unit
    const quantity = parseInt(numberMatch[1], 10);
    // For large quantities with meat products, assume they should be oz
    if (quantity > 20 && (
        itemLower.includes('chicken') ||
        itemLower.includes('breast') ||
        itemLower.includes('beef') ||
        itemLower.includes('steak') ||
        itemLower.includes('pork') ||
        itemLower.includes('turkey') ||
        itemLower.includes('meat')
    )) {
      // Add oz unit
      console.log(`Adding oz unit to ${quantity} for ${itemName}`);
      fixedItem = itemName.replace(numberRegex[0], `${quantity} oz `);
    }
  }

  return fixedItem;
}

/**
 * Extracts grocery items from various API response formats
 * @param {Object|Array} result - The API response
 * @returns {Array} - Array of grocery items as strings
 */
function extractGroceryItems(result) {
  if (!result) return [];

  let items = [];

  // Dictionary to track original ingredient quantities
  const ingredientQuantities = {};

  // First try to extract from direct menu data structure if available
  if (result?.days && Array.isArray(result.days)) {
    console.log("Found days structure - using direct recipe data");

    // This is the full meal plan with all the ingredients
    result.days.forEach(day => {
      // Process meals
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            meal.ingredients.forEach(ing => {
              if (typeof ing === 'object' && ing.name) {
                // Extract quantity directly from ingredient object
                let quantity = ing.quantity || "";
                let name = ing.name || "";

                // If the ingredient has a name and quantity, track it
                if (name) {
                  // Normalize the ingredient name
                  const normalizedName = name.toLowerCase().trim();

                  // Extract numeric quantity and unit from the quantity field
                  let extractedQty = "";
                  let extractedUnit = "";

                  if (quantity) {
                    const qtyMatch = quantity.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
                    if (qtyMatch) {
                      extractedQty = qtyMatch[1]; // The numeric part
                      extractedUnit = qtyMatch[2] || ""; // The unit part (if it exists)
                    }
                  }

                  // Add to our tracking dictionary
                  if (!ingredientQuantities[normalizedName]) {
                    ingredientQuantities[normalizedName] = [];
                  }

                  ingredientQuantities[normalizedName].push({
                    qty: extractedQty,
                    unit: extractedUnit,
                    fullQuantity: quantity
                  });
                }

                // Format as "quantity name"
                const itemStr = `${quantity} ${name}`.trim();
                items.push(itemStr);
              } else if (typeof ing === 'string') {
                items.push(ing);
              }
            });
          }
        });
      }

      // Process snacks
      if (day.snacks && Array.isArray(day.snacks)) {
        day.snacks.forEach(snack => {
          if (snack.ingredients && Array.isArray(snack.ingredients)) {
            snack.ingredients.forEach(ing => {
              if (typeof ing === 'object' && ing.name) {
                // Extract quantity directly from ingredient object
                let quantity = ing.quantity || "";
                let name = ing.name || "";

                // If the ingredient has a name and quantity, track it
                if (name) {
                  // Normalize the ingredient name
                  const normalizedName = name.toLowerCase().trim();

                  // Extract numeric quantity and unit from the quantity field
                  let extractedQty = "";
                  let extractedUnit = "";

                  if (quantity) {
                    const qtyMatch = quantity.match(/(\d+(?:\.\d+)?)\s*([a-zA-Z]+)?/);
                    if (qtyMatch) {
                      extractedQty = qtyMatch[1]; // The numeric part
                      extractedUnit = qtyMatch[2] || ""; // The unit part (if it exists)
                    }
                  }

                  // Add to our tracking dictionary
                  if (!ingredientQuantities[normalizedName]) {
                    ingredientQuantities[normalizedName] = [];
                  }

                  ingredientQuantities[normalizedName].push({
                    qty: extractedQty,
                    unit: extractedUnit,
                    fullQuantity: quantity
                  });
                }

                // Format as "quantity name"
                const itemStr = `${quantity} ${name}`.trim();
                items.push(itemStr);
              } else if (typeof ing === 'string') {
                items.push(ing);
              }
            });
          } else if (snack.title) {
            // Simple snack without ingredients array
            const title = snack.title || "";
            const quantity = snack.quantity || snack.amount || "";
            const itemStr = `${quantity} ${title}`.trim();
            items.push(itemStr);
          }
        });
      }
    });

    // Log the tracked quantities for debugging
    console.log("Extracted original ingredient quantities:", ingredientQuantities);

    // Special handling for specific ingredients that need direct quantity summation
    const directSumIngredients = ["chicken breast", "beef sirloin", "chicken thighs"];

    for (const ingredient of directSumIngredients) {
      if (ingredientQuantities[ingredient]) {
        const quantities = ingredientQuantities[ingredient];

        // Check if all quantities have the same unit
        const firstUnit = quantities[0].unit;
        const allSameUnit = quantities.every(q => q.unit === firstUnit);

        if (allSameUnit && firstUnit) {
          // Sum the quantities
          let totalQty = 0;
          quantities.forEach(q => {
            totalQty += parseFloat(q.qty || 0);
          });

          // Create a new entry with the summed quantity
          const summedItem = `${totalQty} ${firstUnit} ${ingredient}`;
          console.log(`Direct sum for ${ingredient}: ${summedItem}`);

          // Add it to our items list
          items.push(summedItem);
        }
      }
    }
  }

  // If we couldn't extract from days structure, try other formats
  if (items.length === 0) {
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
      const allItems = [];
      result.groceryList.forEach(category => {
        if (category.items && Array.isArray(category.items)) {
          category.items.forEach(item => {
            if (typeof item === 'string') {
              allItems.push(item);
            } else if (item && typeof item === 'object') {
              allItems.push(item.name || item.ingredient || JSON.stringify(item));
            }
          });
        }
      });
      items = allItems;
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
  }

  // Normalize items to strings and fix units
  return items.map(item => {
    let itemStr;
    if (typeof item === 'string') {
      itemStr = item;
    } else if (item && typeof item === 'object') {
      itemStr = item.name || item.ingredient || JSON.stringify(item);
    } else {
      itemStr = String(item);
    }

    // Apply unit fixes
    return fixUnits(itemStr);
  });
}

/**
 * Formats categorized items for AI shopping list display
 * @param {Object} categorizedItems - Object with categories as keys and arrays of items as values
 * @returns {Array} - Array of category objects with format { category, items }
 */
function formatForAiShopping(categorizedItems) {
  // Filter out empty categories and format for the AI shopping list component
  return Object.entries(categorizedItems)
    .filter(([_, items]) => items && items.length > 0)
    .map(([category, items]) => ({
      category,
      items: items.map(item => ({
        name: item,
        display_name: item
      }))
    }));
}

export {
  cleanIngredientName,
  normalizeIngredientName,
  categorizeIngredient,
  processGroceryList,
  fixUnits,
  extractGroceryItems,
  formatForAiShopping
};