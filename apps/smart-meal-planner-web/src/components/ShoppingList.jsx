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
import _ from 'lodash';

// Unit conversion constants
const CONVERSION_RATES = {
  g_to_kg: 0.001,     // 1g = 0.001 kg
  g_to_lbs: 0.00220462,  // 1g = 0.00220462 lbs
  oz_to_lbs: 0.0625,     // 1oz = 0.0625 lbs
  g_to_oz: 0.035274,     // 1g = 0.035274 oz
  cup_to_g: {
    'rice': 200,         // 1 cup rice ≈ 200g
    'broccoli': 150,     // 1 cup chopped broccoli ≈ 150g
    'bell pepper': 150,  // 1 cup chopped bell peppers ≈ 150g
    'carrot': 110,       // 1 cup chopped carrots ≈ 110g
  },
  tbsp_to_ml: 15,        // 1 tbsp ≈ 15ml
  tsp_to_ml: 5           // 1 tsp ≈ 5ml
};

// Common food items that should be displayed in a specific way
const ITEM_DISPLAY_NAMES = {
  'chicken breast': 'Chicken Breast',
  'chicken thigh': 'Chicken Thighs',
  'beef strip': 'Beef Strips',
  'mixed green': 'Mixed Greens',
  'bell pepper': 'Bell Peppers',
  'tomato': 'Tomatoes',
  'cherry tomato': 'Cherry Tomatoes',
  'lettuce leaf': 'Lettuce Leaves',
  'black bean': 'Black Beans',
  'carrot': 'Carrots',
  'cucumber': 'Cucumber',
  'potato': 'Potatoes',
  'rice': 'Rice',
  'quinoa': 'Quinoa',
  'egg': 'Eggs',
  'garlic': 'Garlic',
  'bacon strip': 'Bacon Strips',
  'avocado': 'Avocados',
  'onion': 'Onions',
  'mozzarella': 'Fresh Mozzarella',
  'cheddar cheese': 'Cheddar Cheese',
  'feta cheese': 'Feta Cheese',
  'soy sauce': 'Soy Sauce',
  'balsamic glaze': 'Balsamic Glaze',
  'soy ginger dressing': 'Soy Ginger Dressing',
  'salsa': 'Salsa',
  'cooking oil': 'Cooking Oil',
  'chicken broth': 'Chicken Broth',
  'basil': 'Basil Leaves',
  'basil leaf': 'Basil Leaves',
  'ginger': 'Ginger',
  'saffron': 'Saffron',
  'kalamata olive': 'Kalamata Olives',
  'broccoli': 'Broccoli'
};

// Words that naturally end in 's' but aren't plural
const WORDS_ENDING_IN_S = [
  'hummus', 'berries', 'greens', 'beans',
  'leaves', 'grass', 'swiss', 'brussels'
];

// Common compound words in food items
const COMPOUND_WORDS = {
  'chicken breast': true,
  'chicken thigh': true,
  'beef strip': true,
  'mixed greens': true,
  'bell pepper': true,
  'cherry tomato': true,
  'lettuce leaf': true,
  'black bean': true,
  'bacon strip': true,
  'chicken broth': true,
  'soy sauce': true,
  'balsamic glaze': true,
  'soy ginger dressing': true,
  'cooking oil': true,
  'kalamata olive': true
};

// Items that are countable (not measured by weight)
const COUNT_ITEMS = [
  'egg', 'avocado', 'bacon strip', 'lettuce leaf',
  'clove', 'cucumber', 'black bean'
];

// Clean up and standardize a unit
const formatUnit = (unit) => {
  if (!unit) return '';
  
  let normalizedUnit = unit.toLowerCase()
    .replace(/\.+/g, '')
    .replace(/\s+/g, '')
    .trim();
  
  // Handle different unit forms
  if (/^(cup|cups|c)$/.test(normalizedUnit)) return 'cups';
  if (/^(piece|pieces|pcs)$/.test(normalizedUnit)) return 'pieces';
  if (/^(tablespoon|tablespoons|tbsp|tbsps|tbs)$/.test(normalizedUnit)) return 'tbsp';
  if (/^(teaspoon|teaspoons|tsp|tsps)$/.test(normalizedUnit)) return 'tsp';
  if (/^(ounce|ounces|oz|ozs)$/.test(normalizedUnit)) return 'oz';
  if (/^(pound|pounds|lb|lbs)$/.test(normalizedUnit)) return 'lbs';
  if (/^(gram|grams|g)$/.test(normalizedUnit)) return 'g';
  if (/^(kilogram|kilograms|kg)$/.test(normalizedUnit)) return 'kg';
  if (/^(milliliter|milliliters|ml)$/.test(normalizedUnit)) return 'ml';
  if (/^(liter|liters|l)$/.test(normalizedUnit)) return 'L';
  if (/^(clove|cloves)$/.test(normalizedUnit)) return 'cloves';
  
  return normalizedUnit;
};

// Get the base quantity from an item string
const getBaseQuantity = (item) => {
  // For "Item: 1905" format
  const colonFormat = item.match(/^(.+):\s*(\d{3,4})$/);
  if (colonFormat) {
    return parseFloat(colonFormat[2]);
  }
  
  // For "500g chicken" style
  const unitMatch = item.match(/^(\d+(?:\.\d+)?)\s*([a-zA-Z]+)/);
  if (unitMatch) {
    return parseFloat(unitMatch[1]);
  }
  
  // For "2 eggs" style
  const numberMatch = item.match(/^(\d+(?:\.\d+)?)\s+/);
  if (numberMatch) {
    return parseFloat(numberMatch[1]);
  }
  
  // For any number in the string
  const anyNumbers = item.match(/\d+(?:\.\d+)?/g) || [];
  return anyNumbers[0] ? parseFloat(anyNumbers[0]) : 0;
};

// Extract unit from an item string
const getUnit = (item) => {
  // Check for format like "Chicken Breast: 1905" or "Item: 123" 
  const colonFormat = item.match(/^(.+):\s*(\d{3,4})$/);
  if (colonFormat) {
    // For 3-4 digit quantities after colon, assume grams
    return 'g';
  }
  
  // Also check for older format with digit prefix like "1905 chicken breast"
  const prefixMatch = item.match(/^(\d{3,4})\s+(.+)$/);
  if (prefixMatch) {
    // For 3-4 digit prefixes with meat, vegetables, etc., assume grams
    return 'g';
  }
  
  // Check for common units
  const unitMatches = item.match(/\b(g|oz|cups?|tbsps?|tsps?|pieces?|cloves?|leaves)\b/i);
  if (unitMatches) {
    return formatUnit(unitMatches[1]);
  }
  
  // Check for attached units like "500g"
  const attachedUnit = item.match(/\d+\s*(g|oz|lbs?|kg)\b/i);
  if (attachedUnit) {
    return formatUnit(attachedUnit[1]);
  }
  
  return '';
};

// Extract clean ingredient name
const normalizeItemName = (item) => {
  // Check for "Item: 1905" format and extract just the item name
  const colonFormat = item.match(/^(.+):\s*\d{3,4}$/);
  if (colonFormat) {
    const itemName = colonFormat[1].trim().toLowerCase();
    
    // First check for compound words in the extracted name
    for (const compound of Object.keys(COMPOUND_WORDS)) {
      if (itemName.includes(compound)) {
        return compound;
      }
    }
    
    return itemName;
  }
  
  // First try to match known compound words
  for (const compound of Object.keys(COMPOUND_WORDS)) {
    if (item.toLowerCase().includes(compound)) {
      return compound;
    }
  }
  
  // Remove quantity and unit information
  let name = item.toLowerCase()
    .replace(/^\d+\s*/, '')  // Remove leading numbers
    .replace(/\d+\s*(g|oz|lbs?|kg|cups?|tbsps?|tsps?|pieces?|cloves?|leaves)\b/gi, '') // Remove number+unit
    .replace(/\b(g|oz|lbs?|kg|cups?|tbsps?|tsps?|pieces?|cloves?|leaves)\b/gi, '') // Remove standalone units
    .replace(/,\s*$/, '') // Remove trailing commas
    .replace(/\s+/g, ' ') // Normalize spaces
    .trim();
  
  // Handle special cases like "boneless" and similar descriptors
  name = name.replace(/\s*boneless\s*/, ' ');
  name = name.replace(/\s*skinless\s*/, ' ');
  name = name.replace(/\s*fresh\s*/, ' ');
  name = name.replace(/\s*frozen\s*/, ' ');
  name = name.replace(/\s+/g, ' ').trim();
  
  // Handle plural forms: remove trailing 's' unless in exception list
  if (name.endsWith('s') && !WORDS_ENDING_IN_S.some(word => name.includes(word))) {
    name = name.replace(/s$/, '');
  }
  
  return name;
};

// Convert grams to a more readable format for display
const convertGramsToReadable = (grams, itemName) => {
  // For meat items, produce, and other large quantities, convert to pounds
  if (grams >= 450) { // 450g ≈ 1 lb
    const lbs = (grams * CONVERSION_RATES.g_to_lbs).toFixed(1);
    return `${lbs} lbs`;
  }
  
  return `${grams}g`;
};

// Format the final display name for an item
const formatDisplayName = (name, quantity, unit) => {
  // Get proper display name with capitalization
  const displayName = ITEM_DISPLAY_NAMES[name] || 
    name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  // Format based on item type
  if (COUNT_ITEMS.some(item => name.includes(item))) {
    if (name === 'egg') {
      return `Eggs: ${quantity}`;
    }
    if (name === 'bacon strip') {
      return `Bacon Strips: ${quantity} strips`;
    }
    if (name === 'lettuce leaf') {
      return `Lettuce Leaves: ${quantity} leaves`;
    }
    if (name === 'black bean') {
      return `Black Beans: ${quantity} cups`;
    }
    if (name === 'avocado') {
      return `Avocados: ${quantity}`;
    }
    if (name.includes('clove')) {
      return `${displayName}: ${quantity} cloves`;
    }
    if (name === 'cucumber') {
      return `Cucumber: ${quantity}`;
    }
  }
  
  // Special case handling with default units
  if (name === 'feta cheese' || name.includes('feta')) {
    return 'Feta Cheese: 1/2 cup';
  }
  if (name === 'kalamata olive' || name === 'kalamata olives' || name.includes('kalamata')) {
    return 'Kalamata Olives: 1/4 cup';
  }
  if (name === 'saffron' || name.includes('saffron')) {
    return 'Saffron: 1/2 tsp';
  }
  if (name === 'soy ginger dressing' || name.includes('ginger dressing') || (name.includes('soy') && name.includes('ginger'))) {
    return 'Soy Ginger Dressing: 1/4 cup';
  }
  // Make sure balsamic glaze has units
  if (name === 'balsamic glaze' && !unit) {
    return 'Balsamic Glaze: 4 tbsp';
  }
  // Make sure chicken broth has units
  if (name === 'chicken broth' && !unit) {
    return `Chicken Broth: ${quantity} cups`;
  }
  
  // Format based on unit
  if (unit === 'g') {
    return `${displayName}: ${convertGramsToReadable(quantity, name)}`;
  }
  if (unit === 'oz') {
    return `${displayName}: ${quantity} oz`;
  }
  if (unit === 'cups') {
    return `${displayName}: ${quantity} cups`;
  }
  if (unit === 'tbsp') {
    return `${displayName}: ${quantity} tbsp`;
  }
  if (unit === 'cloves') {
    return `${displayName}: ${quantity} cloves`;
  }
  
  // Default case
  return `${displayName}: ${quantity}${unit ? ' ' + unit : ''}`;
};

// Main function to combine and process items
const combineItems = (items) => {
  const groupedItems = {};

  // First pass: Group items by normalized name
  items.forEach(item => {
    if (!item || typeof item !== 'string' || !item.trim()) return;
    
    // Get normalized name and quantities
    const normalizedName = normalizeItemName(item);
    if (!normalizedName) return;
    
    const quantity = getBaseQuantity(item);
    const unit = getUnit(item);
    
    // Initialize the group if needed
    if (!groupedItems[normalizedName]) {
      groupedItems[normalizedName] = {
        quantities: [],
        totalGrams: 0,
        totalQuantity: 0,
        hasUnit: false
      };
    }
    
    // Add this item's quantity to the group
    if (quantity > 0) {
      groupedItems[normalizedName].quantities.push({
        amount: quantity,
        unit: unit
      });
      
      // If it's in grams, track total grams
      if (unit === 'g') {
        groupedItems[normalizedName].totalGrams += quantity;
        groupedItems[normalizedName].hasUnit = true;
      }
      // For other units, just add to total quantity if units match
      else if (unit) {
        groupedItems[normalizedName].hasUnit = true;
        // If this unit is the majority unit, add to total
        const existingUnit = groupedItems[normalizedName].quantities.length > 1 ? 
          groupedItems[normalizedName].quantities[0].unit : '';
        
        if (unit === existingUnit || !existingUnit) {
          groupedItems[normalizedName].totalQuantity += quantity;
        }
      } 
      // For count items (no unit)
      else {
        groupedItems[normalizedName].totalQuantity += quantity;
      }
    }
  });

  // Second pass: Format each group for display
  return Object.entries(groupedItems)
    .map(([name, data]) => {
      // If we have no quantities, just return the name
      if (!data.quantities.length) {
        return ITEM_DISPLAY_NAMES[name] || name;
      }
      
      // Get the most common unit
      const unitCounts = {};
      data.quantities.forEach(q => {
        if (q.unit) {
          unitCounts[q.unit] = (unitCounts[q.unit] || 0) + 1;
        }
      });
      
      let primaryUnit = '';
      let highestCount = 0;
      Object.entries(unitCounts).forEach(([unit, count]) => {
        if (count > highestCount) {
          highestCount = count;
          primaryUnit = unit;
        }
      });
      
      // Calculate total for the primary unit
      let totalAmount = 0;
      data.quantities.forEach(q => {
        if (q.unit === primaryUnit) {
          totalAmount += q.amount;
        }
      });
      
      // If we don't have a primary unit but have items, use the first item's unit
      if (!primaryUnit && data.quantities.length > 0) {
        primaryUnit = data.quantities[0].unit || '';
        totalAmount = data.totalQuantity;
      }
      
      // For grams, use the total grams
      if (primaryUnit === 'g') {
        totalAmount = data.totalGrams;
      }
      
      // For count items, use total quantity
      if (!primaryUnit) {
        totalAmount = data.totalQuantity;
      }
      
      return formatDisplayName(name, totalAmount, primaryUnit);
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