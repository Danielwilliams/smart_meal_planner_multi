// This file contains code changes that need to be made to fix the polling and quantities issues

// ISSUE 1: Snackbar Notification Looping
// In ShoppingListPage.jsx, modify the checkAiShoppingListStatus function where we show the "AI shopping list ready!" notification
// Change:
/*
// Show notification
setSnackbarMessage("AI shopping list ready!");
setSnackbarOpen(true);
*/
// To:
/*
// Show notification only on first completion
if (pollCount <= 2) {
  setSnackbarMessage("AI shopping list ready!");
  setSnackbarOpen(true);
}
*/

// ISSUE 2: Missing Quantities on Items
// Before updating state with the completed data, add this code to format all items
/*
// Format and normalize all items to ensure quantities are shown
if (statusResponse.groceryList && Array.isArray(statusResponse.groceryList)) {
  statusResponse.groceryList.forEach(category => {
    if (category.items && Array.isArray(category.items)) {
      category.items = category.items.map(item => {
        // If item is just a string, convert to object with name
        if (typeof item === 'string') {
          return { 
            name: item,
            quantity: "1",
            unit: "",
            display_name: `${item}: 1`
          };
        }
        // If item is object but missing quantity/unit, add them
        else if (typeof item === 'object') {
          // Ensure name exists
          const name = item.name || 'Unknown item';
          // Ensure quantity exists
          const quantity = item.quantity || "1";
          // Ensure unit exists
          const unit = item.unit || "";
          // Create or update display_name
          const display_name = `${name}: ${quantity} ${unit}`.trim();
          
          return {
            ...item,
            name,
            quantity,
            unit,
            display_name
          };
        }
        return item;
      });
    }
  });
}
*/

// We also need to update apiService.js in the generateAiShoppingList function
// to process and format all items in the API response to ensure quantities are shown.
// Add this logic before returning the response data:
/*
// Process all grocery list items to ensure they have quantity and display_name
if (responseData.groceryList && Array.isArray(responseData.groceryList)) {
  responseData.groceryList.forEach(category => {
    if (category.items && Array.isArray(category.items)) {
      category.items = category.items.map(item => {
        // Handle string items
        if (typeof item === 'string') {
          return {
            name: item,
            quantity: "1",
            unit: "",
            display_name: `${item}: 1`
          };
        }
        // Handle object items with missing fields
        else if (typeof item === 'object') {
          const name = item.name || "Unknown item";
          const quantity = item.quantity || "1";
          const unit = item.unit || "";
          const display_name = `${name}: ${quantity} ${unit}`.trim();
          
          return {
            ...item,
            name,
            quantity,
            unit,
            display_name
          };
        }
        return item;
      });
    }
  });
}
*/