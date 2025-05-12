/**
 * Production Test Script
 * 
 * Copy and paste this script into your browser console when viewing the
 * shopping list page in production to diagnose and fix display issues.
 */

(function() {
  console.log("=== Smart Meal Planner Shopping List Diagnostic ===");
  
  // 1. Look for shopping list items and log them
  const shoppingListItems = document.querySelectorAll('.MuiGrid-item .MuiTypography-root');
  console.log(`Found ${shoppingListItems.length} shopping list items`);
  
  // 2. Check API data from debug variables
  if (window.lastGroceryListResponse) {
    console.log("Raw API data captured:", window.lastGroceryListResponse);
    
    // Check format of the data
    const firstFewItems = Array.isArray(window.lastGroceryListResponse) ?
      window.lastGroceryListResponse.slice(0, 5) :
      (window.lastGroceryListResponse.groceryList ?
        window.lastGroceryListResponse.groceryList.slice(0, 5) :
        "Unknown format");
    
    console.log("First few items:", firstFewItems);
  } else {
    console.log("No lastGroceryListResponse debug variable found");
  }
  
  // 3. Extract any React props that might help diagnose
  let reactProps = [];
  try {
    // Try to find React Fiber nodes
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (hook) {
      const roots = hook.getFiberRoots ? Array.from(hook.getFiberRoots()) : null;
      if (roots && roots.length > 0) {
        console.log("Found React fiber roots:", roots.length);
        
        // Function to walk the fiber tree looking for ShoppingList
        function walkFiber(fiber, path = []) {
          if (!fiber) return;
          
          // Check if this might be a ShoppingList component
          let componentName = '';
          if (fiber.type) {
            componentName = fiber.type.name || 
                         (fiber.type.displayName) ||
                         (typeof fiber.type === 'string' ? fiber.type : '');
          }
          
          // If it's a ShoppingList, extract props
          if (componentName.includes('ShoppingList')) {
            console.log("Found ShoppingList component:", fiber);
            const props = fiber.memoizedProps || {};
            reactProps.push({
              component: componentName,
              path: [...path, componentName].join(' > '),
              props
            });
          }
          
          // Continue walking
          if (fiber.child) walkFiber(fiber.child, [...path, componentName]);
          if (fiber.sibling) walkFiber(fiber.sibling, path);
        }
        
        // Start walking from each root
        roots.forEach(root => walkFiber(root.current));
      }
    }
  } catch (err) {
    console.error("Error extracting React props:", err);
  }
  
  console.log("Extracted React props:", reactProps);
  
  // 4. Apply fixes to current DOM elements
  console.log("Applying fixes to DOM elements...");
  
  let fixedCount = 0;
  shoppingListItems.forEach((item, index) => {
    const originalText = item.textContent || '';
    
    // Skip already processed items
    if (item.dataset.fixed) return;
    
    // Apply our regex match to extract quantity
    const embeddedQtyRegex = /^([\d\.\/]+\s*(?:ozs?|pieces?|cups?|tbsps?|tsps?|cloves?|pinch|can|inch|lb|lbs|g|kg))\s+(.+)$/i;
    const match = originalText.match(embeddedQtyRegex);
    
    if (match) {
      // Found embedded quantity in name
      const extractedQty = match[1];
      const cleanName = match[2];
      
      // Format with proper capitalization
      const formattedName = cleanName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      const newText = `${formattedName}: ${extractedQty}`;
      
      // Update the text
      item.textContent = newText;
      item.style.fontWeight = 'bold'; // Make it stand out
      item.dataset.fixed = 'true';
      fixedCount++;
      
      console.log(`Fixed item ${index}:`, { 
        original: originalText, 
        fixed: newText 
      });
    }
  });
  
  console.log(`Fixed ${fixedCount} items out of ${shoppingListItems.length} total`);
  console.log("=== Diagnostic Complete ===");
  
  return {
    fixedCount,
    totalItems: shoppingListItems.length,
    reactProps
  };
})();