// src/components/ShoppingList.jsx

import React from 'react';
import { 
  Typography, 
  Paper, 
  Grid,
  Button,
  Box
} from '@mui/material';
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
  oz_to_lbs: 0.0625
};

const WORDS_ENDING_IN_S = [
  'hummus',
  'berries',
  'greens',
  'pancreas',
  'chassis',
  'analysis',
  'molasses',
  'leaves'
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

  // Handle each unit type
  normalizedUnit = normalizedUnit
    .replace(/\b(cup|cups)\b/gi, 'cups')
    .replace(/\b(piece|pieces)\b/gi, 'pieces')
    .replace(/\b(slice|slices)\b/gi, 'slices')
    .replace(/\b(leaf|leaves)\b/gi, 'leaves')
    .replace(/\b(ml)\b/gi, 'ml')
    .replace(/\b(g)\b/gi, 'g')
    .replace(/\b(oz|ozs)\b/gi, 'oz')
    .replace(/\b(tbsp|tbsps)\.?\b/gi, 'tbsp')
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

  let normalized = name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\d+/g, '')
    .replace(/g\s+/, ' ')
    .replace(/lbs?\s+/, ' ')
    .replace(/pieces?\s+/, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Don't remove trailing 's' for words in our exception list
  if (!WORDS_ENDING_IN_S.some(word => normalized.includes(word))) {
    normalized = normalized.replace(/s$/, '');
  }

  return normalized;
};

const formatUnitAndName = (quantity, unit, name) => {
  // Check for special cases
  const normalizedName = name.toLowerCase().trim();
  if (SPECIAL_CASES[normalizedName]) {
    return SPECIAL_CASES[normalizedName](quantity);
  }

  // Handle compound words
  for (const compound of Object.keys(COMPOUND_WORDS)) {
    if (normalizedName.includes(compound)) {
      if (!unit) return `${quantity} ${compound}`;
      const formattedUnit = formatUnit(unit, quantity, compound);
      return `${quantity} ${formattedUnit} ${compound}`.trim();
    }
  }

  // Regular formatting
  if (!unit) return `${quantity} ${normalizedName}`;
  const formattedUnit = formatUnit(unit, quantity, normalizedName);
  return `${quantity} ${formattedUnit} ${normalizedName}`.trim();
};

const getBaseQuantity = (item) => {
  const numbers = item.match(/\d+(\.\d+)?/g) || [];
  return numbers[0] ? parseFloat(numbers[0]) : 0;
};

const isGrams = (item) => /\d+\s*g\b/.test(item.toLowerCase());
const isPounds = (item) => /\d+\s*(lbs?)\b/.test(item.toLowerCase());
const isOunces = (item) => /\d+\s*(oz)\b/.test(item.toLowerCase());

const convertToLbs = (item) => {
  const quantity = getBaseQuantity(item);
  if (isGrams(item)) {
    return quantity * CONVERSION_RATES.g_to_lbs;
  }
  if (isOunces(item)) {
    return quantity * CONVERSION_RATES.oz_to_lbs;
  }
  if (isPounds(item)) {
    return quantity;
  }
  return null;
};

const combineItems = (items) => {
  const groupedItems = {};

  items.forEach(item => {
    if (!item.trim()) return;
    
    const baseName = normalizeItemName(item);
    if (!groupedItems[baseName]) {
      groupedItems[baseName] = {
        items: [],
        totalLbs: 0,
        hasWeight: false,
        originalUnit: null,
        quantity: 0
      };
    }

    const weightInLbs = convertToLbs(item);
    if (weightInLbs !== null && weightInLbs >= 0.5) {
      groupedItems[baseName].hasWeight = true;
      groupedItems[baseName].totalLbs += weightInLbs;
    } else {
      const quantity = getBaseQuantity(item);
      const unitMatch = item.match(/cups|pieces|tbsp|slices|cans|leaves|g|ml|oz/i);
      const unit = unitMatch ? unitMatch[0].toLowerCase() : '';
      
      if (!groupedItems[baseName].originalUnit) {
        groupedItems[baseName].originalUnit = unit;
      }
      if (unit === groupedItems[baseName].originalUnit || !groupedItems[baseName].quantity) {
        groupedItems[baseName].quantity += quantity;
        groupedItems[baseName].originalUnit = unit;
      } else {
        groupedItems[baseName].items.push(item);
      }
    }
  });

  return Object.entries(groupedItems)
    .filter(([name]) => name.trim())
    .map(([name, data]) => {
      if (data.hasWeight) {
        return `${data.totalLbs.toFixed(1)} lbs ${name}`.trim();
      }
      if (data.quantity > 0) {
        return formatUnitAndName(data.quantity, data.originalUnit, name);
      }
      return data.items[0]?.trim() || '';
    })
    .filter(item => item);
};

const ShoppingListItem = ({ 
  item, 
  selectedStore, 
  onAddToCart, 
  onAddToMixedCart 
}) => {
  return (
    <Grid item xs={12} sm={6}>
      <Typography>{item}</Typography>
      
      {selectedStore === 'mixed' ? (
        <Box sx={{ mt: 1 }}>
          <Button 
            variant="outlined" 
            size="small" 
            sx={{ mr: 1 }}
            onClick={() => onAddToMixedCart(item, 'walmart')}
          >
            Add to Walmart
          </Button>
          <Button 
            variant="outlined" 
            size="small" 
            onClick={() => onAddToMixedCart(item, 'kroger')}
          >
            Add to Kroger
          </Button>
        </Box>
      ) : (
        <Button 
          variant="outlined" 
          size="small" 
          sx={{ mt: 1 }}
          onClick={() => onAddToCart(item, selectedStore)}
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
  const processedCategories = Object.entries(categories).reduce((acc, [category, items]) => {
    acc[category] = combineItems(items);
    return acc;
  }, {});

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
              />
            ))}
          </Grid>
        </Paper>
      ))}
    </>
  );
};

export default ShoppingList;
