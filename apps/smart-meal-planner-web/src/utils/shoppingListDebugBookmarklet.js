javascript:(function() {
  // Create debugging UI
  const debugContainer = document.createElement('div');
  debugContainer.style.position = 'fixed';
  debugContainer.style.top = '10px';
  debugContainer.style.right = '10px';
  debugContainer.style.width = '400px';
  debugContainer.style.maxHeight = '90vh';
  debugContainer.style.overflowY = 'auto';
  debugContainer.style.backgroundColor = 'white';
  debugContainer.style.border = '2px solid red';
  debugContainer.style.borderRadius = '5px';
  debugContainer.style.padding = '10px';
  debugContainer.style.zIndex = '9999';
  debugContainer.style.boxShadow = '0 0 10px rgba(0,0,0,0.5)';
  debugContainer.style.fontFamily = 'monospace';
  
  // Add title
  const title = document.createElement('h3');
  title.textContent = 'Shopping List Debug';
  title.style.marginTop = '0';
  title.style.color = 'red';
  debugContainer.appendChild(title);
  
  // Add close button
  const closeButton = document.createElement('button');
  closeButton.textContent = 'X';
  closeButton.style.position = 'absolute';
  closeButton.style.top = '5px';
  closeButton.style.right = '5px';
  closeButton.style.backgroundColor = 'red';
  closeButton.style.color = 'white';
  closeButton.style.border = 'none';
  closeButton.style.borderRadius = '50%';
  closeButton.style.width = '25px';
  closeButton.style.height = '25px';
  closeButton.style.cursor = 'pointer';
  closeButton.addEventListener('click', () => debugContainer.remove());
  debugContainer.appendChild(closeButton);
  
  // Add content section
  const content = document.createElement('div');
  content.style.marginTop = '20px';
  debugContainer.appendChild(content);
  
  // Find shopping list component state in React
  let groceryList = null;
  let foundComponents = [];
  
  // Extract React fiber root
  const reactInstance = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
  if (reactInstance) {
    try {
      // Try to get React fiber roots
      const fiberRoots = reactInstance.getFiberRoots ? Array.from(reactInstance.getFiberRoots()) : null;
      
      if (fiberRoots && fiberRoots.length > 0) {
        content.innerHTML += `<p>✅ Found React fiber roots: ${fiberRoots.length}</p>`;
        
        // Search through fiber tree for ShoppingList components
        fiberRoots.forEach(fiberRoot => {
          const root = fiberRoot.current;
          
          // Function to walk the fiber tree looking for ShoppingList component
          function walkFiber(fiber) {
            if (!fiber) return;
            
            // Check component name
            const componentName = fiber.type && fiber.type.name;
            
            // Check for ShoppingList component
            if (componentName === 'ShoppingList') {
              content.innerHTML += `<p>✅ Found ShoppingList component</p>`;
              foundComponents.push(fiber);
              
              // Try to access the state
              if (fiber.memoizedProps && fiber.memoizedProps.categories) {
                groceryList = fiber.memoizedProps.categories;
                content.innerHTML += `<p>✅ Found categories prop</p>`;
              }
            }
            
            // Check for any component that might have "grocery" or "shopping" in its name
            if (componentName && (componentName.toLowerCase().includes('grocery') || 
                                 componentName.toLowerCase().includes('shopping'))) {
              content.innerHTML += `<p>🔍 Found related component: ${componentName}</p>`;
              foundComponents.push(fiber);
            }
            
            // Check child and sibling fibers
            if (fiber.child) walkFiber(fiber.child);
            if (fiber.sibling) walkFiber(fiber.sibling);
          }
          
          walkFiber(root);
        });
      } else {
        content.innerHTML += `<p>❌ No fiber roots found</p>`;
      }
    } catch (err) {
      content.innerHTML += `<p>❌ Error exploring React tree: ${err.message}</p>`;
    }
  } else {
    content.innerHTML += `<p>❌ React devtools hook not found</p>`;
  }
  
  // Add section for global inspection
  content.innerHTML += `<h4>Global Data</h4>`;
  
  // Check if we have menu data in localStorage
  try {
    const cachedMenu = localStorage.getItem('debug_menu_data');
    if (cachedMenu) {
      content.innerHTML += `<p>✅ Found cached menu in localStorage</p>`;
      
      // Add button to view localStorage data
      const viewCacheButton = document.createElement('button');
      viewCacheButton.textContent = 'View Cached Menu';
      viewCacheButton.style.padding = '5px 10px';
      viewCacheButton.style.margin = '5px 0';
      viewCacheButton.style.backgroundColor = '#007BFF';
      viewCacheButton.style.color = 'white';
      viewCacheButton.style.border = 'none';
      viewCacheButton.style.borderRadius = '3px';
      viewCacheButton.style.cursor = 'pointer';
      viewCacheButton.addEventListener('click', () => {
        try {
          const menuData = JSON.parse(cachedMenu);
          const output = document.createElement('pre');
          output.textContent = JSON.stringify(menuData, null, 2);
          output.style.maxHeight = '300px';
          output.style.overflowY = 'auto';
          output.style.backgroundColor = '#f5f5f5';
          output.style.padding = '10px';
          output.style.border = '1px solid #ddd';
          output.style.borderRadius = '3px';
          output.style.fontSize = '12px';
          
          // Clear previous output and append new one
          const existingOutput = document.getElementById('menu-output');
          if (existingOutput) existingOutput.remove();
          
          output.id = 'menu-output';
          content.appendChild(output);
        } catch (err) {
          alert(`Error parsing cached menu: ${err.message}`);
        }
      });
      content.appendChild(viewCacheButton);
    } else {
      content.innerHTML += `<p>❌ No cached menu found in localStorage</p>`;
    }
  } catch (err) {
    content.innerHTML += `<p>❌ Error checking localStorage: ${err.message}</p>`;
  }
  
  // Function to inspect global variables
  function inspectGlobal() {
    // Look for grocery list or menu-related variables in window
    let foundData = false;
    
    for (const key in window) {
      if (typeof window[key] === 'object' && window[key] !== null) {
        // Check for likely variable names
        if (key.toLowerCase().includes('grocery') || 
            key.toLowerCase().includes('shop') || 
            key.toLowerCase().includes('menu') || 
            key.toLowerCase().includes('list')) {
          
          content.innerHTML += `<p>🔍 Found global variable: ${key}</p>`;
          foundData = true;
          
          // Add button to view this data
          const viewButton = document.createElement('button');
          viewButton.textContent = `View ${key}`;
          viewButton.style.padding = '5px 10px';
          viewButton.style.margin = '5px 0';
          viewButton.style.backgroundColor = '#007BFF';
          viewButton.style.color = 'white';
          viewButton.style.border = 'none';
          viewButton.style.borderRadius = '3px';
          viewButton.style.cursor = 'pointer';
          viewButton.addEventListener('click', () => {
            try {
              const output = document.createElement('pre');
              output.textContent = JSON.stringify(window[key], null, 2);
              output.style.maxHeight = '300px';
              output.style.overflowY = 'auto';
              output.style.backgroundColor = '#f5f5f5';
              output.style.padding = '10px';
              output.style.border = '1px solid #ddd';
              output.style.borderRadius = '3px';
              output.style.fontSize = '12px';
              
              // Clear previous output and append new one
              const existingOutput = document.getElementById('global-output');
              if (existingOutput) existingOutput.remove();
              
              output.id = 'global-output';
              content.appendChild(output);
            } catch (err) {
              alert(`Error displaying ${key}: ${err.message}`);
            }
          });
          content.appendChild(viewButton);
        }
      }
    }
    
    if (!foundData) {
      content.innerHTML += `<p>❌ No relevant global variables found</p>`;
    }
  }
  
  // Add button to inspect globals
  const inspectButton = document.createElement('button');
  inspectButton.textContent = 'Scan Global Variables';
  inspectButton.style.padding = '5px 10px';
  inspectButton.style.backgroundColor = '#28a745';
  inspectButton.style.color = 'white';
  inspectButton.style.border = 'none';
  inspectButton.style.borderRadius = '3px';
  inspectButton.style.cursor = 'pointer';
  inspectButton.addEventListener('click', inspectGlobal);
  content.appendChild(inspectButton);
  
  // Output shopping list data if found
  if (groceryList) {
    const listOutput = document.createElement('pre');
    listOutput.textContent = JSON.stringify(groceryList, null, 2);
    listOutput.style.maxHeight = '300px';
    listOutput.style.overflowY = 'auto';
    listOutput.style.backgroundColor = '#f5f5f5';
    listOutput.style.padding = '10px';
    listOutput.style.border = '1px solid #ddd';
    listOutput.style.borderRadius = '3px';
    listOutput.style.fontSize = '12px';
    listOutput.style.marginTop = '10px';
    content.appendChild(listOutput);
  } else {
    content.innerHTML += `<p>❌ Could not extract shopping list data from React</p>`;
  }
  
  // Add utility functions
  content.innerHTML += `<h4>Utilities</h4>`;
  
  // Add function to save current menu to localStorage
  const captureMenu = document.createElement('button');
  captureMenu.textContent = 'Capture Current Menu Data';
  captureMenu.style.padding = '5px 10px';
  captureMenu.style.backgroundColor = '#6c757d';
  captureMenu.style.color = 'white';
  captureMenu.style.border = 'none';
  captureMenu.style.borderRadius = '3px';
  captureMenu.style.cursor = 'pointer';
  captureMenu.style.marginRight = '5px';
  captureMenu.addEventListener('click', () => {
    try {
      // Find JSON script tags that might contain menu data
      const scripts = document.querySelectorAll('script[type="application/json"]');
      let foundMenuData = false;
      
      scripts.forEach(script => {
        try {
          const data = JSON.parse(script.textContent);
          if (data && (data.days || data.meals || data.ingredients)) {
            localStorage.setItem('debug_menu_data', JSON.stringify(data));
            foundMenuData = true;
            alert('Menu data captured and saved to localStorage!');
          }
        } catch (e) {
          // Ignore parsing errors
        }
      });
      
      if (!foundMenuData) {
        alert('Could not find menu data in the page. Try looking at the Network tab in DevTools for API responses.');
      }
    } catch (err) {
      alert(`Error capturing menu data: ${err.message}`);
    }
  });
  content.appendChild(captureMenu);
  
  // Add the container to the document
  document.body.appendChild(debugContainer);
  
  // Log to console as well
  console.log('Shopping List Debug Bookmarklet activated');
  if (groceryList) {
    console.log('Shopping List Data:', groceryList);
  }
  if (foundComponents.length > 0) {
    console.log('Found Components:', foundComponents);
  }
})();