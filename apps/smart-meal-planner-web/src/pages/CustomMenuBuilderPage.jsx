import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Grid, 
  Card, 
  CardContent, 
  CardActions, 
  Button, 
  Box,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  CircularProgress,
  Alert,
  Snackbar
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

const CustomMenuBuilderPage = () => {
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [selectedRecipes, setSelectedRecipes] = useState({});
  const [menuNickname, setMenuNickname] = useState('');
  const [openDaySelectionDialog, setOpenDaySelectionDialog] = useState(false);
  const [currentRecipe, setCurrentRecipe] = useState(null);
  const [currentMealTime, setCurrentMealTime] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, activeClient } = useOrganization();

  useEffect(() => {
    if (savedRecipes.length > 0) {
      console.log("Saved Recipes Data Check:", savedRecipes);
      
      // Check first recipe for key fields
      const firstRecipe = savedRecipes[0];
      console.log("First recipe ingredients:", firstRecipe.ingredients);
      console.log("First recipe instructions:", firstRecipe.instructions);
      console.log("First recipe macros:", firstRecipe.macros);
    }
  }, [savedRecipes]);

  useEffect(() => {
    const fetchSavedRecipes = async () => {
      try {
        setLoading(true);
        
        // If an organization admin is creating a menu for a client, use the client's ID
        const clientId = activeClient?.id;
        
        const recipes = await apiService.getSavedRecipes(clientId);
        
        // Process each saved recipe to ensure it has complete data
        const fullRecipes = await Promise.all(
          recipes.map(async (recipe) => {
            try {
              // If it's a scraped recipe, get full details
              if (recipe.scraped_recipe_id) {
                const fullRecipeDetails = await apiService.getScrapedRecipeById(recipe.scraped_recipe_id);
                
                // Check for ingredients in metadata
                let ingredients = recipe.ingredients || [];
                if (fullRecipeDetails.metadata?.ingredients_list) {
                  ingredients = fullRecipeDetails.metadata.ingredients_list;
                } else if (fullRecipeDetails.ingredients) {
                  ingredients = fullRecipeDetails.ingredients;
                }
                
                // Check for nutrition data
                let macros = recipe.macros || {};
                if (!macros.perServing && fullRecipeDetails.metadata?.nutrition_per_serving) {
                  macros = {
                    perServing: fullRecipeDetails.metadata.nutrition_per_serving
                  };
                } else if (!macros.perServing && fullRecipeDetails.nutrition) {
                  macros = {
                    perServing: {
                      calories: fullRecipeDetails.nutrition.calories,
                      protein: fullRecipeDetails.nutrition.protein,
                      carbs: fullRecipeDetails.nutrition.carbohydrates || fullRecipeDetails.nutrition.carbs,
                      fat: fullRecipeDetails.nutrition.fat
                    }
                  };
                }
                
                // Combine data from both sources, prioritizing saved recipe data
                return {
                  ...recipe,
                  ...fullRecipeDetails,
                  macros: recipe.macros || macros,
                  ingredients: ingredients,
                  instructions: recipe.instructions || fullRecipeDetails.instructions || [],
                  complexity_level: recipe.complexity_level || fullRecipeDetails.complexity || 'standard',
                  appliance_used: recipe.appliance_used || fullRecipeDetails.appliance_used,
                  servings: recipe.servings || fullRecipeDetails.servings || 1
                };
              }
              
              // If it's a saved recipe from a menu
              if (recipe.menu_id && recipe.recipe_id) {
                // If we already have complete data in saved_recipes, use that
                if (recipe.ingredients && recipe.instructions && recipe.macros) {
                  return recipe;
                }
                
                // Otherwise fetch from menu
                try {
                  const menuDetails = await apiService.getMenuDetails(recipe.menu_id);
                  if (menuDetails?.meal_plan?.days) {
                    // Find the recipe in the menu
                    for (const day of menuDetails.meal_plan.days) {
                      // Look in meals
                      const matchingMeal = (day.meals || []).find(meal => 
                        (meal.id === recipe.recipe_id || recipe.recipe_name === meal.title) && 
                        meal.meal_time === recipe.meal_time
                      );
                      
                      if (matchingMeal) {
                        return {
                          ...recipe,
                          ...matchingMeal,
                          dayNumber: day.dayNumber,
                          originalSource: 'menu',
                          // Ensure we have all needed fields
                          ingredients: recipe.ingredients || matchingMeal.ingredients || [],
                          instructions: recipe.instructions || matchingMeal.instructions || [],
                          macros: recipe.macros || matchingMeal.macros,
                          complexity_level: recipe.complexity_level || matchingMeal.complexity_level || 'standard',
                          appliance_used: recipe.appliance_used || matchingMeal.appliance_used,
                          servings: recipe.servings || matchingMeal.servings || 1
                        };
                      }
                      
                      // Look in snacks
                      const matchingSnack = (day.snacks || []).find(snack => 
                        recipe.recipe_name === snack.title
                      );
                      
                      if (matchingSnack) {
                        return {
                          ...recipe,
                          ...matchingSnack,
                          dayNumber: day.dayNumber,
                          originalSource: 'menu',
                          // Ensure we have all needed fields
                          ingredients: recipe.ingredients || matchingSnack.ingredients || [],
                          instructions: recipe.instructions || matchingSnack.instructions || [],
                          macros: recipe.macros || matchingSnack.macros,
                          complexity_level: recipe.complexity_level || matchingSnack.complexity_level || 'standard',
                          appliance_used: recipe.appliance_used || matchingSnack.appliance_used,
                          servings: recipe.servings || matchingSnack.servings || 1
                        };
                      }
                    }
                  }
                } catch (menuErr) {
                  console.error(`Error fetching menu ${recipe.menu_id}:`, menuErr);
                }
              }
              
              // Return the recipe with whatever data we have
              return recipe;
            } catch (err) {
              console.error(`Error fetching recipe details for ${recipe.id}:`, err);
              return recipe;
            }
          })
        );
        
        setSavedRecipes(fullRecipes);
        setLoading(false);
      } catch (err) {
        console.error('Failed to fetch saved recipes', err);
        setError('Failed to load saved recipes');
        setLoading(false);
      }
    };  

    fetchSavedRecipes();
  }, [activeClient]);

  const renderMacroChips = (recipe) => {
    // Try to extract macros from different possible locations
    const macros = recipe.macros?.perServing || 
                   recipe.macros?.per_serving || 
                   recipe.macros;

    if (!macros) return null;

    return (
      <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', mt: 1 }}>
        {macros.calories && (
          <Chip 
            label={`Cal: ${typeof macros.calories === 'string' 
              ? macros.calories 
              : Math.round(macros.calories)}`} 
            size="small" 
            variant="outlined" 
          />
        )}
        {macros.protein && (
          <Chip 
            label={`P: ${typeof macros.protein === 'string' 
              ? macros.protein 
              : Math.round(macros.protein) + 'g'}`} 
            size="small" 
            variant="outlined" 
          />
        )}
        {macros.carbs && (
          <Chip 
            label={`C: ${typeof macros.carbs === 'string' 
              ? macros.carbs 
              : Math.round(macros.carbs) + 'g'}`} 
            size="small" 
            variant="outlined" 
          />
        )}
        {macros.fat && (
          <Chip 
            label={`F: ${typeof macros.fat === 'string' 
              ? macros.fat 
              : Math.round(macros.fat) + 'g'}`} 
            size="small" 
            variant="outlined" 
          />
        )}
      </Box>
    );
  };

  const openDaySelection = (recipe, mealTime) => {
    setCurrentRecipe(recipe);
    setCurrentMealTime(mealTime);
    setOpenDaySelectionDialog(true);
  };

  const handleSelectDay = (day) => {
    // Create a unique key for the recipe placement
    const key = `day${day}_${currentMealTime}`;
    
    setSelectedRecipes(prev => ({
      ...prev,
      [key]: {
        ...currentRecipe,
        day,
        mealTime: currentMealTime
      }
    }));

    setOpenDaySelectionDialog(false);
    setCurrentRecipe(null);
    setCurrentMealTime(null);
    
    setSnackbarMessage(`Recipe added to Day ${day}`);
    setSnackbarOpen(true);
  };

  const handleRemoveRecipe = (key) => {
    const newSelectedRecipes = {...selectedRecipes};
    delete newSelectedRecipes[key];
    setSelectedRecipes(newSelectedRecipes);
    
    setSnackbarMessage('Recipe removed');
    setSnackbarOpen(true);
  };

  const handleSaveCustomMenu = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Convert selected recipes to the format expected by backend
      const recipes = Object.entries(selectedRecipes).map(([key, recipe]) => ({
        recipe_id: recipe.scraped_recipe_id || null,
        menu_recipe_id: recipe.recipe_id && !recipe.scraped_recipe_id ? String(recipe.recipe_id) : null,
        saved_recipe_id: recipe.saved_id || null,
        title: recipe.recipe_name || recipe.title,
        ingredients: recipe.ingredients || [],
        instructions: recipe.instructions || [],
        meal_time: recipe.mealTime === 'snacks' ? 'snack' : recipe.mealTime,
        servings: recipe.servings || 1,
        macros: recipe.macros || {},
        image_url: recipe.image_url || null
      }));

      // Prepare custom menu request in the format expected by backend
      const customMenuRequest = {
        user_id: user.userId,
        for_client_id: activeClient?.id || null,
        recipes: recipes,
        duration_days: 7,
        nickname: menuNickname || `Custom Menu ${new Date().toLocaleDateString()}`
      };

      console.log('Saving custom menu:', customMenuRequest);
      const response = await apiService.saveCustomMenu(customMenuRequest, activeClient?.id);
      
      setSnackbarMessage('Custom menu saved successfully!');
      setSnackbarOpen(true);
      
      setTimeout(() => {
        navigate(`/menu?menuId=${response.menu_id}`);
      }, 1500);
    } catch (err) {
      console.error('Failed to save custom menu', err);
      setError('Failed to save custom menu: ' + (err.message || 'Unknown error'));
    } finally {
      setLoading(false);
    }
  };

  const renderSelectedRecipes = () => {
    if (Object.keys(selectedRecipes).length === 0) {
      return (
        <Box sx={{ p: 2, textAlign: 'center' }}>
          <Typography color="text.secondary">
            No recipes selected yet. Choose recipes from below and add them to your custom menu.
          </Typography>
        </Box>
      );
    }
    
    return Object.entries(selectedRecipes).map(([key, recipe]) => (
      <Card key={key} variant="outlined" sx={{ mb: 1 }}>
        <CardContent>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <Box>
              <Typography variant="subtitle1">
                Day {recipe.day} - {recipe.mealTime.charAt(0).toUpperCase() + recipe.mealTime.slice(1)}: 
                {' '}{recipe.recipe_name || recipe.title}
              </Typography>
              
              {renderMacroChips(recipe)}
              
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {recipe.ingredients?.length > 0 && `${recipe.ingredients.length} ingredients • `}
                {recipe.instructions?.length > 0 && `${recipe.instructions.length} steps`}
              </Typography>
            </Box>
            <Button 
              color="error" 
              size="small" 
              onClick={() => handleRemoveRecipe(key)}
            >
              Remove
            </Button>
          </Box>
        </CardContent>
      </Card>
    ));
  };

  // Add client name to page title if building for a client
  const pageTitle = activeClient 
    ? `Custom Menu Builder for ${activeClient.name}`
    : 'Custom Menu Builder';

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" gutterBottom>
        {pageTitle}
      </Typography>
      
      <Typography variant="body1" paragraph>
        Create your own custom menu by selecting recipes from your saved collection.
      </Typography>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ my: 2 }}>
          {error}
        </Alert>
      )}

      {/* Selected Recipes Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" gutterBottom>
          Selected Recipes
        </Typography>
        {renderSelectedRecipes()}
      </Box>

      {/* Saved Recipes Section */}
      <Box sx={{ mb: 3 }}>
        <Typography variant="h5" gutterBottom>
          Saved Recipes
        </Typography>
        
        <Button 
          variant="outlined" 
          color="primary" 
          sx={{ mb: 2 }}
          onClick={() => navigate('/recipes')}
        >
          Add Recipes from Browser
        </Button>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : savedRecipes.length === 0 ? (
          <Alert severity="info">
            You don't have any saved recipes yet. Browse our recipe collection to save some first.
          </Alert>
        ) : (
          <Grid container spacing={3}>
            {savedRecipes.map((recipe) => (
              <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                <Card 
                  sx={{ 
                    height: '100%', 
                    display: 'flex', 
                    flexDirection: 'column',
                    transition: 'box-shadow 0.2s',
                    '&:hover': {
                      boxShadow: 3
                    }
                  }}
                >
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" gutterBottom>
                      {recipe.recipe_name || recipe.title}
                    </Typography>
                    
                    {renderMacroChips(recipe)}
                    
                    <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                      {recipe.ingredients?.length > 0 && `${recipe.ingredients.length} ingredients • `}
                      {recipe.instructions?.length > 0 && `${recipe.instructions.length} steps`}
                      {recipe.complexity && (
                        <Chip 
                          size="small" 
                          label={recipe.complexity} 
                          sx={{ ml: 1 }}
                          color={
                            recipe.complexity === 'easy' ? 'success' :
                            recipe.complexity === 'medium' ? 'warning' :
                            recipe.complexity === 'complex' ? 'error' : 
                            'default'
                          }
                        />
                      )}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    {['breakfast', 'lunch', 'dinner', 'snacks'].map((mealTime) => (
                      <Button 
                        key={mealTime}
                        size="small" 
                        onClick={() => openDaySelection(recipe, mealTime)}
                      >
                        {mealTime.charAt(0).toUpperCase() + mealTime.slice(1)}
                      </Button>
                    ))}
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>

      {/* Day Selection Dialog */}
      <Dialog 
        open={openDaySelectionDialog} 
        onClose={() => setOpenDaySelectionDialog(false)}
      >
        <DialogTitle>Select Day</DialogTitle>
        <DialogContent>
          <Grid container spacing={2} sx={{ mt: 1 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((day) => (
              <Grid item xs={4} key={day}>
                <Button 
                  variant="outlined" 
                  fullWidth 
                  onClick={() => handleSelectDay(day)}
                >
                  Day {day}
                </Button>
              </Grid>
            ))}
          </Grid>
        </DialogContent>
      </Dialog>

      {/* Menu Nickname and Save Button */}
      <Box sx={{ mt: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <TextField
          label="Menu Nickname (Optional)"
          variant="outlined"
          fullWidth
          sx={{ mb: 2, maxWidth: 400 }}
          value={menuNickname}
          onChange={(e) => setMenuNickname(e.target.value)}
        />
        <Button 
          variant="contained" 
          color="primary"
          onClick={handleSaveCustomMenu}
          disabled={Object.keys(selectedRecipes).length === 0 || loading}
          sx={{ minWidth: 200 }}
        >
          {loading ? (
            <>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              Saving...
            </>
          ) : 'Save Custom Menu'}
        </Button>
      </Box>
      
      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  );
};

export default CustomMenuBuilderPage;