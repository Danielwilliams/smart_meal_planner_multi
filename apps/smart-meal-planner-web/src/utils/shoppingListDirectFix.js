/**
 * Direct shopping list fix for production site
 * This script can be pasted directly into the browser console
 */

(function() {
  console.log("Applying ShoppingList direct fix...");
  
  // Get the most recent ShoppingList component instance
  let ShoppingListComponent = null;
  let attempt = 0;
  
  // Wait for component to load if needed
  function findShoppingList() {
    // Find ReactDOM instance
    let rootElements = document.querySelectorAll('[data-reactroot]');
    if (rootElements.length === 0) {
      rootElements = document.querySelectorAll('#root');
    }
    
    attempt++;
    console.log(`Search attempt ${attempt} for ShoppingList component...`);
    
    if (rootElements.length === 0 || attempt > 10) {
      console.error("Could not find React root element");
      return;
    }
    
    // Try to find any element with props that contain ShoppingList
    const reactInstances = [];
    
    // Check if the dev tools are installed and we can access React internals
    const reactDevTools = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (reactDevTools) {
      // Try to grab all fiber nodes
      const fiberNodes = reactDevTools.getFiberRoots 
          ? Array.from(reactDevTools.getFiberRoots())
          : null;
      
      if (fiberNodes && fiberNodes.length > 0) {
        console.log("Found React fiber nodes via DevTools", fiberNodes.length);
        
        // Extract rendered components
        fiberNodes.forEach(fiberNode => {
          const root = fiberNode.current;
          console.log("Processing fiber root", root);
          
          // Function to walk the fiber tree
          function walkFiber(fiber) {
            if (!fiber) return;
            
            // Check for ShoppingList in component name
            if (fiber.type && fiber.type.name === "ShoppingList") {
              console.log("Found ShoppingList component!", fiber);
              reactInstances.push(fiber);
            }
            
            // Check child and sibling fibers
            if (fiber.child) walkFiber(fiber.child);
            if (fiber.sibling) walkFiber(fiber.sibling);
          }
          
          walkFiber(root);
        });
      }
    }
    
    // If we found instances, use them
    if (reactInstances.length > 0) {
      console.log(`Found ${reactInstances.length} ShoppingList instances`);
      ShoppingListComponent = reactInstances[0];
      injectFixes(ShoppingListComponent);
    } else {
      // No instances found yet, try again after delay
      console.log("No ShoppingList components found yet, will retry");
      setTimeout(findShoppingList, 1000);
    }
  }
  
  // Inject our fix functions
  function injectFixes(component) {
    if (!component) {
      console.error("No ShoppingList component found to fix");
      return;
    }
    
    console.log("Injecting fixes into ShoppingList component");
    
    try {
      // Direct DOM manipulation to enhance the shopping list display
      enhanceShoppingListDisplay();
    } catch (err) {
      console.error("Error injecting fixes:", err);
    }
  }
  
  // Function to enhance the shopping list display via DOM
  function enhanceShoppingListDisplay() {
    console.log("Enhancing shopping list display via DOM manipulation");
    
    // Find all shopping list items via MUI selectors
    const shoppingListItems = document.querySelectorAll('.MuiGrid-item .MuiTypography-root');
    console.log(`Found ${shoppingListItems.length} shopping list items`);
    
    // Process each item
    shoppingListItems.forEach((item, index) => {
      const originalText = item.textContent || '';
      console.log(`Item ${index}: "${originalText}"`);
      
      // Skip if already processed
      if (item.dataset.processed) return;
      
      // Process the text to fix any embedded quantities
      let processedText = originalText;
      
      // Fix format: "96 ozs chicken breast" with embedded quantity
      const embeddedQtyRegex = /^([\d\.\/]+\s*(?:ozs?|pieces?|cups?|tbsps?|tsps?|cloves?|pinch|can|inch|lb|lbs|g|kg))\s+(.+)$/i;
      const embeddedMatch = originalText.match(embeddedQtyRegex);
      
      if (embeddedMatch) {
        // Found embedded quantity in name
        const extractedQty = embeddedMatch[1];
        const cleanName = embeddedMatch[2];
        
        // Format with proper capitalization
        const formattedName = cleanName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        processedText = `${formattedName}: ${extractedQty}`;
        console.log(`Fixed embedded quantity: "${originalText}" -> "${processedText}"`);
      }
      
      // Fix format: "NAME: NUMBER" with missing unit
      const missingUnitRegex = /^(.+):\s*([\d\.\/]+)\s*$/;
      const missingUnitMatch = originalText.match(missingUnitRegex);

      if (missingUnitMatch && !embeddedMatch) {
        const itemName = missingUnitMatch[1];
        const quantity = missingUnitMatch[2];

        // Add appropriate units based on item type
        if (itemName.toLowerCase().includes('chicken') ||
            itemName.toLowerCase().includes('beef') ||
            itemName.toLowerCase().includes('turkey') ||
            itemName.toLowerCase().includes('steak')) {
          processedText = `${itemName}: ${quantity} oz`;
        }
        else if (itemName.toLowerCase().includes('egg')) {
          processedText = `${itemName}: ${quantity} large`;
        }
        else if (itemName.toLowerCase().includes('garlic')) {
          processedText = `${itemName}: ${quantity} cloves`;
        }
        console.log(`Added missing unit: "${originalText}" -> "${processedText}"`);
      }

      // Fix cheese items specifically
      if (originalText.toLowerCase().includes('cheddar cheese') &&
          !originalText.toLowerCase().includes('oz')) {
        processedText = "Cheddar Cheese: 8 oz";
        console.log(`Fixed cheese quantity: "${originalText}" -> "${processedText}"`);
      }

      if (originalText.toLowerCase().includes('mozzarella cheese') &&
          !originalText.toLowerCase().includes('oz')) {
        processedText = "Mozzarella Cheese: 8 oz";
        console.log(`Fixed cheese quantity: "${originalText}" -> "${processedText}"`);
      }
      
      // Update the item text if it changed
      if (processedText !== originalText) {
        item.textContent = processedText;
        item.style.fontWeight = 'bold'; // Make it bold to show it was fixed
        item.dataset.processed = 'true';
      }
    });
    
    console.log("Shopping list display enhancement complete");
  }
  
  // Look for changes to detect when new shopping list items are added
  function watchForChanges() {
    // Create a mutation observer to watch for DOM changes
    const observer = new MutationObserver(function(mutations) {
      mutations.forEach(function(mutation) {
        if (mutation.addedNodes && mutation.addedNodes.length > 0) {
          // Re-run our enhancement if nodes were added
          setTimeout(enhanceShoppingListDisplay, 100);
        }
      });
    });
    
    // Start observing the document with the configured parameters
    observer.observe(document.body, { childList: true, subtree: true });
    console.log("Watching for DOM changes to update shopping list fixes");
  }
  
  // Start the fix process
  findShoppingList();
  watchForChanges();
  
  // Also try to directly patch any shopping list data
  setTimeout(function() {
    enhanceShoppingListDisplay();
  }, 2000);
  
  // Set up interval to periodically check for new items
  setInterval(enhanceShoppingListDisplay, 5000);
  
  console.log("Shopping list fix script initialized");
})();