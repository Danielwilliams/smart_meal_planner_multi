import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
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

  // State management
  const [groceryList, setGroceryList] = useState([]);
  const [menuHistory, setMenuHistory] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState(null);
  const [selectedStore, setSelectedStore] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [storeSearchResults, setStoreSearchResults] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

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

      setGroceryList(groceryList);
      setSelectedMenuId(latestMenuId);
    }
    
  } catch (err) {
    console.error('Shopping list fetch error:', err);
    
    if (err.response?.status === 404) {
      setError('No grocery lists found. Generate a menu first!');
    } else if (err.response?.status === 401) {
      navigate('/login');
    } else {
      setError('Failed to load grocery list. Please try again.');
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
  }, [user]);

const categorizeItems = (mealPlanData) => {
  let ingredientsList = [];

  // First, determine the structure of the input data
  if (Array.isArray(mealPlanData)) {
    // If it's already a direct list of ingredients
    ingredientsList = mealPlanData;
  } else if (mealPlanData && mealPlanData.meal_plan) {
    // If it's a structured meal plan object
    const mealPlan = typeof mealPlanData.meal_plan === 'string' 
      ? JSON.parse(mealPlanData.meal_plan) 
      : mealPlanData.meal_plan;

    // Extract ingredients from days, meals, and snacks
    if (mealPlan.days) {
      mealPlan.days.forEach(day => {
        // Process meals
        if (day.meals && Array.isArray(day.meals)) {
          day.meals.forEach(meal => {
            if (meal.ingredients && Array.isArray(meal.ingredients)) {
              ingredientsList.push(...meal.ingredients.map(ing => 
                `${ing.quantity || ''} ${ing.name || ''}`.trim()
              ));
            }
          });
        }

        // Process snacks
        if (day.snacks && Array.isArray(day.snacks)) {
          day.snacks.forEach(snack => {
            if (snack.ingredients && Array.isArray(snack.ingredients)) {
              ingredientsList.push(...snack.ingredients.map(ing => 
                `${ing.quantity || ''} ${ing.name || ''}`.trim()
              ));
            }
          });
        }
      });
    }
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

      {groceryList.length > 0 && (
        <ShoppingList 
          categories={categorizeItems(groceryList)} 
          selectedStore={selectedStore} 
          onAddToCart={handleAddToCart} 
          onAddToMixedCart={handleAddToMixedCart} 
        />
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