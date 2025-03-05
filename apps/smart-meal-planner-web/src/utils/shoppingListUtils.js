// src/utils/shoppingListUtils.js
import CATEGORY_MAPPING from '../data/categoryMapping';

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
      combinedItems[normalizedName] = {
        name: cleanedName,
        displayQuantity: itemQuantity || '1' // Use provided quantity or default to 1
      };
    } else {
      // If we have duplicates with the same normalized name, keep the first one's name
      // but combine quantities if possible
      if (itemQuantity) {
        try {
          // Try to extract numbers from both quantities and add them
          const currentQty = parseFloat(combinedItems[normalizedName].displayQuantity) || 1;
          const newQty = parseFloat(itemQuantity) || 1;
          
          // Update with combined quantity
          combinedItems[normalizedName].displayQuantity = (currentQty + newQty).toString();
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
    
    // Format as "quantity name"
    const formattedItem = `${item.displayQuantity} ${item.name}`.trim();
    processedItems[category].push(formattedItem);
  });
  
  console.log('Final processed grocery list:', processedItems);
  
  return processedItems;
}

export {
  cleanIngredientName,
  normalizeIngredientName,
  categorizeIngredient,
  processGroceryList
};