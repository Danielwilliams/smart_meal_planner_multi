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
  
  // Meat products should use oz for larger quantities
  if (name.includes('chicken') || name.includes('beef') || 
      name.includes('pork') || name.includes('steak') || 
      name.includes('turkey') || name.includes('meat')) {
    
    // For large quantities in pounds, convert to ounces for clarity
    if ((normalizedUnit === 'lb' || normalizedUnit === 'lbs' || 
         normalizedUnit === 'pound' || normalizedUnit === 'pounds') && 
        parsedQuantity > 5) {
      return {
        quantity: (parsedQuantity * 16).toFixed(0),
        unit: 'oz'
      };
    }
    
    // For large quantities with no units, assume ounces
    if ((!normalizedUnit || normalizedUnit === 'piece' || normalizedUnit === 'pieces') && 
        parsedQuantity > 20) {
      return {
        quantity: parsedQuantity.toString(),
        unit: 'oz'
      };
    }
    
    // For very large gram values, convert to oz
    if ((normalizedUnit === 'g' || normalizedUnit === 'gram' || normalizedUnit === 'grams') && 
        parsedQuantity > 500) {
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