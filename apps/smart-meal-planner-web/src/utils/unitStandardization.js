/**
 * Unit standardization utility functions
 * This provides a consistent way to handle units across the application
 */

/**
 * Standardize units for grocery items, especially meat products
 * @param {string|number} quantity - The quantity value
 * @param {string} unit - The unit (lb, oz, etc.)
 * @param {string} itemName - The name of the item
 * @returns {Object} - The standardized quantity and unit
 */
export const standardizeUnits = (quantity, unit, itemName) => {
  const name = (itemName || '').toLowerCase();
  const parsedQuantity = parseFloat(quantity) || 1;
  
  // Normalize unit for consistent checks
  const normalizedUnit = (unit || '').toLowerCase().replace(/\.$/, '');
  
  // Meat products with proper handling of units
  if (name.includes('chicken') || name.includes('beef') ||
      name.includes('pork') || name.includes('steak') ||
      name.includes('turkey') || name.includes('meat')) {

    // Check if quantity is already in oz
    if (normalizedUnit === 'oz' || normalizedUnit === 'ounce' || normalizedUnit === 'ounces') {
      // Keep the original oz value, don't modify it
      return {
        quantity: parsedQuantity.toString(),
        unit: 'oz'
      };
    }

    // For quantities in pounds, convert to ounces for better summation
    if ((normalizedUnit === 'lb' || normalizedUnit === 'lbs' ||
         normalizedUnit === 'pound' || normalizedUnit === 'pounds')) {
      return {
        quantity: (parsedQuantity * 16).toFixed(0),
        unit: 'oz'
      };
    }

    // For quantities with no units, check quantity size to determine unit
    if ((!normalizedUnit || normalizedUnit === 'piece' || normalizedUnit === 'pieces')) {
      // If it's a reasonable number (under 20), it's likely pounds
      if (parsedQuantity <= 5) {
        return {
          quantity: (parsedQuantity * 16).toFixed(0), // Convert to oz
          unit: 'oz'
        };
      } else if (parsedQuantity <= 20) {
        // Between 5-20, likely already in oz
        return {
          quantity: parsedQuantity.toString(),
          unit: 'oz'
        };
      } else {
        // Over 20, definitely in oz
        return {
          quantity: parsedQuantity.toString(),
          unit: 'oz'
        };
      }
    }

    // For gram values, convert to oz carefully
    if ((normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams')) {
      // 1g ≈ 0.035oz
      const ozValue = (parsedQuantity * 0.035274).toFixed(0);
      return {
        quantity: ozValue,
        unit: 'oz'
      };
    }
  }
  
  // For dairy/cheese items with large gram values
  if ((name.includes('cheese') || name.includes('dairy')) && 
      (normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') && 
      parsedQuantity > 200) {
    // Convert grams to oz for cheese/dairy
    const ozValue = (parsedQuantity * 0.035274).toFixed(1);
    return {
      quantity: ozValue,
      unit: 'oz'
    };
  }
  
  // For produce with large counts, make measurements more realistic
  if ((name.includes('pepper') || name.includes('onion') || name.includes('potato')) &&
      (!normalizedUnit || normalizedUnit === 'piece' || normalizedUnit === 'pieces') && 
      parsedQuantity > 6) {
    return {
      quantity: Math.min(parsedQuantity, 6).toString(), // Cap at 6
      unit: normalizedUnit || 'medium'
    };
  }
  
  // Return original if no changes needed
  return { 
    quantity: quantity.toString(), 
    unit: unit || '' 
  };
};

/**
 * Format display for standardized units
 * @param {string} itemName - The name of the item 
 * @param {string|number} quantity - The quantity
 * @param {string} unit - The unit
 * @returns {string} - Formatted display string
 */
export const formatUnitDisplay = (itemName, quantity, unit) => {
  // First standardize the units
  const standardized = standardizeUnits(quantity, unit, itemName);
  
  // Apply proper formatting
  const parsedQty = parseFloat(standardized.quantity);
  const displayUnit = standardized.unit || '';
  
  // Specific rules for different unit types
  if (displayUnit === 'oz') {
    return `${parsedQty} oz`;
  } else if (displayUnit === 'lb' || displayUnit === 'lbs') {
    return `${parsedQty} lb`;
  } else if (displayUnit === 'g' || displayUnit === 'gram' || displayUnit === 'grams') {
    return `${parsedQty}g`;
  } else if (displayUnit) {
    return `${parsedQty} ${displayUnit}`;
  }
  
  // Just return the quantity if no unit
  return standardized.quantity.toString();
};