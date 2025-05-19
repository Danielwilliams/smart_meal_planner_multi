// src/components/MealShoppingList.jsx

import React, { useState, useEffect } from 'react';
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
  Alert
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Restaurant as MealIcon,
  LocalCafe as SnackIcon
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
        
        // Call the new API endpoint for meal-specific shopping lists
        const response = await apiService.get(`/menu/${menuId}/meal-shopping-lists`);

        console.log('Meal shopping lists response:', response);

        // Ensure response is an object
        if (response && typeof response === 'object') {
          // Check if meal_lists property exists and is an array
          const mealLists = response.meal_lists || [];

          if (Array.isArray(mealLists)) {
            try {
              // Create a defensive copy to avoid modifying the original
              const listsCopy = mealLists.map(meal => ({...meal}));

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
              setMenuTitle(response.title || `Menu ${menuId}`);
            } catch (sortError) {
              console.error('Error sorting meal lists:', sortError);
              // Fall back to unsorted lists
              setMealLists(mealLists);
              setMenuTitle(response.title || `Menu ${menuId}`);
            }
          } else {
            console.error('Meal lists is not an array:', mealLists);
            setError('Invalid response format: meal_lists is not an array');
            setMealLists([]);
          }
        } else {
          console.error('Invalid response format:', response);
          setError('Invalid response format');
          setMealLists([]);
        }
      } catch (err) {
        console.error('Error fetching meal shopping lists:', err);
        setError(err.message || 'Failed to load shopping lists');
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

  // Group meals by day with error handling
  const mealsByDay = mealLists.reduce((acc, meal) => {
    try {
      // Use a default of 0 if day_index is undefined
      const dayKey = meal && meal.day_index !== undefined ? meal.day_index : 0;
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
                                    primary={ingredient.name || "Unnamed ingredient"}
                                    secondary={ingredient.quantity || ""}
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
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
};

export default MealShoppingList;