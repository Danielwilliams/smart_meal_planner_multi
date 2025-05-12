/**
 * Helper utility to adapt various API response formats to the expected shopping list format
 */

/**
 * Adapts various API response formats to the expected shopping list format
 * @param {object} result - Raw API response data
 * @param {string} menuId - The menu ID associated with this shopping list
 * @param {function} logger - Optional logging function that takes message and type
 * @returns {object} Processed data in expected format
 */
export const adaptShoppingListResponse = (result, menuId, logger = null) => {
  const log = (message, type = 'info') => {
    if (logger) {
      logger(message, type);
    }
    console.log(`[Shopping List Adapter] ${type === 'error' ? 'ERROR:' : ''} ${message}`);
  };

  // Safety check for null/undefined
  if (!result) {
    log('Received null or undefined result', 'error');
    return {
      categories: { 'Other': ['No items found'] },
      healthyAlternatives: [],
      shoppingTips: [],
      cached: false,
      timestamp: new Date().toISOString(),
      menuId: menuId
    };
  }

  // Define the final processed result object
  let processedResult;

  try {
    // Format 1: Already in expected format with categories
    if (result.categories && typeof result.categories === 'object') {
      log(`Found categories object with ${Object.keys(result.categories).length} categories`, 'info');
      
      processedResult = {
        ...result,
        cached: result.cached || false,
        timestamp: result.timestamp || new Date().toISOString(),
        menuId: menuId
      };
    } 
    // Format 2: Standard API format with groceryList, recommendations, nutritionTips
    else if (result.groceryList) {
      log(`Found standard API format with groceryList property`, 'info');
      
      // Handle various groceryList formats
      let categories = {};
      if (Array.isArray(result.groceryList)) {
        // Try to extract categories if the first item is an object
        if (result.groceryList.length > 0 && typeof result.groceryList[0] === 'object' && !Array.isArray(result.groceryList[0])) {
          categories = result.groceryList[0];
          log(`Using first groceryList item as categories object: ${Object.keys(categories).join(', ')}`, 'info');
        } else {
          // Categorize items if possible
          const categorized = {};
          result.groceryList.forEach(item => {
            const category = (item && item.category) ? item.category : 'Other';
            if (!categorized[category]) {
              categorized[category] = [];
            }
            categorized[category].push(item.name || item);
          });

          if (Object.keys(categorized).length > 1) {
            categories = categorized;
            log(`Categorized groceryList into ${Object.keys(categories).length} categories`, 'info');
          } else {
            // Fallback to simple format
            categories = { 'All Items': result.groceryList };
            log(`Using all ${result.groceryList.length} groceryList items as a single category`, 'info');
          }
        }
      } else if (typeof result.groceryList === 'object') {
        // groceryList is already an object (might be categories)
        categories = result.groceryList;
        log(`Using groceryList object directly as categories`, 'info');
      } else {
        // Fallback for unexpected format
        categories = { 'Other': ['No items found'] };
        log(`Unexpected groceryList format: ${typeof result.groceryList}`, 'warning');
      }
      
      // Map API response to expected format
      processedResult = {
        categories: categories,
        healthyAlternatives: result.recommendations || [],
        shoppingTips: result.nutritionTips || [],
        cached: false,
        timestamp: result.timestamp || new Date().toISOString(),
        menuId: menuId
      };
      
      log(`Mapped API response to expected format`, 'success');
    }
    // Format 3: Data wrapped in data property
    else if (result.data && result.data.categories) {
      log(`Found categories in nested data property`, 'info');
      
      processedResult = {
        ...result.data,
        cached: false,
        timestamp: new Date().toISOString(),
        menuId: menuId
      };
    }
    // Format 4: Direct array of items
    else if (Array.isArray(result)) {
      log(`Found direct array with ${result.length} items`, 'info');
      
      // Create a single category with all items
      processedResult = {
        categories: { 'All Items': result },
        healthyAlternatives: [],
        shoppingTips: [],
        cached: false,
        timestamp: new Date().toISOString(),
        menuId: menuId
      };
    }
    // Format 5: Unknown format - try to extract useful data
    else {
      log(`Unrecognized format - creating minimal structure`, 'warning');
      
      // Try extracting any arrays found in the result
      const allItems = [];
      let healthyAlternatives = [];
      let shoppingTips = [];
      
      Object.keys(result).forEach(key => {
        if (Array.isArray(result[key])) {
          log(`Found array in property "${key}" with ${result[key].length} items`, 'info');
          
          // Map known properties to expected format
          if (key === 'groceryList') {
            allItems.push(...result[key]);
          } else if (key === 'recommendations') {
            healthyAlternatives = result[key];
          } else if (key === 'nutritionTips') {
            shoppingTips = result[key];
          } else {
            // Add any other arrays to allItems
            allItems.push(...result[key]);
          }
        }
      });
      
      processedResult = {
        categories: { 'All Items': allItems.length > 0 ? allItems : ['No items found'] },
        healthyAlternatives: healthyAlternatives,
        shoppingTips: shoppingTips,
        cached: false,
        timestamp: result.timestamp || new Date().toISOString(),
        menuId: menuId
      };
    }
    
    // Ensure all expected properties exist
    if (!processedResult.categories) processedResult.categories = { 'Other': [] };
    if (!processedResult.healthyAlternatives) processedResult.healthyAlternatives = [];
    if (!processedResult.shoppingTips) processedResult.shoppingTips = [];
    
    return processedResult;
  } catch (error) {
    log(`Error processing shopping list data: ${error.message}`, 'error');
    console.error('Error in adaptShoppingListResponse:', error);
    
    // Return minimal valid structure
    return {
      categories: { 'Other': ['Error processing data'] },
      healthyAlternatives: [],
      shoppingTips: [],
      cached: false,
      timestamp: new Date().toISOString(),
      menuId: menuId,
      error: error.message
    };
  }
};

export default { adaptShoppingListResponse };