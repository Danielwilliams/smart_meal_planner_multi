/**
 * Direct fix for the shopping list quantities
 * This keeps a direct copy of the original quantities
 */

// Global storage for initial quantities
let originalQuantities = {};

/**
 * Captures the initial quantities from an API response
 */
export const captureOriginalQuantities = (result) => {
  if (!result || !result.groceryList || !Array.isArray(result.groceryList)) {
    console.log("[directFix] No valid grocery list to capture");
    return;
  }

  // Look for All Items category with original quantities
  const allItemsCategory = result.groceryList.find(cat => 
    cat && cat.category === 'All Items' && Array.isArray(cat.items)
  );

  if (!allItemsCategory) {
    console.log("[directFix] No All Items category found");
    return;
  }

  console.log("[directFix] Found All Items category with", allItemsCategory.items.length, "items");
  
  // Store original quantities by name
  originalQuantities = {};
  allItemsCategory.items.forEach(item => {
    if (item && item.name) {
      originalQuantities[item.name.toLowerCase()] = {
        quantity: item.quantity,
        unit: extractUnit(item.quantity)
      };
      console.log(`[directFix] Saved ${item.name}: ${item.quantity}`);
    }
  });

  console.log("[directFix] Saved", Object.keys(originalQuantities).length, "original quantities");
};

/**
 * Extract unit from quantity string like "96 oz"
 */
const extractUnit = (quantityStr) => {
  if (typeof quantityStr !== 'string') return '';
  
  const parts = quantityStr.trim().split(' ');
  if (parts.length > 1) {
    return parts.slice(1).join(' ');
  }
  return '';
};

/**
 * Apply original quantities to categorized items
 */
export const fixQuantities = (result) => {
  if (!result || !result.groceryList || !Array.isArray(result.groceryList)) {
    console.log("[directFix] No valid grocery list to fix");
    return result;
  }

  if (Object.keys(originalQuantities).length === 0) {
    console.log("[directFix] No original quantities available");
    return result;
  }

  console.log("[directFix] Fixing quantities for categorized list");
  let fixCount = 0;

  // Go through each category
  result.groceryList.forEach(category => {
    if (category && category.items && Array.isArray(category.items)) {
      // Fix each item
      category.items.forEach(item => {
        if (item && item.name) {
          const key = item.name.toLowerCase();
          if (originalQuantities[key]) {
            // Apply original quantity
            item.quantity = originalQuantities[key].quantity;
            
            // Apply unit if available
            if (originalQuantities[key].unit) {
              item.unitOfMeasure = originalQuantities[key].unit;
              item.unit = originalQuantities[key].unit;
            }
            
            fixCount++;
            console.log(`[directFix] Fixed ${item.name}: ${item.quantity} ${item.unitOfMeasure || ''}`);
          }
        }
      });
    }
  });

  console.log(`[directFix] Fixed ${fixCount} items`);
  return result;
};

/**
 * Reset the stored quantities
 */
export const resetQuantities = () => {
  originalQuantities = {};
  console.log("[directFix] Reset original quantities");
};

export default {
  captureOriginalQuantities,
  fixQuantities,
  resetQuantities
};