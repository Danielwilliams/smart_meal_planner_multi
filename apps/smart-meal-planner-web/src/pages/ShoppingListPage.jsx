import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation, useParams, useSearchParams } from 'react-router-dom';
import { 
  Container, 
  Typography, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Box, 
  Paper, 
  Grid,
  Button,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import CATEGORY_MAPPING from '../data/categoryMapping';
import ShoppingList from '../components/ShoppingList';

function ShoppingListPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { menuId: urlMenuId } = useParams(); // Get menuId from URL path
  const [searchParams] = useSearchParams(); // Get query parameters
  
  // Check for menuId in various places
  const queryMenuId = searchParams.get('menuId');
  const isClientSourced = searchParams.get('source') === 'client';
  
  // State management
  const [groceryList, setGroceryList] = useState([]);
  const [menuHistory, setMenuHistory] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState(urlMenuId || queryMenuId || null);
  const [selectedStore, setSelectedStore] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeSearchResults, setStoreSearchResults] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Debug log
  console.log("ShoppingListPage params:", { 
    urlMenuId, 
    queryMenuId, 
    selectedMenuId, 
    isClientSourced 
  });

  // Check for new user flow from navigation state
  const { isNewUser, showWalkthrough } = location.state || {};

  // Fetch shopping list data
 const fetchShoppingListData = async () => {
  if (!user?.userId) {
    console.error('No user or userId found');
    navigate('/login');
    return;
  }

  try {
    setLoading(true);
    setError('');
    setGroceryList([]); // Reset grocery list to avoid showing old data

    // If we have a menuId from URL, use that directly
    if (selectedMenuId) {
      console.log(`Using menu ID from URL: ${selectedMenuId}`);
      
      // Try both endpoints to get the data we need
      let fetchedGroceryList = [];
      let menuDetails = null;
      let success = false;
      
      // Strategy 1: Try direct grocery list API
      try {
        console.log(`Strategy 1: Fetching grocery list for menu ${selectedMenuId}`);
        const groceryListResponse = await apiService.getGroceryListByMenuId(selectedMenuId);
        
        if (groceryListResponse && groceryListResponse.groceryList && groceryListResponse.groceryList.length > 0) {
          console.log("Grocery list fetched successfully:", groceryListResponse.groceryList);
          fetchedGroceryList = groceryListResponse.groceryList;
          success = true;
        } else if (groceryListResponse && Array.isArray(groceryListResponse)) {
          console.log("Grocery list returned as direct array:", groceryListResponse);
          fetchedGroceryList = groceryListResponse;
          success = true;
        }
      } catch (groceryErr) {
        console.log("Strategy 1 failed:", groceryErr.message);
      }
      
      // Strategy 2: If first attempt failed, try client menu endpoint
      if (!success) {
        try {
          console.log(`Strategy 2: Fetching client menu ${selectedMenuId}`);
          menuDetails = await apiService.getClientMenu(selectedMenuId);
          console.log("Client menu fetched successfully:", menuDetails);
          
          // Check if API returned a grocery list directly
          if (menuDetails && menuDetails.groceryList && menuDetails.groceryList.length > 0) {
            fetchedGroceryList = menuDetails.groceryList;
            success = true;
          }
          // Otherwise need to extract from menu plan
          else if (menuDetails && menuDetails.meal_plan) {
            console.log("Extracting grocery list from client menu meal plan");
            try {
              // Get client grocery list API if we have the menu
              const clientGroceryList = await apiService.getClientGroceryList(selectedMenuId);
              if (clientGroceryList && clientGroceryList.groceryList) {
                fetchedGroceryList = clientGroceryList.groceryList;
                success = true;
                console.log("Client grocery list API succeeded:", fetchedGroceryList);
              }
            } catch (clientGroceryErr) {
              console.log("Client grocery list API failed, falling back to extraction from meal plan");
              // Extract from menu details
              const categorizedItems = categorizeItems(menuDetails);
              fetchedGroceryList = Object.values(categorizedItems).flat();
              success = fetchedGroceryList.length > 0;
            }
          }
        } catch (clientMenuErr) {
          console.log("Strategy 2 failed:", clientMenuErr.message);
        }
      }
      
      // Strategy 3: Try regular menu endpoint
      if (!success) {
        try {
          console.log(`Strategy 3: Fetching regular menu ${selectedMenuId}`);
          menuDetails = await apiService.getMenuDetails(selectedMenuId);
          console.log("Regular menu fetched successfully:", menuDetails);
          
          // Extract from menu details
          const categorizedItems = categorizeItems(menuDetails);
          fetchedGroceryList = Object.values(categorizedItems).flat();
          success = fetchedGroceryList.length > 0;
        } catch (regularMenuErr) {
          console.log("Strategy 3 failed:", regularMenuErr.message);
        }
      }
      
      // If we got data from any strategy, use it
      if (success && fetchedGroceryList.length > 0) {
        console.log("Final grocery list:", fetchedGroceryList);
        setGroceryList(fetchedGroceryList);
      } else {
        console.error("All strategies failed or returned empty data");
        setError(`No grocery items found for menu ${selectedMenuId}. The menu might not have any ingredients.`);
      }
    } else {
      // No specific menu ID, get the latest one
      const history = await apiService.getMenuHistory(user.userId);
      setMenuHistory(history);

      if (history && history.length > 0) {
        const latestMenuId = history[0].menu_id;
        
        // Fetch the full menu details
        const fullMenuDetails = await apiService.getMenuDetails(latestMenuId);
        
        console.log('Full Menu Details:', fullMenuDetails);
        
        // Use the categorizeItems method to generate grocery list
        const categorizedItems = categorizeItems(fullMenuDetails);
        const groceryList = Object.values(categorizedItems).flat();
        
        console.log("🔎 Grocery List:", groceryList);

        if (groceryList.length > 0) {
          setGroceryList(groceryList);
          setSelectedMenuId(latestMenuId);
        } else {
          setError('No grocery items found in this menu. Try generating a new menu with recipes.');
        }
      } else {
        setError('No menus found. Generate a menu first!');
      }
    }
    
  } catch (err) {
    console.error('Shopping list fetch error:', err);
    
    if (err.response?.status === 404) {
      setError('No grocery lists found. Generate a menu first!');
    } else if (err.response?.status === 401) {
      navigate('/login');
    } else if (err.response?.status === 422) {
      setError('The menu format is not compatible with grocery lists. Try a different menu.');
    } else {
      setError(`Failed to load grocery list: ${err.message || 'Unknown error'}`);
    }
  } finally {
    setLoading(false);
  }
};
  
  // Menu selection handler
  const handleMenuSelect = async (menuId) => {
    try {
      setLoading(true);
      const groceryListResponse = await apiService.getGroceryListByMenuId(menuId);
      
      setGroceryList(groceryListResponse.groceryList);
      setSelectedMenuId(menuId);
    } catch (err) {
      console.error('Error selecting menu:', err);
      setError('Failed to load grocery list');
    } finally {
      setLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchShoppingListData();
  }, [user, selectedMenuId]);

const categorizeItems = (mealPlanData) => {
  let ingredientsList = [];
  console.log("Categorizing items from data:", mealPlanData);

  // Handle case where we get a groceryList array directly
  if (mealPlanData && mealPlanData.groceryList && Array.isArray(mealPlanData.groceryList)) {
    console.log("Using groceryList property directly:", mealPlanData.groceryList);
    return { "All Items": mealPlanData.groceryList };
  }

  // First, determine the structure of the input data
  if (Array.isArray(mealPlanData)) {
    // If it's already a direct list of ingredients
    console.log("Data is an array, using directly");
    ingredientsList = mealPlanData;
  } else if (mealPlanData && mealPlanData.meal_plan) {
    // If it's a structured meal plan object
    console.log("Found meal_plan property, processing structured data");
    
    let mealPlan;
    try {
      mealPlan = typeof mealPlanData.meal_plan === 'string' 
        ? JSON.parse(mealPlanData.meal_plan) 
        : mealPlanData.meal_plan;
    } catch (e) {
      console.error("Error parsing meal_plan:", e);
      mealPlan = { days: [] };
    }

    // Extract ingredients from days, meals, and snacks
    if (mealPlan && mealPlan.days && Array.isArray(mealPlan.days)) {
      console.log(`Processing ${mealPlan.days.length} days of meals`);
      
      mealPlan.days.forEach(day => {
        // Process meals
        if (day.meals && Array.isArray(day.meals)) {
          day.meals.forEach(meal => {
            if (meal.ingredients && Array.isArray(meal.ingredients)) {
              console.log(`Found ${meal.ingredients.length} ingredients in meal: ${meal.title || 'Unnamed'}`);
              
              const processedIngredients = meal.ingredients.map(ing => {
                if (typeof ing === 'string') return ing.trim();
                return `${ing.quantity || ''} ${ing.name || ''}`.trim();
              }).filter(ing => ing.length > 0);
              
              ingredientsList.push(...processedIngredients);
            }
          });
        }

        // Process snacks
        if (day.snacks && Array.isArray(day.snacks)) {
          day.snacks.forEach(snack => {
            if (snack.ingredients && Array.isArray(snack.ingredients)) {
              console.log(`Found ${snack.ingredients.length} ingredients in snack: ${snack.title || 'Unnamed'}`);
              
              const processedIngredients = snack.ingredients.map(ing => {
                if (typeof ing === 'string') return ing.trim();
                return `${ing.quantity || ''} ${ing.name || ''}`.trim();
              }).filter(ing => ing.length > 0);
              
              ingredientsList.push(...processedIngredients);
            }
          });
        }
      });
    }
  }
  
  // If ingredientsList is still empty but we have a groceryList somewhere in the data
  if (ingredientsList.length === 0 && typeof mealPlanData === 'object') {
    // Try to find a groceryList in a nested property
    const findGroceryList = (obj, depth = 0) => {
      if (depth > 3) return null; // Limit depth to avoid infinite recursion
      
      if (obj && obj.groceryList && Array.isArray(obj.groceryList)) {
        return obj.groceryList;
      }
      
      for (const key in obj) {
        if (typeof obj[key] === 'object' && obj[key] !== null) {
          const result = findGroceryList(obj[key], depth + 1);
          if (result) return result;
        }
      }
      
      return null;
    };
    
    const foundList = findGroceryList(mealPlanData);
    if (foundList) {
      console.log("Found groceryList in nested property:", foundList);
      ingredientsList = foundList;
    }
  }
  
  console.log(`Final ingredients list has ${ingredientsList.length} items`);
  if (ingredientsList.length === 0) {
    // Return a default empty category to prevent errors
    return { "No Items Found": [] };
  }

  // Categorization logic
  const categorizedItems = {};
  const ingredientTotals = {};

  // Helper function to parse quantity
  const parseQuantity = (quantityStr) => {
    if (!quantityStr) return 1;
    
    const parts = quantityStr.split(/\s+/);
    let total = 0;

    parts.forEach(part => {
      if (part.includes('/')) {
        const [num, denom] = part.split('/');
        total += parseFloat(num) / parseFloat(denom);
      } else {
        const num = parseFloat(part);
        if (!isNaN(num)) {
          total += num;
        }
      }
    });

    return total || 1;
  };

  // Helper function to combine multiple quantities
  const combineQuantities = (quantityStr) => {
    const parts = quantityStr.split(/\s+/);
    let totalQuantity = 0;
    let lastUnit = '';

    for (let i = 0; i < parts.length; i++) {
      const num = parseFloat(parts[i]);
      if (!isNaN(num)) {
        const nextPart = parts[i + 1];
        const unitConversions = {
          'tablespoon': 1/16,
          'tbsp': 1/16,
          'teaspoon': 1/48,
          'tsp': 1/48
        };

        if (nextPart && unitConversions[nextPart.toLowerCase()]) {
          totalQuantity += num * unitConversions[nextPart.toLowerCase()];
          lastUnit = 'cup';
          i++;
        } else {
          totalQuantity += num;
          lastUnit = '';
        }
      }
    }

    return { quantity: totalQuantity, unit: lastUnit };
  };

  // Helper function to guess the most appropriate unit
  const guessAppropriateUnit = (itemName, currentUnit) => {
    const unitMappings = {
      'quinoa': 'cup',
      'rice vinegar': 'tbsp',
      'tortilla': 'piece',
      'black bean': 'cup',
      'edamame': 'cup',
      'almond': 'tbsp',
      'basil': 'cup',
      'berrie': 'cup',
      'chickpea': 'can',
      'olive': 'cup',
      'hummu': 'cup',
      'seed': 'tbsp',
      'avocado': 'piece',
      'jalapeno': 'piece',
      'tomato': 'piece',
      'cucumber': 'piece',
      'bell pepper': 'piece',
      'onion': 'piece',
      'garlic': 'clove',
      'egg': 'piece',
      'cheese': 'cup'
    };

    // If current unit is already valid, keep it
    const STANDARD_UNITS = {
      volume: ['cup', 'tbsp', 'tsp', 'ml', 'l'],
      weight: ['oz', 'lb', 'g', 'kg'],
      count: ['slice', 'piece', 'can', 'scoop', 'clove', 'egg'],
      special: ['leaves', 'kernel', 'seed']
    };

    if (STANDARD_UNITS.volume.includes(currentUnit) ||
        STANDARD_UNITS.weight.includes(currentUnit) ||
        STANDARD_UNITS.count.includes(currentUnit) ||
        STANDARD_UNITS.special.includes(currentUnit)) {
      return currentUnit;
    }

    // Find the most appropriate unit based on the ingredient name
    for (const [ingredient, unit] of Object.entries(unitMappings)) {
      if (itemName.toLowerCase().includes(ingredient)) {
        return unit;
      }
    }

    // Default to no unit if no other unit is found
    return '';
  };

  // Process and combine ingredients
  ingredientsList.forEach(item => {
    let fullItemName = item.trim().toLowerCase();

    // First, try to combine complex quantities
    const combinedQuantity = combineQuantities(fullItemName);
    let quantity = combinedQuantity.quantity;
    let unit = combinedQuantity.unit;

    // Extract quantity and unit if not already parsed
    const quantityRegex = /^((?:\d+\s*)*(?:\d*\/?\d+)?)\s*(cup|tbsp|tsp|oz|lb|can|slice|clove|piece|scoop)s?\s*(.*)/i;
    const match = fullItemName.match(quantityRegex);

    if (match) {
      quantity = parseQuantity(match[1]);
      unit = match[2] || '';
      fullItemName = match[3].trim();
    }

    // Skip if item is now empty
    if (!fullItemName) return;

    // Guess appropriate unit if needed
    unit = guessAppropriateUnit(fullItemName, unit);

    // Normalize item name (remove plurals)
    const normalizedItemName = fullItemName.replace(/s$/, '');

    // Combine total quantity for similar items
    if (!ingredientTotals[normalizedItemName]) {
      ingredientTotals[normalizedItemName] = { 
        quantity: quantity, 
        unit: unit 
      };
    } else {
      ingredientTotals[normalizedItemName].quantity += quantity;
    }
  });

  // Categorize normalized items
  Object.entries(ingredientTotals).forEach(([itemName, details]) => {
    const category = Object.keys(CATEGORY_MAPPING).find(cat => 
      CATEGORY_MAPPING[cat].some(keyword => 
        itemName.toLowerCase().includes(keyword.toLowerCase())
      )
    ) || 'Other';
    
    if (!categorizedItems[category]) {
      categorizedItems[category] = [];
    }
    
    // Improved formatting logic
    const formattedItem = details.quantity > 1 
      ? `${details.quantity} ${details.unit ? details.unit + 's' : ''} ${itemName}`.trim()
      : details.unit 
        ? `${details.unit} ${itemName}`.trim()
        : `${details.quantity} ${itemName}`.trim();

    categorizedItems[category].push(formattedItem);
  });
  
  return categorizedItems;
};
  
  // Store search handler
  const handleStoreSearchAll = async () => {
    try {
      if (selectedStore === 'mixed') {
        return;
      }

      // Add all items to internal cart
      await apiService.addToInternalCart({
        items: groceryList.map(item => ({
          name: typeof item === 'string' ? item : item.name,
          quantity: 1,
          store_preference: selectedStore
        })),
        store: selectedStore
      });

      setSnackbarMessage(`Items added to ${selectedStore} cart`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error(`Error processing ${selectedStore} items:`, err);
      setError(`Failed to process items in ${selectedStore}`);
      setSnackbarMessage(`Error: ${err.message}`);
      setSnackbarOpen(true);
    }
  };

  // Add to cart handler for single store
  const handleAddToCart = async (item, store) => {
    try {
      await apiService.addToInternalCart({
        items: [{
          name: item,
          quantity: 1,
          store_preference: store
        }],
        store
      });

      setSnackbarMessage(`Added ${item} to ${store} cart`);
      setSnackbarOpen(true);
    } catch (err) {
      console.error(`Error adding ${item} to ${store} cart:`, err);
      let errorMessage = `Failed to add ${item} to ${store} cart`;
      if (err.message) {
        errorMessage += `: ${err.message}`;
      }
      setSnackbarMessage(errorMessage);
      setSnackbarOpen(true);
    }
  };

  // Add to cart handler for mixed stores
  const handleAddToMixedCart = async (item, selectedStore) => {
    if (selectedStore === 'mixed') {
      return;
    }
    await handleAddToCart(item, selectedStore);
  };

  // Close snackbar
  const handleCloseSnackbar = () => {
    setSnackbarOpen(false);
  };

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Shopping List
      </Typography>

      {loading && (
        <Box display="flex" justifyContent="center" my={2}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Box sx={{ display: 'flex', gap: 2, mb: 2 }}>
        {menuHistory.length > 0 && (
          <FormControl sx={{ flex: 1 }}>
            <InputLabel>Select Menu</InputLabel>
            <Select
              value={selectedMenuId || ''}
              label="Select Menu"
              onChange={(e) => handleMenuSelect(e.target.value)}
              disabled={loading}
            >
              {menuHistory.map((menuItem) => (
                <MenuItem 
                  key={menuItem.menu_id} 
                  value={menuItem.menu_id}
                >
                  {menuItem.nickname || `Menu from ${new Date(menuItem.created_at).toLocaleDateString()}`}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        )}

        <FormControl sx={{ flex: 1 }}>
          <InputLabel>Store Search Mode</InputLabel>
          <Select
            value={selectedStore}
            label="Store Search Mode"
            onChange={(e) => setSelectedStore(e.target.value)}
          >
            <MenuItem value="walmart">Walmart</MenuItem>
            <MenuItem value="kroger">Kroger</MenuItem>
            <MenuItem value="mixed">Mixed Stores</MenuItem>
          </Select>
        </FormControl>

        {selectedStore !== 'mixed' && groceryList.length > 0 && (
          <Button 
            variant="contained" 
            onClick={handleStoreSearchAll}
            disabled={loading}
          >
            Add All to {selectedStore.charAt(0).toUpperCase() + selectedStore.slice(1)} Cart
          </Button>
        )}
      </Box>

      {groceryList && groceryList.length > 0 ? (
        <ShoppingList 
          categories={categorizeItems(groceryList)} 
          selectedStore={selectedStore} 
          onAddToCart={handleAddToCart} 
          onAddToMixedCart={handleAddToMixedCart} 
        />
      ) : (
        !loading && (
          <Alert severity="info" sx={{ mt: 3 }}>
            No grocery items found for this menu. The menu might not have any ingredients listed, or there might be an issue with the menu data.
          </Alert>
        )
      )}

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={handleCloseSnackbar}
        message={snackbarMessage}
      />
    </Container>
  );
}

export default ShoppingListPage;