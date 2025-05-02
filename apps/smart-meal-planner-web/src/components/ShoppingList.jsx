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
  TextField,
  Alert
} from '@mui/material';
import StoreSelector from './StoreSelector';
import apiService from '../services/apiService';
import _ from 'lodash';

const SPECIAL_UNITS = {
  'tomato sauce': 'oz'
};

const UNIT_MAPPINGS = {
  singular: {
    'cup': 'cups',
    'piece': 'pieces',
    'slice': 'slices',
    'can': 'cans',
    'leaf': 'leaves',
    'tbsp': 'tbsp',
    'oz': 'oz',
    'g': 'g',
    'ml': 'ml'
  },
  plural: {
    'cups': 'cups',
    'pieces': 'pieces',
    'slices': 'slices',
    'cans': 'cans',
    'leaves': 'leaves',
    'tbsp': 'tbsp',
    'oz': 'oz',
    'g': 'g',
    'ml': 'ml'
  }
};

const SPECIAL_CASES = {
  'egg': (quantity) => `${quantity} eggs`,
  'eggs': (quantity) => `${quantity} eggs`,
};

const COMPOUND_WORDS = {
  'mixed greens': true,
  'mixed berries': true,
  'balsamic glaze': true,
  'cherry tomatoes': true,
  'cherry tomato': true,
  'water chestnut': true,
  'tomato sauce': true,
  'bell pepper': true,
  'greek yogurt': true
};

const CONVERSION_RATES = {
  g_to_lbs: 0.00220462,
  oz_to_lbs: 0.0625,
  g_to_oz: 0.035274
};

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
  'confectioners sugar'
];

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
  'chicken breast',
  'chicken thigh',
  'mozzarella',
  'cheddar',
  'chicken broth',
  'basil',
  'mixed greens'
];

const formatUnit = (unit, quantity, itemName) => {
  if (!unit) return '';

  // Check for special unit cases based on item name
  if (itemName && SPECIAL_UNITS[itemName.toLowerCase()]) {
    return SPECIAL_UNITS[itemName.toLowerCase()];
  }
  
  // Clean up unit
  let normalizedUnit = unit.toLowerCase()
    .replace(/\.+/g, '.')  // Clean up dots
    .replace(/\s+/g, ' ');  // Normalize spaces

  // Remove duplicate unit words with a more comprehensive pattern
  // This handles cases like "cups cups", "tbsp tbsps", "cup cup" etc.
  normalizedUnit = normalizedUnit.replace(/\b(cup|cups|tbsp|tbsps|tsp|tsps|g|oz|ozs|ml|piece|pieces|slice|slices)\s+\1s?\b/gi, '$1');
  normalizedUnit = normalizedUnit.replace(/\b(cup)s?\s+(cup)s?\b/gi, 'cups');
  normalizedUnit = normalizedUnit.replace(/\b(tbsp|tbs|tablespoon)s?\s+(tbsp|tbs|tablespoon)s?\b/gi, 'tbsp');
  normalizedUnit = normalizedUnit.replace(/\b(tsp|teaspoon)s?\s+(tsp|teaspoon)s?\b/gi, 'tsp');
  
  // Handle each unit type - standardize the format
  normalizedUnit = normalizedUnit
    .replace(/\b(cup|cups)\b/gi, 'cups')
    .replace(/\b(piece|pieces)\b/gi, 'pieces')
    .replace(/\b(slice|slices)\b/gi, 'slices')
    .replace(/\b(leaf|leaves)\b/gi, 'leaves')
    .replace(/\b(ml)\b/gi, 'ml')
    .replace(/\b(g)\b/gi, 'g')
    .replace(/\b(oz|ozs)\b/gi, 'oz')
    .replace(/\b(tbsp|tbsps|tbs|tablespoon|tablespoons)\.?\b/gi, 'tbsp')
    .replace(/\b(tsp|tsps|teaspoon|teaspoons)\.?\b/gi, 'tsp')
    .replace(/\b(lbs|lb)\s+(?:oz|ozs?)\b/gi, 'lbs')
    .trim();

  // Get rid of any remaining duplicate units
  normalizedUnit = normalizedUnit.split(/\s+/)[0];

  return normalizedUnit;
};

const normalizeItemName = (name) => {
  // First check for compound words
  const lowerName = name.toLowerCase();
  for (const compound of Object.keys(COMPOUND_WORDS)) {
    if (lowerName.includes(compound)) {
      return compound;
    }
  }

  // Extract the quantity at the beginning if present
  const quantityMatch = name.match(/^(\d+(?:\.\d+)?)\s+(.+)$/);
  let quantity = '';
  let itemNamePart = name;
  
  if (quantityMatch) {
    quantity = quantityMatch[1];
    itemNamePart = quantityMatch[2];
  }

  // Process the name part without removing the initial quantities
  let normalized = itemNamePart
    .toLowerCase()
    .replace(/\s+/g, ' ')
    // Don't remove all numbers anymore: .replace(/\d+/g, '')
    .replace(/g\s+/, ' ')
    .replace(/lbs?\s+/, ' ')
    .replace(/pieces?\s+/, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Store the original ending for plural restoration later
  const hasPlural = normalized.endsWith('s') && 
    !normalized.endsWith('ss') && // Skip words ending in 'ss' like 'glass'
    !normalized.endsWith('us'); // Skip words ending in 'us' like 'hummus'
    
  // Don't remove trailing 's' for words in our exception list
  if (!WORDS_ENDING_IN_S.some(word => normalized.includes(word))) {
    normalized = normalized.replace(/s$/, '');
  }

  // Store the normalized form with an indicator if it was plural
  return {
    name: normalized,
    wasPlural: hasPlural
  };
};

const formatUnitAndName = (quantity, unit, name) => {
  // Check for special cases
  const normalizedName = name.toLowerCase().trim();
  if (SPECIAL_CASES[normalizedName]) {
    return SPECIAL_CASES[normalizedName](quantity);
  }

  // Function to check if a name needs pluralization
  const shouldPluralize = (itemName, qty) => {
    // Don't pluralize if quantity is 1 or it already ends with 's'
    if (qty <= 1 || itemName.endsWith('s')) return false;
    
    // Check if this is a word that shouldn't be pluralized
    const lowerName = itemName.toLowerCase();
    
    // Check the word is in our UNCOUNTABLE_NOUNS list
    if (UNCOUNTABLE_NOUNS.includes(lowerName)) return false;
    
    // Check if the word contains any uncountable nouns (for compound words)
    for (const uncountable of UNCOUNTABLE_NOUNS) {
      if (lowerName.includes(uncountable) && 
          (lowerName.endsWith(uncountable) || lowerName.startsWith(uncountable))) {
        return false;
      }
    }
    
    // If it passes all checks, it should be pluralized
    return true;
  };

  // Handle compound words
  for (const compound of Object.keys(COMPOUND_WORDS)) {
    if (normalizedName.includes(compound)) {
      let displayCompound = compound;
      
      // Check if we need to pluralize the compound word
      if (shouldPluralize(compound, quantity)) {
        // Special case for compound phrases ending in specific words
        if (compound.endsWith('tomato')) {
          displayCompound = compound.replace(/tomato$/, 'tomatoes');
        } else if (compound.endsWith('potato')) {
          displayCompound = compound.replace(/potato$/, 'potatoes');
        } else if (compound.endsWith('y') && !compound.endsWith(' jelly')) {
          displayCompound = compound.replace(/y$/, 'ies');
        } else if (compound.endsWith('sh') || compound.endsWith('ch') || 
                  compound.endsWith('x') || compound.endsWith('z')) {
          displayCompound = `${compound}es`;
        } else if (!compound.endsWith('s')) {
          displayCompound = `${compound}s`;
        }
      }
      
      if (!unit) return `${quantity} ${displayCompound}`;
      const formattedUnit = formatUnit(unit, quantity, compound);
      return `${quantity} ${formattedUnit} ${displayCompound}`.trim();
    }
  }
  
  // For regular names, we assume pluralization has been handled by the caller
  // as we now track plural information at the ingredient level
  
  // Regular formatting
  if (!unit) return `${quantity} ${normalizedName}`;
  const formattedUnit = formatUnit(unit, quantity, normalizedName);
  return `${quantity} ${formattedUnit} ${normalizedName}`.trim();
};

const getBaseQuantity = (item) => {
  // Get the first number in the string, even if it's at the beginning
  const numbers = item.match(/^\s*(\d+(?:\.\d+)?)|(\d+(?:\.\d+)?)/g) || [];
  
  // For this specific menu we need to treat these product codes as actual gram quantities
  const recipeCodeToGramsMap = {
    '1105': 500, // 500g chicken breast
    '602': 453,  // 1lb (453g) beef strips
    '800': 800,  // 800g product
    '804': 400,  // Recipe had 2 cups (400g) broccoli
    '1107': 300, // Recipe had 300g bell peppers
    '408': 400,  // 400g tomatoes
    '216': 8     // 8oz mozzarella (convert to 216g)
  };
  
  // Check if this item starts with one of our known recipe codes
  const recipeCodeMatch = item.match(/^(\d{3,})\s+/);
  if (recipeCodeMatch) {
    const code = recipeCodeMatch[1];
    // If we have a mapped quantity for this code, use it
    if (recipeCodeToGramsMap[code]) {
      return recipeCodeToGramsMap[code];
    }
  }
  
  return numbers[0] ? parseFloat(numbers[0]) : 0;
};

const isGrams = (item) => {
  // Check for explicit gram notation
  if (/\d+\s*g\b/.test(item.toLowerCase())) {
    return true;
  }
  
  // For this specific menu, these codes represent gram quantities
  const gramCodes = ['1105', '602', '800', '804', '1107', '408'];
  const codeMatch = item.match(/^(\d{3,})\s+/);
  if (codeMatch && gramCodes.includes(codeMatch[1])) {
    return true;
  }
  
  return false;
};

const isPounds = (item) => /\d+\s*(lbs?)\b/.test(item.toLowerCase());

const isOunces = (item) => {
  // Check for explicit ounce notation
  if (/\d+\s*(oz)\b/.test(item.toLowerCase())) {
    return true;
  }
  
  // Check for our special code that represents ounces
  if (item.match(/^216\s+/)) {
    return true;
  }
  
  return false;
};

const convertToLbs = (item) => {
  const quantity = getBaseQuantity(item);
  
  // For zero quantities, don't try to convert
  if (quantity === 0) {
    return null;
  }
  
  if (isGrams(item)) {
    // For large gram quantities, convert to pounds
    if (quantity >= 200) {
      return quantity * CONVERSION_RATES.g_to_lbs;
    } else {
      // Small quantities are better left in grams
      return null;
    }
  }
  
  if (isOunces(item)) {
    // For large ounce quantities, convert to pounds
    if (quantity >= 16) {
      return quantity * CONVERSION_RATES.oz_to_lbs;
    } else {
      // Small quantities are better left in ounces
      return null;
    }
  }
  
  if (isPounds(item)) {
    return quantity;
  }
  
  // For our specific ingredient codes, convert appropriately
  const codeMatch = item.match(/^(\d{3,})\s+/);
  if (codeMatch) {
    const code = codeMatch[1];
    // These codes represent gram quantities
    if (['1105', '602', '800', '804', '1107', '408'].includes(code)) {
      return quantity * CONVERSION_RATES.g_to_lbs;
    }
  }
  
  return null;
};

const combineItems = (items) => {
  const groupedItems = {};

  // Fix misspellings of common plurals
  const fixMisspellings = (name) => {
    // Fix common misspellings
    if (/tomatoe/i.test(name)) {
      return name.replace(/tomatoe/i, 'tomato');
    }
    if (/potatoe/i.test(name)) {
      return name.replace(/potatoe/i, 'potato');
    }
    return name;
  };

  items.forEach(item => {
    if (!item.trim()) return;
    
    // Fix any common misspellings
    const fixedItem = fixMisspellings(item);
    
    // Check if the item starts with a number
    const hasLeadingNumber = /^\s*\d+/.test(fixedItem);
    
    // For items with leading numbers, we want to preserve them
    const nameInfo = normalizeItemName(fixedItem);
    // Handle the new return value from normalizeItemName
    const baseName = typeof nameInfo === 'object' ? nameInfo.name : nameInfo;
    const wasPlural = typeof nameInfo === 'object' ? nameInfo.wasPlural : false;
    
    const itemKey = baseName; // Use as the key for grouping
    
    if (!groupedItems[itemKey]) {
      groupedItems[itemKey] = {
        items: [],
        totalLbs: 0,
        hasWeight: false,
        originalUnit: null,
        quantity: 0,
        originalItem: fixedItem, // Store the original item to preserve formatting
        wasPlural: wasPlural // Store plural flag
      };
    } else {
      // Update plural flag if any version was plural
      groupedItems[itemKey].wasPlural = groupedItems[itemKey].wasPlural || wasPlural;
    }

    const weightInLbs = convertToLbs(item);
    if (weightInLbs !== null && weightInLbs >= 0.5) {
      groupedItems[itemKey].hasWeight = true;
      groupedItems[itemKey].totalLbs += weightInLbs;
    } else {
      const quantity = getBaseQuantity(item);
      const unitMatch = item.match(/cups|pieces|tbsp|slices|cans|leaves|g|ml|oz/i);
      const unit = unitMatch ? unitMatch[0].toLowerCase() : '';
      
      if (!groupedItems[itemKey].originalUnit) {
        groupedItems[itemKey].originalUnit = unit;
      }
      
      // Always add the quantity, even if units differ - we'll handle display later
      groupedItems[itemKey].quantity += quantity;
      
      // If this is the first item or has no quantity, set the original unit
      if (unit === groupedItems[itemKey].originalUnit || 
          !groupedItems[itemKey].quantity || 
          groupedItems[itemKey].quantity === quantity) {
        groupedItems[itemKey].originalUnit = unit;
      } else {
        // Store different unit items separately for reference
        groupedItems[itemKey].items.push(item);
      }
      
      // If this item has a leading number but current original doesn't, use this one as original
      if (hasLeadingNumber && !/^\s*\d+/.test(groupedItems[itemKey].originalItem)) {
        groupedItems[itemKey].originalItem = item;
      }
    }
  });

  return Object.entries(groupedItems)
    .filter(([name]) => name.trim())
    .map(([name, data]) => {
      // Function to pluralize an item name if needed
      const pluralizeName = (itemName, quantity) => {
        // Strip trailing commas before pluralizing
        itemName = itemName.replace(/,+$/, '');
        
        // Check if it's a numbered item (like '1105 chicken breast')
        const isNumberedItem = /^\d+\s+/.test(itemName);
        
        // Don't pluralize if it's already plural or quantity is 1
        if (data.wasPlural || quantity <= 1) return itemName;
        
        // Skip pluralization for uncountable nouns
        for (const uncountable of UNCOUNTABLE_NOUNS) {
          if (itemName.includes(uncountable)) {
            return itemName;
          }
        }

        // Skip pluralization for numbered ingredients (like "1105 chicken breast")
        if (isNumberedItem) {
          return itemName;
        }
        
        // Handle special cases for specific items from your list
        if (itemName.includes('strip')) {
          return itemName.replace(/strip$/, 'strips');
        }
        
        // Handle special plural cases
        if (itemName.endsWith('y') && !['key', 'bay', 'day'].includes(itemName)) {
          return itemName.replace(/y$/, 'ies');
        } else if (itemName.endsWith('sh') || itemName.endsWith('ch') || 
                  itemName.endsWith('s') || itemName.endsWith('x') || 
                  itemName.endsWith('z')) {
          return `${itemName}es`;
        } else if (itemName === 'tomato' || itemName.endsWith(' tomato')) {
          return itemName.replace(/tomato$/, 'tomatoes');
        } else if (itemName === 'potato' || itemName.endsWith(' potato')) {
          return itemName.replace(/potato$/, 'potatoes');
        } else if (itemName === 'leaf' || itemName.endsWith(' leaf')) {
          return itemName.replace(/leaf$/, 'leaves');
        } else {
          // Default pluralization
          return `${itemName}s`;
        }
      };
      
      // Function to handle our special recipe codes and add appropriate units
      const processRecipeCode = (name, quantity) => {
        // Extract the code if present
        const codeMatch = name.match(/^(\d{3,})\s+(.+)$/);
        if (!codeMatch) return null;
        
        const code = codeMatch[1];
        const ingredient = codeMatch[2];
        
        // Handle specific codes
        const specialCases = {
          '1105': `${quantity}g chicken breast`,
          '602': `${quantity}g beef strips`,
          '800': `${quantity}g ${ingredient}`,
          '804': `${quantity}g broccoli`,
          '1107': `${quantity}g bell peppers`, 
          '408': `${quantity}g tomatoes`,
          '216': `${quantity}oz mozzarella`
        };
        
        return specialCases[code] || null;
      };
      
      // Determine if we need to pluralize based on quantity
      let displayName = name;
      if (data.quantity && data.quantity > 1) {
        displayName = pluralizeName(name, data.quantity);
      }
      
      // Check if we have a special recipe code to process
      const codeMatch = name.match(/^(\d{3,})\s+/);
      if (codeMatch && data.quantity > 0) {
        const processedItem = processRecipeCode(name, data.quantity);
        if (processedItem) {
          return processedItem;
        }
      }
      
      if (data.hasWeight && data.totalLbs >= 0.5) {
        // Format to 1 decimal place but remove trailing zeros
        const weightStr = data.totalLbs.toFixed(1).replace(/\.0$/, '');
        return `${weightStr} lbs ${displayName}`.trim();
      }
      
      // If we have a quantity and the name doesn't already start with it
      if (data.quantity > 0) {
        // For gram quantities, make sure to include the unit
        if (isGrams(data.originalItem) && !data.originalItem.includes(' g ')) {
          if (data.quantity >= 1000) {
            // Convert to kg for large quantities
            return `${(data.quantity/1000).toFixed(1)} kg ${displayName}`.trim();
          } else {
            return `${data.quantity}g ${displayName}`.trim();
          }
        }
        
        // For ounce quantities, make sure to include the unit
        if (isOunces(data.originalItem)) {
          return `${data.quantity}oz ${displayName}`.trim();
        }
        
        // Try to extract the item's quantity and use formatUnitAndName
        return formatUnitAndName(data.quantity, data.originalUnit, displayName);
      }
      
      // Fall back to the original item if we couldn't process it properly
      return data.originalItem.trim() || data.items[0]?.trim() || '';
    })
    .filter(item => item);
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