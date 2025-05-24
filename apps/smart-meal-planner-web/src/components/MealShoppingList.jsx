// src/components/MealShoppingList.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import InstacartCarrotIcon from '../assets/instacart/Instacart_Carrot.png';
import {
  Typography,
  Paper,
  Grid,
  Button,
  Box,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Chip,
  Divider,
  Alert,
  ButtonGroup,
  Snackbar
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Restaurant as MealIcon,
  LocalCafe as SnackIcon,
  ShoppingCart as ShoppingCartIcon,
  LocalGroceryStore as KrogerIcon
} from '@mui/icons-material';
import apiService from '../services/apiService';

/**
 * Component for displaying shopping lists organized by individual meals
 */
const MealShoppingList = ({ menuId }) => {
  const [mealLists, setMealLists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [menuTitle, setMenuTitle] = useState('');
  const [cartLoading, setCartLoading] = useState({});
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Fetch meal-specific shopping lists when component mounts
  useEffect(() => {
    const fetchMealShoppingLists = async () => {
      if (!menuId) {
        setError('No menu ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        
        // Call the API endpoint for meal-specific shopping lists using axios directly
        // since apiService.get might not be defined
        let response;
        try {
          // Use axios directly instead of apiService.get
          const token = localStorage.getItem('access_token');
          const formattedToken = token && token.startsWith('Bearer ') ? token : `Bearer ${token}`;

          const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';

          const axiosResponse = await axios.get(`${API_BASE_URL}/menu/${menuId}/meal-shopping-lists`, {
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'Authorization': formattedToken
            }
          });

          // Extract data from axios response
          response = axiosResponse.data;
          console.log('Meal shopping lists response:', response);
        } catch (apiError) {
          console.error('API Error:', apiError);
          throw new Error(apiError?.message || 'Failed to fetch meal shopping lists');
        }

        // FIX: Add defensive checks before accessing properties
        if (!response) {
          throw new Error('No response received from server');
        }

        // Ensure response is an object
        if (typeof response !== 'object') {
          throw new Error('Invalid response format: not an object');
        }

        // Check if meal_lists property exists and is an array
        const mealLists = response.meal_lists || [];
        
        if (!Array.isArray(mealLists)) {
          throw new Error('Invalid response format: meal_lists is not an array');
        }

        try {
          // Create a defensive copy to avoid modifying the original
          const listsCopy = mealLists.map(meal => {
            // FIX: Additional safety check for each meal object
            if (!meal || typeof meal !== 'object') {
              return { error: true, title: 'Invalid meal data' };
            }
            return {...meal};
          });

          // Sort by day and meal index with error handling
          const sortedLists = listsCopy.sort((a, b) => {
            // Default values for missing properties
            const aDayIndex = a.day_index !== undefined ? a.day_index : 0;
            const bDayIndex = b.day_index !== undefined ? b.day_index : 0;
            const aIsSnack = Boolean(a.is_snack);
            const bIsSnack = Boolean(b.is_snack);
            const aMealIndex = a.meal_index !== undefined ? a.meal_index : 0;
            const bMealIndex = b.meal_index !== undefined ? b.meal_index : 0;

            // First sort by day
            if (aDayIndex !== bDayIndex) {
              return aDayIndex - bDayIndex;
            }
            // Then by meal vs. snack (meals first)
            if (aIsSnack !== bIsSnack) {
              return aIsSnack ? 1 : -1;
            }
            // Then by meal index
            return aMealIndex - bMealIndex;
          });

          setMealLists(sortedLists);
          // FIX: Add safety check for title
          setMenuTitle(response.title || `Menu ${menuId}`);
        } catch (sortError) {
          console.error('Error sorting meal lists:', sortError);
          // Fall back to unsorted lists
          setMealLists(mealLists);
          setMenuTitle(response.title || `Menu ${menuId}`);
        }
      } catch (err) {
        console.error('Error fetching meal shopping lists:', err);
        // FIX: Ensure we don't try to access properties that might not exist
        setError(err?.message || 'Failed to load shopping lists');
        setMealLists([]);
      } finally {
        setLoading(false);
      }
    };

    fetchMealShoppingLists();
  }, [menuId]);

  // Format day number for display
  const formatDay = (dayIndex, dayNumber) => {
    return `Day ${dayNumber || dayIndex + 1}`;
  };

  // Get meal type display (breakfast, lunch, dinner)
  const getMealTypeDisplay = (mealTime) => {
    if (!mealTime) return '';

    const normalizedTime = mealTime.toLowerCase().trim();
    if (normalizedTime === 'breakfast') return ' (Breakfast)';
    if (normalizedTime === 'lunch') return ' (Lunch)';
    if (normalizedTime === 'dinner') return ' (Dinner)';

    return normalizedTime ? ` (${mealTime})` : '';
  };

  // Add meal ingredients to internal cart assigned to the specified store
  const addMealToCart = async (meal, store) => {
    if (!meal.ingredients || meal.ingredients.length === 0) {
      setSnackbarMessage('No ingredients to add to cart');
      setSnackbarOpen(true);
      return;
    }

    const mealKey = `${meal.day_index}-${meal.meal_index}-${store}`;
    setCartLoading(prev => ({ ...prev, [mealKey]: true }));

    try {
      const token = localStorage.getItem('access_token');
      const formattedToken = token && token.startsWith('Bearer ') ? token : `Bearer ${token}`;
      const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';

      // Convert ingredients to cart items format with correct quantity formatting
      const cartItems = meal.ingredients.map(ingredient => {
        // Process ingredient with proper units
        let quantity = ingredient.quantity || "";
        let name = ingredient.name || "";
        let itemName = name;

        // DEBUG: Log the ingredient processing
        console.log(`Processing ingredient: name="${name}", quantity="${quantity}"`);

        // If quantity already contains units (like "2 cups", "16 oz"), use it directly
        if (quantity && quantity.trim() && /\d+.*[a-zA-Z]/.test(quantity.trim())) {
          itemName = `${quantity} ${name}`.trim();
          console.log(`Using quantity with units: "${itemName}"`);
        }
        // If quantity is just a number, apply specific unit rules
        else if (quantity && quantity.trim() && /^\d+(\.\d+)?$/.test(quantity.trim())) {
          if (quantity === "16" && name.toLowerCase().includes("pasta")) {
            itemName = `16 oz ${name}`;
          } else if (quantity === "2" && name.toLowerCase().includes("spinach")) {
            itemName = `2 cups ${name}`;
          } else if (quantity === "2" && name.toLowerCase().includes("olive oil")) {
            itemName = `2 tbsp ${name}`;
          } else if (quantity === "2" && name.toLowerCase().includes("italian")) {
            itemName = `2 tbsp ${name}`;
          } else if (quantity === "1" && name.toLowerCase().includes("tomato sauce")) {
            itemName = `1 can ${name}`;
          } else if (quantity === "1" && name.toLowerCase().includes("cheese") && !name.toLowerCase().includes("cream cheese")) {
            itemName = `1 cup ${name}`;
          } else if (quantity === "3" && name.toLowerCase().includes("rice")) {
            itemName = `3 cups ${name}`;
          } else if (quantity === "1" && name.toLowerCase().includes("broccoli")) {
            itemName = `1 head ${name}`;
          } else if (quantity === "1" && name.toLowerCase().includes("onion")) {
            itemName = `1 medium ${name}`;
          } else if (quantity === "4" && name.toLowerCase().includes("garlic")) {
            itemName = `4 cloves ${name}`;
          } else if (quantity === "8" && name.toLowerCase().includes("chicken")) {
            itemName = `8 oz ${name}`;
          } else {
            // For numeric quantities without specific rules, just add the number
            itemName = `${quantity} ${name}`.trim();
          }
          console.log(`Using numeric quantity rule: "${itemName}"`);
        }
        // If no quantity or empty quantity, use just the name
        else {
          itemName = name;
          console.log(`Using name only: "${itemName}"`);
        }

        return {
          name: itemName,
          quantity: 1,  // This is the item count, not the measurement quantity
          store_preference: store
        };
      });

      // Add items to internal cart assigned to the specified store
      const response = await axios.post(
        `${API_BASE_URL}/cart/internal/add_items`,
        {
          items: cartItems,
          store: store
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': formattedToken
          }
        }
      );

      if (response.data && response.data.status === 'success') {
        setSnackbarMessage(
          `Added ${meal.ingredients.length} items from "${meal.title}" to ${store.charAt(0).toUpperCase() + store.slice(1)} cart`
        );
        setSnackbarOpen(true);
      } else {
        setSnackbarMessage(`Failed to add items to ${store} cart`);
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Error adding meal to cart:', err);
      setSnackbarMessage(`Error adding meal to ${store} cart: ${err.response?.data?.detail || err.message}`);
      setSnackbarOpen(true);
    } finally {
      setCartLoading(prev => ({ ...prev, [mealKey]: false }));
    }
  };

  // Render loading state
  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4} flexDirection="column" alignItems="center">
        <CircularProgress />
        <Typography variant="body1" mt={2}>
          Loading meal shopping lists...
        </Typography>
      </Box>
    );
  }

  // Render error state
  if (error) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Error: {error}
      </Alert>
    );
  }

  // Render empty state
  if (!mealLists || mealLists.length === 0) {
    return (
      <Alert severity="info" sx={{ my: 2 }}>
        No meal shopping lists available for this menu.
      </Alert>
    );
  }

  // FIX: Add additional safety check before reducing
  if (!Array.isArray(mealLists)) {
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        Error: Invalid meal lists data format
      </Alert>
    );
  }

  // Group meals by day with error handling
  const mealsByDay = mealLists.reduce((acc, meal) => {
    try {
      // Skip null or undefined meals
      if (!meal) return acc;

      // Use a default of 0 if day_index is undefined
      const dayKey = meal.day_index !== undefined ? meal.day_index : 0;
      if (!acc[dayKey]) {
        acc[dayKey] = [];
      }
      acc[dayKey].push(meal);
    } catch (err) {
      console.error('Error processing meal in grouping:', err, meal);
      // Continue processing other meals
    }
    return acc;
  }, {});

  return (
    <Box sx={{ my: 2 }}>
      <Typography variant="h5" gutterBottom>
        Meal Shopping Lists - {menuTitle}
      </Typography>
      
      <Typography variant="body1" paragraph>
        Below you'll find shopping lists organized by meal. This makes it easier to shop for
        specific meals rather than buying all ingredients at once.
      </Typography>
      
      {Object.entries(mealsByDay).map(([dayIndex, dayMeals]) => {
        // Make sure dayMeals is an array and not empty
        if (!Array.isArray(dayMeals) || dayMeals.length === 0) {
          return null;
        }

        // Parse dayIndex safely
        const dayIndexNum = parseInt(dayIndex, 10) || 0;

        // Get first valid meal to extract day number
        const firstMeal = dayMeals[0] || {};

        return (
          <Accordion key={dayIndex} defaultExpanded={dayIndexNum === 0}>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Typography variant="h6">
                {formatDay(dayIndexNum, firstMeal.day)}
              </Typography>
            </AccordionSummary>
            <AccordionDetails>
              <Grid container spacing={2}>
                {dayMeals.map((meal, index) => {
                  // Skip invalid meals
                  if (!meal) return null;

                  return (
                    <Grid item xs={12} md={6} lg={4} key={index}>
                      <Paper elevation={2} sx={{ p: 2 }}>
                        <Box display="flex" alignItems="center" mb={1}>
                          {meal.is_snack ? (
                            <SnackIcon color="secondary" sx={{ mr: 1 }} />
                          ) : (
                            <MealIcon color="primary" sx={{ mr: 1 }} />
                          )}
                          <Typography variant="h6">
                            {meal.title || "Untitled Meal"}
                            {getMealTypeDisplay(meal.meal_time)}
                            {meal.is_snack && (
                              <Chip
                                label="Snack"
                                size="small"
                                color="secondary"
                                sx={{ ml: 1 }}
                              />
                            )}
                          </Typography>
                        </Box>

                        {(meal.servings && meal.servings > 0) && (
                          <Typography variant="body2" color="text.secondary" mb={1}>
                            Serves: {meal.servings}
                          </Typography>
                        )}

                        <Divider sx={{ my: 1 }} />

                        <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 'bold' }}>
                          Ingredients:
                        </Typography>

                        <List dense>
                          {(meal.ingredients && Array.isArray(meal.ingredients) && meal.ingredients.length > 0) ? (
                            meal.ingredients.map((ingredient, idx) => {
                              // Skip invalid ingredients
                              if (!ingredient) return null;

                              return (
                                <ListItem key={idx}>
                                  <ListItemText
                                    primary={
                                      (() => {
                                        // Fix the common unit abbreviation problems:
                                        // The backend passes "quantity" property which may be just a number like "16"
                                        // When unit is missing or incorrect, handle special cases

                                        let quantity = ingredient.quantity || "";
                                        let name = ingredient.name || "Unnamed ingredient";

                                        // Common fixes for incorrect/mismatched units
                                        const lowerName = name.toLowerCase();
                                        const numericQuantity = parseFloat(quantity);

                                        // Handle meat weight conversions (common issue)
                                        if (lowerName.includes("chicken") || lowerName.includes("beef") || lowerName.includes("pork") || lowerName.includes("meat")) {
                                          // Check for obvious wrong conversions like "16 lb" chicken (should be 1 lb)
                                          if (numericQuantity === 16 && quantity.includes("lb")) {
                                            return `1 lb ${name}`;
                                          }
                                          // Check for large numbers without proper units
                                          else if (numericQuantity >= 16 && !quantity.includes("oz") && !quantity.includes("lb")) {
                                            const pounds = numericQuantity / 16;
                                            return pounds >= 1 ? `${pounds} lb ${name}` : `${numericQuantity} oz ${name}`;
                                          }
                                          // Small amounts without units should be oz
                                          else if (numericQuantity <= 8 && !quantity.includes("oz") && !quantity.includes("lb")) {
                                            return `${numericQuantity} oz ${name}`;
                                          }
                                        }

                                        // Handle specific ingredient fixes
                                        if (quantity === "16" && lowerName.includes("pasta")) {
                                          return "1 lb " + name;  // 16 oz = 1 lb
                                        }
                                        if (quantity === "2" && lowerName.includes("spinach")) {
                                          return "2 cups " + name;
                                        }
                                        if (quantity === "2" && lowerName.includes("olive oil")) {
                                          return "2 tbsp " + name;
                                        }
                                        if (quantity === "2" && lowerName.includes("italian")) {
                                          return "2 tbsp " + name;
                                        }
                                        if (quantity === "1" && lowerName.includes("tomato sauce")) {
                                          return "1 can " + name;
                                        }
                                        if (quantity === "1" && lowerName.includes("cheese") && !lowerName.includes("cream cheese")) {
                                          return "1 cup " + name;
                                        }
                                        if (quantity === "3" && lowerName.includes("rice")) {
                                          return "3 cups " + name;
                                        }
                                        if (quantity === "2" && lowerName.includes("rice")) {
                                          return "2 cups " + name;
                                        }
                                        if (quantity === "1" && lowerName.includes("broccoli")) {
                                          return "1 head " + name;
                                        }
                                        if (quantity === "1" && lowerName.includes("onion")) {
                                          return "1 medium " + name;
                                        }
                                        if (quantity === "4" && lowerName.includes("garlic")) {
                                          return "4 cloves " + name;
                                        }
                                        if (quantity === "8" && lowerName.includes("chicken")) {
                                          return "8 oz " + name;
                                        }

                                        // Add missing units for common ingredients
                                        if (quantity && !isNaN(numericQuantity) && numericQuantity > 0) {
                                          // Check if quantity already has a unit
                                          const hasUnit = /\b(oz|lb|cup|tbsp|tsp|clove|piece|can|head|medium|large|small|g|kg|ml|l)\b/i.test(quantity);

                                          if (!hasUnit) {
                                            // Add appropriate units based on ingredient type
                                            if (lowerName.includes("edamame") || lowerName.includes("almonds") || lowerName.includes("nuts")) {
                                              return `${quantity} oz ${name}`;
                                            }
                                            if (lowerName.includes("mozzarella") && lowerName.includes("ball")) {
                                              return `${quantity} oz ${name}`;
                                            }
                                            if (lowerName.includes("cherry tomato") || lowerName.includes("tomato")) {
                                              return `${quantity} medium ${name}`;
                                            }
                                            if (lowerName.includes("balsamic glaze") || lowerName.includes("glaze")) {
                                              return `${quantity} tbsp ${name}`;
                                            }
                                            if (lowerName.includes("green onion") || lowerName.includes("onion")) {
                                              return `${quantity} medium ${name}`;
                                            }
                                            if (lowerName.includes("bell pepper") || lowerName.includes("pepper")) {
                                              return `${quantity} medium ${name}`;
                                            }
                                            if (lowerName.includes("peas")) {
                                              return `${quantity} cup ${name}`;
                                            }
                                            if (lowerName.includes("egg")) {
                                              return `${quantity} large ${name}`;
                                            }
                                          }
                                        }

                                        // For all other cases, show quantity with the ingredient name
                                        return quantity && quantity.trim()
                                          ? `${quantity} ${name}`
                                          : name;
                                      })()
                                    }
                                  />
                                </ListItem>
                              );
                            })
                          ) : (
                            <ListItem>
                              <ListItemText primary="No ingredients found" />
                            </ListItem>
                          )}
                        </List>

                        {/* Cart Buttons */}
                        {meal.ingredients && meal.ingredients.length > 0 && (
                          <Box sx={{ mt: 2, pt: 1, borderTop: '1px solid #e0e0e0' }}>
                            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
                              Add to Cart:
                            </Typography>
                            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
                              {/* Instacart CTA button - Stacked on top for prominence */}
                              <Button
                                onClick={() => addMealToCart(meal, 'instacart')}
                                disabled={cartLoading[`${meal.day_index}-${meal.meal_index}-instacart`]}
                                variant="contained"
                                fullWidth
                                sx={{
                                  height: 46, // Official Instacart height
                                  py: '16px', // Official vertical padding
                                  px: '18px', // Official horizontal padding
                                  backgroundColor: '#003D29', // Official dark background
                                  color: '#FAF1E5', // Official text color
                                  fontWeight: 500,
                                  borderRadius: '999px', // Fully rounded
                                  textTransform: 'none',
                                  '&:hover': {
                                    backgroundColor: '#002A1C' // Slightly darker on hover
                                  },
                                  '&:disabled': {
                                    backgroundColor: '#ccc'
                                  }
                                }}
                              >
                                {cartLoading[`${meal.day_index}-${meal.meal_index}-instacart`] ?
                                  <CircularProgress size={22} color="inherit" /> :
                                  <Box component="img"
                                    src={InstacartCarrotIcon}
                                    alt="Instacart"
                                    sx={{ height: 22, width: 'auto', mr: 1 }}
                                  />
                                }
                                Get Ingredients
                              </Button>

                              {/* Kroger button below */}
                              <Button
                                startIcon={cartLoading[`${meal.day_index}-${meal.meal_index}-kroger`] ?
                                  <CircularProgress size={16} /> : <KrogerIcon />}
                                onClick={() => addMealToCart(meal, 'kroger')}
                                disabled={cartLoading[`${meal.day_index}-${meal.meal_index}-kroger`]}
                                variant="outlined"
                                fullWidth
                                size="medium"
                                sx={{
                                  color: '#0066B2',
                                  borderColor: '#0066B2',
                                  '&:hover': {
                                    borderColor: '#0066B2',
                                    backgroundColor: 'rgba(0, 102, 178, 0.04)'
                                  }
                                }}
                              >
                                Shop with Kroger
                              </Button>
                            </Box>
                          </Box>
                        )}
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </AccordionDetails>
          </Accordion>
        );
      })}

      {/* Snackbar for feedback */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={4000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
};

export default MealShoppingList;