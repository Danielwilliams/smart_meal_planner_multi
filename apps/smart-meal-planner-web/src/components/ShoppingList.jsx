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
  
  // Handle ingredient strings with numeric prefixes (what was incorrectly assumed to be product codes)
  // These are actually just ingredient strings with quantities at the beginning
  // Examples: "1905 chicken breast" should be treated as "1905g chicken breast"
  const prefixMatch = ingredientStr.match(/^(\d{3,4})\s+(.+)$/);
  if (prefixMatch) {
    const quantity = prefixMatch[1];
    const name = prefixMatch[2];
    return {
      name: name,
      quantity: parseFloat(quantity),
      unit: 'g'  // Assuming these are in grams
    };
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
      
      // Combine like units
      const unitGroups = {};
      group.quantities.forEach(({ amount, unit }) => {
        const normalizedUnit = unit ? unit.toLowerCase() : '';
        if (!unitGroups[normalizedUnit]) {
          unitGroups[normalizedUnit] = 0;
        }
        unitGroups[normalizedUnit] += amount;
      });
      
      // Special conversion for large quantities
      Object.entries(unitGroups).forEach(([unit, amount]) => {
        // Convert grams to kg for large quantities
        if (unit === 'g' && amount >= 1000) {
          delete unitGroups[unit];
          unitGroups['kg'] = amount / 1000;
        }
        
        // Convert g to lbs for certain items that make more sense in pounds
        else if (unit === 'g' && amount >= 450 && 
                ['chicken', 'beef', 'pork', 'meat', 'steak', 'fish'].some(meat => 
                  group.name.includes(meat))) {
          delete unitGroups[unit];
          unitGroups['lbs'] = parseFloat((amount * CONVERSION_RATES.g_to_lbs).toFixed(1));
        }
      });
      
      // If we have exactly one unit group, format accordingly
      if (Object.keys(unitGroups).length === 1) {
        const [unit, amount] = Object.entries(unitGroups)[0];
        const unitStr = unit ? ` ${unit}` : '';
        const displayName = amount > 1 ? pluralizeName(group.name, amount) : group.name;
        return `${amount}${unitStr} ${displayName}`.trim();
      }
      
      // If we have multiple different units, list them separately
      let formattedUnits = Object.entries(unitGroups)
        .map(([unit, amount]) => {
          const unitStr = unit ? ` ${unit}` : '';
          return `${amount}${unitStr}`;
        })
        .join(' + ');
      
      // Use plural form if total is > 1 across all units
      const totalAmount = Object.values(unitGroups).reduce((sum, amount) => sum + amount, 0);
      const displayName = totalAmount > 1 ? pluralizeName(group.name, totalAmount) : group.name;
      
      return `${formattedUnits} ${displayName}`.trim();
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