/**
 * FIX for Method Not Allowed (405) Error
 * 
 * The /menu/{id}/ai-shopping-list endpoint needs to be called with POST, not GET.
 * This script contains a simple function to fix the issue.
 */

/**
 * Properly fetch AI shopping list with POST method
 * 
 * @param {number} menuId - Menu ID to fetch shopping list for
 * @param {boolean} useCache - Whether to use cached results
 * @param {string} additionalPreferences - Optional preferences for AI
 * @returns {Promise<Object>} - The shopping list data
 */
async function fetchAiShoppingList(menuId, useCache = true, additionalPreferences = null) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No auth token available');
    }

    // Use POST instead of GET for this endpoint
    const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-list`, {
      method: 'POST', // Changed from GET to POST
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menu_id: parseInt(menuId),
        use_ai: true,
        use_cache: useCache,
        additional_preferences: additionalPreferences || undefined
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(`API error: ${response.status} - ${errorData.detail || 'Unknown error'}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Error fetching AI shopping list:', error);
    throw error;
  }
}

/**
 * Clear the shopping list cache
 * 
 * @param {number} menuId - Menu ID to clear cache for
 * @returns {Promise<boolean>} - Success status
 */
async function clearShoppingListCache(menuId) {
  try {
    const token = localStorage.getItem('token');
    if (!token) {
      throw new Error('No auth token available');
    }

    const response = await fetch(`https://smartmealplannermulti-production.up.railway.app/menu/${menuId}/ai-shopping-cache`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    return response.ok;
  } catch (error) {
    console.error('Error clearing shopping list cache:', error);
    return false;
  }
}

/**
 * Regenerate shopping list by clearing cache and fetching new data
 * 
 * @param {number} menuId - Menu ID to regenerate list for
 * @param {Function} setLoading - State setter for loading state
 * @param {Function} setData - State setter for shopping list data
 * @param {Function} showError - Function to display errors
 * @returns {Promise<void>}
 */
async function regenerateShoppingList(menuId, setLoading, setData, showError) {
  try {
    setLoading(true);
    
    // First clear the cache
    await clearShoppingListCache(menuId);
    
    // Then fetch a new list with cache disabled
    const result = await fetchAiShoppingList(menuId, false);
    
    setData(result);
  } catch (error) {
    console.error('Error regenerating shopping list:', error);
    showError(error.message);
  } finally {
    setLoading(false);
  }
}

export { fetchAiShoppingList, clearShoppingListCache, regenerateShoppingList };