// Enhanced direct fetch shopping list function
// This is a replacement for the original directFetchShoppingList function

import { extractGroceryItems, processGroceryList, formatForAiShopping } from './shoppingListUtils';

/**
 * Directly fetches and processes a shopping list for a menu
 * @param {number} menuId - The menu ID to fetch shopping list for
 * @param {function} setAiShoppingLoading - State setter for loading state
 * @param {function} setAiShoppingData - State setter for AI shopping data
 * @param {function} setActiveTab - State setter for active tab
 * @param {function} setUsingAiList - State setter for using AI list flag
 * @param {function} setCachedShoppingList - Function to cache shopping list
 * @param {object} apiService - API service instance
 * @returns {Promise<boolean>} - Success status
 */
export async function enhancedDirectFetch(
  menuId, 
  setAiShoppingLoading, 
  setAiShoppingData, 
  setActiveTab, 
  setUsingAiList,
  setCachedShoppingList,
  apiService
) {
  console.log("ENHANCED FETCH: Attempting to get shopping list for menu ID:", menuId);
  
  try {
    if (!menuId) {
      console.error("ENHANCED FETCH ERROR: No menuId provided!");
      setAiShoppingLoading(false);
      return null;
    }

    // Use the enhanced grocery list API that handles multiple fallbacks
    console.log("ENHANCED FETCH: Using enhanced API method with fallbacks");
    const result = await apiService.getEnhancedGroceryList(menuId);
    
    if (!result) {
      console.error("ENHANCED FETCH: Enhanced API returned null result");
      setAiShoppingLoading(false);
      return null;
    }
    
    console.log("ENHANCED FETCH: Got shopping list from enhanced API:", result);
    
    // Extract grocery items from the result in a standard format
    const extractedItems = extractGroceryItems(result);
    
    if (!extractedItems || extractedItems.length === 0) {
      console.error("ENHANCED FETCH: No items extracted from API response");
      setAiShoppingLoading(false);
      return null;
    }
    
    console.log(`ENHANCED FETCH: Extracted ${extractedItems.length} items`);
    
    // Process the extracted items into categorized format
    const processedItems = processGroceryList(extractedItems);
    
    // Format for AI shopping display
    const formattedCategories = formatForAiShopping(processedItems);
    
    console.log("ENHANCED FETCH: Final formatted categories:", formattedCategories);
    
    // Update state with categorized data
    setAiShoppingLoading(false);
    setAiShoppingData({
      groceryList: formattedCategories,
      menuId: menuId,
      status: "completed",
      cached: true,
      nutritionTips: result.nutritionTips || [
        "Try to prioritize whole foods over processed options.",
        "Choose lean proteins for healthier meal options.",
        "Look for whole grain alternatives to refined grains."
      ],
      recommendations: result.recommendations || [
        "Shop the perimeter of the store first for fresh foods.",
        "Check your pantry before shopping to avoid duplicates.",
        "Consider buying in-season produce for better flavor and value."
      ]
    });
    
    setActiveTab(1);
    setUsingAiList(true);
    
    // Cache the results
    setCachedShoppingList(menuId, {
      groceryList: formattedCategories,
      menuId: menuId,
      status: "completed",
      nutritionTips: result.nutritionTips || [
        "Try to prioritize whole foods over processed options.",
        "Choose lean proteins for healthier meal options.",
        "Look for whole grain alternatives to refined grains."
      ],
      recommendations: result.recommendations || [
        "Shop the perimeter of the store first for fresh foods.",
        "Check your pantry before shopping to avoid duplicates.",
        "Consider buying in-season produce for better flavor and value."
      ]
    });
    
    return true;
  } catch (error) {
    console.error("ENHANCED FETCH: Error fetching shopping list:", error);
    setAiShoppingLoading(false);
    return null;
  }
}