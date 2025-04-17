// src/components/ClientSavedRecipes.jsx
import React, { useState, useEffect } from 'react';
import { 
  Typography, Paper, Box, Grid, Card, CardContent, CardMedia, CardActions,
  Button, CircularProgress, Divider, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, IconButton, Tooltip, Alert, Tab, Tabs, TextField, MenuItem,
  Select, FormControl, InputLabel, Snackbar
} from '@mui/material';
import { 
  Star, StarBorder, Bookmark, BookmarkBorder, FavoriteBorder, Favorite,
  RestaurantMenu, Add, MoreVert, VisibilityOff, Visibility, AddToQueue,
  MenuBook, Restaurant
} from '@mui/icons-material';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';

function ClientSavedRecipes({ clientId, clientName }) {
  const navigate = useNavigate();
  const [savedRecipes, setSavedRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  const [recipeDetailsOpen, setRecipeDetailsOpen] = useState(false);
  const [tab, setTab] = useState(0);
  
  // Menu functionality
  const [menuDialogOpen, setMenuDialogOpen] = useState(false);
  const [menuOptions, setMenuOptions] = useState([]);
  const [selectedMenuId, setSelectedMenuId] = useState('');
  const [menuLoading, setMenuLoading] = useState(false);
  const [menuActionType, setMenuActionType] = useState('add'); // 'add' or 'create'
  const [recipeForMenu, setRecipeForMenu] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  
  // For new menu creation
  const [newMenuName, setNewMenuName] = useState('');

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

  const fetchMenuOptions = async () => {
    try {
      // Fetch menus created for this client
      const menus = await apiService.getMenusForClient(clientId);
      console.log('Available menus for client:', menus);
      setMenuOptions(menus || []);
      return menus;
    } catch (err) {
      console.error('Error fetching menus:', err);
      return [];
    }
  };

  const handleAddToCustomMenu = (recipe) => {
    // Set the recipe we want to add to a menu
    setRecipeForMenu(recipe);
    
    // Start by fetching available menus
    setMenuLoading(true);
    fetchMenuOptions()
      .then(menus => {
        // If we have existing menus, set to 'add' mode, otherwise 'create' mode
        if (menus && menus.length > 0) {
          setMenuActionType('add');
          setSelectedMenuId(menus[0]?.menu_id || '');
        } else {
          setMenuActionType('create');
          setNewMenuName(`${clientName}'s Custom Menu`);
        }
        setMenuDialogOpen(true);
      })
      .finally(() => {
        setMenuLoading(false);
      });
  };
  
  const handleCloseMenuDialog = () => {
    setMenuDialogOpen(false);
    setSelectedMenuId('');
    setNewMenuName('');
  };
  
  const handleAddRecipeToMenu = async () => {
    if (!recipeForMenu) return;
    
    setMenuLoading(true);
    try {
      if (menuActionType === 'add' && selectedMenuId) {
        // Add to existing menu
        // Prepare the recipe in the format expected by the backend
        const recipeToAdd = {
          recipe_name: recipeForMenu.recipe_name,
          ingredients: recipeForMenu.ingredients || [],
          instructions: recipeForMenu.instructions || [],
          image_url: recipeForMenu.image_url,
          meal_time: 'dinner', // Default meal time
          day_number: 1, // Default day number
          notes: recipeForMenu.notes,
          macros: recipeForMenu.macros || {},
          complexity_level: recipeForMenu.complexity_level,
          servings: recipeForMenu.servings || 1,
          source: recipeForMenu.recipe_source || 'custom'
        };
        
        const result = await apiService.addRecipeToCustomMenu(selectedMenuId, recipeToAdd);
        console.log('Recipe added to menu:', result);
        setSnackbarMessage(`Recipe added to menu successfully!`);
      } else if (menuActionType === 'create' && newMenuName) {
        // Create a new menu
        const menuData = {
          name: newMenuName,
          recipes: [{
            recipe_name: recipeForMenu.recipe_name,
            ingredients: recipeForMenu.ingredients || [],
            instructions: recipeForMenu.instructions || [],
            image_url: recipeForMenu.image_url,
            meal_time: 'dinner',
            day_number: 1,
            notes: recipeForMenu.notes,
            macros: recipeForMenu.macros || {},
            complexity_level: recipeForMenu.complexity_level,
            servings: recipeForMenu.servings || 1,
            source: recipeForMenu.recipe_source || 'custom'
          }]
        };
        
        const result = await apiService.saveCustomMenu(menuData, clientId);
        console.log('New menu created with recipe:', result);
        setSnackbarMessage(`New menu "${newMenuName}" created with recipe!`);
      }
      
      setSnackbarOpen(true);
      handleCloseMenuDialog();
    } catch (err) {
      console.error('Error adding recipe to menu:', err);
      setSnackbarMessage(`Error: ${err.message || 'Failed to add recipe to menu'}`);
      setSnackbarOpen(true);
    } finally {
      setMenuLoading(false);
    }
  };
  
  const handleViewInMenuBuilder = () => {
    if (menuActionType === 'add' && selectedMenuId) {
      // Navigate to menu builder with the selected menu ID
      navigate(`/menu?menuId=${selectedMenuId}&clientId=${clientId}`);
    } else if (menuActionType === 'create') {
      // Navigate to menu builder for new menu
      navigate(`/menu?clientId=${clientId}`);
    }
    handleCloseMenuDialog();
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
                      image={recipe.image_url || `https://via.placeholder.com/300x140?text=${encodeURIComponent(recipe.recipe_name || 'Recipe')}`}
                      alt={recipe.recipe_name || 'Saved recipe'}
                      onError={(e) => {
                        console.log('Image failed to load:', recipe.image_url);
                        // Fallback image based on recipe source or cuisine
                        const fallbackImage = recipe.cuisine 
                          ? `https://source.unsplash.com/300x140/?food,${recipe.cuisine}`
                          : 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=300&h=140&q=80';
                        e.target.src = fallbackImage;
                      }}
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
                <Box sx={{ maxWidth: '100%', maxHeight: '300px', overflow: 'hidden', mb: 2 }}>
                  <img 
                    src={selectedRecipe.image_url || `https://via.placeholder.com/800x400?text=${encodeURIComponent(selectedRecipe.recipe_name || 'Recipe Details')}`}
                    alt={selectedRecipe.recipe_name} 
                    style={{ width: '100%', objectFit: 'cover' }}
                    onError={(e) => {
                      console.log('Detail image failed to load:', selectedRecipe.image_url);
                      // Fallback image based on recipe source or cuisine
                      const fallbackImage = selectedRecipe.cuisine 
                        ? `https://source.unsplash.com/800x400/?food,${selectedRecipe.cuisine}`
                        : 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=800&h=400&q=80';
                      e.target.src = fallbackImage;
                    }}
                  />
                </Box>
                
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

      {/* Menu Dialog - for adding recipe to menu */}
      <Dialog
        open={menuDialogOpen}
        onClose={handleCloseMenuDialog}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>
          {menuActionType === 'add' ? 'Add Recipe to Menu' : 'Create New Menu with Recipe'}
        </DialogTitle>
        <DialogContent dividers>
          {menuLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
              <CircularProgress />
            </Box>
          ) : (
            <>
              {menuActionType === 'add' ? (
                // Select existing menu
                <FormControl fullWidth sx={{ mb: 2 }}>
                  <InputLabel id="menu-select-label">Select Menu</InputLabel>
                  <Select
                    labelId="menu-select-label"
                    id="menu-select"
                    value={selectedMenuId}
                    label="Select Menu"
                    onChange={(e) => setSelectedMenuId(e.target.value)}
                  >
                    {menuOptions.map((menu) => (
                      <MenuItem key={menu.menu_id} value={menu.menu_id}>
                        {menu.name || menu.nickname || `Menu ${menu.menu_id}`}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              ) : (
                // Create new menu
                <TextField
                  autoFocus
                  margin="dense"
                  id="menu-name"
                  label="Menu Name"
                  type="text"
                  fullWidth
                  variant="outlined"
                  value={newMenuName}
                  onChange={(e) => setNewMenuName(e.target.value)}
                />
              )}

              {recipeForMenu && (
                <Box sx={{ mt: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Recipe to add:
                  </Typography>
                  <Paper sx={{ p: 2, display: 'flex', alignItems: 'center', gap: 2 }}>
                    <Box sx={{ width: 60, height: 60, overflow: 'hidden', borderRadius: 1 }}>
                      <img 
                        src={recipeForMenu.image_url || `https://via.placeholder.com/60x60?text=${encodeURIComponent(recipeForMenu.recipe_name?.charAt(0) || 'R')}`}
                        alt={recipeForMenu.recipe_name} 
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        onError={(e) => {
                          // Simple fallback for the small thumbnail
                          e.target.src = 'https://images.unsplash.com/photo-1512621776951-a57141f2eefd?ixlib=rb-4.0.3&ixid=MnwxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8&auto=format&fit=crop&w=60&h=60&q=80';
                        }}
                      />
                    </Box>
                    <Box>
                      <Typography variant="subtitle2">
                        {recipeForMenu.recipe_name || 'Unnamed Recipe'}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        {recipeForMenu.notes ? 
                          (recipeForMenu.notes.length > 50 ? 
                            `${recipeForMenu.notes.substring(0, 50)}...` : 
                            recipeForMenu.notes) : 
                          'No description'}
                      </Typography>
                    </Box>
                  </Paper>
                </Box>
              )}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseMenuDialog}>
            Cancel
          </Button>
          <Button
            onClick={handleViewInMenuBuilder}
            startIcon={<MenuBook />}
          >
            View in Menu Builder
          </Button>
          <Button
            onClick={handleAddRecipeToMenu}
            variant="contained"
            color="primary"
            disabled={menuLoading || (menuActionType === 'add' && !selectedMenuId) || (menuActionType === 'create' && !newMenuName)}
            startIcon={<Add />}
          >
            {menuActionType === 'add' ? 'Add to Menu' : 'Create Menu'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Box>
  );
}

export default ClientSavedRecipes;