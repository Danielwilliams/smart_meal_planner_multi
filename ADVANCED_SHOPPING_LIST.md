# Advanced AI Shopping List Implementation

This document outlines the implementation of an enhanced AI shopping list feature that provides better categorization, healthy alternatives, and shopping tips.

## Overview

The shopping list generation has been updated to:

1. Take a menu and pass it to OpenAI in plain text format
2. Generate a shopping list with correct categorization in format 'Item: Quantity-Unit'
3. Include healthy alternatives to common ingredients (like using Greek yogurt instead of sour cream)
4. Provide shopping tips for better grocery shopping
5. Support regenerating the list on demand, which clears cached versions

## Backend Changes

### 1. Updated OpenAI Prompt in `grocery_list.py`

The AI prompt now specifically requests:
- Items formatted as 'Item: Quantity-Unit'
- Categorization by store section
- Healthy alternatives for common ingredients
- Shopping tips

### 2. Added New Fields to Response Format

- Added `healthyAlternatives` array with objects containing:
  - `original`: Original ingredient
  - `alternative`: Healthy substitute
  - `benefit`: Benefits of the substitution
- Added `shoppingTips` array with grocery shopping tips

### 3. Improved Fallback Responses

- All fallback responses now include healthy alternatives and shopping tips
- Format is consistent across all response types (AI-enhanced, basic, fallbacks)

### 4. Cache Management

- Added a DELETE endpoint to clear cached AI shopping list for a specific menu
- Added support for `use_cache=false` parameter to force regeneration

## Frontend Changes

### 1. Updated `ShoppingList.jsx` Component

- Added props for `healthyAlternatives`, `shoppingTips`, and `onRegenerateList`
- Added UI sections to display healthy alternatives and shopping tips
- Added a regenerate button that triggers the `onRegenerateList` callback

### 2. Updated `aiShoppingListFix.js` Client-Side Processing

- Enhanced the format to include healthy alternatives and shopping tips
- Added default values for when AI is unavailable

## Implementation

To implement this feature in your app:

1. Copy the updated backend and frontend files to your application
2. Add the regeneration function to your ShoppingListPage component:

```javascript
const handleRegenerateList = async () => {
  try {
    if (!selectedMenuId) {
      showSnackbar("No menu selected");
      return;
    }

    // Set loading state
    setAiShoppingLoading(true);
    setActiveTab(1); // Switch to AI tab
    setLoadingMessageIndex(0); // Reset loading message index

    // Clear any cached AI data for this menu
    try {
      await fetch(`${API_BASE_URL}/menu/${selectedMenuId}/ai-shopping-cache`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      });
      console.log("Successfully cleared AI shopping list cache");
    } catch (err) {
      console.error("Error clearing AI shopping list cache:", err);
      // Continue anyway
    }

    // Then make a new fetch request with use_cache=false
    const token = localStorage.getItem('token');
    if (!token) {
      console.error("No auth token in localStorage!");
      setAiShoppingLoading(false);
      showSnackbar("Authentication error");
      return;
    }

    console.log("Making API request for new AI shopping list:", selectedMenuId);
    const response = await fetch(`${API_BASE_URL}/menu/${selectedMenuId}/ai-shopping-list`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        menu_id: parseInt(selectedMenuId),
        use_ai: true,
        use_cache: false
      })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const result = await response.json();
    
    if (result && (result.status === "processing" || !result.status)) {
      // Start polling for the final result
      console.log("AI shopping list processing started, beginning status polling");
      pollForAiShoppingListStatus(selectedMenuId);
    } else {
      // If we got an immediate result, use it
      console.log("Received immediate AI shopping list result:", result);
      setAiShoppingData(result);
      setAiShoppingLoading(false);
      showSnackbar("Shopping list regenerated successfully");
    }
  } catch (error) {
    console.error("Error regenerating AI shopping list:", error);
    setAiShoppingLoading(false);
    showSnackbar("Error regenerating shopping list");
    
    // Try the client-side fallback
    try {
      console.log("Attempting client-side fallback processing");
      const aiResult = processShoppingListAI(groceryList);
      setAiShoppingData(aiResult);
      showSnackbar("Generated shopping list using local processing");
    } catch (fallbackError) {
      console.error("Client-side fallback also failed:", fallbackError);
    }
  }
};
```

3. Update your ShoppingList component rendering to pass the new props:

```jsx
{aiShoppingData && aiShoppingData.groceryList && (
  <ShoppingList
    categories={aiShoppingData.groceryList}
    selectedStore={selectedStore}
    onAddToCart={handleAddToCart}
    onAddToMixedCart={handleAddToMixedCart}
    healthyAlternatives={aiShoppingData.healthyAlternatives || []}
    shoppingTips={aiShoppingData.shoppingTips || []}
    onRegenerateList={handleRegenerateList}
  />
)}
```

## Testing Notes

- Ensure the shopping list generates properly when a menu is selected
- Verify healthy alternatives and shopping tips are displayed correctly
- Test that regenerating the list clears the cache and creates a new version
- Confirm the format 'Item: Quantity-Unit' is consistent across all items