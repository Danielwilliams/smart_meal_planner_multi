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
    // Log the entire raw data for debugging
    log(`Full raw JSON: ${JSON.stringify(result)}`, 'debug');

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

      // Special debug for this exact format
      if (Array.isArray(result.groceryList) && result.groceryList.length > 0) {
        log(`GroceryList first item: ${JSON.stringify(result.groceryList[0])}`, 'debug');
      }

      // Special handling for the specific format we're seeing
      if (Array.isArray(result.groceryList) &&
          result.groceryList.length === 1 &&
          result.groceryList[0].category &&
          result.groceryList[0].items) {

        // This is the format where groceryList[0] has {category, items}
        log(`Found special format with category and items properties`, 'info');

        // Extract data from the expected format
        const firstItem = result.groceryList[0];

        // Check if it's just "All Items" - if so, we should categorize the items ourselves
        if (firstItem.category === "All Items" && Array.isArray(firstItem.items)) {
          log(`Found "All Items" category - categorizing items automatically`, 'info');

          // Define standard categories
          const categorizedItems = {
            "Protein": [],
            "Produce": [],
            "Dairy": [],
            "Grains": [],
            "Pantry": [],
            "Condiments": [],
            "Other": []
          };

          // Keywords for categorization
          const categoryKeywords = {
            "Protein": ["chicken", "beef", "turkey", "salmon", "fish", "pork", "tofu", "sausage", "bacon", "shrimp", "meat", "protein", "ground"],
            "Produce": ["pepper", "onion", "garlic", "broccoli", "carrot", "lettuce", "tomato", "spinach", "cucumber", "avocado", "potato", "berr", "lime", "lemon", "ginger", "vegetable", "fruit", "cilantro", "parsley", "basil", "edamame", "bell", "saffron", "herb"],
            "Dairy": ["cheese", "yogurt", "milk", "cream", "butter", "egg", "parmesan", "cheddar", "mozzarella", "greek yogurt"],
            "Grains": ["rice", "pasta", "quinoa", "oat", "bread", "tortilla", "flour", "gluten-free", "granola", "cereal", "breadcrumb"],
            "Pantry": ["oil", "spice", "salt", "pepper", "sugar", "honey", "cornstarch", "vinegar", "sauce", "canned", "can", "broth", "stock", "almond", "nut", "sesame", "paprika", "cumin", "garlic powder", "chili powder", "bean", "water chestnut"],
            "Condiments": ["salsa", "sauce", "soy sauce", "lime juice", "marinade", "marinara", "olive oil"]
          };

          // Helper function to categorize an item
          const categorizeItem = (item) => {
            if (!item || !item.name) return "Other";

            const itemName = item.name.toLowerCase();

            // Check each category's keywords
            for (const [category, keywords] of Object.entries(categoryKeywords)) {
              for (const keyword of keywords) {
                if (itemName.includes(keyword)) {
                  return category;
                }
              }
            }

            return "Other";
          };

          // Categorize each item
          firstItem.items.forEach(item => {
            const category = categorizeItem(item);
            // Make a copy of the item to avoid reference issues
            categorizedItems[category].push({...item});
          });

          // Remove empty categories
          for (const category in categorizedItems) {
            if (categorizedItems[category].length === 0) {
              delete categorizedItems[category];
            }
          }

          // Convert the categorized items format to the expected categories format
          // But KEEP the original item objects so we preserve quantity and unitOfMeasure
          const formattedCategories = {};
          Object.entries(categorizedItems).forEach(([category, items]) => {
            formattedCategories[category] = items.map(item => {
              // Important: return the full item object instead of just a string
              return item;
            });
          });

          categories = formattedCategories;
          log(`Auto-categorized items into ${Object.keys(categories).length} categories: ${Object.keys(categories).join(', ')}`, 'info');

          // Log the final categorized structure for debugging
          console.log("Final categorized structure:", JSON.stringify(categories, null, 2));
        } else {
          // Use the categories as-is
          categories[firstItem.category] = firstItem.items;

          // If there are multiple categories in the response, extract them
          result.groceryList.forEach(categoryObj => {
            if (categoryObj.category && Array.isArray(categoryObj.items)) {
              categories[categoryObj.category] = categoryObj.items;
            }
          });

          log(`Created categories from special format: ${Object.keys(categories).join(', ')}`, 'info');
        }
      }
      else if (Array.isArray(result.groceryList)) {
        // Try to extract categories if the first item is an object
        if (result.groceryList.length > 0 && typeof result.groceryList[0] === 'object' && !Array.isArray(result.groceryList[0])) {
          // Check if it has a structure like {Produce: [...], Dairy: [...]}
          const firstItem = result.groceryList[0];
          let isCategoriesObject = true;

          for (const key in firstItem) {
            if (!Array.isArray(firstItem[key])) {
              isCategoriesObject = false;
              break;
            }
          }

          if (isCategoriesObject) {
            categories = firstItem;
            log(`Using first groceryList item as categories object: ${Object.keys(categories).join(', ')}`, 'info');
          } else {
            // It's not a categories object, treat each item as an item
            categories = { 'All Items': result.groceryList };
            log(`First item is an object but not categories, using as items`, 'info');
          }
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
      
      // Check if categories is empty
      if (Object.keys(categories).length === 0) {
        log(`No categories extracted, trying to create a simple format`, 'warning');
        // Create a simple "All Items" category
        if (Array.isArray(result.groceryList)) {
          // Flatten the array if needed
          const allItems = [];
          const processItem = (item) => {
            if (typeof item === 'string') {
              allItems.push(item);
            } else if (item && item.items && Array.isArray(item.items)) {
              // It has items array
              allItems.push(...item.items);
            } else if (item && item.category && Array.isArray(item.items)) {
              // Item has category and items
              allItems.push(`${item.category}: ${item.items.join(', ')}`);
            } else {
              // Just add the item as-is
              allItems.push(JSON.stringify(item));
            }
          };

          result.groceryList.forEach(processItem);

          categories = { 'All Items': allItems };
          log(`Created fallback 'All Items' category with ${allItems.length} items`, 'info');
        }
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

      // Check if this array contains properly categorized items
      const hasCategories = result.length > 0 &&
                           result[0].category &&
                           typeof result[0].category === 'string';

      if (hasCategories) {
        log(`Direct array has category property, checking for proper categorization`, 'info');

        // Extract all unique categories
        const uniqueCategories = [...new Set(result.map(item => item.category))];
        log(`Found ${uniqueCategories.length} unique categories: ${uniqueCategories.join(', ')}`, 'info');

        // If we have more than one category or a single category that's not "All Items",
        // then we have proper categorization from OpenAI
        const hasProperCategories = uniqueCategories.length > 1 ||
                                   (uniqueCategories.length === 1 && uniqueCategories[0] !== 'All Items');

        if (hasProperCategories) {
          log(`Array has properly categorized items`, 'success');

          // Organize items by category
          const categoryMap = {};
          uniqueCategories.forEach(category => {
            categoryMap[category] = result.filter(item => item.category === category);
          });

          processedResult = {
            categories: categoryMap,
            healthyAlternatives: [],
            shoppingTips: [],
            cached: false,
            timestamp: new Date().toISOString(),
            menuId: menuId
          };

          return processedResult;
        }
      }

      // If we don't have proper categories or categories at all, just pass the array through
      // CategorizedShoppingList component will handle categorization
      log(`Returning the direct array for client-side processing`, 'info');
      return result;
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
    
    // Log the final structure right before returning
    console.log('FINAL ADAPTER OUTPUT STRUCTURE:', JSON.stringify(processedResult, null, 2));
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