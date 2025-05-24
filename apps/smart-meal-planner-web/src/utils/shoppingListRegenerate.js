/**
 * Shopping List Regeneration Utility
 * 
 * This file contains functions to regenerate AI shopping lists and
 * clear the shopping list cache.
 */

import { processShoppingListAI } from './aiShoppingListFix';

/**
 * Regenerate a shopping list by clearing the cache and making a new request
 * 
 * @param {number} menuId - The ID of the menu to regenerate the shopping list for
 * @param {Function} setAiShoppingLoading - State setter for loading status
 * @param {Function} setAiShoppingData - State setter for AI shopping data
 * @param {Function} setLoadingMessageIndex - State setter for loading message index
 * @param {Function} showSnackbar - Function to show a snackbar message
 * @param {Array} groceryList - Fallback grocery list data for client-side processing
 * @param {Function} pollForAiShoppingListStatus - Function to poll for AI status
 * @returns {Promise<void>}
 */
export const regenerateShoppingList = async (
  menuId,
  setAiShoppingLoading,
  setAiShoppingData,
  setLoadingMessageIndex,
  showSnackbar,
  groceryList,
  pollForAiShoppingListStatus
) => {
  try {
    if (!menuId) {
      showSnackbar("No menu selected");
      return;
    }

    // Set loading state
    setAiShoppingLoading(true);
    setLoadingMessageIndex(0); // Reset loading message index

    // First try to clear the cache
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("No auth token available");
      }

      // Delete the cached AI shopping list
      const clearCacheResponse = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-cache`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (clearCacheResponse.ok) {
        console.log("Successfully cleared AI shopping list cache");
      } else {
        console.warn("Failed to clear cache, status:", clearCacheResponse.status);
        // Continue anyway - the use_cache=false flag will ensure we get fresh data
      }
    } catch (cacheError) {
      console.error("Error clearing AI shopping list cache:", cacheError);
      // Continue anyway
    }

    // Now make the actual request for a new shopping list
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        throw new Error("No auth token available");
      }

      console.log("Generating new AI shopping list for menu:", menuId);
      const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-list`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          menu_id: parseInt(menuId),
          use_ai: true,
          use_cache: false // Important: Force freshly generated list
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`API error: ${response.status} - ${errorData.detail || 'Unknown error'}`);
      }

      const result = await response.json();
      console.log("AI shopping list response:", result);

      if (result && (result.status === "processing" || !result.status)) {
        // Start polling for the final result
        console.log("AI shopping list processing started, beginning status polling");
        pollForAiShoppingListStatus(menuId);
      } else {
        // If we got an immediate result, use it
        console.log("Received immediate AI shopping list result");
        setAiShoppingData(result);
        setAiShoppingLoading(false);
        showSnackbar("Shopping list regenerated successfully");
      }
    } catch (apiError) {
      console.error("Error generating new AI shopping list:", apiError);
      
      // Try client-side processing
      try {
        console.log("Attempting client-side processing fallback");
        const aiResult = processShoppingListAI(groceryList);
        setAiShoppingData(aiResult);
        setAiShoppingLoading(false);
        showSnackbar("Generated shopping list using local processing");
      } catch (fallbackError) {
        console.error("Client-side processing fallback also failed:", fallbackError);
        setAiShoppingLoading(false);
        showSnackbar("Error generating shopping list");
      }
    }
  } catch (error) {
    console.error("Unexpected error in regenerateShoppingList:", error);
    setAiShoppingLoading(false);
    showSnackbar("Error generating shopping list");
  }
};

/**
 * Simple version for direct use in components
 * This can be called directly from a button click handler
 * 
 * @param {number} menuId - The menu ID
 * @param {Object} options - Functions and state setters needed
 * @returns {Promise<void>}
 */
export const regenerateShoppingListSimple = async (menuId, options) => {
  const {
    setLoading,
    setData,
    showMessage,
    groceryList,
  } = options;

  try {
    // Set loading state
    setLoading(true);

    // First clear the cache
    const token = localStorage.getItem('token');
    
    // Delete the cached AI shopping list
    await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-cache`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    // Generate new list with cache disabled
    const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-list?use_ai=true&use_cache=false`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    // Update the data
    setData(result);
    setLoading(false);
    showMessage("Shopping list regenerated successfully");
  } catch (error) {
    console.error("Error regenerating shopping list:", error);
    
    // Try client-side processing
    try {
      const aiResult = processShoppingListAI(groceryList);
      setData(aiResult);
    } catch (e) {
      // Just show error if all fails
      showMessage("Error regenerating list");
    } finally {
      setLoading(false);
    }
  }
};