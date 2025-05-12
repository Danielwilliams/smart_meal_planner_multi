import React, { useEffect, useState } from 'react';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  Button,
  CircularProgress,
  Divider,
  Switch,
  FormControlLabel,
  Alert
} from '@mui/material';
import { BugReport as BugIcon } from '@mui/icons-material';
import ShoppingList from '../components/ShoppingList';
import ShoppingListDebug from '../components/ShoppingListDebug';
import apiService from '../services/apiService';

// A simplified debugging version of the shopping list page
function ShoppingListPageDebug() {
  const [groceryList, setGroceryList] = useState([]);
  const [selectedStore, setSelectedStore] = useState('mixed');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [rawMenuData, setRawMenuData] = useState(null);

  // Sample menu ID for debugging - can be updated with your actual menu ID
  const SAMPLE_MENU_ID = '1234';

  // Function to load sample data for testing
  const loadSampleData = () => {
    setLoading(true);
    
    // Try to fetch a menu from localStorage if we have one
    const cachedMenu = localStorage.getItem('debug_menu_data');
    if (cachedMenu) {
      try {
        const parsedMenu = JSON.parse(cachedMenu);
        console.log("Loaded menu from localStorage:", parsedMenu);
        setRawMenuData(parsedMenu);
        
        // Extract grocery list from menu data
        if (parsedMenu && parsedMenu.days) {
          const extractedItems = extractIngredientsFromMenuData(parsedMenu);
          setGroceryList(extractedItems);
        } else {
          setGroceryList([]);
        }
        
        setLoading(false);
        return;
      } catch (err) {
        console.error("Error loading cached menu:", err);
      }
    }
    
    // If no cached menu, use the sample menu data
    const sampleMenuData = {
      "days": [
        {
          "meals": [
            {
              "title": "Gluten-Free Chicken Stir-Fry",
              "ingredients": [
                {
                  "name": "Chicken Breast",
                  "quantity": "16 oz"
                },
                {
                  "name": "Broccoli",
                  "quantity": "2 cups"
                },
                {
                  "name": "Bell Peppers",
                  "quantity": "1 cup"
                },
                {
                  "name": "Gluten-Free Soy Sauce",
                  "quantity": "2 tbsp"
                },
                {
                  "name": "Garlic",
                  "quantity": "2 cloves"
                },
                {
                  "name": "Ginger",
                  "quantity": "1 tsp"
                },
                {
                  "name": "Olive Oil",
                  "quantity": "1 tbsp"
                }
              ]
            }
          ],
          "snacks": [
            {
              "title": "Greek Yogurt Parfait",
              "ingredients": [
                {
                  "name": "Greek Yogurt",
                  "quantity": "1 cup"
                },
                {
                  "name": "Berries",
                  "quantity": "1/2 cup"
                },
                {
                  "name": "Granola",
                  "quantity": "2 tbsp"
                }
              ]
            }
          ]
        },
        {
          "meals": [
            {
              "title": "Chicken Breast",
              "ingredients": [
                {
                  "name": "Chicken Breast",
                  "quantity": "16 oz"
                }
              ]
            }
          ]
        }
      ]
    };
    
    // Save the sample menu to localStorage for future use
    localStorage.setItem('debug_menu_data', JSON.stringify(sampleMenuData));
    
    // Set the raw menu data
    setRawMenuData(sampleMenuData);
    
    // Extract grocery list from menu data
    const extractedItems = extractIngredientsFromMenuData(sampleMenuData);
    setGroceryList(extractedItems);
    
    setLoading(false);
  };

  // Function to extract ingredients from menu data
  const extractIngredientsFromMenuData = (menuData) => {
    if (!menuData || !menuData.days) return [];
    
    const allIngredients = [];
    
    // Process each day
    menuData.days.forEach(day => {
      // Process meals
      if (day.meals && Array.isArray(day.meals)) {
        day.meals.forEach(meal => {
          if (meal.ingredients && Array.isArray(meal.ingredients)) {
            meal.ingredients.forEach(ing => {
              allIngredients.push(ing);
            });
          }
        });
      }
      
      // Process snacks
      if (day.snacks && Array.isArray(day.snacks)) {
        day.snacks.forEach(snack => {
          if (snack.ingredients && Array.isArray(snack.ingredients)) {
            snack.ingredients.forEach(ing => {
              allIngredients.push(ing);
            });
          }
        });
      }
    });
    
    return allIngredients;
  };

  // Function to try to load actual menu data from API
  const loadActualMenuData = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch menu history to find most recent menu ID
      const history = await apiService.getMenuHistory();
      
      if (history && history.length > 0) {
        const latestMenuId = history[0].menu_id;
        
        // Fetch the full menu details
        const menuDetails = await apiService.getMenuDetails(latestMenuId);
        console.log('Fetched menu details:', menuDetails);
        
        // Store the raw menu data
        setRawMenuData(menuDetails);
        
        // Save to localStorage for future debugging
        localStorage.setItem('debug_menu_data', JSON.stringify(menuDetails));
        
        // Extract grocery list
        if (menuDetails && menuDetails.days) {
          const extractedItems = extractIngredientsFromMenuData(menuDetails);
          setGroceryList(extractedItems);
        } else {
          // Try to fetch grocery list directly
          const groceryListResponse = await apiService.getGroceryListByMenuId(latestMenuId);
          
          if (groceryListResponse && groceryListResponse.groceryList) {
            setGroceryList(groceryListResponse.groceryList);
          } else {
            setError('Failed to extract grocery list from menu data');
          }
        }
      } else {
        setError('No menu history found');
        // Fall back to sample data
        loadSampleData();
      }
    } catch (err) {
      console.error('Error loading actual menu data:', err);
      setError(`Failed to load actual menu data: ${err.message}`);
      // Fall back to sample data
      loadSampleData();
    } finally {
      setLoading(false);
    }
  };

  // Load data when component mounts
  useEffect(() => {
    loadSampleData();
  }, []);

  // Handler for adding items to cart in regular shopping list
  const handleAddToCart = (item, store) => {
    console.log(`Adding to ${store} cart:`, item);
  };

  // Handler for adding items to mixed cart
  const handleAddToMixedCart = (item, store) => {
    console.log(`Adding to mixed cart (${store}):`, item);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Paper elevation={3} sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs>
            <Typography variant="h5" component="h1">
              🔴 UPDATED v2 - Shopping List Debug Tool
            </Typography>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="error"
              startIcon={<BugIcon />}
              onClick={() => setShowDebug(!showDebug)}
              sx={{
                mr: 1,
                fontWeight: 'bold',
                boxShadow: showDebug ? '0 0 10px rgba(255,0,0,0.5)' : 'none'
              }}
              size="large"
            >
              {showDebug ? 'Hide Debug Tools' : 'Show Debug Tools'}
            </Button>
          </Grid>
          <Grid item>
            <Button
              variant="contained"
              color="primary"
              onClick={loadSampleData}
              sx={{ mr: 1 }}
            >
              Load Sample Data
            </Button>
            <Button
              variant="outlined"
              onClick={loadActualMenuData}
              sx={{ mr: 1 }}
            >
              Try Load Actual Data
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {showDebug && (
        <ShoppingListDebug groceryData={rawMenuData} />
      )}

      <Divider sx={{ my: 3 }}>
        <Typography variant="subtitle1" color="textSecondary">
          Shopping List Display
        </Typography>
      </Divider>

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      ) : error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : (
        <ShoppingList
          categories={groceryList}
          selectedStore={selectedStore}
          onAddToCart={handleAddToCart}
          onAddToMixedCart={handleAddToMixedCart}
        />
      )}
    </Container>
  );
}

export default ShoppingListPageDebug;