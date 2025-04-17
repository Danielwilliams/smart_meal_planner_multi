// src/components/ClientSavedRecipes.jsx
import React, { useState, useEffect } from 'react';
import { 
  Typography, Paper, Box, Grid, Card, CardContent, CardMedia, CardActions,
  Button, CircularProgress, Divider, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, Alert, Tab, Tabs
} from '@mui/material';
import { 
  Star, StarBorder, Bookmark, BookmarkBorder, FavoriteBorder, Favorite,
  RestaurantMenu, Add, MoreVert, VisibilityOff, Visibility, AddToQueue
} from '@mui/icons-material';
import apiService from '../services/apiService';

function ClientSavedRecipes({ clientId, clientName }) {
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetailsOpen, setRecipeDetailsOpen] = useState(false);
  const [tab, setTab] = useState(0);

  useEffect(() => {
    const fetchSavedRecipes = async () => {
      try {
        setLoading(true);
        setError('');
        
        const recipes = await apiService.getClientSavedRecipes(clientId);
        console.log('Fetched client saved recipes:', recipes);
        setSavedRecipes(recipes);
      } catch (err) {
        console.error('Error fetching client saved recipes:', err);
        setError('Failed to load saved recipes. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    if (clientId) {
      fetchSavedRecipes();
    }
  }, [clientId]);

  const handleRecipeClick = (recipe) => {
    setSelectedRecipe(recipe);
    setRecipeDetailsOpen(true);
  };

  const handleCloseRecipeDetails = () => {
    setRecipeDetailsOpen(false);
  };

  const handleAddToCustomMenu = (recipe) => {
    // Placeholder for adding to custom menu functionality
    console.log('Add to custom menu:', recipe);
    // This will be implemented in a future update
  };

  const handleTabChange = (event, newValue) => {
    setTab(newValue);
  };

  // Function to format recipe type for display
  const formatRecipeType = (recipeSource) => {
    if (!recipeSource) return 'Custom Recipe';
    
    if (recipeSource === 'scraped') return 'Database Recipe';
    if (recipeSource === 'menu') return 'Menu Recipe';
    if (recipeSource === 'custom') return 'Custom Recipe';
    
    return recipeSource.charAt(0).toUpperCase() + recipeSource.slice(1);
  };

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ mt: 2 }}>
        {error}
      </Alert>
    );
  }

  // Categorize recipes by type
  const menuRecipes = savedRecipes.filter(recipe => recipe.recipe_source === 'menu');
  const scrapedRecipes = savedRecipes.filter(recipe => recipe.recipe_source === 'scraped');
  const customRecipes = savedRecipes.filter(recipe => 
    recipe.recipe_source === 'custom' || !recipe.recipe_source
  );

  return (
    <Box sx={{ mt: 2 }}>
      <Paper sx={{ p: 2, mb: 2 }}>
        <Typography variant="h6" gutterBottom>
          {clientName}'s Saved Recipes
        </Typography>
        
        {savedRecipes.length === 0 ? (
          <Alert severity="info">
            This client hasn't saved any recipes yet.
          </Alert>
        ) : (
          <>
            <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 2 }}>
              <Tabs 
                value={tab} 
                onChange={handleTabChange}
                aria-label="recipe categories"
              >
                <Tab label={`All (${savedRecipes.length})`} />
                <Tab label={`Menu Recipes (${menuRecipes.length})`} />
                <Tab label={`Database Recipes (${scrapedRecipes.length})`} />
                <Tab label={`Custom Recipes (${customRecipes.length})`} />
              </Tabs>
            </Box>
            
            <Grid container spacing={2}>
              {(tab === 0 ? savedRecipes : 
                tab === 1 ? menuRecipes :
                tab === 2 ? scrapedRecipes :
                customRecipes).map((recipe) => (
                <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                  <Card 
                    sx={{ 
                      height: '100%', 
                      display: 'flex', 
                      flexDirection: 'column',
                      '&:hover': {
                        boxShadow: 6
                      }
                    }}
                  >
                    <CardMedia
                      component="img"
                      height="140"
                      image={recipe.image_url || 'https://via.placeholder.com/300x140?text=No+Image'}
                      alt={recipe.recipe_name || 'Saved recipe'}
                    />
                    <CardContent sx={{ flexGrow: 1 }}>
                      <Typography variant="h6" component="div" noWrap>
                        {recipe.recipe_name || 'Unnamed Recipe'}
                      </Typography>
                      <Chip 
                        size="small"
                        label={formatRecipeType(recipe.recipe_source)}
                        sx={{ mt: 1, mr: 1 }}
                      />
                      {recipe.complexity_level && (
                        <Chip 
                          size="small"
                          label={`Difficulty: ${recipe.complexity_level}`}
                          sx={{ mt: 1 }}
                        />
                      )}
                      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                        {recipe.notes ? 
                          (recipe.notes.length > 100 ? 
                            `${recipe.notes.substring(0, 100)}...` : 
                            recipe.notes) : 
                          'No description'}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions>
                      <Button 
                        size="small" 
                        onClick={() => handleRecipeClick(recipe)}
                      >
                        View Details
                      </Button>
                      <Button
                        size="small"
                        color="primary"
                        startIcon={<AddToQueue />}
                        onClick={() => handleAddToCustomMenu(recipe)}
                      >
                        Add to Menu
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))}
            </Grid>
          </>
        )}
      </Paper>

      {/* Recipe Details Dialog */}
      <Dialog 
        open={recipeDetailsOpen} 
        onClose={handleCloseRecipeDetails}
        maxWidth="md"
        fullWidth
      >
        {selectedRecipe && (
          <>
            <DialogTitle>
              {selectedRecipe.recipe_name || 'Recipe Details'}
            </DialogTitle>
            <DialogContent dividers>
              <Box sx={{ mb: 2 }}>
                {selectedRecipe.image_url && (
                  <Box sx={{ maxWidth: '100%', maxHeight: '300px', overflow: 'hidden', mb: 2 }}>
                    <img 
                      src={selectedRecipe.image_url} 
                      alt={selectedRecipe.recipe_name} 
                      style={{ width: '100%', objectFit: 'cover' }}
                    />
                  </Box>
                )}
                
                <Typography variant="h6" gutterBottom>Description</Typography>
                <Typography paragraph>
                  {selectedRecipe.notes || 'No description available'}
                </Typography>
              </Box>
              
              {selectedRecipe.macros && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>Nutrition Information</Typography>
                  <Grid container spacing={2}>
                    {['calories', 'protein', 'carbs', 'fat'].map(macro => 
                      selectedRecipe.macros[macro] && (
                        <Grid item xs={6} sm={3} key={macro}>
                          <Paper sx={{ p: 1, textAlign: 'center' }}>
                            <Typography variant="body2" color="text.secondary">
                              {macro.charAt(0).toUpperCase() + macro.slice(1)}
                            </Typography>
                            <Typography variant="body1">
                              {macro === 'calories' ? 
                                `${selectedRecipe.macros[macro]} kcal` : 
                                `${selectedRecipe.macros[macro]}g`}
                            </Typography>
                          </Paper>
                        </Grid>
                      )
                    )}
                  </Grid>
                </Box>
              )}
              
              {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>Ingredients</Typography>
                  <ul>
                    {selectedRecipe.ingredients.map((ingredient, idx) => (
                      <li key={idx}>
                        <Typography variant="body1">
                          {typeof ingredient === 'string' ? 
                            ingredient : 
                            ingredient.name}
                        </Typography>
                      </li>
                    ))}
                  </ul>
                </Box>
              )}
              
              {selectedRecipe.instructions && selectedRecipe.instructions.length > 0 && (
                <Box sx={{ mb: 2 }}>
                  <Typography variant="h6" gutterBottom>Instructions</Typography>
                  <ol>
                    {selectedRecipe.instructions.map((step, idx) => (
                      <li key={idx}>
                        <Typography variant="body1" paragraph>
                          {typeof step === 'string' ? 
                            step : 
                            step.text || step.step}
                        </Typography>
                      </li>
                    ))}
                  </ol>
                </Box>
              )}
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 2 }}>
                {selectedRecipe.complexity_level && (
                  <Chip 
                    label={`Difficulty: ${selectedRecipe.complexity_level}`}
                    variant="outlined"
                  />
                )}
                
                {selectedRecipe.servings && (
                  <Chip 
                    label={`Servings: ${selectedRecipe.servings}`}
                    variant="outlined"
                  />
                )}
                
                {selectedRecipe.recipe_source && (
                  <Chip 
                    label={formatRecipeType(selectedRecipe.recipe_source)}
                    variant="outlined"
                  />
                )}
                
                {selectedRecipe.appliance_used && (
                  <Chip 
                    label={`Appliance: ${selectedRecipe.appliance_used}`}
                    variant="outlined"
                  />
                )}
              </Box>
            </DialogContent>
            <DialogActions>
              <Button 
                onClick={handleCloseRecipeDetails}
                color="primary"
              >
                Close
              </Button>
              <Button
                color="primary"
                variant="contained"
                startIcon={<AddToQueue />}
                onClick={() => {
                  handleAddToCustomMenu(selectedRecipe);
                  handleCloseRecipeDetails();
                }}
              >
                Add to Menu
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </Box>
  );
}

export default ClientSavedRecipes;