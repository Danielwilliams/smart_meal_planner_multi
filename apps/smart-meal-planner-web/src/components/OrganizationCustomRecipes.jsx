// src/components/OrganizationCustomRecipes.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Alert,
  CircularProgress,
  IconButton,
  Paper,
  Menu,
  MenuItem,
  ListItemIcon,
  Fab,
  Tooltip
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  MoreVert as MoreVertIcon,
  Restaurant as RecipeIcon,
  Search as SearchIcon,
  Visibility as ViewIcon,
  FilterList as FilterIcon
} from '@mui/icons-material';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import CustomRecipeCreationDialog from './CustomRecipeCreationDialog';

const OrganizationCustomRecipes = () => {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Filter and Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [cuisineFilter, setCuisineFilter] = useState('');

  // Dialog State
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);

  // Menu State
  const [anchorEl, setAnchorEl] = useState(null);
  const [menuRecipe, setMenuRecipe] = useState(null);

  // Load recipes on component mount
  useEffect(() => {
    if (organization?.id) {
      loadCustomRecipes();
    }
  }, [organization?.id]);

  const loadCustomRecipes = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Get custom recipes created by this organization
      const response = await apiService.getUserRecipesByOrganization(organization.id);
      setRecipes(response || []);
    } catch (err) {
      console.error('Error loading custom recipes:', err);
      setError('Failed to load custom recipes');
      setRecipes([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateRecipe = () => {
    setCreateDialogOpen(true);
  };

  const handleEditRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setEditDialogOpen(true);
  };

  const handleDeleteRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setDeleteDialogOpen(true);
  };

  const handleViewRecipe = (recipe) => {
    setSelectedRecipe(recipe);
    setViewDialogOpen(true);
  };

  const confirmDeleteRecipe = async () => {
    if (!selectedRecipe) return;

    try {
      await apiService.deleteUserRecipe(selectedRecipe.id);
      
      // Remove from local state
      setRecipes(prev => prev.filter(r => r.id !== selectedRecipe.id));
      setSuccess('Recipe deleted successfully');
      setDeleteDialogOpen(false);
      setSelectedRecipe(null);
    } catch (err) {
      console.error('Error deleting recipe:', err);
      setError('Failed to delete recipe');
    }
  };

  const handleRecipeCreated = (newRecipe) => {
    // Add to local state
    setRecipes(prev => [newRecipe, ...prev]);
    setSuccess('Recipe created successfully!');
    
    // Clear success message after a few seconds
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleRecipeUpdated = (updatedRecipe) => {
    // Update local state
    setRecipes(prev => prev.map(r => r.id === updatedRecipe.id ? updatedRecipe : r));
    setSuccess('Recipe updated successfully!');
    
    // Clear success message after a few seconds
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleMenuOpen = (event, recipe) => {
    setAnchorEl(event.currentTarget);
    setMenuRecipe(recipe);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setMenuRecipe(null);
  };

  // Filter recipes based on search and cuisine
  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = !searchTerm || 
      recipe.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.diet_tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCuisine = !cuisineFilter || recipe.cuisine === cuisineFilter;
    
    return matchesSearch && matchesCuisine;
  });

  // Get unique cuisines for filter
  const availableCuisines = [...new Set(recipes.map(r => r.cuisine).filter(Boolean))];

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Custom Recipes...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>
          {success}
        </Alert>
      )}

      {/* Header */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={8}>
            <Typography variant="h4" gutterBottom>
              Custom Recipes
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Create and manage recipes specific to your organization
            </Typography>
          </Grid>
          <Grid item xs={12} md={4}>
            <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
              <Typography variant="h4">{recipes.length}</Typography>
              <Typography variant="caption">Custom Recipes</Typography>
            </Paper>
          </Grid>
        </Grid>
      </Paper>

      {/* Controls */}
      <Paper sx={{ p: 2, mb: 3 }}>
        <Grid container spacing={2} alignItems="center">
          <Grid item xs={12} md={6}>
            <TextField
              fullWidth
              size="small"
              placeholder="Search recipes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              InputProps={{
                startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
              }}
            />
          </Grid>
          <Grid item xs={12} md={4}>
            <TextField
              fullWidth
              size="small"
              select
              label="Filter by Cuisine"
              value={cuisineFilter}
              onChange={(e) => setCuisineFilter(e.target.value)}
            >
              <MenuItem value="">All Cuisines</MenuItem>
              {availableCuisines.map(cuisine => (
                <MenuItem key={cuisine} value={cuisine}>{cuisine}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} md={2}>
            <Button
              fullWidth
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateRecipe}
            >
              Create Recipe
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Recipes Grid */}
      <Grid container spacing={3}>
        {filteredRecipes.map((recipe) => (
          <Grid item xs={12} md={6} lg={4} key={recipe.id}>
            <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
              {recipe.image_url && (
                <Box
                  component="img"
                  src={recipe.image_url}
                  alt={recipe.title}
                  sx={{ width: '100%', height: 200, objectFit: 'cover' }}
                />
              )}
              <CardContent sx={{ flexGrow: 1 }}>
                <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                  <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
                    {recipe.title}
                  </Typography>
                  <IconButton
                    size="small"
                    onClick={(e) => handleMenuOpen(e, recipe)}
                  >
                    <MoreVertIcon />
                  </IconButton>
                </Box>

                {recipe.description && (
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    {recipe.description.substring(0, 100)}
                    {recipe.description.length > 100 && '...'}
                  </Typography>
                )}

                {/* Recipe Info */}
                <Box display="flex" flexWrap="wrap" gap={1} mb={2}>
                  {recipe.cuisine && (
                    <Chip label={recipe.cuisine} size="small" variant="outlined" />
                  )}
                  {recipe.difficulty && (
                    <Chip 
                      label={recipe.difficulty} 
                      size="small" 
                      variant="outlined"
                      color={recipe.difficulty === 'Easy' ? 'success' : recipe.difficulty === 'Hard' ? 'error' : 'default'}
                    />
                  )}
                  {recipe.total_time && (
                    <Chip label={`${recipe.total_time} min`} size="small" variant="outlined" />
                  )}
                  {recipe.servings && (
                    <Chip label={`${recipe.servings} servings`} size="small" variant="outlined" />
                  )}
                </Box>

                {/* Diet Tags */}
                {recipe.diet_tags && recipe.diet_tags.length > 0 && (
                  <Box mb={2}>
                    {recipe.diet_tags.slice(0, 3).map((tag, index) => (
                      <Chip
                        key={index}
                        label={tag}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5, bgcolor: 'success.light', color: 'white' }}
                      />
                    ))}
                    {recipe.diet_tags.length > 3 && (
                      <Chip
                        label={`+${recipe.diet_tags.length - 3} more`}
                        size="small"
                        sx={{ mr: 0.5, mb: 0.5 }}
                      />
                    )}
                  </Box>
                )}

                {/* Ingredients Count */}
                <Typography variant="caption" color="text.secondary">
                  {recipe.ingredients?.length || 0} ingredients • {recipe.steps?.length || 0} steps
                </Typography>
              </CardContent>

              {/* Actions */}
              <Box sx={{ p: 2, pt: 0 }}>
                <Grid container spacing={1}>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      size="small"
                      startIcon={<ViewIcon />}
                      onClick={() => handleViewRecipe(recipe)}
                    >
                      View
                    </Button>
                  </Grid>
                  <Grid item xs={6}>
                    <Button
                      fullWidth
                      size="small"
                      variant="outlined"
                      startIcon={<EditIcon />}
                      onClick={() => handleEditRecipe(recipe)}
                    >
                      Edit
                    </Button>
                  </Grid>
                </Grid>
              </Box>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Empty State */}
      {filteredRecipes.length === 0 && (
        <Paper sx={{ p: 6, textAlign: 'center' }}>
          <RecipeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
          <Typography variant="h6" color="text.secondary" gutterBottom>
            {recipes.length === 0 ? 'No custom recipes yet' : 'No recipes match your filters'}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
            {recipes.length === 0 
              ? 'Create your first custom recipe to get started'
              : 'Try adjusting your search or filter criteria'
            }
          </Typography>
          {recipes.length === 0 && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleCreateRecipe}
            >
              Create First Recipe
            </Button>
          )}
        </Paper>
      )}

      {/* Action Menu */}
      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleMenuClose}
      >
        <MenuItem onClick={() => {
          handleViewRecipe(menuRecipe);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <ViewIcon fontSize="small" />
          </ListItemIcon>
          View Recipe
        </MenuItem>
        <MenuItem onClick={() => {
          handleEditRecipe(menuRecipe);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <EditIcon fontSize="small" />
          </ListItemIcon>
          Edit Recipe
        </MenuItem>
        <MenuItem onClick={() => {
          handleDeleteRecipe(menuRecipe);
          handleMenuClose();
        }}>
          <ListItemIcon>
            <DeleteIcon fontSize="small" />
          </ListItemIcon>
          Delete Recipe
        </MenuItem>
      </Menu>

      {/* Recipe Creation Dialog */}
      <CustomRecipeCreationDialog
        open={createDialogOpen}
        onClose={() => setCreateDialogOpen(false)}
        onRecipeCreated={handleRecipeCreated}
        mode="organization"
      />

      {/* Recipe Edit Dialog */}
      <CustomRecipeCreationDialog
        open={editDialogOpen}
        onClose={() => {
          setEditDialogOpen(false);
          setSelectedRecipe(null);
        }}
        onRecipeCreated={handleRecipeUpdated}
        editingRecipe={selectedRecipe}
        mode="organization"
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)}>
        <DialogTitle>Delete Recipe</DialogTitle>
        <DialogContent>
          <Typography>
            Are you sure you want to delete "{selectedRecipe?.title}"? This action cannot be undone.
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button onClick={confirmDeleteRecipe} color="error" variant="contained">
            Delete
          </Button>
        </DialogActions>
      </Dialog>

      {/* Recipe View Dialog */}
      <Dialog open={viewDialogOpen} onClose={() => setViewDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          {selectedRecipe?.title}
        </DialogTitle>
        <DialogContent>
          {selectedRecipe && (
            <Box>
              {selectedRecipe.image_url && (
                <Box
                  component="img"
                  src={selectedRecipe.image_url}
                  alt={selectedRecipe.title}
                  sx={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 1, mb: 2 }}
                />
              )}
              
              {selectedRecipe.description && (
                <Typography variant="body1" paragraph>
                  {selectedRecipe.description}
                </Typography>
              )}

              {/* Recipe Info */}
              <Box display="flex" flexWrap="wrap" gap={1} mb={3}>
                {selectedRecipe.cuisine && <Chip label={selectedRecipe.cuisine} />}
                {selectedRecipe.difficulty && <Chip label={selectedRecipe.difficulty} />}
                {selectedRecipe.total_time && <Chip label={`${selectedRecipe.total_time} min`} />}
                {selectedRecipe.servings && <Chip label={`${selectedRecipe.servings} servings`} />}
              </Box>

              {/* Diet Tags */}
              {selectedRecipe.diet_tags && selectedRecipe.diet_tags.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>Diet Tags</Typography>
                  <Box display="flex" flexWrap="wrap" gap={1}>
                    {selectedRecipe.diet_tags.map((tag, index) => (
                      <Chip key={index} label={tag} color="success" />
                    ))}
                  </Box>
                </Box>
              )}

              {/* Ingredients */}
              {selectedRecipe.ingredients && selectedRecipe.ingredients.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>Ingredients</Typography>
                  <Box component="ul" sx={{ pl: 2 }}>
                    {selectedRecipe.ingredients.map((ingredient, index) => (
                      <Typography key={index} component="li" variant="body2" gutterBottom>
                        {ingredient.quantity && ingredient.unit 
                          ? `${ingredient.quantity} ${ingredient.unit} ${ingredient.name}`
                          : ingredient.quantity 
                            ? `${ingredient.quantity} ${ingredient.name}`
                            : ingredient.name
                        }
                      </Typography>
                    ))}
                  </Box>
                </Box>
              )}

              {/* Instructions */}
              {selectedRecipe.steps && selectedRecipe.steps.length > 0 && (
                <Box mb={3}>
                  <Typography variant="h6" gutterBottom>Instructions</Typography>
                  <Box component="ol" sx={{ pl: 2 }}>
                    {selectedRecipe.steps
                      .sort((a, b) => a.step_number - b.step_number)
                      .map((step, index) => (
                        <Typography key={index} component="li" variant="body2" paragraph>
                          {step.instruction}
                        </Typography>
                      ))}
                  </Box>
                </Box>
              )}
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setViewDialogOpen(false)}>Close</Button>
          <Button 
            variant="contained" 
            startIcon={<EditIcon />}
            onClick={() => {
              setViewDialogOpen(false);
              handleEditRecipe(selectedRecipe);
            }}
          >
            Edit Recipe
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationCustomRecipes;