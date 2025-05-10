// Fix for the shopping list issues
// 1. Fix the looping snackbar notification
// 2. Ensure quantities are properly displayed on items

// Changes needed:

// 1. First add the quantity formatting code at the top of checkAiShoppingListStatus function
// This code should run when we get a "completed" status response before updating the UI

// In ShoppingListPage.jsx, find this section in checkAiShoppingListStatus:
// if (statusResponse.status === "completed") {
//   console.log("AI shopping list processing completed!");
//   clearStatusPolling();
//   ...

// Before updating the state with setAiShoppingData, add this code to format the items:

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

// 2. Then, fix the snackbar looping by limiting when we show the notification
// Change:
// setSnackbarMessage("AI shopping list ready!");
// setSnackbarOpen(true);

// To:
// Show notification only on first few attempts
if (pollCount <= 2) {
  setSnackbarMessage("AI shopping list ready!");
  setSnackbarOpen(true);
}