/**
 * Test Script for AI Shopping List API
 * 
 * This script tests the AI Shopping List API to ensure it correctly:
 * 1. Generates a shopping list
 * 2. Clears the cache when requested
 * 3. Returns properly formatted data
 * 
 * Usage:
 * node test_shopping_list_api.js <user_token> <menu_id>
 */

const fetch = require('node-fetch');

// Configuration
const API_BASE_URL = 'https://smartmealplannermulti-production.up.railway.app';
const TOKEN = process.argv[2]; // Get token from command line
const MENU_ID = process.argv[3] || '1'; // Get menu ID from command line or default to 1

if (!TOKEN) {
  console.error('Please provide your authentication token as the first argument');
  console.log('Usage: node test_shopping_list_api.js <user_token> <menu_id>');
  process.exit(1);
}

console.log(`Testing AI Shopping List API for menu ID: ${MENU_ID}`);

// Helper function to make API requests
async function makeRequest(endpoint, method = 'GET', body = null) {
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json'
  };

  const options = {
    method,
    headers
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  try {
    console.log(`Making ${method} request to: ${endpoint}`);
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API error (${response.status}): ${errorText}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Request failed:', error.message);
    throw error;
  }
}

// Main test function
async function runTests() {
  try {
    console.log('1. Testing basic menu fetch...');
    const menuDetails = await makeRequest(`/menu/${MENU_ID}`);
    console.log(`✓ Menu successfully retrieved (ID: ${menuDetails.menu_id})`);
    
    console.log('\n2. Testing cache clearing...');
    try {
      await makeRequest(`/menu/${MENU_ID}/ai-shopping-cache`, 'DELETE');
      console.log('✓ Cache successfully cleared');
    } catch (error) {
      console.log('✗ Cache clearing failed (this might be ok if endpoint not implemented)');
    }
    
    console.log('\n3. Testing AI shopping list generation with cache disabled...');
    const aiShoppingList = await makeRequest(`/menu/${MENU_ID}/ai-shopping-list`, 'POST', {
      menu_id: parseInt(MENU_ID),
      use_ai: true,
      use_cache: false
    });
    
    console.log('✓ AI shopping list request accepted');
    
    // Check if we got a processing status or immediate result
    if (aiShoppingList.status === 'processing') {
      console.log('AI shopping list is being processed asynchronously...');
      console.log('Polling for status...');
      
      // Simple polling for demonstration purposes
      let complete = false;
      let attempts = 0;
      let finalResult = null;
      
      while (!complete && attempts < 10) {
        attempts++;
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        try {
          const status = await makeRequest(`/menu/${MENU_ID}/ai-shopping-list/status`);
          console.log(`Poll attempt ${attempts}: Status = ${status.status}`);
          
          if (status.status === 'completed') {
            complete = true;
            finalResult = status;
          }
        } catch (error) {
          console.log(`Poll attempt ${attempts} failed:`, error.message);
        }
      }
      
      if (complete && finalResult) {
        analyzeResult(finalResult);
      } else {
        console.log('⚠ Polling timed out without getting a completed result');
      }
    } else {
      console.log('✓ Received immediate result from AI shopping list');
      analyzeResult(aiShoppingList);
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

// Helper function to analyze the AI shopping list result
function analyzeResult(result) {
  console.log('\n4. Analyzing AI shopping list result...');
  
  // Check basic structure
  if (!result.groceryList || !Array.isArray(result.groceryList)) {
    console.log('✗ Missing or invalid groceryList property');
    return;
  }
  
  console.log(`✓ Response has ${result.groceryList.length} categories`);
  
  // Check for recommendations
  if (result.recommendations && Array.isArray(result.recommendations)) {
    console.log(`✓ Found ${result.recommendations.length} recommendations`);
  } else {
    console.log('⚠ Missing recommendations');
  }
  
  // Check for nutrition tips
  if (result.nutritionTips && Array.isArray(result.nutritionTips)) {
    console.log(`✓ Found ${result.nutritionTips.length} nutrition tips`);
  } else {
    console.log('⚠ Missing nutrition tips');
  }
  
  // Check for healthy alternatives
  if (result.healthyAlternatives && Array.isArray(result.healthyAlternatives)) {
    console.log(`✓ Found ${result.healthyAlternatives.length} healthy alternatives`);
    
    // Check structure of first alternative
    if (result.healthyAlternatives.length > 0) {
      const firstAlt = result.healthyAlternatives[0];
      if (firstAlt.original && firstAlt.alternative && firstAlt.benefit) {
        console.log('✓ Healthy alternatives have correct structure');
      } else {
        console.log('✗ Healthy alternatives have incorrect structure');
      }
    }
  } else {
    console.log('⚠ Missing healthyAlternatives');
  }
  
  // Check for shopping tips
  if (result.shoppingTips && Array.isArray(result.shoppingTips)) {
    console.log(`✓ Found ${result.shoppingTips.length} shopping tips`);
  } else {
    console.log('⚠ Missing shoppingTips');
  }
  
  // Check first category and item format
  if (result.groceryList.length > 0) {
    const firstCategory = result.groceryList[0];
    console.log(`✓ First category: "${firstCategory.category}"`);
    
    if (firstCategory.items && Array.isArray(firstCategory.items) && firstCategory.items.length > 0) {
      const firstItem = firstCategory.items[0];
      console.log(`✓ First item: ${JSON.stringify(firstItem)}`);
      
      // Check item structure
      if (firstItem.name && firstItem.quantity !== undefined && firstItem.unit !== undefined) {
        console.log('✓ Items have correct structure (name, quantity, unit)');
        
        // Check display_name format
        if (firstItem.display_name) {
          console.log(`✓ Item has display_name: "${firstItem.display_name}"`);
          
          // Check if display_name follows "Item: Quantity-Unit" format
          const formatRegex = /^.+:\s*[\d.]+\-[a-zA-Z]+$/;
          if (formatRegex.test(firstItem.display_name)) {
            console.log('✓ display_name follows "Item: Quantity-Unit" format');
          } else {
            console.log(`✗ display_name does not follow "Item: Quantity-Unit" format`);
          }
        } else {
          console.log('⚠ Items missing display_name property');
        }
      } else {
        console.log('✗ Items have incorrect structure');
      }
    } else {
      console.log('✗ First category has no items');
    }
  }
  
  console.log('\nTesting Complete!');
}

// Run the tests
runTests().catch(console.error);