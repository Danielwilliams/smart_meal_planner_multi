// src/components/OrganizationRecipeLibrary.jsx
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
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Alert,
  CircularProgress,
  IconButton,
  Tooltip,
  Tabs,
  Tab,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Divider,
  Badge,
  Fab,
  Menu,
  MenuList,
  ListItemIcon,
  Autocomplete,
  FormControlLabel,
  Switch
} from '@mui/material';
import {
  Add as AddIcon,
  Edit as EditIcon,
  Delete as DeleteIcon,
  Approval as ApprovalIcon,
  Check as CheckIcon,
  Close as CloseIcon,
  FilterList as FilterIcon,
  Search as SearchIcon,
  Category as CategoryIcon,
  Restaurant as RecipeIcon,
  Stars as StarsIcon,
  MoreVert as MoreVertIcon,
  Label as TagIcon,
  Notes as NotesIcon,
  Visibility as ViewIcon
} from '@mui/icons-material';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recipe-tabpanel-${index}`}
      aria-labelledby={`recipe-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ p: 3 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const OrganizationRecipeLibrary = () => {
  const { organization } = useOrganization();
  const [tabValue, setTabValue] = useState(0);
  
  // Recipe Library State
  const [recipes, setRecipes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  
  // Filter and Search State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showApprovedOnly, setShowApprovedOnly] = useState(false);
  
  // Dialog State
  const [categoryDialogOpen, setCategoryDialogOpen] = useState(false);
  const [recipeDialogOpen, setRecipeDialogOpen] = useState(false);
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState(null);
  
  // Category Form State
  const [categoryForm, setCategoryForm] = useState({
    name: '',
    description: '',
    color: '#1976d2',
    sort_order: 0
  });
  
  // Recipe Form State
  const [recipeForm, setRecipeForm] = useState({
    recipe_id: '',
    category_id: '',
    tags: [],
    internal_notes: '',
    client_notes: ''
  });
  
  // Recipe Browser State
  const [availableRecipes, setAvailableRecipes] = useState([]);
  const [recipeSearchTerm, setRecipeSearchTerm] = useState('');
  const [selectedAvailableRecipe, setSelectedAvailableRecipe] = useState(null);
  const [loadingAvailableRecipes, setLoadingAvailableRecipes] = useState(false);
  
  // Approval State
  const [approvalForm, setApprovalForm] = useState({
    approved: true,
    approval_notes: '',
    compliance_notes: ''
  });

  const statusColors = {
    'draft': '#9e9e9e',
    'pending': '#ff9800',
    'approved': '#4caf50',
    'needs_revision': '#f44336',
    'archived': '#757575'
  };

  const statusLabels = {
    'draft': 'Draft',
    'pending': 'Pending Review',
    'approved': 'Approved',
    'needs_revision': 'Needs Revision',
    'archived': 'Archived'
  };

  // Load data on component mount
  useEffect(() => {
    if (organization?.id) {
      loadData();
    }
  }, [organization?.id]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [recipesData, categoriesData] = await Promise.all([
        loadRecipes(),
        loadCategories()
      ]);
    } catch (err) {
      setError('Failed to load recipe library data');
      console.error('Error loading data:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadRecipes = async () => {
    try {
      const params = {};
      if (selectedCategory) params.category_id = selectedCategory;
      if (statusFilter !== 'all') params.status_filter = statusFilter;
      if (showApprovedOnly) params.approved_only = 'true';

      const response = await apiService.getOrganizationRecipes(organization.id, params);
      
      setRecipes(response || []);
      return response;
    } catch (err) {
      console.error('Error loading recipes:', err);
      setRecipes([]);
      throw err;
    }
  };

  const loadCategories = async () => {
    try {
      const response = await apiService.getOrganizationRecipeCategories(organization.id);
      
      setCategories(response || []);
      return response;
    } catch (err) {
      console.error('Error loading categories:', err);
      setCategories([]);
      throw err;
    }
  };

  const loadAvailableRecipes = async () => {
    try {
      setLoadingAvailableRecipes(true);
      const response = await apiService.getAvailableRecipes({
        limit: 100, // Get first 100 recipes
        search: recipeSearchTerm
      });
      
      setAvailableRecipes(response || []);
    } catch (err) {
      console.error('Error loading available recipes:', err);
      setError('Failed to load available recipes');
    } finally {
      setLoadingAvailableRecipes(false);
    }
  };

  const handleCreateCategory = async () => {
    try {
      const response = await apiService.createOrganizationRecipeCategory(organization.id, categoryForm);

      setCategories(prev => [...prev, response]);
      setCategoryDialogOpen(false);
      setCategoryForm({ name: '', description: '', color: '#1976d2', sort_order: 0 });
    } catch (err) {
      setError('Failed to create category');
      console.error('Error creating category:', err);
    }
  };

  const handleAddRecipe = async () => {
    if (!selectedAvailableRecipe) {
      setError('Please select a recipe to add');
      return;
    }

    try {
      const response = await apiService.addRecipeToOrganization(organization.id, {
        recipe_id: selectedAvailableRecipe.id,
        category_id: recipeForm.category_id,
        tags: recipeForm.tags || [],
        internal_notes: recipeForm.internal_notes,
        client_notes: recipeForm.client_notes
      });

      setRecipes(prev => [...prev, response]);
      setRecipeDialogOpen(false);
      setRecipeForm({
        recipe_id: '',
        category_id: '',
        tags: [],
        internal_notes: '',
        client_notes: ''
      });
      setSelectedAvailableRecipe(null);
      setRecipeSearchTerm('');
      setAvailableRecipes([]);
    } catch (err) {
      setError('Failed to add recipe to library');
      console.error('Error adding recipe:', err);
    }
  };

  const handleOpenRecipeDialog = () => {
    setRecipeDialogOpen(true);
    loadAvailableRecipes();
  };

  const handleApprovalSubmit = async () => {
    try {
      await apiService.approveOrganizationRecipe(organization.id, selectedRecipe.id, approvalForm);

      // Reload recipes to reflect changes
      await loadRecipes();
      setApprovalDialogOpen(false);
      setSelectedRecipe(null);
      setApprovalForm({ approved: true, approval_notes: '', compliance_notes: '' });
    } catch (err) {
      setError('Failed to process approval');
      console.error('Error processing approval:', err);
    }
  };

  const filteredRecipes = recipes.filter(recipe => {
    const matchesSearch = !searchTerm || 
      recipe.recipe_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      recipe.tags?.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = !selectedCategory || recipe.category_id === parseInt(selectedCategory);
    
    return matchesSearch && matchesCategory;
  });

  const pendingRecipesCount = recipes.filter(r => r.approval_status === 'pending').length;
  const approvedRecipesCount = recipes.filter(r => r.is_approved).length;

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
        <CircularProgress />
        <Typography variant="h6" sx={{ ml: 2 }}>Loading Recipe Library...</Typography>
      </Box>
    );
  }

  return (
    <Box>
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {/* Header with Stats */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item xs={12} md={6}>
            <Typography variant="h4" gutterBottom>
              Recipe Library
            </Typography>
            <Typography variant="body1" color="text.secondary">
              Manage your organization's curated recipe collection
            </Typography>
          </Grid>
          <Grid item xs={12} md={6}>
            <Grid container spacing={2}>
              <Grid item xs={4}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'primary.light', color: 'white' }}>
                  <Typography variant="h4">{recipes.length}</Typography>
                  <Typography variant="caption">Total Recipes</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'success.light', color: 'white' }}>
                  <Typography variant="h4">{approvedRecipesCount}</Typography>
                  <Typography variant="caption">Approved</Typography>
                </Paper>
              </Grid>
              <Grid item xs={4}>
                <Paper sx={{ p: 2, textAlign: 'center', bgcolor: 'warning.light', color: 'white' }}>
                  <Typography variant="h4">{pendingRecipesCount}</Typography>
                  <Typography variant="caption">Pending</Typography>
                </Paper>
              </Grid>
            </Grid>
          </Grid>
        </Grid>
      </Paper>

      {/* Tabs Navigation */}
      <Paper sx={{ mb: 3 }}>
        <Tabs 
          value={tabValue} 
          onChange={(e, newValue) => setTabValue(newValue)}
          variant="scrollable"
          scrollButtons="auto"
        >
          <Tab 
            label={
              <Badge badgeContent={recipes.length} color="primary">
                Recipe Library
              </Badge>
            } 
            icon={<RecipeIcon />} 
          />
          <Tab 
            label={
              <Badge badgeContent={pendingRecipesCount} color="warning">
                Approval Queue
              </Badge>
            } 
            icon={<ApprovalIcon />} 
          />
          <Tab label="Categories" icon={<CategoryIcon />} />
          <Tab label="Analytics" icon={<StarsIcon />} />
        </Tabs>
      </Paper>

      {/* Recipe Library Tab */}
      <TabPanel value={tabValue} index={0}>
        {/* Controls */}
        <Paper sx={{ p: 2, mb: 3 }}>
          <Grid container spacing={2} alignItems="center">
            <Grid item xs={12} md={4}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search recipes or tags..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                InputProps={{
                  startAdornment: <SearchIcon sx={{ color: 'text.secondary', mr: 1 }} />
                }}
              />
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Category</InputLabel>
                <Select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  label="Category"
                >
                  <MenuItem value="">All Categories</MenuItem>
                  {categories.map(cat => (
                    <MenuItem key={cat.id} value={cat.id}>
                      <Box display="flex" alignItems="center">
                        <Box 
                          sx={{ 
                            width: 12, 
                            height: 12, 
                            borderRadius: '50%', 
                            bgcolor: cat.color, 
                            mr: 1 
                          }} 
                        />
                        {cat.name}
                      </Box>
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={3}>
              <FormControl fullWidth size="small">
                <InputLabel>Status</InputLabel>
                <Select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  label="Status"
                >
                  <MenuItem value="all">All Status</MenuItem>
                  <MenuItem value="draft">Draft</MenuItem>
                  <MenuItem value="pending">Pending Review</MenuItem>
                  <MenuItem value="approved">Approved</MenuItem>
                  <MenuItem value="needs_revision">Needs Revision</MenuItem>
                </Select>
              </FormControl>
            </Grid>
            <Grid item xs={12} md={2}>
              <Button
                fullWidth
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenRecipeDialog}
              >
                Add Recipe
              </Button>
            </Grid>
          </Grid>
          
          <Box mt={2}>
            <FormControlLabel
              control={
                <Switch
                  checked={showApprovedOnly}
                  onChange={(e) => setShowApprovedOnly(e.target.checked)}
                />
              }
              label="Show only approved recipes"
            />
          </Box>
        </Paper>

        {/* Recipe Grid */}
        <Grid container spacing={3}>
          {filteredRecipes.map((recipe) => (
            <Grid item xs={12} md={6} lg={4} key={recipe.id}>
              <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                <CardContent sx={{ flexGrow: 1 }}>
                  <Box display="flex" justifyContent="space-between" alignItems="flex-start" mb={2}>
                    <Typography variant="h6" component="div">
                      {recipe.recipe_name || `Recipe #${recipe.recipe_id}`}
                    </Typography>
                    <Chip
                      label={statusLabels[recipe.approval_status] || recipe.approval_status}
                      size="small"
                      sx={{ 
                        bgcolor: statusColors[recipe.approval_status] || '#9e9e9e',
                        color: 'white'
                      }}
                    />
                  </Box>

                  {/* Category */}
                  {recipe.category_id && (
                    <Box display="flex" alignItems="center" mb={1}>
                      <CategoryIcon sx={{ fontSize: 16, mr: 0.5, color: 'text.secondary' }} />
                      <Typography variant="body2" color="text.secondary">
                        {categories.find(c => c.id === recipe.category_id)?.name || 'Unknown Category'}
                      </Typography>
                    </Box>
                  )}

                  {/* Tags */}
                  {recipe.tags && recipe.tags.length > 0 && (
                    <Box mb={2}>
                      {recipe.tags.slice(0, 3).map((tag, index) => (
                        <Chip
                          key={index}
                          label={tag}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      ))}
                      {recipe.tags.length > 3 && (
                        <Chip
                          label={`+${recipe.tags.length - 3} more`}
                          size="small"
                          variant="outlined"
                          sx={{ mr: 0.5, mb: 0.5 }}
                        />
                      )}
                    </Box>
                  )}

                  {/* Notes Preview */}
                  {recipe.client_notes && (
                    <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                      {recipe.client_notes.substring(0, 100)}
                      {recipe.client_notes.length > 100 && '...'}
                    </Typography>
                  )}

                  {/* Usage Stats */}
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={2}>
                    <Typography variant="caption" color="text.secondary">
                      Used {recipe.usage_count || 0} times
                    </Typography>
                    {recipe.last_used_at && (
                      <Typography variant="caption" color="text.secondary">
                        Last used: {new Date(recipe.last_used_at).toLocaleDateString()}
                      </Typography>
                    )}
                  </Box>
                </CardContent>

                {/* Actions */}
                <Box sx={{ p: 2, pt: 0 }}>
                  <Grid container spacing={1}>
                    <Grid item xs={6}>
                      <Button
                        fullWidth
                        size="small"
                        startIcon={<ViewIcon />}
                        onClick={() => {
                          // Navigate to recipe detail view
                          window.open(`/recipe/${recipe.recipe_id}`, '_blank');
                        }}
                      >
                        View
                      </Button>
                    </Grid>
                    <Grid item xs={6}>
                      {recipe.approval_status === 'pending' ? (
                        <Button
                          fullWidth
                          size="small"
                          variant="contained"
                          color="warning"
                          startIcon={<ApprovalIcon />}
                          onClick={() => {
                            setSelectedRecipe(recipe);
                            setApprovalDialogOpen(true);
                          }}
                        >
                          Review
                        </Button>
                      ) : (
                        <Button
                          fullWidth
                          size="small"
                          startIcon={<EditIcon />}
                          onClick={() => {
                            setRecipeForm({
                              recipe_id: recipe.recipe_id,
                              category_id: recipe.category_id || '',
                              tags: recipe.tags || [],
                              internal_notes: recipe.internal_notes || '',
                              client_notes: recipe.client_notes || ''
                            });
                            setRecipeDialogOpen(true);
                          }}
                        >
                          Edit
                        </Button>
                      )}
                    </Grid>
                  </Grid>
                </Box>
              </Card>
            </Grid>
          ))}
        </Grid>

        {filteredRecipes.length === 0 && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <RecipeIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes found
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {searchTerm || selectedCategory || statusFilter !== 'all' 
                ? 'Try adjusting your filters or search terms'
                : 'Start building your recipe library by adding your first recipe'
              }
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenRecipeDialog}
            >
              Add First Recipe
            </Button>
          </Paper>
        )}
      </TabPanel>

      {/* Approval Queue Tab */}
      <TabPanel value={tabValue} index={1}>
        <List>
          {recipes.filter(r => r.approval_status === 'pending').map((recipe) => (
            <React.Fragment key={recipe.id}>
              <ListItem>
                <ListItemText
                  primary={recipe.recipe_name || `Recipe #${recipe.recipe_id}`}
                  secondary={
                    <Box>
                      <Typography variant="body2" color="text.secondary">
                        Submitted: {new Date(recipe.submitted_for_approval_at || recipe.created_at).toLocaleDateString()}
                      </Typography>
                      {recipe.tags && recipe.tags.length > 0 && (
                        <Box mt={1}>
                          {recipe.tags.map((tag, index) => (
                            <Chip key={index} label={tag} size="small" variant="outlined" sx={{ mr: 0.5 }} />
                          ))}
                        </Box>
                      )}
                    </Box>
                  }
                />
                <ListItemSecondaryAction>
                  <Button
                    variant="contained"
                    color="warning"
                    startIcon={<ApprovalIcon />}
                    onClick={() => {
                      setSelectedRecipe(recipe);
                      setApprovalDialogOpen(true);
                    }}
                  >
                    Review
                  </Button>
                </ListItemSecondaryAction>
              </ListItem>
              <Divider />
            </React.Fragment>
          ))}
        </List>

        {recipes.filter(r => r.approval_status === 'pending').length === 0 && (
          <Paper sx={{ p: 6, textAlign: 'center' }}>
            <ApprovalIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No recipes pending approval
            </Typography>
            <Typography variant="body2" color="text.secondary">
              All recipes are up to date!
            </Typography>
          </Paper>
        )}
      </TabPanel>

      {/* Categories Tab */}
      <TabPanel value={tabValue} index={2}>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={3}>
          <Typography variant="h5">Recipe Categories</Typography>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => setCategoryDialogOpen(true)}
          >
            Add Category
          </Button>
        </Box>

        <Grid container spacing={2}>
          {categories.map((category) => (
            <Grid item xs={12} md={6} lg={4} key={category.id}>
              <Card>
                <CardContent>
                  <Box display="flex" alignItems="center" mb={2}>
                    <Box 
                      sx={{ 
                        width: 24, 
                        height: 24, 
                        borderRadius: '50%', 
                        bgcolor: category.color, 
                        mr: 2 
                      }} 
                    />
                    <Typography variant="h6">{category.name}</Typography>
                  </Box>
                  {category.description && (
                    <Typography variant="body2" color="text.secondary" mb={2}>
                      {category.description}
                    </Typography>
                  )}
                  <Typography variant="caption" color="text.secondary">
                    {recipes.filter(r => r.category_id === category.id).length} recipes
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </TabPanel>

      {/* Analytics Tab */}
      <TabPanel value={tabValue} index={3}>
        <Typography variant="h5" gutterBottom>Recipe Analytics</Typography>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Approval Status Distribution</Typography>
              {/* Add charts here in the future */}
              <List>
                {Object.entries(statusLabels).map(([status, label]) => {
                  const count = recipes.filter(r => r.approval_status === status).length;
                  return (
                    <ListItem key={status}>
                      <ListItemText 
                        primary={label} 
                        secondary={`${count} recipes`}
                      />
                    </ListItem>
                  );
                })}
              </List>
            </Paper>
          </Grid>
          <Grid item xs={12} md={6}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>Most Used Recipes</Typography>
              <List>
                {recipes
                  .sort((a, b) => (b.usage_count || 0) - (a.usage_count || 0))
                  .slice(0, 5)
                  .map((recipe) => (
                    <ListItem key={recipe.id}>
                      <ListItemText 
                        primary={recipe.recipe_name || `Recipe #${recipe.recipe_id}`}
                        secondary={`Used ${recipe.usage_count || 0} times`}
                      />
                    </ListItem>
                  ))}
              </List>
            </Paper>
          </Grid>
        </Grid>
      </TabPanel>

      {/* Category Dialog */}
      <Dialog open={categoryDialogOpen} onClose={() => setCategoryDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Create New Category</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Category Name"
            fullWidth
            value={categoryForm.name}
            onChange={(e) => setCategoryForm(prev => ({...prev, name: e.target.value}))}
          />
          <TextField
            margin="dense"
            label="Description"
            fullWidth
            multiline
            rows={2}
            value={categoryForm.description}
            onChange={(e) => setCategoryForm(prev => ({...prev, description: e.target.value}))}
          />
          <TextField
            margin="dense"
            label="Color"
            type="color"
            value={categoryForm.color}
            onChange={(e) => setCategoryForm(prev => ({...prev, color: e.target.value}))}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setCategoryDialogOpen(false)}>Cancel</Button>
          <Button onClick={handleCreateCategory} variant="contained">Create</Button>
        </DialogActions>
      </Dialog>

      {/* Recipe Browser Dialog */}
      <Dialog open={recipeDialogOpen} onClose={() => setRecipeDialogOpen(false)} maxWidth="lg" fullWidth>
        <DialogTitle>Add Recipe to Library</DialogTitle>
        <DialogContent>
          <Box sx={{ display: 'flex', gap: 3 }}>
            {/* Recipe Browser Section */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>Browse Available Recipes</Typography>
              
              <TextField
                fullWidth
                size="small"
                placeholder="Search recipes..."
                value={recipeSearchTerm}
                onChange={(e) => {
                  setRecipeSearchTerm(e.target.value);
                  // Debounce search by reloading after a delay
                  clearTimeout(window.recipeSearchTimeout);
                  window.recipeSearchTimeout = setTimeout(() => {
                    loadAvailableRecipes();
                  }, 500);
                }}
                sx={{ mb: 2 }}
              />

              {loadingAvailableRecipes ? (
                <Box display="flex" justifyContent="center" p={3}>
                  <CircularProgress />
                </Box>
              ) : (
                <Box sx={{ maxHeight: 400, overflowY: 'auto', border: '1px solid #e0e0e0', borderRadius: 1 }}>
                  {availableRecipes.length === 0 ? (
                    <Box p={3} textAlign="center">
                      <Typography color="text.secondary">
                        {recipeSearchTerm ? 'No recipes found matching your search' : 'No recipes available'}
                      </Typography>
                    </Box>
                  ) : (
                    availableRecipes.map((recipe) => (
                      <Box
                        key={recipe.id}
                        onClick={() => setSelectedAvailableRecipe(recipe)}
                        sx={{
                          p: 2,
                          cursor: 'pointer',
                          backgroundColor: selectedAvailableRecipe?.id === recipe.id ? '#e3f2fd' : 'transparent',
                          borderBottom: '1px solid #f0f0f0',
                          '&:hover': { backgroundColor: '#f5f5f5' }
                        }}
                      >
                        <Box display="flex" gap={2}>
                          {recipe.image_url && (
                            <Box
                              component="img"
                              src={recipe.image_url}
                              alt={recipe.title}
                              sx={{ width: 60, height: 60, borderRadius: 1, objectFit: 'cover' }}
                            />
                          )}
                          <Box flex={1}>
                            <Typography variant="subtitle2" fontWeight="bold">
                              {recipe.title}
                            </Typography>
                            <Typography variant="body2" color="text.secondary">
                              {recipe.cuisine && `${recipe.cuisine} • `}
                              {recipe.total_time && `${recipe.total_time} min • `}
                              {recipe.servings && `${recipe.servings} servings`}
                            </Typography>
                            {recipe.diet_tags && recipe.diet_tags.length > 0 && (
                              <Box mt={1}>
                                {recipe.diet_tags.slice(0, 3).map((tag, idx) => (
                                  <Chip key={idx} label={tag} size="small" sx={{ mr: 0.5, fontSize: '0.7rem' }} />
                                ))}
                              </Box>
                            )}
                          </Box>
                        </Box>
                      </Box>
                    ))
                  )}
                </Box>
              )}
            </Box>

            {/* Configuration Section */}
            <Box sx={{ flex: 1 }}>
              <Typography variant="h6" gutterBottom>Recipe Configuration</Typography>
              
              {selectedAvailableRecipe ? (
                <Box>
                  <Paper sx={{ p: 2, mb: 2, backgroundColor: '#f8f9fa' }}>
                    <Typography variant="subtitle1" fontWeight="bold">
                      Selected: {selectedAvailableRecipe.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {selectedAvailableRecipe.cuisine && `${selectedAvailableRecipe.cuisine} • `}
                      {selectedAvailableRecipe.total_time && `${selectedAvailableRecipe.total_time} min`}
                    </Typography>
                  </Paper>

                  <FormControl fullWidth margin="dense">
                    <InputLabel>Category</InputLabel>
                    <Select
                      value={recipeForm.category_id}
                      onChange={(e) => setRecipeForm(prev => ({...prev, category_id: e.target.value}))}
                      label="Category"
                    >
                      <MenuItem value="">No Category</MenuItem>
                      {categories.map(cat => (
                        <MenuItem key={cat.id} value={cat.id}>
                          <Box display="flex" alignItems="center">
                            <Box 
                              sx={{ 
                                width: 12, 
                                height: 12, 
                                borderRadius: '50%', 
                                bgcolor: cat.color, 
                                mr: 1 
                              }} 
                            />
                            {cat.name}
                          </Box>
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                  
                  <Autocomplete
                    multiple
                    freeSolo
                    options={[]}
                    value={recipeForm.tags || []}
                    onChange={(event, newValue) => {
                      setRecipeForm(prev => ({...prev, tags: newValue}));
                    }}
                    renderInput={(params) => (
                      <TextField
                        {...params}
                        margin="dense"
                        label="Tags"
                        placeholder="Add tags..."
                        helperText="Press Enter to add custom tags"
                      />
                    )}
                  />
                  
                  <TextField
                    margin="dense"
                    label="Internal Notes"
                    fullWidth
                    multiline
                    rows={3}
                    value={recipeForm.internal_notes}
                    onChange={(e) => setRecipeForm(prev => ({...prev, internal_notes: e.target.value}))}
                    helperText="Private notes for organization staff only"
                  />
                  
                  <TextField
                    margin="dense"
                    label="Client Notes"
                    fullWidth
                    multiline
                    rows={3}
                    value={recipeForm.client_notes}
                    onChange={(e) => setRecipeForm(prev => ({...prev, client_notes: e.target.value}))}
                    helperText="Notes visible to clients"
                  />
                </Box>
              ) : (
                <Box textAlign="center" py={4}>
                  <Typography color="text.secondary">
                    Select a recipe from the list to configure it for your organization
                  </Typography>
                </Box>
              )}
            </Box>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => {
            setRecipeDialogOpen(false);
            setSelectedAvailableRecipe(null);
            setRecipeSearchTerm('');
            setAvailableRecipes([]);
          }}>Cancel</Button>
          <Button 
            onClick={handleAddRecipe} 
            variant="contained"
            disabled={!selectedAvailableRecipe}
          >
            Add Recipe
          </Button>
        </DialogActions>
      </Dialog>

      {/* Approval Dialog */}
      <Dialog open={approvalDialogOpen} onClose={() => setApprovalDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>
          Review Recipe: {selectedRecipe?.recipe_name || `Recipe #${selectedRecipe?.recipe_id}`}
        </DialogTitle>
        <DialogContent>
          <FormControlLabel
            control={
              <Switch
                checked={approvalForm.approved}
                onChange={(e) => setApprovalForm(prev => ({...prev, approved: e.target.checked}))}
                color="success"
              />
            }
            label={approvalForm.approved ? "Approve Recipe" : "Reject Recipe"}
            sx={{ mb: 2 }}
          />
          
          <TextField
            fullWidth
            margin="dense"
            label="Approval Notes"
            multiline
            rows={3}
            value={approvalForm.approval_notes}
            onChange={(e) => setApprovalForm(prev => ({...prev, approval_notes: e.target.value}))}
            helperText="Optional notes about the approval decision"
          />
          
          <TextField
            fullWidth
            margin="dense"
            label="Compliance Notes"
            multiline
            rows={3}
            value={approvalForm.compliance_notes}
            onChange={(e) => setApprovalForm(prev => ({...prev, compliance_notes: e.target.value}))}
            helperText="Notes about nutritional compliance or quality standards"
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setApprovalDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleApprovalSubmit} 
            variant="contained" 
            color={approvalForm.approved ? "success" : "error"}
            startIcon={approvalForm.approved ? <CheckIcon /> : <CloseIcon />}
          >
            {approvalForm.approved ? "Approve" : "Reject"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default OrganizationRecipeLibrary;