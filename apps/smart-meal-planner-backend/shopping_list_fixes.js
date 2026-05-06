// Shopping List Component Fixes
// This file contains the necessary fixes for two issues:
// 1. Looping "AI shopping list ready" snackbar notification
// 2. Missing quantities on shopping list items

// ISSUE: The ShoppingListPage.jsx file has a corrupted if-block for handling completed status
// SOLUTION: Add a properly formatted code block for handling completed status

// The corrupted code in checkAiShoppingListStatus function has this structure:
// if (statusResponse.status === "completed") {
//   console.log("AI shopping list processing completed!");
//   clearStatusPolling();
//   ...
//   // Format and normalize all items... (malformed code insertion)
//   ...
// }

// Replace the entire if-block for statusResponse.status === "completed" with:

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

// Also fix the handleError section which may be missing:

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

// INSTRUCTIONS:
// 1. In ShoppingListPage.jsx, find the checkAiShoppingListStatus function
// 2. Replace the entire if-block for handling "completed" status with the code above
// 3. Make sure the "else if" for error handling follows immediately after