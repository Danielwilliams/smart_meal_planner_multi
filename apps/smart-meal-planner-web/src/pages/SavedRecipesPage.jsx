import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

// Material UI imports
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Grid, 
  Box, 
  CircularProgress, 
  Alert, 
  Chip, 
  Divider, 
  Paper,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import { 
  FreeBreakfast as BreakfastIcon,
  Restaurant as DinnerIcon,
  Fastfood as LunchIcon,
  Apple as SnackIcon,
  Delete as DeleteIcon,
  Visibility as ViewIcon,
  Close as CloseIcon,
  ExpandMore as ExpandMoreIcon
} from '@mui/icons-material';

const SavedRecipesPage = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetails, setRecipeDetails] = useState(null);
  const [loadingRecipeDetails, setLoadingRecipeDetails] = useState(false);

  useEffect(() => {
    const fetchSavedRecipes = async () => {
      if (!user) {
        navigate('/login');
        return;
      }   

      try {
        setLoading(true);
        setError('');   

        const response = await apiService.getSavedRecipes();
        console.log('Saved recipes response:', response);
        setSavedRecipes(response || []);
      } catch (err) {
        console.error('API error:', err);
        setError(err.message || 'Failed to fetch saved recipes');
      } finally {
        setLoading(false);
      }
    };

    fetchSavedRecipes();
  }, [user, navigate]);

  const handleViewRecipe = async (recipeId, menuId, recipe = null) => {
    try {
      setSelectedRecipe({ recipeId, menuId });
      setDialogOpen(true);
      setLoadingRecipeDetails(true);

      // Check if this is a scraped recipe (no menu_id)
      if (!menuId || menuId === null) {
        // For scraped recipes, try to get the stored recipe data directly
        const scrapedRecipe = savedRecipes.find(r => r.recipe_id === recipeId || r.id === recipeId);
        if (scrapedRecipe) {
          console.log('🐛 Raw scraped recipe data:', scrapedRecipe);

          // Parse ingredients - use scraped data first, fallback to saved data
          let ingredients = [];
          const ingredientSource = scrapedRecipe.scraped_ingredients || scrapedRecipe.ingredients;
          if (ingredientSource && ingredientSource !== null) {
            if (typeof ingredientSource === 'string') {
              try {
                const parsed = JSON.parse(ingredientSource);
                ingredients = Array.isArray(parsed) ? parsed : [parsed];
              } catch (e) {
                ingredients = [ingredientSource]; // Treat as single ingredient
              }
            } else if (Array.isArray(ingredientSource)) {
              ingredients = ingredientSource;
            } else if (typeof ingredientSource === 'object') {
              // Convert object to array
              ingredients = Object.values(ingredientSource);
            }
          }

          // Parse instructions - use scraped data first, fallback to saved data
          let instructions = [];
          const instructionSource = scrapedRecipe.scraped_instructions || scrapedRecipe.instructions;
          if (instructionSource && instructionSource !== null) {
            if (typeof instructionSource === 'string') {
              try {
                const parsed = JSON.parse(instructionSource);
                instructions = Array.isArray(parsed) ? parsed : [parsed];
              } catch (e) {
                instructions = [instructionSource]; // Treat as single instruction
              }
            } else if (Array.isArray(instructionSource)) {
              instructions = instructionSource;
            } else if (typeof instructionSource === 'object') {
              // Convert object to array
              instructions = Object.values(instructionSource);
            }
          }

          console.log('🐛 Parsed ingredients:', ingredients);
          console.log('🐛 Parsed instructions:', instructions);

          // Create a recipe object from the stored data
          const recipeDetails = {
            title: scrapedRecipe.recipe_name,
            ingredients: ingredients,
            instructions: instructions,
            macros: scrapedRecipe.scraped_macros || scrapedRecipe.macros,
            complexity_level: scrapedRecipe.scraped_complexity || scrapedRecipe.complexity_level,
            servings: scrapedRecipe.scraped_servings || scrapedRecipe.servings,
            recipe_source: 'scraped'
          };

          console.log('🐛 Final recipe details:', recipeDetails);

          setRecipeDetails(recipeDetails);
          setLoadingRecipeDetails(false);
          return;
        }
      }

      // For menu recipes, fetch the menu details to get the recipe details
      const menuDetails = await apiService.getMenuDetails(menuId);
      
      // Find the recipe in the menu
      let foundRecipe = null;
      
      if (menuDetails && menuDetails.meal_plan && menuDetails.meal_plan.days) {
        // Search through all days, meals and snacks
        for (const day of menuDetails.meal_plan.days) {
          if (day.meals) {
            for (const meal of day.meals) {
              if (meal.id === recipeId || 
                 (meal.meal_time && meal.title && 
                  savedRecipes.some(r => 
                    r.recipe_id === recipeId && 
                    r.meal_time === meal.meal_time && 
                    r.recipe_name === meal.title))) {
                foundRecipe = meal;
                break;
              }
            }
          }
          
          if (!foundRecipe && day.snacks) {
            for (const snack of day.snacks) {
              if (snack.id === recipeId || 
                 (snack.title && 
                  savedRecipes.some(r => 
                    r.recipe_id === recipeId && 
                    r.recipe_name === snack.title))) {
                foundRecipe = snack;
                break;
              }
            }
          }
          
          if (foundRecipe) break;
        }
      }
      
      setRecipeDetails(foundRecipe);
      setLoadingRecipeDetails(false);
    } catch (err) {
      console.error('Error fetching recipe details:', err);
      setLoadingRecipeDetails(false);
      setError('Failed to load recipe details');
    }
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setSelectedRecipe(null);
    setRecipeDetails(null);
  };

  const handleRemoveSaved = async (savedId) => {
    try {
      await apiService.unsaveRecipe(savedId);
      setSavedRecipes(prev => prev.filter(recipe => recipe.id !== savedId));
    } catch (err) {
      console.error('Error removing saved recipe:', err);
      setError(err.message || 'Failed to remove saved recipe');
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    }).format(date);
  };

  const getMealTimeIcon = (mealTime) => {
    switch (mealTime?.toLowerCase()) {
      case 'breakfast':
        return <BreakfastIcon />;
      case 'lunch':
        return <LunchIcon />;
      case 'dinner':
        return <DinnerIcon />;
      case 'snack':
      case 'snacks':
        return <SnackIcon />;
      default:
        return <DinnerIcon />;
    }
  };

  // Helper function to format ingredients
  const formatIngredient = (ingredient) => {
    if (typeof ingredient === 'string') {
      return ingredient;
    }
    
    if (ingredient.ingredient && ingredient.amount) {
      return `${ingredient.amount} ${ingredient.ingredient}`;
    }
    
    if (ingredient.name && ingredient.quantity) {
      return `${ingredient.quantity} ${ingredient.name}`;
    }
    
    if (ingredient.item && ingredient.quantity) {
      return `${ingredient.quantity} ${ingredient.item}`;
    }
    
    return JSON.stringify(ingredient);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Typography variant="h4" component="h1" gutterBottom sx={{ mb: 3 }}>
        Your Saved Recipes
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      {!loading && savedRecipes.length === 0 && (
        <Paper sx={{ p: 4, textAlign: 'center', bgcolor: 'background.paper' }}>
          <Typography variant="h6" gutterBottom>
            You haven't saved any recipes yet
          </Typography>
          <Typography variant="body1" color="textSecondary" sx={{ mb: 3 }}>
            Click the heart icon on any recipe to save it to your favorites.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/menu')}
          >
            Browse Your Menus
          </Button>
        </Paper>
      )}

      <Grid container spacing={3}>
        {savedRecipes.map(recipe => (
          <Grid item xs={12} sm={6} md={4} key={recipe.id}>
            <Card sx={{ 
              height: '100%', 
              display: 'flex', 
              flexDirection: 'column',
              transition: 'box-shadow 0.3s',
              '&:hover': {
                boxShadow: 6
              }
            }}>
              <CardContent sx={{ flex: '1 0 auto' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                  <Box sx={{ mr: 1 }}>
                    {getMealTimeIcon(recipe.meal_time)}
                  </Box>
                  <Typography variant="h6" component="h2">
                    {recipe.recipe_name || 'Unnamed Recipe'}
                  </Typography>
                </Box>

                <Typography color="textSecondary" variant="body2" sx={{ mb: 1 }}>
                  From: {recipe.menu_nickname || `Menu from ${formatDate(recipe.created_at)}`}
                </Typography>

                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, my: 1 }}>
                  {recipe.meal_time && (
                    <Chip 
                      size="small" 
                      label={recipe.meal_time.charAt(0).toUpperCase() + recipe.meal_time.slice(1)} 
                      color="primary"
                      variant="outlined"
                    />
                  )}
                  {recipe.day_number && (
                    <Chip 
                      size="small" 
                      label={`Day ${recipe.day_number}`}
                      variant="outlined"
                    />
                  )}
                </Box>

                {recipe.notes && (
                  <Box sx={{ 
                    mt: 2, 
                    p: 1.5, 
                    bgcolor: 'rgb(255, 244, 229)',
                    borderRadius: 1 
                  }}>
                    <Typography variant="subtitle2">Notes:</Typography>
                    <Typography variant="body2">{recipe.notes}</Typography>
                  </Box>
                )}
              </CardContent>

              <Divider />

              <Box sx={{ 
                display: 'flex', 
                justifyContent: 'space-between', 
                p: 1.5 
              }}>
                <Button
                  startIcon={<ViewIcon />}
                  onClick={() => handleViewRecipe(recipe.recipe_id, recipe.menu_id, recipe)}
                  size="small"
                  variant="contained"
                >
                  View Recipe
                </Button>
                <Button 
                  startIcon={<DeleteIcon />}
                  onClick={() => handleRemoveSaved(recipe.id)}
                  size="small"
                  variant="outlined"
                  color="error"
                >
                  Remove
                </Button>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Recipe Details Dialog */}
      <Dialog 
        open={dialogOpen} 
        onClose={handleCloseDialog}
        fullWidth
        maxWidth="md"
        scroll="paper"
      >
        <DialogTitle sx={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          pb: 1 
        }}>
          <Box sx={{ display: 'flex', alignItems: 'center' }}>
            {recipeDetails && getMealTimeIcon(recipeDetails.meal_time)}
            <Typography variant="h6" component="div" sx={{ ml: 1 }}>
              {recipeDetails ? recipeDetails.title : 'Loading Recipe...'}
            </Typography>
          </Box>
          <IconButton 
            edge="end" 
            color="inherit" 
            onClick={handleCloseDialog} 
            aria-label="close"
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          {loadingRecipeDetails ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
              <CircularProgress />
            </Box>
          ) : !recipeDetails ? (
            <Alert severity="warning">
              Recipe details could not be found. The menu might have been updated.
            </Alert>
          ) : (
            <>
              <Accordion defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="ingredients-content"
                  id="ingredients-header"
                >
                  <Typography variant="h6">Ingredients</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  <List dense>
                    {recipeDetails.ingredients && recipeDetails.ingredients.map((ingredient, idx) => (
                      <ListItem key={idx}>
                        <ListItemText primary={formatIngredient(ingredient)} />
                      </ListItem>
                    ))}
                  </List>
                </AccordionDetails>
              </Accordion>

              <Accordion defaultExpanded>
                <AccordionSummary
                  expandIcon={<ExpandMoreIcon />}
                  aria-controls="instructions-content"
                  id="instructions-header"
                >
                  <Typography variant="h6">Instructions</Typography>
                </AccordionSummary>
                <AccordionDetails>
                  {Array.isArray(recipeDetails.instructions) ? (
                    <List dense>
                      {recipeDetails.instructions.map((step, idx) => (
                        <ListItem key={idx}>
                          <ListItemText primary={`${idx + 1}. ${step}`} />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography paragraph>{recipeDetails.instructions}</Typography>
                  )}
                </AccordionDetails>
              </Accordion>

              {recipeDetails.macros && (
                <Accordion>
                  <AccordionSummary
                    expandIcon={<ExpandMoreIcon />}
                    aria-controls="macros-content"
                    id="macros-header"
                  >
                    <Typography variant="h6">Nutrition Information</Typography>
                  </AccordionSummary>
                  <AccordionDetails>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle1">Per Serving:</Typography>
                      <Typography variant="body2">
                        Calories: {recipeDetails.macros.perServing?.calories || 'N/A'} |
                        Protein: {recipeDetails.macros.perServing?.protein || 'N/A'} |
                        Carbs: {recipeDetails.macros.perServing?.carbs || 'N/A'} |
                        Fat: {recipeDetails.macros.perServing?.fat || 'N/A'}
                      </Typography>
                    </Box>
                    
                    <Typography variant="subtitle1">Total Recipe ({recipeDetails.servings || 1} servings):</Typography>
                    <Typography variant="body2">
                      Calories: {recipeDetails.macros.perMeal?.calories || 'N/A'} |
                      Protein: {recipeDetails.macros.perMeal?.protein || 'N/A'} |
                      Carbs: {recipeDetails.macros.perMeal?.carbs || 'N/A'} |
                      Fat: {recipeDetails.macros.perMeal?.fat || 'N/A'}
                    </Typography>
                  </AccordionDetails>
                </Accordion>
              )}

              {recipeDetails.complexity_level && (
                <Box sx={{ mt: 2 }}>
                  <Chip 
                    label={`Complexity: ${recipeDetails.complexity_level}`} 
                    color="primary" 
                    variant="outlined"
                    sx={{ mr: 1 }}
                  />
                  {recipeDetails.appliance_used && (
                    <Chip 
                      label={`Appliance: ${recipeDetails.appliance_used}`} 
                      color="secondary" 
                      variant="outlined" 
                    />
                  )}
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} color="primary">
            Close
          </Button>
          <Button 
            onClick={() => navigate(`/menu?menuId=${selectedRecipe?.menuId}`)} 
            color="primary" 
            variant="contained"
          >
            View Full Menu
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default SavedRecipesPage;