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
        
        if (response.meal_lists && Array.isArray(response.meal_lists)) {
          // Sort by day and meal index
          const sortedLists = [...response.meal_lists].sort((a, b) => {
            // First sort by day
            if (a.day_index !== b.day_index) {
              return a.day_index - b.day_index;
            }
            // Then by meal vs. snack (meals first)
            if ((a.is_snack || false) !== (b.is_snack || false)) {
              return (a.is_snack || false) ? 1 : -1;
            }
            // Then by meal index
            return a.meal_index - b.meal_index;
          });
          
          setMealLists(sortedLists);
          setMenuTitle(response.title || `Menu ${menuId}`);
        } else {
          setError('Invalid response format');
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

  // Group meals by day
  const mealsByDay = mealLists.reduce((acc, meal) => {
    const dayKey = meal.day_index;
    if (!acc[dayKey]) {
      acc[dayKey] = [];
    }
    acc[dayKey].push(meal);
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
      
      {Object.entries(mealsByDay).map(([dayIndex, dayMeals]) => (
        <Accordion key={dayIndex} defaultExpanded={parseInt(dayIndex) === 0}>
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <Typography variant="h6">
              {formatDay(parseInt(dayIndex), dayMeals[0]?.day)}
            </Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Grid container spacing={2}>
              {dayMeals.map((meal, index) => (
                <Grid item xs={12} md={6} lg={4} key={index}>
                  <Paper elevation={2} sx={{ p: 2 }}>
                    <Box display="flex" alignItems="center" mb={1}>
                      {meal.is_snack ? (
                        <SnackIcon color="secondary" sx={{ mr: 1 }} />
                      ) : (
                        <MealIcon color="primary" sx={{ mr: 1 }} />
                      )}
                      <Typography variant="h6">
                        {meal.title}{getMealTypeDisplay(meal.meal_time)}
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
                    
                    {meal.servings > 0 && (
                      <Typography variant="body2" color="text.secondary" mb={1}>
                        Serves: {meal.servings}
                      </Typography>
                    )}
                    
                    <Divider sx={{ my: 1 }} />
                    
                    <Typography variant="subtitle1" sx={{ mt: 1, fontWeight: 'bold' }}>
                      Ingredients:
                    </Typography>
                    
                    <List dense>
                      {meal.ingredients && meal.ingredients.length > 0 ? (
                        meal.ingredients.map((ingredient, idx) => (
                          <ListItem key={idx}>
                            <ListItemText
                              primary={ingredient.name}
                              secondary={ingredient.quantity}
                            />
                          </ListItem>
                        ))
                      ) : (
                        <ListItem>
                          <ListItemText primary="No ingredients found" />
                        </ListItem>
                      )}
                    </List>
                  </Paper>
                </Grid>
              ))}
            </Grid>
          </AccordionDetails>
        </Accordion>
      ))}
    </Box>
  );
};

export default MealShoppingList;