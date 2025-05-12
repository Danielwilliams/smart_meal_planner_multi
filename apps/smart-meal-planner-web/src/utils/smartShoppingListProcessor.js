/**
 * Smart Shopping List Processor
 * Intelligently combines and formats shopping list items
 */

// Process a raw shopping list into a well-formatted list with proper quantities
export function processShoppingList(rawItems) {
  console.log("Processing shopping list with SmartProcessor:", rawItems);
  
  // Skip processing if no items
  if (!rawItems || !Array.isArray(rawItems) || rawItems.length === 0) {
    console.warn("No items to process");
    return [];
  }
  
  // Step 1: Normalize all items
  const normalizedItems = rawItems.map(normalizeItem);
  
  // Step 2: Group similar items
  const groupedItems = groupSimilarItems(normalizedItems);
  
  // Step 3: Format each item for display
  const processedItems = formatItems(groupedItems);
  
  console.log("Smart processing complete:", processedItems);
  return processedItems;
}

// Normalize an item to a standard format
function normalizeItem(item) {
  // Handle different item formats (string or object)
  if (typeof item === 'string') {
    return processStringItem(item);
  } else if (item && typeof item === 'object' && item.name) {
    return {
      name: item.name,
      quantity: item.quantity || '',
      unit: extractUnit(item.quantity || '')
    };
  }
  
  // Default for unknown formats
  return { name: String(item), quantity: '', unit: '' };
}

// Process string-format items
function processStringItem(itemStr) {
  // Format 1: "96 ozs chicken breast" or "2 cups rice"
  const unitFirstMatch = itemStr.match(/^(\d+(?:\.\d+)?)\s+(ozs?|cups?|tbsps?|tsps?|lbs?|g|kg|cloves|pieces?|cans?)\s+(.+)$/i);
  if (unitFirstMatch) {
    const quantity = unitFirstMatch[1];
    const unit = standardizeUnit(unitFirstMatch[2]);
    const name = capitalizeFirst(unitFirstMatch[3]);
    
    return { name, quantity, unit };
  }
  
  // Format 2: "Chicken Breast: 96 oz"
  const colonFormat = itemStr.match(/^(.+):\s*(\d+(?:\.\d+)?)\s*(.*)$/i);
  if (colonFormat) {
    const name = capitalizeFirst(colonFormat[1]);
    const quantity = colonFormat[2];
    const unit = standardizeUnit(colonFormat[3]);
    
    return { name, quantity, unit };
  }
  
  // Format 3: Simple numbers with name "2 eggs" or "1 cucumber"
  const simpleFormat = itemStr.match(/^(\d+(?:\.\d+)?)\s+(.+)$/i);
  if (simpleFormat) {
    const quantity = simpleFormat[1];
    const name = capitalizeFirst(simpleFormat[2]);
    
    // Check for embedded units in the name
    const unitInName = name.match(/(.+)\s+(ozs?|cups?|tbsps?|tsps?|lbs?|g|kg)$/i);
    if (unitInName) {
      return {
        name: capitalizeFirst(unitInName[1]),
        quantity,
        unit: standardizeUnit(unitInName[2])
      };
    }
    
    return { name, quantity, unit: '' };
  }
  
  // Default for unknown formats
  return { name: capitalizeFirst(itemStr), quantity: '', unit: '' };
}

// Standardize unit names
function standardizeUnit(unit) {
  if (!unit) return '';
  
  const unitLower = unit.toLowerCase().trim();
  
  // Standard conversion map
  const unitMap = {
    'ozs': 'oz',
    'oz': 'oz',
    'ounce': 'oz',
    'ounces': 'oz',
    'lb': 'lb',
    'lbs': 'lb',
    'pound': 'lb',
    'pounds': 'lb',
    'g': 'g',
    'gram': 'g',
    'grams': 'g',
    'kg': 'kg',
    'kilogram': 'kg',
    'kilograms': 'kg',
    'cup': 'cups',
    'cups': 'cups',
    'tbsp': 'tbsp',
    'tbsps': 'tbsp',
    'tablespoon': 'tbsp',
    'tablespoons': 'tbsp',
    'tsp': 'tsp',
    'tsps': 'tsp',
    'teaspoon': 'tsp',
    'teaspoons': 'tsp',
    'clove': 'cloves',
    'cloves': 'cloves',
    'piece': 'pieces',
    'pieces': 'pieces',
    'can': 'cans',
    'cans': 'cans'
  };
  
  return unitMap[unitLower] || unitLower;
}

// Extract unit from a quantity string
function extractUnit(quantityStr) {
  if (!quantityStr || typeof quantityStr !== 'string') return '';
  
  // Look for units in the quantity string
  const unitMatch = quantityStr.match(/[0-9.]+\s*([a-zA-Z]+)/i);
  return unitMatch ? standardizeUnit(unitMatch[1]) : '';
}

// Capitalize the first letter of each word
function capitalizeFirst(str) {
  if (!str) return '';
  return str
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Group similar items together, combining quantities where possible
function groupSimilarItems(items) {
  const groups = {};
  
  items.forEach(item => {
    // Create a normalized key for grouping
    const key = item.name.toLowerCase().replace(/\s+/g, '_');
    
    if (!groups[key]) {
      groups[key] = {
        name: item.name,
        instances: []
      };
    }
    
    groups[key].instances.push({
      quantity: item.quantity,
      unit: item.unit
    });
  });
  
  return groups;
}

// Format each grouped item for display
function formatItems(groupedItems) {
  const result = [];
  
  Object.values(groupedItems).forEach(group => {
    // Combine quantities with the same unit
    const quantitiesByUnit = {};
    
    group.instances.forEach(instance => {
      const unit = instance.unit || 'count';
      if (!quantitiesByUnit[unit]) {
        quantitiesByUnit[unit] = [];
      }
      
      // Convert quantity to number if possible
      const qty = instance.quantity === '' ? 1 : 
                  !isNaN(parseFloat(instance.quantity)) ? 
                  parseFloat(instance.quantity) : 
                  instance.quantity;
                  
      quantitiesByUnit[unit].push(qty);
    });
    
    // Format the item with total quantities
    let formattedItem = '';
    
    // Special handling for common items
    const nameLower = group.name.toLowerCase();
    
    // Format meats consistently in ounces
    if (nameLower.includes('chicken') || nameLower.includes('beef') || 
        nameLower.includes('turkey') || nameLower.includes('pork')) {
      // Handle meat products
      let totalOz = 0;
      
      // Process oz amounts
      if (quantitiesByUnit['oz']) {
        totalOz += quantitiesByUnit['oz'].reduce((sum, qty) => sum + qty, 0);
      }
      
      // Convert lb to oz
      if (quantitiesByUnit['lb']) {
        const lbTotal = quantitiesByUnit['lb'].reduce((sum, qty) => sum + qty, 0);
        totalOz += lbTotal * 16;
      }
      
      // Display totals
      if (totalOz > 0) {
        formattedItem = `${group.name}: ${totalOz} oz`;
      } else {
        formattedItem = group.name;
      }
    }
    // Format count items (eggs, avocados, etc.)
    else if (['egg', 'eggs', 'avocado', 'avocados', 'cucumber', 'cucumbers'].some(item => 
             nameLower.includes(item))) {
      const total = quantitiesByUnit['count'].reduce((sum, qty) => sum + qty, 0);
      formattedItem = `${group.name}: ${total}`;
    }
    // Handle other items with consistent units
    else {
      const unitEntries = Object.entries(quantitiesByUnit);
      if (unitEntries.length > 0) {
        const [primaryUnit, quantities] = unitEntries[0];
        const total = quantities.reduce((sum, qty) => sum + qty, 0);
        
        if (primaryUnit === 'count') {
          formattedItem = `${group.name}: ${total}`;
        } else {
          formattedItem = `${group.name}: ${total} ${primaryUnit}`;
        }
      } else {
        formattedItem = group.name;
      }
    }
    
    result.push(formattedItem);
  });
  
  return result;
}

// Organize shopping list by store departments
export function organizeByDepartment(items) {
  const departments = {
    'Produce': [],
    'Meat & Seafood': [],
    'Dairy & Eggs': [],
    'Bakery': [],
    'Pantry': [],
    'Frozen': [],
    'Other': []
  };
  
  items.forEach(item => {
    const itemName = typeof item === 'string' ? item : item.name || '';
    const nameLower = itemName.toLowerCase();
    
    // Produce
    if (containsAny(nameLower, ['lettuce', 'tomato', 'carrot', 'broccoli', 'cucumber', 
                              'onion', 'garlic', 'potato', 'bell pepper', 'spinach',
                              'cilantro', 'parsley', 'ginger', 'avocado'])) {
      departments['Produce'].push(item);
    }
    // Meat & Seafood
    else if (containsAny(nameLower, ['chicken', 'beef', 'turkey', 'pork', 'salmon', 
                                   'fish', 'meat', 'seafood', 'bacon', 'steak'])) {
      departments['Meat & Seafood'].push(item);
    }
    // Dairy & Eggs
    else if (containsAny(nameLower, ['milk', 'cheese', 'yogurt', 'egg', 'cream', 
                                   'butter', 'sour cream'])) {
      departments['Dairy & Eggs'].push(item);
    }
    // Bakery
    else if (containsAny(nameLower, ['bread', 'bun', 'roll', 'bagel', 'tortilla'])) {
      departments['Bakery'].push(item);
    }
    // Pantry
    else if (containsAny(nameLower, ['oil', 'vinegar', 'sauce', 'spice', 'herb', 
                                   'rice', 'pasta', 'bean', 'flour', 'sugar', 
                                   'honey', 'cereal', 'granola', 'nut'])) {
      departments['Pantry'].push(item);
    }
    // Frozen
    else if (containsAny(nameLower, ['frozen', 'ice', 'cream'])) {
      departments['Frozen'].push(item);
    }
    // Default to Other
    else {
      departments['Other'].push(item);
    }
  });
  
  // Remove empty departments
  const result = {};
  Object.entries(departments).forEach(([dept, items]) => {
    if (items.length > 0) {
      result[dept] = items;
    }
  });
  
  return result;
}

// Helper to check if a string contains any of the search terms
function containsAny(str, searchTerms) {
  return searchTerms.some(term => str.includes(term));
}