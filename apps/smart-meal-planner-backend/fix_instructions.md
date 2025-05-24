# Shopping List Fix Instructions

There are two issues that need to be fixed in the ShoppingListPage.jsx:

1. The "AI shopping list ready!" snackbar notification is looping/repeating
2. Shopping list items don't show quantities

## Current Status

The file appears to be missing the "else if" block for error handling between the "completed" and the "not_found" conditions. This is likely causing the issues.

## Fix Instructions

1. Open the file `/mnt/c/Users/Daniel/OneDrive - City of Loveland/Documents/Smart Meal Planner/smart_meal_planner_multi/apps/smart-meal-planner-web/src/pages/ShoppingListPage.jsx`

2. Find the `checkAiShoppingListStatus` function (around line 608)

3. Look for the if-blocks that handle different status values (around line 629)

4. We need to ensure the error handling block is present between the "completed" and "not_found" blocks. Make sure the code has this structure:

```javascript
// Check if processing is complete
if (statusResponse.status === "completed") {
  console.log("AI shopping list processing completed!");

  // Stop the polling
  clearStatusPolling();

  // Format and normalize all items to ensure quantities are shown
  if (statusResponse.groceryList && Array.isArray(statusResponse.groceryList)) {
    statusResponse.groceryList.forEach(category => {
      if (category.items && Array.isArray(category.items)) {
        category.items = category.items.map(item => {
          // If item is just a string, convert to object with name
          if (typeof item === "string") {
            return { 
              name: item,
              quantity: "1",
              unit: "",
              display_name: `${item}: 1`
            };
          }
          // If item is object but missing quantity/unit, add them
          else if (typeof item === "object") {
            // Ensure name exists
            const name = item.name || "Unknown item";
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
  
  // Update state with the completed data
  setAiShoppingData(statusResponse);
  setAiShoppingLoading(false);
  
  // Show notification only on first couple of polls to prevent looping
  if (pollCount <= 2) {
    setSnackbarMessage("AI shopping list ready!");
    setSnackbarOpen(true);
  }
  
  // Cache the results
  setCachedShoppingList(menuId, statusResponse);
}
// Handle error state
else if (statusResponse.status === "error") {
  console.warn("AI processing resulted in error:", statusResponse.message || "Unknown error");

  // Stop the polling
  clearStatusPolling();

  // Show error message
  setSnackbarMessage(`AI processing error: ${statusResponse.message || "Unknown error"}`);
  setSnackbarOpen(true);

  // Still update the data with what we got (might contain fallback data)
  setAiShoppingData(statusResponse);
  setAiShoppingLoading(false);
}
// Handle "not found" status (processing hasn't started or cache expired)
else if (statusResponse.status === "not_found" || statusResponse.status === "expired") {
  console.warn("AI processing status not found or expired");
  
  // Stop polling as there's nothing to poll for
  clearStatusPolling();
  
  // Notify user
  setSnackbarMessage("AI processing not found. Please try again.");
  setSnackbarOpen(true);
  setAiShoppingLoading(false);
}
```

5. Additionally, make sure the `apiService.js` file has proper handling to ensure all items have quantities. The relevant code is already in the `generateAiShoppingList` function.

## What These Fixes Do

1. The `if (pollCount <= 2)` condition prevents showing the notification repeatedly
2. The item formatting ensures all items have proper name, quantity, unit, and display_name properties
3. The proper error handling ensures we don't get stuck in error states

The issues should be resolved after these fixes.