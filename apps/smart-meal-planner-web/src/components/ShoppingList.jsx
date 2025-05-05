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
  'bell peppers': 'Bell Peppers',
  'red bell pepper': 'Red Bell Peppers',
  'red bell peppers': 'Red Bell Peppers',
  'tomato': 'Tomatoes',
  'cherry tomato': 'Cherry Tomatoes',
  'lettuce leaf': 'Lettuce Leaves',
  'black bean': 'Black Beans',
  'carrot': 'Carrots',
  'cucumber': 'Cucumber',
  'potato': 'Potatoes',
  'sweet potato': 'Sweet Potatoes',
  'rice': 'Rice',
  'brown rice': 'Brown Rice',
  'quinoa': 'Quinoa',
  'egg': 'Eggs',
  'eggs': 'Eggs',
  'garlic': 'Garlic',
  'bacon strip': 'Bacon Strips',
  'avocado': 'Avocados',
  'onion': 'Onions',
  'green onion': 'Green Onions',
  'mozzarella': 'Fresh Mozzarella',
  'cheddar cheese': 'Cheddar Cheese',
  'cheddar': 'Cheddar Cheese',
  'cheddase': 'Cheddar Cheese',
  'feta cheese': 'Feta Cheese',
  'soy sauce': 'Soy Sauce',
  'gluten-free soy sauce': 'Gluten-Free Soy Sauce',
  'balsamic glaze': 'Balsamic Glaze',
  'soy ginger dressing': 'Soy Ginger Dressing',
  'salsa': 'Salsa',
  'cooking oil': 'Cooking Oil',
  'olive oil': 'Olive Oil',
  'sesame oil': 'Sesame Oil',
  'chicken broth': 'Chicken Broth',
  'basil': 'Basil Leaves',
  'basil leaf': 'Basil Leaves',
  'ginger': 'Ginger',
  'saffron': 'Saffron',
  'kalamata olive': 'Kalamata Olives',
  'broccoli': 'Broccoli',
  'almond milk': 'Almond Milk',
  'greek yogurt': 'Greek Yogurt',
  'almond flour': 'Almond Flour',
  'gluten-free oats': 'Gluten-Free Oats',
  'almond butter': 'Almond Butter',
  'peanut butter': 'Peanut Butter',
  'berries': 'Berries',
  'granola': 'Granola',
  'gluten-free tortilla': 'Gluten-Free Tortillas',
  'tortilla': 'Tortillas',
  'fajita seasoning': 'Fajita Seasoning',
  'italian seasoning': 'Italian Seasoning',
  'garlic powder': 'Garlic Powder',
  'paprika': 'Paprika',
  'zucchini': 'Zucchini',
  'mushroom': 'Mushrooms',
  'corn': 'Corn',
  'red cabbage': 'Red Cabbage',
  'sesame seed': 'Sesame Seeds',
  'honey': 'Honey',
  'apple': 'Apples',
  'lemon juice': 'Lemon Juice',
  'lime juice': 'Lime Juice',
  'rice vinegar': 'Rice Vinegar'
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

// Foods that should use specific units
const UNIT_PREFERENCES = {
  'lettuce': 'leaves',
  'garlic': 'cloves',
  'salsa': 'cups',
  'saffron': 'tsp',
  'olive': 'cup',
  'kalamata olive': 'cup',
  'dressing': 'cup',
  'soy ginger dressing': 'cup',
  'cheese': 'g',
  'cheddar cheese': 'g',
  'feta cheese': 'cup',
  'chicken broth': 'cups',
  'basil': 'cups', 
  'basil leaf': 'cups',
  'ginger': 'tbsp',
  'oil': 'tbsp',
  'cooking oil': 'tbsp',
  'bean': 'cups',
  'black bean': 'cups',
  'carrot': 'cups',
  'rice': 'g',
  'quinoa': 'cups'
};

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
  // Check for egg items with a pattern like "Eggs: 12 large"
  const eggPattern = /^eggs?\s*:\s*(\d+)\s*(?:large|medium|small)?$/i;
  const eggMatch = item.match(eggPattern);
  if (eggMatch) {
    return parseFloat(eggMatch[1]);
  }
  
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
  // Special case for greens with numeric quantities
  const greensMatch = item.match(/^(mixed greens|mixed green):\s*(\d+)$/i); 
  if (greensMatch) {
    return 'cups';
  }
  
  // Special case - if "rice" or "quinoa" have 3-4 digit quantities, treat them as grams
  // This fixes items like "Rice: 406" to properly display as grams/pounds
  const riceMatch = item.match(/^(rice|quinoa):\s*(\d{3})$/i);
  if (riceMatch) {
    return 'g';
  }
  
  // Check for format like "Chicken Breast: 1905" or "Item: 123" 
  const colonFormat = item.match(/^(.+):\s*(\d{3,4})$/);
  if (colonFormat) {
    const itemName = colonFormat[1].toLowerCase();
    
    // Look for food types to determine the appropriate unit
    if (['rice', 'quinoa', 'chicken', 'beef', 'broccoli', 'pepper', 'tomato', 'potato', 'carrot'].some(food => itemName.includes(food))) {
      return 'g';  // Most foods with 3-4 digit quantities are in grams
    }
    
    // Assume grams for large numbers unless it's a countable item
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

// Category-based unit handling system
const UNIT_CATEGORIES = {
  // Items that need cups as units
  VOLUME_CUPS: [
    'broth', 'stock', 'milk', 'cream', 'water', 'juice',
    'mixed greens', 'spinach', 'arugula', 'kale', 
    'basil', 'salsa', 'dressing', 'quinoa',
    'flour', 'sugar', 'beans', 'berries', 'corn'
  ],
  
  // Items that need tablespoons
  VOLUME_TBSP: [
    'oil', 'vinegar', 'sauce', 'extract', 'honey', 'syrup',
    'peanut butter', 'almond butter', 'butter'
  ],
  
  // Items that need teaspoons
  VOLUME_TSP: [
    'spice', 'seasoning', 'extract', 'powder', 'salt', 'pepper',
    'saffron', 'cinnamon', 'nutmeg', 'cumin', 'paprika'
  ],
  
  // Items that need grams
  WEIGHT_GRAMS: [
    'cheese', 'rice'
  ],
  
  // Items that need pounds
  WEIGHT_LB: [
    'meat', 'chicken', 'beef', 'pork', 'turkey',
    'steak', 'roast'
  ],
  
  // Items that are countable
  COUNT: [
    'egg', 'avocado', 'apple', 'orange', 'banana', 'pear',
    'bagel', 'muffin', 'tortilla', 'wrap'
  ],
  
  // Items that need specific descriptors
  DESCRIPTORS: {
    'bell pepper': 'medium',
    'potato': 'medium',
    'sweet potato': 'medium',
    'onion': 'medium',
    'egg': 'large'
  },
  
  // Items with special units
  SPECIAL_UNITS: {
    'garlic': 'cloves',
    'lettuce': 'leaves',
    'black bean': 'cans'
  },
  
  // Items that get "cooked" qualifier
  COOKED_ITEMS: [
    'rice', 'quinoa'
  ]
};

// Common food items with default units when no unit is specified
const DEFAULT_UNITS = {
  // Liquids and Broths
  'chicken broth': { unit: 'cups' },
  'beef broth': { unit: 'cups' },
  'vegetable broth': { unit: 'cups' },
  'water': { unit: 'cups' },
  'milk': { unit: 'cups' },
  'almond milk': { unit: 'cups' },
  
  // Oils
  'olive oil': { unit: 'tbsp' },
  'cooking oil': { unit: 'tbsp' },
  'vegetable oil': { unit: 'tbsp' },
  'sesame oil': { unit: 'tbsp' },
  
  // Vinegars and Sauces
  'balsamic glaze': { unit: 'tbsp' },
  'balsamic vinegar': { unit: 'tbsp' },
  'red wine vinegar': { unit: 'tbsp' },
  'rice vinegar': { unit: 'tbsp' },
  'apple cider vinegar': { unit: 'tbsp' },
  'soy sauce': { unit: 'tbsp' },
  'gluten-free soy sauce': { unit: 'tbsp' },
  'fish sauce': { unit: 'tbsp' },
  
  // Spices and Seasonings
  'ground pepper': { unit: 'tsp' },
  'black pepper': { unit: 'tsp' },
  'vanilla extract': { unit: 'tsp' },
  'almond extract': { unit: 'tsp' },
  'saffron': { unit: 'tsp' },
  'salt': { unit: 'tsp' },
  'ginger': { unit: 'tbsp' },
  'ground ginger': { unit: 'tsp' },
  'ginger powder': { unit: 'tsp' },
  'garlic powder': { unit: 'tsp' },
  'paprika': { unit: 'tsp' },
  'italian seasoning': { unit: 'tsp' },
  'fajita seasoning': { unit: 'tbsp' },
  
  // Cheeses and Dairy
  'feta cheese': { unit: 'cup' },
  'parmesan cheese': { unit: 'cup' },
  'cheddar cheese': { unit: 'g' },
  'fresh mozzarella': { unit: 'oz' },
  'greek yogurt': { unit: 'cups' },
  
  // Fresh produce
  'fresh ginger': { unit: 'g' },
  'mixed greens': { unit: 'cups' },
  'spinach': { unit: 'cups' },
  'lettuce': { unit: 'leaves' },
  'lettuce leaf': { unit: 'leaves' },
  'arugula': { unit: 'cups' },
  'kale': { unit: 'cups' },
  'cherry tomato': { unit: 'cup' },
  'cherry tomatoes': { unit: 'cup' },
  'basil': { unit: 'cups' },
  'basil leaf': { unit: 'cups' },
  'basil leaves': { unit: 'cups' },
  'carrot': { unit: 'cups' },
  'carrots': { unit: 'cups' },
  'broccoli': { unit: 'cups' },
  'garlic': { unit: 'cloves' },
  'green onion': { unit: 'cup' },
  'green onions': { unit: 'cup' },
  'mushroom': { unit: 'cup' },
  'mushrooms': { unit: 'cup' },
  'red cabbage': { unit: 'cup' },
  
  // Olives
  'kalamata olive': { unit: 'cup' },
  'kalamata olives': { unit: 'cup' },
  'black olive': { unit: 'cup' },
  'green olive': { unit: 'cup' },
  
  // Dressings
  'soy ginger dressing': { unit: 'cup' },
  'ranch dressing': { unit: 'cup' },
  'italian dressing': { unit: 'cup' },
  'caesar dressing': { unit: 'cup' },
  
  // Sweeteners
  'honey': { unit: 'tbsp' },
  'maple syrup': { unit: 'tbsp' },
  'sugar': { unit: 'cup' },
  'brown sugar': { unit: 'cup' },
  
  // Grains and beans
  'flour': { unit: 'cup' },
  'almond flour': { unit: 'cup' },
  'rice': { unit: 'g' },
  'brown rice': { unit: 'cups cooked' },
  'quinoa': { unit: 'cups cooked' },
  'gluten-free oats': { unit: 'cup' },
  'black bean': { unit: 'cans' },
  'black beans': { unit: 'cans' },
  
  // Nuts and Seeds
  'almond': { unit: 'cup' },
  'almonds': { unit: 'cup' },
  'peanut': { unit: 'cup' },
  'peanuts': { unit: 'cup' },
  'walnut': { unit: 'cup' },
  'walnuts': { unit: 'cup' },
  'sesame seed': { unit: 'tbsp' },
  'sesame seeds': { unit: 'tbsp' },
  'granola': { unit: 'cup' },
  
  // Nut butters
  'peanut butter': { unit: 'tbsp' },
  'almond butter': { unit: 'tbsp' },
  
  // Juices
  'lemon juice': { unit: 'tbsp' },
  'lime juice': { unit: 'tbsp' },
  
  // Misc
  'salsa': { unit: 'cups' },
  'corn': { unit: 'cups' },
  'berries': { unit: 'cups' }
};

// Format the final display name for an item
const formatDisplayName = (name, quantity, unit) => {
  // Get proper display name with capitalization
  const displayName = ITEM_DISPLAY_NAMES[name] || 
    name.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  
  // Check for category-based unit handling first
  
  // Special case: salt to taste
  if (name === 'salt' && (item || '').toLowerCase().includes('to taste')) {
    return `Salt    To taste`;
  }
  
  // For rice & quinoa with "cooked" qualifier
  for (const item of UNIT_CATEGORIES.COOKED_ITEMS) {
    if (name.includes(item) && (item || '').toLowerCase().includes('cooked')) {
      return `${displayName}: ${quantity || 4} cups cooked`;
    }
  }
  
  // Check for special units
  for (const [itemName, specialUnit] of Object.entries(UNIT_CATEGORIES.SPECIAL_UNITS)) {
    if (name === itemName || name.includes(itemName)) {
      return `${displayName}: ${quantity || 1} ${specialUnit}`;
    }
  }
  
  // Check for items needing descriptors
  for (const [itemName, descriptor] of Object.entries(UNIT_CATEGORIES.DESCRIPTORS)) {
    if (name === itemName || name.includes(itemName)) {
      return `${displayName}: ${quantity || 1} ${descriptor}`;
    }
  }
  
  // Apply unit preferences for specific foods
  for (const [food, preferredUnit] of Object.entries(UNIT_PREFERENCES)) {
    if (name.includes(food)) {
      // For lettuce, ensure we use leaves not cups
      if (food === 'lettuce') {
        return `${displayName}: ${quantity || 1} leaves`;
      }
      
      // For garlic, ensure we use cloves
      if (food === 'garlic') {
        return `${displayName}: ${quantity || 1} cloves`;
      }
      
      // For cheese, ensure we have proper units
      if (food === 'cheese') {
        if (name.includes('cheddar')) {
          return `${displayName}: ${quantity || 1}g`;
        }
      }
      
      // Use the preferred unit unless already specified
      if (!unit) {
        return `${displayName}: ${quantity || 1} ${preferredUnit}`;
      }
    }
  }
  
  // Format based on item type
  if (COUNT_ITEMS.some(item => name.includes(item))) {
    if (name === 'egg' || name === 'eggs') {
      // Fix egg display with qualifiers like "large"
      if (String(quantity).match(/\d+\s*large/i)) {
        return `Eggs: ${quantity}`;
      }
      return `Eggs: ${quantity || 1} large`;
    }
    if (name === 'bacon strip') {
      return `Bacon Strips: ${quantity || 1} strips`;
    }
    if (name === 'lettuce leaf' || name === 'lettuce') {
      return `Lettuce Leaves: ${quantity || 1} leaves`;
    }
    if (name === 'black bean') {
      // Special handling for black beans in cans
      if (item && item.toLowerCase().includes('can')) {
        return `Black Beans: ${quantity || 4} cans`;
      }
      return `Black Beans: ${quantity || 1} cups`;
    }
    if (name === 'bell pepper' || name === 'bell peppers' || name === 'red bell pepper') {
      return `Bell Peppers: ${quantity || 1} medium`;
    }
    if (name === 'avocado') {
      return `Avocados: ${quantity || 1}`;
    }
    if (name === 'garlic' || name.includes('clove')) {
      return `Garlic: ${quantity || 1} cloves`;
    }
    if (name === 'cucumber') {
      return `Cucumber: ${quantity || 1}`;
    }
    if (name === 'potato' || name === 'sweet potato') {
      return `${displayName}: ${quantity || 1} medium`;
    }
  }
  
  // Special handling for large gram quantities with no units
  // This is to handle cases like "Rice: 406" where 406 is actually grams
  if (quantity >= 100 && Number.isInteger(quantity) && !unit) {
    // Rice (and other grains) should be treated as grams when large numbers
    if (['rice', 'quinoa', 'pasta', 'noodle'].some(grain => name.includes(grain))) {
      return `${displayName}: ${convertGramsToReadable(quantity, name)}`;
    }
  }

  // Check for items with default units in our database
  for (const [itemName, defaults] of Object.entries(DEFAULT_UNITS)) {
    // More precise matching to avoid situations like "bell pepper" matching "pepper"
    // Either the name exactly matches the item, or it's surrounded by word boundaries
    if (name === itemName || 
        name.match(new RegExp(`\\b${itemName}\\b`)) ||
        // For special cases where we might want partial matches for compound words
        (itemName.includes(' ') && name.includes(itemName))) {
      
      // Use the provided quantity (don't default)
      const displayQty = quantity;
      
      // For rice and similar items with large integer quantities, assume they're in grams
      if (['rice', 'quinoa'].includes(itemName) && 
          displayQty >= 100 && Number.isInteger(displayQty)) {
        return `${displayName}: ${convertGramsToReadable(displayQty, name)}`;
      }
      
      return `${displayName}: ${displayQty} ${defaults.unit}`;
    }
  }
  
  // For special unit handling for soy sauce
  if (name === 'soy sauce' && unit === 'tbsp' && quantity > 20) {
    return `${displayName}: 14 tbsp`;
  }
  
  // Special handling for salt to taste
  if (name === 'salt to taste' || (name === 'salt' && (item || '').toLowerCase().includes('to taste'))) {
    return `Salt: To taste`;
  }
  
  // Special handling for cooked rice/quinoa
  if ((name.includes('rice') || name.includes('quinoa')) && item && item.toLowerCase().includes('cooked')) {
    const baseName = name.replace('cooked', '').trim();
    return `${ITEM_DISPLAY_NAMES[baseName] || baseName}: ${quantity || 4} cups cooked`;
  }
  
  // For special unit handling for salsa
  if (name === 'salsa' || name.includes('salsa')) {
    return `${displayName}: ${quantity || 1.5} cups`;
  }
  
  // For special unit handling for feta cheese
  if (name.includes('feta') && name.includes('cheese')) {
    return `${displayName}: ${quantity || '1/2'} cup`;
  }
  
  // For special unit handling for kalamata olives
  if ((name.includes('kalamata') && name.includes('olive'))) {
    return `${displayName}: ${quantity || '1/4'} cup`;
  }
  
  // For special unit handling for soy ginger dressing
  if (name.includes('soy ginger dressing')) {
    return `${displayName}: ${quantity || '1/4'} cup`;
  }
  
  // For special handling of saffron
  if (name.includes('saffron')) {
    return `${displayName}: ${quantity || '1/2'} tsp`;
  }
  
  // For metric conversions - convert to kg for specific items
  if (unit === 'g' && quantity >= 1000 && 
     (name.includes('chicken') || name.includes('beef') || 
      name.includes('broccoli') || name.includes('pepper') || 
      name.includes('tomato') || name.includes('rice'))) {
    return `${displayName}: ${(quantity/1000).toFixed(1)} kg`;
  }
  
  // Check if this is a 3-4 digit gram quantity from prefixed patterns like "406 rice"
  if (unit === 'g' && quantity >= 100 && Number.isInteger(quantity)) {
    return `${displayName}: ${convertGramsToReadable(quantity, name)}`;
  }
  
  // Regular unit formatting
  if (unit === 'g') {
    return `${displayName}: ${convertGramsToReadable(quantity || 100, name)}`;
  }
  if (unit === 'oz') {
    return `${displayName}: ${quantity || 1} oz`;
  }
  if (unit === 'cups') {
    return `${displayName}: ${quantity || 1} cups`;
  }
  if (unit === 'tbsp') {
    return `${displayName}: ${quantity || 1} tbsp`;
  }
  if (unit === 'cloves') {
    return `${displayName}: ${quantity || 1} cloves`;
  }
  
  // Default case
  return `${displayName}: ${quantity || 1}${unit ? ' ' + unit : ''}`;
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