# Shopping List Troubleshooting Guide

This guide addresses common issues with the AI shopping list generation feature.

## Permission Issues: "You don't have access to this menu"

If you're seeing permission errors when trying to access a menu:

1. Verify that the menu ID is correct
2. Check that you're properly authenticated (token is valid)
3. Verify that you have permission to access the menu (you own it or it's shared with you)

## Cache Issues: List Not Updating

If the AI shopping list is still showing old data:

1. Use the "Regenerate List" button to force a fresh list
2. If regenerating doesn't work, try these API calls:

```javascript
// Clear the cache for a specific menu
fetch(`/menu/${menuId}/ai-shopping-cache`, {
  method: 'DELETE',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`
  }
});

// Generate a new list with cache disabled
fetch(`/menu/${menuId}/ai-shopping-list`, {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('token')}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    menu_id: menuId,
    use_ai: true,
    use_cache: false
  })
});
```

## Testing the API

You can use the included test script to verify that the AI shopping list API is working correctly:

```bash
node test_shopping_list_api.js <your_auth_token> <menu_id>
```

## Common Issues and Fixes

### Issue: Missing healthy alternatives

If healthy alternatives aren't showing up:
- Make sure you're using the latest version of the ShoppingList component
- Check that the `healthyAlternatives` prop is being passed correctly
- Verify that the API response contains the `healthyAlternatives` array

### Issue: Shopping list not showing up at all

If the shopping list isn't displaying:
- Check browser console for errors
- Verify that the menu data is loading correctly
- Check if there's a permission issue with the menu

### Issue: AI generation seems to be using the same prompt repeatedly

If the AI isn't generating fresh content:
- Clear browser localStorage (may contain cached data)
- Regenerate the list with cache disabled
- Try using a different menu to generate a new list

## Using the Utility Functions

We've added a new utility file `shoppingListRegenerate.js` that contains functions for regenerating shopping lists:

```javascript
import { regenerateShoppingList } from '../utils/shoppingListRegenerate';

// Usage in a component
const handleRegenerateList = () => {
  regenerateShoppingList(
    selectedMenuId,
    setAiShoppingLoading,
    setAiShoppingData,
    setLoadingMessageIndex,
    showSnackbar,
    groceryList,
    pollForAiShoppingListStatus
  );
};
```

## Server-Side Improvements

We've made several improvements to the server-side processing:

1. Better error messages for permission issues
2. Improved cache handling to respect `use_cache=false` parameter
3. More consistent response format with healthy alternatives and shopping tips
4. Better handling of OpenAI API integration to ensure consistent format

If issues persist, please contact support with details of the specific problem you're experiencing.