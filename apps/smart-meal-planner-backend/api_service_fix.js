// This file contains the necessary changes to the apiService.js file
// to ensure all shopping list items have quantities

// Find the generateAiShoppingList function in the apiService.js file
// Look for the section where we process the response data before returning it
// Add this code right before the "return responseData" line:

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

// Also make sure the getAiShoppingListStatus function is properly implemented
// with similar logic to process the response data

// Add this code to the getAiShoppingListStatus function before returning responseData:

// Ensure all grocery list items have quantity and display_name
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