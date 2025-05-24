/**
 * Shopping List Testing Utility
 * 
 * This script can be executed in the browser console to test the ShoppingList component
 * with various data formats to ensure proper display of quantities.
 */

// Sample data in the format returned by the API
const sampleItems = [
  {
    name: "96 ozs chicken breast",
    quantity: "1",
    unit: ""
  },
  {
    name: "2 cups rice",
    quantity: "1",
    unit: ""
  },
  {
    name: "1/2 cup olive oil",
    quantity: "1",
    unit: ""
  },
  {
    name: "5 cloves garlic",
    quantity: "1",
    unit: ""
  },
  {
    name: "bell pepper",
    quantity: "3",
    unit: ""
  },
  {
    name: "salt",
    quantity: "1",
    unit: "tsp"
  },
  {
    name: "Black Pepper: 1 tsp",
    quantity: "1",
    unit: ""
  }
];

// Function to test the regex extraction manually
function testQuantityExtraction(items) {
  console.log("Testing quantity extraction from item names:");
  
  items.forEach((item, index) => {
    if (!item || !item.name) return;
    
    const nameStr = item.name;
    console.log(`\nTesting item ${index}: "${nameStr}"`);
    
    // Test regex extraction
    const qtyRegex = /^([\d\.\/]+\s*(?:ozs?|pieces?|cups?|tbsps?|tsps?|cloves?|pinch|can|inch|lb|lbs|g|kg))\s+(.+)$/i;
    const match = nameStr.match(qtyRegex);
    
    if (match) {
      const extractedQty = match[1];
      const cleanName = match[2];
      
      // Capitalize first letter of each word in name
      const formattedName = cleanName
        .split(' ')
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
      
      console.log("✅ Quantity extracted successfully");
      console.log(`   Original: "${nameStr}"`);
      console.log(`   Quantity: "${extractedQty}"`);
      console.log(`   Clean name: "${cleanName}"`);
      console.log(`   Formatted: "${formattedName}"`);
      console.log(`   Final display: "${formattedName}: ${extractedQty}"`);
    } else {
      console.log("❌ No embedded quantity detected");
      
      // Check if it has a colon format like "Item: Quantity"
      if (nameStr.includes(':')) {
        console.log("   This item already has a colon format");
      }
      // Check if it has a separate quantity field that's meaningful
      else if (item.quantity && item.quantity !== '1') {
        console.log(`   Using quantity field: ${item.quantity}${item.unit ? ' ' + item.unit : ''}`);
      } else {
        console.log("   No special formatting needed");
      }
    }
  });
}

// Function to simulate rendering with our fix
function simulateRendering(items) {
  console.log("\nSimulating ShoppingList rendering:");
  
  items.forEach((item, index) => {
    if (!item) return;
    
    console.log(`\nItem ${index}:`);
    console.log("Input:", item);
    
    // Process the item
    let displayText = "";
    
    if (typeof item === 'object' && item.name) {
      // First check for embedded quantity
      const nameStr = item.name;
      const qtyRegex = /^([\d\.\/]+\s*(?:ozs?|pieces?|cups?|tbsps?|tsps?|cloves?|pinch|can|inch|lb|lbs|g|kg))\s+(.+)$/i;
      const match = nameStr.match(qtyRegex);
      
      if (match) {
        // Found embedded quantity in name
        const extractedQty = match[1];
        const cleanName = match[2];
        
        // Capitalize first letter of each word in name
        const formattedName = cleanName
          .split(' ')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        
        displayText = `${formattedName}: ${extractedQty}`;
      }
      // Check if already in colon format
      else if (nameStr.includes(':')) {
        displayText = nameStr;
      }
      // Use separate quantity if meaningful
      else if (item.quantity && item.quantity !== '1') {
        displayText = `${item.name}: ${item.quantity}${item.unit ? ' ' + item.unit : ''}`;
      }
      // Default to just the name
      else {
        displayText = item.name;
      }
    } else if (typeof item === 'string') {
      displayText = item;
    } else {
      displayText = "Unknown Item";
    }
    
    console.log("Output display:", displayText);
  });
}

// Run the tests
console.log("===== SHOPPING LIST DISPLAY TEST =====");
testQuantityExtraction(sampleItems);
simulateRendering(sampleItems);
console.log("===== TEST COMPLETE =====");

// Export the test functions for use in console
window.testShoppingList = {
  testQuantityExtraction,
  simulateRendering,
  sampleItems
};

console.log("Test functions available at window.testShoppingList");