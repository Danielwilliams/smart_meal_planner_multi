// src/components/ShoppingList.jsx

import React, { useState, useEffect } from 'react';
import { 
  Typography, 
  Paper, 
  Grid,
  Button,
  Box,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert
} from '@mui/material';
import StoreSelector from './StoreSelector';
import apiService from '../services/apiService';

// Unit conversion constants
const CONVERSION_RATES = {
  g_to_kg: 0.001,     // 1g = 0.001 kg
  g_to_lbs: 0.00220462,  // 1g = 0.00220462 lbs
  oz_to_lbs: 0.0625,     // 1oz = 0.0625 lbs
  g_to_oz: 0.035274,     // 1g = 0.035274 oz
  cup_to_g: {
    // Approximate conversions for common ingredients
    'rice': 200,         // 1 cup rice ≈ 200g
    'broccoli': 150,     // 1 cup chopped broccoli ≈ 150g
    'bell pepper': 150,  // 1 cup chopped bell peppers ≈ 150g
    'carrot': 110,       // 1 cup chopped carrots ≈ 110g
    'default': 130       // Default for unknown ingredients
  },
  tbsp_to_ml: 15,        // 1 tbsp ≈ 15ml
  tsp_to_ml: 5           // 1 tsp ≈ 5ml
};

// Unit mapping for standardization
const UNIT_MAPPINGS = {
  singular: {
    'cup': 'cups',
    'piece': 'pieces',
    'slice': 'slices',
    'can': 'cans',
    'leaf': 'leaves',
    'tbsp': 'tbsp',
    'tsp': 'tsp',
    'oz': 'oz',
    'g': 'g',
    'kg': 'kg',
    'ml': 'ml',
    'lb': 'lbs',
    'clove': 'cloves'
  },
  plural: {
    'cups': 'cups',
    'pieces': 'pieces',
    'slices': 'slices',
    'cans': 'cans',
    'leaves': 'leaves',
    'tbsp': 'tbsp',
    'tsp': 'tsp',
    'oz': 'oz',
    'g': 'g',
    'kg': 'kg',
    'ml': 'ml',
    'lbs': 'lbs',
    'cloves': 'cloves'
  }
};

// Unit abbreviation mapping
const UNIT_ABBREVIATIONS = {
  'tablespoon': 'tbsp',
  'tablespoons': 'tbsp',
  'tbsps': 'tbsp',
  'tbsp.': 'tbsp',
  'teaspoon': 'tsp',
  'teaspoons': 'tsp',
  'tsps': 'tsp',
  'tsp.': 'tsp',
  'pound': 'lbs',
  'pounds': 'lbs',
  'lb': 'lbs',
  'lbs.': 'lbs',
  'ounce': 'oz',
  'ounces': 'oz',
  'ozs': 'oz',
  'oz.': 'oz',
  'gram': 'g',
  'grams': 'g',
  'g.': 'g',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'kg.': 'kg',
  'milliliter': 'ml',
  'milliliters': 'ml',
  'ml.': 'ml',
  'cup': 'cups',
  'c.': 'cups',
  'piece': 'pieces',
  'pcs': 'pieces',
  'slice': 'slices',
  'can': 'cans',
  'leaf': 'leaves',
  'clove': 'cloves'
};

// Uncountable food nouns that shouldn't be pluralized
const UNCOUNTABLE_NOUNS = [
  'rice',
  'milk',
  'water',
  'oil',
  'butter',
  'flour',
  'cheese',
  'salt',
  'pepper',
  'sugar',
  'cinnamon',
  'bread',
  'garlic',
  'beef',
  'chicken',
  'pork',
  'fish',
  'salmon',
  'tuna',
  'pasta',
  'spaghetti',
  'yogurt',
  'corn',
  'broccoli',
  'spinach',
  'lettuce',
  'celery',
  'parsley',
  'cilantro',
  'mint',
  'honey',
  'juice',
  'vinegar',
  'cream',
  'salsa',
  'sauce',
  'chocolate',
  'mustard',
  'ketchup',
  'mayo',
  'mayonnaise',
  'quinoa',
  'oats',
  'feta',
  'bacon',
  'mozzarella',
  'cheddar',
  'chicken broth',
  'basil',
  'mixed greens',
  'ginger',
  'dressing',
  'olive oil',
  'soy sauce',
  'hot sauce',
  'ground beef',
  'ground turkey',
  'ground chicken'
];

// Common ingredient compound words
const COMPOUND_WORDS = {
  'mixed greens': true,
  'mixed berries': true,
  'balsamic glaze': true,
  'cherry tomatoes': true,
  'cherry tomato': true,
  'water chestnut': true,
  'tomato sauce': true,
  'bell pepper': true,
  'bell peppers': true,
  'beef strips': true,
  'beef strip': true,
  'chicken breast': true,
  'chicken breasts': true,
  'chicken thighs': true,
  'chicken thigh': true,
  'bacon strip': true,
  'bacon strips': true,
  'greek yogurt': true,
  'black bean': true,
  'black beans': true,
  'cheddar cheese': true,
  'olive oil': true,
  'chicken broth': true,
  'cooking oil': true,
  'cookin oil': true,
  'feta cheese': true,
  'ground beef': true,
  'ground turkey': true,
  'ground chicken': true,
  'soy sauce': true,
  'hot sauce': true
};

// Words that naturally end in 's' but aren't plural
const WORDS_ENDING_IN_S = [
  'hummus',
  'berries',
  'greens',
  'pancreas',
  'chassis',
  'analysis',
  'molasses',
  'leaves',
  'grass',
  'mass',
  'pass',
  'bass',
  'glass',
  'class',
  'express',
  'asparagus',
  'brussels sprouts',
  'swiss chard',
  'confectioners sugar',
  'beans'
];

// Function to format units consistently
const formatUnit = (unit, quantity, itemName) => {
  if (!unit) return '';
  
  // Clean up unit
  let normalizedUnit = unit.toLowerCase()
    .replace(/\.+/g, '.')  // Clean up dots
    .replace(/\s+/g, ' ');  // Normalize spaces

  // Map abbreviated or full unit names to standard forms
  normalizedUnit = UNIT_ABBREVIATIONS[normalizedUnit] || normalizedUnit;
  
  // Remove duplicate unit words
  normalizedUnit = normalizedUnit.replace(/\b(cup|cups|tbsp|tbsps|tsp|tsps|g|oz|ozs|ml|piece|pieces|slice|slices)\s+\1s?\b/gi, '$1');
  normalizedUnit = normalizedUnit.replace(/\b(cup)s?\s+(cup)s?\b/gi, 'cups');
  normalizedUnit = normalizedUnit.replace(/\b(tbsp|tbs|tablespoon)s?\s+(tbsp|tbs|tablespoon)s?\b/gi, 'tbsp');
  normalizedUnit = normalizedUnit.replace(/\b(tsp|teaspoon)s?\s+(tsp|teaspoon)s?\b/gi, 'tsp');
  
  // Get rid of any remaining duplicate units
  normalizedUnit = normalizedUnit.split(/\s+/)[0];

  return normalizedUnit;
};

// Parse quantity from string, handling fractions and mixed numbers
const parseQuantity = (quantityStr) => {
  if (!quantityStr) return 0;
  
  // Handle fractions like "1/2"
  if (quantityStr.includes('/')) {
    const [numerator, denominator] = quantityStr.split('/');
    return parseFloat(numerator) / parseFloat(denominator);
  }
  
  // Handle mixed numbers like "1 1/2"
  const mixedMatch = quantityStr.match(/(\d+)\s+(\d+)\/(\d+)/);
  if (mixedMatch) {
    const whole = parseFloat(mixedMatch[1]);
    const numerator = parseFloat(mixedMatch[2]);
    const denominator = parseFloat(mixedMatch[3]);
    return whole + (numerator / denominator);
  }
  
  // Handle plain numbers
  return parseFloat(quantityStr);
};

// Function to normalize ingredient names
const normalizeItemName = (name) => {
  // Fix misspellings
  let fixedName = name
    .replace(/tomatoe/i, 'tomato')
    .replace(/potatoe/i, 'potato')
    .replace(/cookin oil/i, 'cooking oil');
  
  // Extract quantities and units using regex
  const regex = /^(?:(\d+(?:\.\d+)?(?:\s*\d+\/\d+)?|\d+\/\d+)\s*)?([a-zA-Z\.]+)?(?:\s+(?:of|worth|sized?))?\s*(.+)$/i;
  const match = fixedName.match(regex);
  
  if (match) {
    const [, quantity, unit, itemPart] = match;
    
    // Normalize the item name part
    let normalizedName = itemPart
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .replace(/,\s*$/, '') // Remove trailing comma
      .trim();
    
    // First check for compound words
    for (const compound of Object.keys(COMPOUND_WORDS)) {
      if (normalizedName.includes(compound)) {
        return {
          name: compound,
          quantity: quantity ? parseQuantity(quantity) : null,
          unit: unit ? formatUnit(unit, quantity, compound) : null,
          wasPlural: compound.endsWith('s')
        };
      }
    }
    
    // Store plural information
    const hasPlural = normalizedName.endsWith('s') && 
      !WORDS_ENDING_IN_S.some(word => normalizedName.includes(word));
    
    // Standardize common ingredients
    if (normalizedName.includes('chicken breast')) {
      normalizedName = 'chicken breast';
    } else if (normalizedName.includes('chicken thigh')) {
      normalizedName = 'chicken thigh';
    } else if (normalizedName.includes('beef strip')) {
      normalizedName = 'beef strip';
    } else if (normalizedName.includes('bell pepper')) {
      normalizedName = 'bell pepper';
    } else if (normalizedName === 'balsamic') {
      normalizedName = 'balsamic glaze';
    } else if (normalizedName === 'mixed green') {
      normalizedName = 'mixed greens';
    }
    
    return {
      name: normalizedName,
      quantity: quantity ? parseQuantity(quantity) : null,
      unit: unit ? formatUnit(unit, quantity, normalizedName) : null,
      wasPlural: hasPlural
    };
  }

  // If regex fails, return basic normalization
  return {
    name: fixedName.toLowerCase().trim(),
    quantity: null,
    unit: null,
    wasPlural: fixedName.endsWith('s')
  };
};

// Extract quantity and unit from an ingredient string
const parseIngredient = (ingredientStr) => {
  if (!ingredientStr || typeof ingredientStr !== 'string') {
    return { name: '', quantity: 0, unit: '' };
  }
  
  // Handle numeric prefixes that represent quantities
  // Examples: "1905 chicken breast", "602 beef strips"
  const prefixMatch = ingredientStr.match(/^(\d{3,4})\s+(.+)$/);
  if (prefixMatch) {
    const prefix = prefixMatch[1];
    const remainder = prefixMatch[2].trim();
    
    // Handle specific prefixes based on the text
    if (remainder.includes('chicken breast')) {
      return {
        name: 'chicken breast',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('beef strip')) {
      return {
        name: 'beef strips',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('broccoli')) {
      return {
        name: 'broccoli',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('tomato') && !remainder.includes('cherry')) {
      return {
        name: 'tomato',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('bell pepper')) {
      return {
        name: 'bell pepper',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('carrot')) {
      return {
        name: 'carrot',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('potato')) {
      return {
        name: 'potato',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('rice')) {
      return {
        name: 'rice',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else if (remainder.includes('mozzarella')) {
      return {
        name: 'mozzarella',
        quantity: parseFloat(prefix),
        unit: 'oz'
      };
    }
    else if (remainder.includes('chicken thigh')) {
      return {
        name: 'chicken thigh',
        quantity: parseFloat(prefix),
        unit: 'g'
      };
    }
    else {
      // For unknown prefixes, use the remainder as name
      return {
        name: remainder,
        quantity: parseFloat(prefix),
        unit: 'g'  // Assume grams as default
      };
    }
  }
  
  // Extract quantity and unit using regex for standard formats
  // Examples: "2 cups rice", "500g chicken", "1/2 tsp salt"
  const standardMatch = ingredientStr.match(/^([\d\/\.\s]+)\s*([a-zA-Z\.]+)?\s+(.+)$/);
  if (standardMatch) {
    const [, quantityStr, unit, name] = standardMatch;
    return {
      name: name.trim(),
      quantity: parseQuantity(quantityStr),
      unit: unit ? formatUnit(unit, quantityStr, name) : ''
    };
  }
  
  // If no quantity at beginning, check for quantity embedded in the string
  // Examples: "chicken breast 500g", "rice 2 cups"
  const embeddedMatch = ingredientStr.match(/(.+?)\s+([\d\/\.]+)\s*([a-zA-Z\.]+)?$/);
  if (embeddedMatch) {
    const [, name, quantityStr, unit] = embeddedMatch;
    return {
      name: name.trim(),
      quantity: parseQuantity(quantityStr),
      unit: unit ? formatUnit(unit, quantityStr, name) : ''
    };
  }
  
  // For strings with just numbers and no units
  // Examples: "2 eggs", "3 tomatoes"
  const simpleMatch = ingredientStr.match(/^([\d\/\.]+)\s+(.+)$/);
  if (simpleMatch) {
    const [, quantityStr, name] = simpleMatch;
    return {
      name: name.trim(),
      quantity: parseQuantity(quantityStr),
      unit: ''
    };
  }
  
  // Default case: just a name with no clear quantity or unit
  return {
    name: ingredientStr.trim(),
    quantity: 1,  // Default to quantity of 1
    unit: ''
  };
};

// Function to pluralize a name properly
const pluralizeName = (name, quantity) => {
  // Don't pluralize if quantity <= 1 or it's an uncountable noun
  if (quantity <= 1 || UNCOUNTABLE_NOUNS.includes(name.toLowerCase())) {
    return name;
  }
  
  // Don't pluralize if already plural or in exception list
  if (name.endsWith('s') || WORDS_ENDING_IN_S.some(word => name.includes(word))) {
    return name;
  }
  
  // Handle special cases
  if (name.endsWith('y') && !['key', 'bay', 'day'].includes(name)) {
    return name.replace(/y$/, 'ies');
  } else if (name.endsWith('sh') || name.endsWith('ch') || name.endsWith('x') || name.endsWith('z')) {
    return `${name}es`;
  } else if (name === 'tomato' || name.endsWith(' tomato')) {
    return name.replace(/tomato$/, 'tomatoes');
  } else if (name === 'potato' || name.endsWith(' potato')) {
    return name.replace(/potato$/, 'potatoes');
  } else if (name === 'leaf' || name.endsWith(' leaf')) {
    return name.replace(/leaf$/, 'leaves');
  } else {
    // Default pluralization
    return `${name}s`;
  }
};

// Combine and aggregate multiple items into categorized groups
const combineItems = (items) => {
  const groupedItems = {};

  // Special combine logic for count items (for eggs, avocados, etc.)
  // This prevents them from being converted to weight units
  const COUNT_ITEMS = [
    'egg', 'avocado', 'bacon strip', 'lettuce leaf', 'clove',
    'black bean', 'basil leaf', 'carrot', 'cucumber', 'bell pepper', 'tomato',
    'potato', 'onion'
  ];
  
  // Process each item
  items.forEach(item => {
    if (!item || (typeof item === 'string' && !item.trim())) return;
    
    // Parse the ingredient string
    const itemStr = typeof item === 'string' ? item : (item.name || '');
    const parsedItem = parseIngredient(itemStr);
    const normalizedInfo = normalizeItemName(parsedItem.name);
    
    // Use normalized name as the key for grouping
    const itemKey = normalizedInfo.name;
    if (!itemKey) return;
    
    // Get quantity and unit, prioritizing parsed values
    const quantity = parsedItem.quantity !== null ? parsedItem.quantity : normalizedInfo.quantity;
    const unit = parsedItem.unit || normalizedInfo.unit;
    
    // Initialize the group if needed
    if (!groupedItems[itemKey]) {
      groupedItems[itemKey] = {
        name: itemKey,
        quantities: [],
        wasPlural: normalizedInfo.wasPlural
      };
    }
    
    // Add this quantity/unit pair to the list
    if (quantity !== null && quantity > 0) {
      groupedItems[itemKey].quantities.push({
        amount: quantity,
        unit: unit || ''
      });
    }
  });

  // Format all items for display
  return Object.values(groupedItems)
    .filter(group => group.name && group.name.trim())
    .map(group => {
      // If no quantities were found, just return the name
      if (!group.quantities.length) {
        return group.name;
      }
      
      // Determine if this is a countable item
      const isCountItem = COUNT_ITEMS.some(item => 
        group.name.includes(item) && !group.name.includes('broth'));
      
      // Convert between units for better aggregation
      const standardizeUnits = (quantities) => {
        const standardized = [...quantities];
        
        // For cup-based measurements of specific items, convert to grams
        standardized.forEach(item => {
          // Convert cups to grams for rice
          if (item.unit === 'cups' && group.name === 'rice') {
            item.amount = item.amount * CONVERSION_RATES.cup_to_g['rice'];
            item.unit = 'g';
          }
          // Convert cups to grams for broccoli
          else if (item.unit === 'cups' && group.name === 'broccoli') {
            item.amount = item.amount * CONVERSION_RATES.cup_to_g['broccoli'];
            item.unit = 'g';
          }
          // Convert cups to grams for bell pepper
          else if (item.unit === 'cups' && group.name.includes('bell pepper')) {
            item.amount = item.amount * CONVERSION_RATES.cup_to_g['bell pepper'];
            item.unit = 'g';
          }
          // Convert cups to grams for carrot
          else if (item.unit === 'cups' && group.name === 'carrot') {
            item.amount = item.amount * CONVERSION_RATES.cup_to_g['carrot'];
            item.unit = 'g';
          }
          // Convert tablespoons to ml for liquid ingredients
          else if ((item.unit === 'tbsp' || item.unit === 'tablespoon') && 
                  ['sauce', 'oil', 'dressing', 'glaze'].some(liquid => group.name.includes(liquid))) {
            item.amount = item.amount * CONVERSION_RATES.tbsp_to_ml;
            item.unit = 'ml';
          }
        });
        
        return standardized;
      };
      
      // Standardize units if needed
      const standardizedQuantities = standardizeUnits(group.quantities);
      
      // Combine like units
      const unitGroups = {};
      standardizedQuantities.forEach(({ amount, unit }) => {
        const normalizedUnit = unit ? unit.toLowerCase() : '';
        if (!unitGroups[normalizedUnit]) {
          unitGroups[normalizedUnit] = 0;
        }
        unitGroups[normalizedUnit] += amount;
      });
      
      // Special conversion for large quantities
      Object.entries(unitGroups).forEach(([unit, amount]) => {
        // Don't convert countable items
        if (isCountItem && unit === '') {
          return;
        }
        
        // Convert grams to kg for large quantities
        if (unit === 'g' && amount >= 1000) {
          delete unitGroups[unit];
          unitGroups['kg'] = parseFloat((amount / 1000).toFixed(1));
        }
        
        // Convert g to lbs for certain meat items if they're over 450g
        else if (unit === 'g' && amount >= 450 && 
                ['chicken', 'beef', 'pork', 'meat', 'steak', 'fish'].some(meat => 
                  group.name.includes(meat)) && 
                !group.name.includes('broth')) {
          delete unitGroups[unit];
          unitGroups['kg'] = parseFloat(((amount * CONVERSION_RATES.g_to_lbs) / 2.2).toFixed(1)); // Convert to kg for consistency
        }
        
        // Convert ml to cups for specific liquids
        else if (unit === 'ml' && amount >= 240 && 
                ['sauce', 'dressing', 'broth', 'salsa'].some(liquid => 
                  group.name.includes(liquid))) {
          delete unitGroups[unit];
          unitGroups['cups'] = parseFloat((amount / 240).toFixed(1)); // 240ml ≈ 1 cup
        }
      });
      
      // Clean up the ingredient name for display
      const cleanupName = (name) => {
        // Remove trailing 's' or other artifacts
        name = name.replace(/s$/, '')
                  .replace(/\s+s$/, '')
                  .replace(/\s+$/, '');
                  
        // Handle specific cases
        if (name === 'egg') return 'Eggs';
        if (name === 'black bean') return 'Canned Black Beans';
        if (name === 'bacon strip') return 'Bacon Strips';
        if (name === 'chicken breast') return 'Chicken Breast';
        if (name === 'chicken thigh') return 'Chicken Thighs';
        if (name === 'beef strip') return 'Beef Strips';
        if (name === 'mixed green') return 'Mixed Greens';
        if (name === 'lettuce leaf') return 'Lettuce Leaves';
        if (name === 'carrot') return 'Carrots';
        if (name === 'bell pepper') return 'Bell Peppers';
        if (name === 'cherry tomato') return 'Cherry Tomatoes';
        if (name === 'tomato') return 'Tomatoes';
        if (name === 'avocado') return 'Avocados';
        if (name === 'garlic') return 'Garlic';
        if (name === 'rice') return 'Rice (uncooked)';
        if (name === 'quinoa') return 'Quinoa (uncooked)';
        if (name === 'mozzarella') return 'Fresh Mozzarella';
        if (name === 'cheddar cheese') return 'Cheddar Cheese (shredded)';
        if (name === 'feta cheese') return 'Feta Cheese';
        if (name === 'soy sauce') return 'Soy Sauce';
        if (name === 'balsamic glaze') return 'Balsamic Glaze';
        if (name === 'soy ginger dressing') return 'Soy Ginger Dressing';
        if (name === 'salsa') return 'Salsa';
        if (name === 'cooking oil') return 'Cooking Oil';
        if (name === 'basil') return 'Basil Leaves';
        if (name === 'kalamata olive') return 'Kalamata Olives';
        if (name === 'ginger') return 'Ginger';
        if (name === 'saffron') return 'Saffron';
        if (name === 'chicken broth') return 'Chicken Broth';
        if (name === 'cucumber') return 'Cucumber';
        if (name === 'onion') return 'Onions';
        if (name === 'potato') return 'Potatoes';
        
        // Capitalize first letter for everything else
        return name.charAt(0).toUpperCase() + name.slice(1);
      };
      
      // Format the final output based on the item type
      const formatOutput = () => {
        // Get the cleaned display name
        const displayName = cleanupName(group.name);
        
        // Special case handling
        if (group.name === 'egg') {
          return `${unitGroups['']} eggs`;
        }
        if (group.name === 'bacon strip') {
          return `${unitGroups['']} strips`;
        }
        if (group.name === 'lettuce leaf') {
          return `Lettuce Leaves: ${unitGroups['']} leaves`;
        }
        if (group.name === 'cucumber') {
          return `Cucumber: ${unitGroups[''] || 1}`;
        }
        if (group.name === 'feta cheese' && !unitGroups['g']) {
          return `Feta Cheese: 1/2 cup`;
        }
        if (group.name === 'kalamata olive') {
          return `Kalamata Olives: 1/4 cup`;
        }
        if (group.name === 'saffron') {
          return `Saffron: 1/2 tsp`;
        }
        if (group.name === 'soy ginger dressing') {
          return `Soy Ginger Dressing: 1/4 cup`;
        }
        
        // Handle cases with a single unit
        if (Object.keys(unitGroups).length === 1) {
          const [unit, amount] = Object.entries(unitGroups)[0];
          
          // Format based on unit type
          if (unit === '') {
            if (isCountItem) {
              return `${displayName}: ${amount}`;
            }
            return `${displayName}: ${amount}`;
          }
          else if (unit === 'kg') {
            return `${displayName}: ${amount} kg`;
          }
          else if (unit === 'g') {
            return `${displayName}: ${amount}g`;
          }
          else if (unit === 'oz') {
            return `${displayName}: ${amount} oz`;
          }
          else if (unit === 'cups') {
            return `${displayName}: ${amount} cups`;
          }
          else if (unit === 'tbsp') {
            return `${displayName}: ${amount} tbsp`;
          }
          else {
            return `${displayName}: ${amount} ${unit}`;
          }
        }
        
        // Handle multiple units (show only the main one for simplicity)
        // Sort by preference: kg > g > oz > cups > tbsp > empty
        const unitPriority = {
          'kg': 5,
          'g': 4,
          'oz': 3,
          'cups': 2,
          'tbsp': 1,
          '': 0
        };
        
        // Get the highest priority unit
        const sortedUnits = Object.entries(unitGroups)
          .sort((a, b) => (unitPriority[b[0]] || -1) - (unitPriority[a[0]] || -1));
        
        if (sortedUnits.length > 0) {
          const [unit, amount] = sortedUnits[0];
          
          if (unit === '') {
            return `${displayName}: ${amount}`;
          }
          else if (unit === 'kg') {
            return `${displayName}: ${amount} kg`;
          }
          else if (unit === 'g') {
            return `${displayName}: ${amount}g`;
          }
          else if (unit === 'oz') {
            return `${displayName}: ${amount} oz`;
          }
          else if (unit === 'cups') {
            return `${displayName}: ${amount} cups`;
          }
          else if (unit === 'tbsp') {
            return `${displayName}: ${amount} tbsp`;
          }
          else {
            return `${displayName}: ${amount} ${unit}`;
          }
        }
        
        // Default fallback
        return displayName;
      };
      
      return formatOutput();
    });
};

const ShoppingListItem = ({ 
  item, 
  selectedStore, 
  onAddToCart, 
  onAddToMixedCart,
  onKrogerNeededSetup
}) => {
  const handleStoreClick = async (store, itemName) => {
    if (store === 'kroger') {
      try {
        // Check if we have a configured Kroger store in localStorage
        const isConfigured = localStorage.getItem('kroger_store_configured') === 'true';
        const locationId = localStorage.getItem('kroger_store_location_id');
        
        // If not configured, show the setup dialog
        if (!isConfigured || !locationId) {
          console.log("Kroger store not configured, showing setup dialog");
          onKrogerNeededSetup(itemName);
          return;
        }
        
        // If configured, try to add to cart
        if (selectedStore === 'mixed') {
          onAddToMixedCart(itemName, 'kroger');
        } else {
          onAddToCart(itemName, 'kroger');
        }
      } catch (err) {
        console.error("Error checking Kroger configuration:", err);
        onKrogerNeededSetup(itemName);
      }
    } else {
      // For Walmart, just proceed normally
      if (selectedStore === 'mixed') {
        onAddToMixedCart(itemName, store);
      } else {
        onAddToCart(itemName, store);
      }
    }
  };
  
  return (
    <Grid item xs={12} sm={6}>
      <Typography>{item}</Typography>
      
      {selectedStore === 'mixed' ? (
        <Box sx={{ mt: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            sx={{ mr: 1 }}
            onClick={() => handleStoreClick('walmart', item)}
          >
            Add to Walmart
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => handleStoreClick('kroger', item)}
          >
            Add to Kroger
          </Button>
        </Box>
      ) : (
        <Button 
          variant="outlined" 
          size="small" 
          sx={{ mt: 1 }}
          onClick={() => handleStoreClick(selectedStore, item)}
        >
          Add to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
        </Button>
      )}
    </Grid>
  );
};

const ShoppingList = ({ 
  categories, 
  selectedStore,
  onAddToCart,
  onAddToMixedCart
}) => {
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [pendingItem, setPendingItem] = useState(null);
  const [error, setError] = useState('');
  
  // Check if we have a configured Kroger store already
  useEffect(() => {
    // Check if we need to refresh the Kroger location from a temp storage
    const tempLocationId = localStorage.getItem('temp_kroger_location_id');
    const savedLocationId = localStorage.getItem('kroger_store_location_id');
    
    if (tempLocationId && (!savedLocationId || tempLocationId !== savedLocationId)) {
      console.log("Found temp Kroger location ID, attempting to save permanently");
      const refreshLocation = async () => {
        try {
          await apiService.updateKrogerLocation(tempLocationId);
          localStorage.removeItem('temp_kroger_location_id');
        } catch (err) {
          console.error("Failed to save temp location:", err);
        }
      };
      refreshLocation();
    }
  }, []);
  
  const processedCategories = Object.entries(categories).reduce((acc, [category, items]) => {
    acc[category] = combineItems(items);
    return acc;
  }, {});
  
  const handleKrogerNeededSetup = (item) => {
    setPendingItem(item);
    setShowStoreSelector(true);
  };
  
  const handleCloseStoreSelector = () => {
    setShowStoreSelector(false);
    setPendingItem(null);
  };
  
  const handleStoreSelect = async (locationId) => {
    if (!locationId) {
      setError("No store location selected");
      return;
    }
    
    try {
      console.log(`Selected Kroger store location: ${locationId}`);
      
      const result = await apiService.updateKrogerLocation(locationId);
      
      if (result.success) {
        // Store was successfully set
        console.log("Kroger store location set successfully");
        localStorage.setItem('kroger_store_configured', 'true');
        
        // Close the dialog
        setShowStoreSelector(false);
        
        // If we had a pending item, try to add it to the cart now
        if (pendingItem) {
          if (selectedStore === 'mixed') {
            onAddToMixedCart(pendingItem, 'kroger');
          } else {
            onAddToCart(pendingItem, 'kroger');
          }
          setPendingItem(null);
        }
      } else {
        setError(result.message || "Failed to set store location");
      }
    } catch (err) {
      console.error("Error setting store location:", err);
      setError(err.message || "An error occurred setting the store location");
    }
  };

  return (
    <>
      {Object.entries(processedCategories).map(([category, items]) => (
        <Paper key={category} elevation={3} sx={{ my: 2, p: 2 }}>
          <Typography variant="h6">{category}</Typography>
          <Grid container spacing={2}>
            {items.map((item, index) => (
              <ShoppingListItem 
                key={index}
                item={item}
                selectedStore={selectedStore}
                onAddToCart={onAddToCart}
                onAddToMixedCart={onAddToMixedCart}
                onKrogerNeededSetup={handleKrogerNeededSetup}
              />
            ))}
          </Grid>
        </Paper>
      ))}
      
      {/* Kroger Store Selection Dialog */}
      <StoreSelector 
        open={showStoreSelector}
        onClose={handleCloseStoreSelector}
        onStoreSelect={handleStoreSelect}
        storeType="kroger"
      />
      
      {error && (
        <Dialog open={!!error} onClose={() => setError('')}>
          <DialogTitle>Error</DialogTitle>
          <DialogContent>
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setError('')} color="primary">
              Close
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </>
  );
};

export default ShoppingList;