import React, { useState, useEffect, useMemo } from 'react';
import { 
  Container, Typography, Grid, Paper, Box, Chip, Divider, 
  List, ListItem, ListItemText, Button, Alert,
  CircularProgress
} from '@mui/material';
import { useParams, useNavigate } from 'react-router-dom';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import AccessTimeIcon from '@mui/icons-material/AccessTime';
import RestaurantIcon from '@mui/icons-material/Restaurant';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import MacroDisplay from '../components/MacroDisplay';  
import RecipeSaveButton from '../components/RecipeSaveButton';

const RecipeDetailPage = () => {
  const [recipe, setRecipe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  console.log("Recipe detail page loaded with ID:", id);

  useEffect(() => {
    console.log("Recipe detail useEffect triggered with ID:", id);
    if (id) {
      fetchRecipeDetails();
    }
  }, [id]);

  // Add the useMemo hook right here, after your useEffect but before your other functions
  const nutritionData = useMemo(() => {
    if (!recipe) return null;
    
    // Check for metadata.nutrition_per_serving first (multi-user app structure)
    if (recipe.metadata && recipe.metadata.nutrition_per_serving) {
      return { perServing: recipe.metadata.nutrition_per_serving };
    }
    
    // Then check other formats
    if (recipe.macros) {
      return recipe.macros;
    } else if (recipe.nutrition) {
      // Format from scraped recipe
      return {
        perServing: {
          calories: recipe.nutrition.calories,
          protein: recipe.nutrition.protein,
          carbs: recipe.nutrition.carbohydrates || recipe.nutrition.carbs,
          fat: recipe.nutrition.fat
        }
      };
    } else {
      return null;
    }
  }, [recipe]);

  const fetchRecipeDetails = async () => {
    try {
      console.log("Fetching recipe details for ID:", id);
      setLoading(true);
      const recipeData = await apiService.getScrapedRecipeById(id);
      console.log("Fetched recipe data:", recipeData);
      
      // Check if the recipe is saved by current user
      try {
        if (user) {
          const savedStatus = await apiService.checkRecipeSaved(
            null, null, null, recipeData.id
          );
          recipeData.is_saved = savedStatus.is_saved;
          recipeData.saved_id = savedStatus.saved_id;
        }
      } catch (saveCheckErr) {
        console.warn('Error checking saved status:', saveCheckErr);
      }
      
      // Process ingredients - could be in the metadata for multi-user app
      if (recipeData.metadata && recipeData.metadata.ingredients_list) {
        recipeData.ingredients = recipeData.metadata.ingredients_list;
      }
      
      setRecipe(recipeData);
    } catch (err) {
      console.error('Error fetching recipe details:', err);
      setError('Failed to load recipe details. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSuccess = (result) => {
    console.log('Save result:', result);
    // Update local recipe state with saved status
    setRecipe({
      ...recipe,
      is_saved: result.isSaved,
      saved_id: result.savedId
    });
  };

  const handleBack = () => {
    navigate(-1);
  };

  const renderComplexityColor = (complexity) => {
    switch (complexity) {
      case 'easy':
        return 'success';
      case 'medium':
        return 'warning';
      case 'complex':
        return 'error';
      default:
        return 'default';
    }
  };

  if (loading) return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 8 }}>
        <CircularProgress />
      </Box>
      <Typography align="center">Loading recipe {id}...</Typography>
    </Container>
  );
  
  if (error) return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>Back</Button>
      <Alert severity="error">{error}</Alert>
      <Box sx={{ mt: 2 }}>
        <Typography>Debug info: ID param is {id}</Typography>
      </Box>
    </Container>
  );
  
  if (!recipe) return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Button startIcon={<ArrowBackIcon />} onClick={handleBack} sx={{ mb: 2 }}>Back</Button>
      <Alert severity="warning">Recipe not found</Alert>
      <Box sx={{ mt: 2 }}>
        <Typography>Debug info: ID param is {id}</Typography>
        <Button 
          variant="contained" 
          color="primary" 
          onClick={fetchRecipeDetails}
          sx={{ mt: 2 }}
        >
          Try Again
        </Button>
      </Box>
    </Container>
  );

  return (
    <Container maxWidth="lg" sx={{ my: 4 }}>
      <Button 
        startIcon={<ArrowBackIcon />} 
        onClick={handleBack}
        sx={{ mb: 2 }}
      >
        Back to Recipes
      </Button>
      
      <Paper sx={{ p: 3, mb: 4 }}>
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
              <Typography variant="h4" component="h1" gutterBottom>
                {recipe.title}
              </Typography>
              
              {/* Replace IconButton with RecipeSaveButton */}
              <RecipeSaveButton
                scraped={true}
                scrapedRecipeId={recipe.id}
                recipeTitle={recipe.title}
                isSaved={recipe.is_saved}
                savedId={recipe.saved_id}
                onSaveSuccess={handleSaveSuccess}
                recipeData={{
                  ingredients: recipe.ingredients,
                  instructions: recipe.instructions,
                  macros: nutritionData,
                  complexity_level: recipe.complexity || recipe.complexity_level,
                  servings: recipe.servings || 1,
                  recipe_source: 'scraped'
                }}
              />
            </Box>
            
            <Box sx={{ mb: 2, display: 'flex', gap: 1, flexWrap: 'wrap' }}>
              <Chip 
                label={recipe.complexity || 'Unknown difficulty'} 
                color={renderComplexityColor(recipe.complexity)}
              />
              {recipe.cuisine && (
                <Chip label={recipe.cuisine} variant="outlined" />
              )}
              <Chip label={`Source: ${recipe.source}`} variant="outlined" />
            </Box>
            
            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, gap: 2, flexWrap: 'wrap' }}>
              {recipe.prep_time && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">
                    Prep: {recipe.prep_time} mins
                  </Typography>
                </Box>
              )}
              
              {recipe.cook_time && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">
                    Cook: {recipe.cook_time} mins
                  </Typography>
                </Box>
              )}
              
              {recipe.total_time && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <AccessTimeIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">
                    Total: {recipe.total_time} mins
                  </Typography>
                </Box>
              )}
              
              {recipe.servings && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <RestaurantIcon fontSize="small" sx={{ mr: 0.5 }} />
                  <Typography variant="body2">
                    Servings: {recipe.servings}
                  </Typography>
                </Box>
              )}
            </Box>
            
            {recipe.tags && recipe.tags.length > 0 && (
              <Box sx={{ mb: 3 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Tags:
                </Typography>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                  {recipe.tags.map((tag, index) => (
                    <Chip 
                      key={index} 
                      label={tag} 
                      size="small" 
                      variant="outlined"
                      sx={{ mr: 0.5, mb: 0.5 }}
                    />
                  ))}
                </Box>
              </Box>
            )}

            {/* Display nutrition summary if available */}
            {nutritionData && (
              <Box sx={{ mt: 3 }}>
                <Typography variant="subtitle1">Nutrition Per Serving:</Typography>
                <MacroDisplay macros={nutritionData} type="chips" />
              </Box>
            )}

            {/* Debug info */}
            <Box sx={{ mt: 3, p: 2, backgroundColor: '#f5f5f5', borderRadius: 1 }}>
              <Typography variant="caption">
                Debug info: Recipe ID from URL: {id}
              </Typography>
            </Box>
          </Grid>
          
          <Grid item xs={12} md={4}>
            {recipe.image_url ? (
              <Box 
                component="img"
                src={recipe.image_url}
                alt={recipe.title}
                sx={{
                  width: '100%',
                  height: 300,
                  objectFit: 'cover',
                  borderRadius: 1
                }}
              />
            ) : (
              <Box
                sx={{
                  width: '100%',
                  height: 300,
                  backgroundColor: 'action.selected',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 1
                }}
              >
                <Typography variant="body1" color="text.secondary">
                  No image available
                </Typography>
              </Box>
            )}
          </Grid>
        </Grid>
      </Paper>
      
      <Grid container spacing={4}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" gutterBottom>
              Ingredients
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <List>
              {recipe.ingredients && recipe.ingredients.map((ingredient, index) => (
                <ListItem key={index} disablePadding sx={{ py: 0.5 }}>
                  <ListItemText 
                    primary={
                      typeof ingredient === 'string' 
                        ? ingredient 
                        : ingredient.name 
                          ? ingredient.name
                          : (ingredient.ingredient && ingredient.amount)
                            ? `${ingredient.amount} ${ingredient.ingredient}`
                            : JSON.stringify(ingredient)
                    }
                    secondary={ingredient.notes}
                  />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
        
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h5" gutterBottom>
              Instructions
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <List>
              {Array.isArray(recipe.instructions) ? (
                recipe.instructions.map((step, index) => (
                  <ListItem key={index} sx={{ py: 1 }}>
                    <ListItemText 
                      primary={
                        <Typography variant="body1" component="div">
                          <Box component="span" sx={{ fontWeight: 'bold', mr: 1 }}>
                            {index + 1}.
                          </Box>
                          {step}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))
              ) : (
                <ListItem>
                  <ListItemText primary={recipe.instructions || "No instructions available"} />
                </ListItem>
              )}
            </List>
          </Paper>
        </Grid>
        
        {/* Recipe Notes Section */}
        {recipe.notes && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mt: 2 }}>
              <Typography variant="h5" gutterBottom>
                Recipe Notes
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <Typography variant="body1" sx={{ whiteSpace: 'pre-wrap' }}>
                {recipe.notes}
              </Typography>
            </Paper>
          </Grid>
        )}
        
        {/* Add Detailed Nutrition Section */}
        {nutritionData && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mt: 2 }}>
              <Typography variant="h5" gutterBottom>
                Nutrition Information
              </Typography>
              <Divider sx={{ mb: 2 }} />
              <MacroDisplay 
                macros={nutritionData} 
                type="detailed" 
                showServings={true}
                servings={recipe.servings || 1}
              />
            </Paper>
          </Grid>
        )}
      </Grid>
    </Container>
  );
};

export default RecipeDetailPage;