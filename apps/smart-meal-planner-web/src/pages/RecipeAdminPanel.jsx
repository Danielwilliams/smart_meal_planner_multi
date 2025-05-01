import React, { useState, useEffect } from 'react';
import { 
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  TextField,
  Checkbox,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  Alert,
  Box,
  CircularProgress,
  IconButton,
  Tooltip,
  Pagination,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  DialogContentText,
  RadioGroup,
  FormControlLabel,
  Radio,
  FormControl,
  FormLabel,
  Tabs,
  Tab,
  FormGroup,
  Select,
  MenuItem,
  Slider,
  Divider,
  Collapse
} from '@mui/material';
import InfoIcon from '@mui/icons-material/Info';
import CloseIcon from '@mui/icons-material/Close';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import CheckIcon from '@mui/icons-material/Check';
import AddIcon from '@mui/icons-material/Add';
import apiService from '../services/apiService';
import axios from 'axios';
import KeyboardArrowDownIcon from '@mui/icons-material/KeyboardArrowDown';
import KeyboardArrowUpIcon from '@mui/icons-material/KeyboardArrowUp';
import { Link } from 'react-router-dom';
import RecipeEditor from '../components/RecipeEditor';
import Snackbar from '@mui/material/Snackbar';
import AddRecipeForm from '../components/AddRecipeForm';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const RecipeAdminPanel = () => {
  // API base URL
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
  
  // Get organization context to check admin status
  const { organization, isOrganizationAdmin } = useOrganization();
  const { user } = useAuth();
  
  // Base state variables
  const [recipes, setRecipes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [componentTypes, setComponentTypes] = useState([]);
  const [selectedRecipes, setSelectedRecipes] = useState([]);
  const [taggingResult, setTaggingResult] = useState(null);
  const [compatibility, setCompatibility] = useState(null);
  const [recipe1, setRecipe1] = useState('');
  const [recipe2, setRecipe2] = useState('');
  const [alertMessage, setAlertMessage] = useState(null);
  const [alertSeverity, setAlertSeverity] = useState('info');
  const [page, setPage] = useState(1);
  const [totalRecipes, setTotalRecipes] = useState(0);
  const [recipesPerPage] = useState(20);
  const [expandedRecipeId, setExpandedRecipeId] = useState(null);
  const [loadedDetailIds, setLoadedDetailIds] = useState(new Set());
  const [debugData, setDebugData] = useState(null);
  const [filters, setFilters] = useState({});
  const [error, setError] = useState('');
  const [total, setTotal] = useState(0);
  const [addRecipeDialogOpen, setAddRecipeDialogOpen] = useState(false);
  const [isAdminUser, setIsAdminUser] = useState(false);

  // Tag dialog state
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedTag, setSelectedTag] = useState('');
  const [newTagName, setNewTagName] = useState('');
  const [customTagMode, setCustomTagMode] = useState(false);
  const [tagDialogTab, setTagDialogTab] = useState(0); 
  const [alertOpen, setAlertOpen] = useState(false);

  // Delete confirmation dialog
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [recipeToDelete, setRecipeToDelete] = useState(null);

  // Recipe editor dialog
  const [editorOpen, setEditorOpen] = useState(false);
  const [recipeToEdit, setRecipeToEdit] = useState(null);

  // Preference tagging state
  const [dietType, setDietType] = useState('');
  const [recipeType, setRecipeType] = useState('');
  const [flavorTags, setFlavorTags] = useState({
    herbs: false,
    smoky: false,
    spicy: false,
    sweet: false,
    tangy: false,
    umami: false,
    cheesy: false,
    creamy: false,
    hearty: false,
    spiced: false,
    peppery: false,
    garlicky: false
  });
  const [spiceLevel, setSpiceLevel] = useState('medium');
  const [recipeFormat, setRecipeFormat] = useState('');
  const [mealPrepType, setMealPrepType] = useState('');
  const [prepComplexity, setPrepComplexity] = useState(50);
  const [selectedAppliances, setSelectedAppliances] = useState({
    airFryer: false,
    instantPot: false,
    crockPot: false
  });

  // Static arrays for option lists
  const dietTypes = [
    'Vegetarian', 'Vegan', 'Pescatarian', 'Mediterranean', 
    'Ketogenic', 'Paleo', 'Low-Carb', 'Low-Fat', 
    'Gluten-Free', 'Dairy-Free', 'Other'
  ];

  const recipeTypes = [
    'American', 'Italian', 'Mexican', 'Asian', 'Mediterranean',
    'Indian', 'French', 'Greek', 'Japanese', 'Thai', 'Chinese',
    'Korean', 'Spanish', 'Middle Eastern', 'Vietnamese',
    'Brazilian', 'Caribbean', 'Other'
  ];

  const recipeFormats = [
    'Bake', 'Wrap', 'Pasta', 'Pizza', 'Salad', 'Tacos',
    'Burger', 'Sandwich', 'Stir Fry', 'Soup Stew',
    'Grain Bowl', 'Main Sides', 'Family Meals'
  ];

  const mealPrepTypes = [
    'One Pot', 'Meal Prep', 'Batch Cooking', 
    'Minimal Dishes', 'Quick Assembly'
  ];

  const predefinedComponentTypes = [
    'main_protein', 
    'side_dish', 
    'sauce', 
    'carb_base', 
    'vegetable_component',
    'breakfast_main',
    'soup',
    'salad',
    'dessert',
    'sandwich_filling',
    'pizza_topping'
  ];

  // Check if the user has admin privileges
  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) return;
      
      // Check if user is an organization admin or has account_type of 'admin' or Role of 'admin'
      const isAdmin = 
        user.account_type === 'admin' || 
        user.Role === 'admin' || 
        await isOrganizationAdmin();
        
      setIsAdminUser(isAdmin);
      
      if (!isAdmin) {
        setError('You do not have permission to access this page.');
      }
    };
    
    checkAdmin();
  }, [user, isOrganizationAdmin]);

  // Function to show alerts
  const showAlert = (message, severity = 'info') => {
    setAlertMessage(message);
    setAlertSeverity(severity);
    setAlertOpen(true);
    setTimeout(() => {
      setAlertOpen(false);
      setAlertMessage(null);
    }, 5000);
  };

  // Handle check component
  const handleCheckComponent = async (recipeId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/recipe-admin/check-component/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      setDebugData(response.data);
      console.log('Component debug data:', response.data);
      showAlert(`Component data for recipe ${recipeId} checked. See console for details.`, 'info');
    } catch (error) {
      console.error('Error checking component:', error);
      showAlert(`Failed to check component: ${error.message}`, 'error');
    }
  };

  // Delete recipe handler
  const handleDeleteRecipe = async () => {
    if (!recipeToDelete) return;
    
    try {
      setLoading(true);
      const response = await axios.delete(`${API_BASE_URL}/recipe-admin/delete-recipe/${recipeToDelete.id}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        showAlert(`Recipe "${recipeToDelete.title}" deleted successfully`, 'success');
        setRecipes(recipes.filter(r => r.id !== recipeToDelete.id));
        setTotalRecipes(totalRecipes - 1);
      } else {
        showAlert(`Failed to delete recipe: ${response.data.message}`, 'error');
      }
    } catch (error) {
      console.error('Error deleting recipe:', error);
      showAlert(`Error deleting recipe: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      setDeleteConfirmOpen(false);
      setRecipeToDelete(null);
    }
  };

  // Edit recipe handler
  const handleEditRecipe = (recipe) => {
    setRecipeToEdit(recipe.id);
    setEditorOpen(true);
  };

  // Handle edit save
  const handleEditSave = (result) => {
    showAlert(`Recipe updated successfully`, 'success');
    fetchRecipes();
  };

  // Handle flavor tag changes
  const handleFlavorTagChange = (event) => {
    setFlavorTags({
      ...flavorTags,
      [event.target.name]: event.target.checked,
    });
  };

  // Handle appliance selection changes
  const handleApplianceChange = (event) => {
    setSelectedAppliances({
      ...selectedAppliances,
      [event.target.name]: event.target.checked,
    });
  };

  const toggleRecipeDetails = async (recipeId) => {
    if (expandedRecipeId === recipeId) {
      setExpandedRecipeId(null);
    } else {
      setExpandedRecipeId(recipeId);
      const currentRecipe = recipes.find(r => r.id === recipeId);
      
      try {
        // Use Promise.all to make two API calls in parallel
        const [recipeResponse, componentResponse] = await Promise.all([
          // Get recipe details including ingredients and instructions
          axios.get(`${API_BASE_URL}/scraped-recipes/${recipeId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json'
            }
          }),
          
          // Get component and preferences data 
          axios.get(`${API_BASE_URL}/recipe-admin/check-component/${recipeId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json'
            }
          })
        ]);
        
        console.log(`Details for recipe ${recipeId}:`, recipeResponse.data);
        console.log(`Component and preferences data for recipe ${recipeId}:`, componentResponse.data);
        
        // Extract preferences data
        const preferences = componentResponse.data.preferences || {};
        const componentType = componentResponse.data.component?.component_type;
        
        // Extract ingredients from metadata if available
        let ingredients = [];
        if (recipeResponse.data.metadata && recipeResponse.data.metadata.ingredients_list) {
          ingredients = recipeResponse.data.metadata.ingredients_list;
        }
        
        // Update the recipe in the list with all fetched data
        setRecipes(prevRecipes => 
          prevRecipes.map(recipe => 
            recipe.id === recipeId 
              ? { 
                  ...recipe, 
                  ingredients: ingredients,
                  instructions: recipeResponse.data.instructions || [],
                  // Add component and preferences data
                  component_type: componentType,
                  diet_type: preferences.diet_type,
                  cuisine: preferences.cuisine || recipe.cuisine,
                  flavor_tags: preferences.flavor_tags,
                  spice_level: preferences.spice_level,
                  recipe_format: preferences.recipe_format,
                  meal_prep_type: preferences.meal_prep_type,
                  prep_complexity: preferences.prep_complexity,
                  appliances: preferences.appliances
                } 
              : recipe
          )
        );
      } catch (error) {
        console.error(`Error fetching details for recipe ${recipeId}:`, error);
        showAlert(`Failed to load details for recipe #${recipeId}`, 'error');
      }
    }
  };

  useEffect(() => {
    if (isAdminUser) {
      fetchRecipes();
      fetchComponentTypes();
    }
  }, [page, isAdminUser]);

  const fetchRecipes = async () => {
    try {
      setLoading(true);
      const offset = (page - 1) * recipesPerPage;
      
      console.log(`Fetching page ${page} of recipes (offset=${offset}, limit=${recipesPerPage})`);
      
      const response = await apiService.getScrapedRecipes({
        ...filters,
        limit: recipesPerPage,
        offset: offset
      });
      
      console.log(`Received ${response.recipes?.length} recipes`);
      setRecipes(response.recipes || []);
      setTotal(response.total || 0);
      setTotalRecipes(response.total || 0);
    } catch (err) {
      console.error('Error fetching recipes:', err);
      setError('Failed to load recipes. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const verifyRecipeCount = async () => {
    try {
      const countResponse = await apiService.getRecipeCount();
      console.log(`Direct count API shows ${countResponse} total recipes`);
      console.log(`Current pagination shows ${totalRecipes} total recipes`);
      
      if (countResponse !== totalRecipes) {
        console.warn('⚠️ Mismatch between pagination total and direct count!');
        // Update to the correct count
        setTotalRecipes(countResponse);
        showAlert(`Updated recipe count from ${totalRecipes} to ${countResponse}`, 'info');
      }
    } catch (error) {
      console.error('Error verifying recipe count:', error);
    }
  };
    
  useEffect(() => {
    if (recipes.length > 0 && !loading && isAdminUser) {
      verifyRecipeCount();
    }
  }, [recipes, loading, isAdminUser]);

  const fetchComponentTypes = async () => {
    try {
      console.log('Fetching component types...');
      const response = await axios.get(`${API_BASE_URL}/recipe-admin/component-types`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Component types response:', response.data);
      setComponentTypes(response.data || []);
    } catch (error) {
      console.error('Error fetching component types:', error);
      showAlert('Failed to fetch component types: ' + error.message, 'error');
    }
  };

  const handleTagRecipesClick = () => {
    if (selectedRecipes.length === 0) {
      showAlert('Please select at least one recipe to tag', 'warning');
      return;
    }
    
    setSelectedTag('');
    setNewTagName('');
    setCustomTagMode(false);
    setTagDialogTab(0);
    setDietType('');
    setRecipeType('');
    setFlavorTags({
      herbs: false,
      smoky: false,
      spicy: false,
      sweet: false,
      tangy: false,
      umami: false,
      cheesy: false,
      creamy: false,
      hearty: false,
      spiced: false,
      peppery: false,
      garlicky: false
    });
    setSpiceLevel('medium');
    setRecipeFormat('');
    setMealPrepType('');
    setPrepComplexity(50);
    setSelectedAppliances({
      airFryer: false,
      instantPot: false,
      crockPot: false
    });
    
    setTagDialogOpen(true);
  };

  const handleTabChange = (event, newValue) => {
    setTagDialogTab(newValue);
  };

  const handleTagConfirm = async () => {
    if (tagDialogTab === 0) {
      const finalTag = customTagMode ? newTagName : selectedTag;
      if (!finalTag) {
        showAlert('Please select or enter a component type', 'warning');
        return;
      }
      
      try {
        setLoading(true);
        showAlert(`Tagging ${selectedRecipes.length} recipes as "${finalTag}"...`, 'info');
        setTagDialogOpen(false);
        
        const response = await axios.post(`${API_BASE_URL}/recipe-admin/tag-recipes`, {
          recipe_ids: selectedRecipes.map(id => parseInt(id)),
          component_type: finalTag
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Tagging response:', response.data);
        setTaggingResult(response.data);
        
        const tagged = response.data.tagged_count;
        const failed = selectedRecipes.length - tagged;
        
        if (failed > 0) {
          showAlert(`Tagged ${tagged} recipes as "${finalTag}". ${failed} recipes failed.`, 'warning');
        } else {
          showAlert(`Successfully tagged all ${tagged} recipes as "${finalTag}"!`, 'success');
        }
        
        await fetchComponentTypes();
        fetchRecipes();
        setSelectedRecipes([]);
      } catch (error) {
        console.error('Error tagging recipes:', error);
        showAlert(`Failed to tag recipes: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      try {
        setLoading(true);
        setTagDialogOpen(false);
        
        const anyPreferenceSelected = 
          dietType || 
          recipeType || 
          Object.values(flavorTags).some(value => value) ||
          spiceLevel ||
          recipeFormat ||
          mealPrepType ||
          Object.values(selectedAppliances).some(value => value);
        
        if (!anyPreferenceSelected) {
          showAlert('Please select at least one preference', 'warning');
          setLoading(false);
          return;
        }
        
        const selectedPreferences = {};
        if (dietType) selectedPreferences.diet_type = dietType;
        if (recipeType) selectedPreferences.cuisine = recipeType;
        
        const activeFlavorTags = Object.entries(flavorTags)
          .filter(([key, value]) => value)
          .map(([key]) => key);
        
        if (activeFlavorTags.length > 0) {
          selectedPreferences.flavor_tags = activeFlavorTags;
        }
        
        if (spiceLevel) selectedPreferences.spice_level = spiceLevel;
        if (recipeFormat) selectedPreferences.recipe_format = recipeFormat;
        if (mealPrepType) selectedPreferences.meal_prep_type = mealPrepType;
        if (prepComplexity !== null && prepComplexity !== undefined) {
          selectedPreferences.prep_complexity = prepComplexity;
        }
        
        const activeAppliances = Object.entries(selectedAppliances)
          .filter(([key, value]) => value)
          .map(([key]) => key);
        
        if (activeAppliances.length > 0) {
          selectedPreferences.appliances = activeAppliances;
        }
        
        const tagDescriptions = [];
        if (dietType) tagDescriptions.push(`Diet: ${dietType}`);
        if (recipeType) tagDescriptions.push(`Cuisine: ${recipeType}`);
        if (activeFlavorTags.length > 0) tagDescriptions.push(`Flavors: ${activeFlavorTags.join(', ')}`);
        if (spiceLevel) tagDescriptions.push(`Spice: ${spiceLevel}`);
        if (recipeFormat) tagDescriptions.push(`Format: ${recipeFormat}`);
        if (mealPrepType) tagDescriptions.push(`Prep: ${mealPrepType}`);
        if (prepComplexity) tagDescriptions.push(`Complexity: ${prepComplexity}%`);
        if (activeAppliances.length > 0) tagDescriptions.push(`Appliances: ${activeAppliances.join(', ')}`);
        
        const tagsDescription = tagDescriptions.join(', ');
        
        console.log('Sending preferences payload:', {
          recipe_ids: selectedRecipes.map(id => parseInt(id)),
          preferences: selectedPreferences
        });
        
        const response = await axios.post(`${API_BASE_URL}/recipe-admin/tag-preferences`, {
          recipe_ids: selectedRecipes.map(id => parseInt(id)),
          preferences: selectedPreferences
        }, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        console.log('Preference tagging response:', response.data);
        
        if (response.data.success) {
          showAlert(`Tagged ${response.data.tagged_count} recipes with preferences: ${tagsDescription}`, 'success');
        } else {
          showAlert(`Tagging failed. Server message: ${response.data.message || 'Unknown error'}`, 'error');
        }
        
        fetchRecipes();
        setSelectedRecipes([]);
      } catch (error) {
        console.error('Error tagging recipes with preferences:', error);
        showAlert(`Failed to tag recipes with preferences: ${error.message}`, 'error');
      } finally {
        setLoading(false);
      }
    }
  };

  const handleCalculateCompatibility = async () => {
    if (!recipe1 || !recipe2) {
      showAlert('Please enter both recipe IDs', 'warning');
      return;
    }

    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/recipe-admin/calculate-compatibility`, {
        recipe_id1: parseInt(recipe1),
        recipe_id2: parseInt(recipe2)
      }, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      setCompatibility(response.data);
      showAlert('Compatibility calculated successfully', 'success');
    } catch (error) {
      console.error('Error calculating compatibility:', error);
      showAlert(`Failed to calculate compatibility: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestMeal = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_BASE_URL}/recipe-admin/suggest-custom-meal`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (response.data.success) {
        showAlert(`Custom meal suggested: ${response.data.meal.title}`, 'success');
      } else {
        showAlert(`Failed to suggest meal: ${response.data.message}`, 'warning');
      }
    } catch (error) {
      console.error('Error suggesting meal:', error);
      showAlert(`Failed to suggest custom meal: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const selectAllRecipes = (selected) => {
    if (selected) {
      setSelectedRecipes(recipes.map(r => r.id));
    } else {
      setSelectedRecipes([]);
    }
  };

  const toggleRecipeSelection = (recipeId) => {
    if (selectedRecipes.includes(recipeId)) {
      setSelectedRecipes(selectedRecipes.filter(id => id !== recipeId));
    } else {
      setSelectedRecipes([...selectedRecipes, recipeId]);
    }
  };

  const handlePageChange = (event, value) => {
    setPage(value);
    setSelectedRecipes([]);
  };

  const handleAddRecipeSuccess = (data) => {
   showAlert(`Recipe "${data.recipe.title}" added successfully with ID ${data.recipe_id}`, 'success');
    fetchRecipes();
  };

  const handleAlertClose = () => {
    setAlertOpen(false);
  };

  const totalPages = Math.ceil(totalRecipes / recipesPerPage);

  // If the user is not an admin, show an error message
  if (!isAdminUser) {
    return (
      <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          You do not have permission to access this page. This page is only available to organization administrators.
        </Alert>
        <Button component={Link} to="/home" variant="contained">
          Return to Home
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Recipe Component Admin
      </Typography>
      
      <Grid container spacing={3}>
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6">
                Component Types
              </Typography>
              <Button 
                variant="contained" 
                color="primary"
                onClick={() => setAddRecipeDialogOpen(true)}
                startIcon={<AddIcon />}
              >
                Add New Recipe
              </Button>
            </Box>
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
              {componentTypes.length > 0 ? (
                componentTypes.map(type => (
                  <Chip 
                    key={type.component_type}
                    label={`${type.component_type}: ${type.count}`}
                    color="primary"
                    variant="outlined"
                  />
                ))
              ) : (
                <Typography color="text.secondary">
                  No component types found. Start tagging recipes to generate components.
                </Typography>
              )}
            </Box>
            <Button 
              variant="contained" 
              onClick={handleSuggestMeal}
              disabled={loading || componentTypes.length === 0}
            >
              Generate Custom Meal
            </Button>
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Calculate Compatibility
            </Typography>
            <Grid container spacing={2} alignItems="center">
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Recipe 1 ID"
                  type="number"
                  value={recipe1}
                  onChange={(e) => setRecipe1(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={5}>
                <TextField
                  fullWidth
                  label="Recipe 2 ID"
                  type="number"
                  value={recipe2}
                  onChange={(e) => setRecipe2(e.target.value)}
                />
              </Grid>
              <Grid item xs={12} sm={2}>
                <Button
                  fullWidth
                  variant="contained"
                  onClick={handleCalculateCompatibility}
                  disabled={loading || !recipe1 || !recipe2}
                >
                  Calculate
                </Button>
              </Grid>
            </Grid>
            
            {compatibility && (
              <Box sx={{ mt: 2 }}>
                <Alert severity={compatibility.compatibility_score > 70 ? "success" : "warning"}>
                  <Typography variant="subtitle1">
                    Compatibility Score: {compatibility.compatibility_score}/100
                  </Typography>
                  <Typography variant="body2">
                    <strong>{compatibility.recipe1.title}</strong> ({compatibility.recipe1.component_type}) with <strong>{compatibility.recipe2.title}</strong> ({compatibility.recipe2.component_type})
                  </Typography>
                  <Typography variant="subtitle2" sx={{ mt: 1 }}>
                    Reasons:
                  </Typography>
                  <ul>
                    {compatibility.compatibility_reasons.map((reason, i) => (
                      <li key={i}><Typography variant="body2">{reason}</Typography></li>
                    ))}
                  </ul>
                </Alert>
              </Box>
            )}
          </Paper>
        </Grid>
        
        <Grid item xs={12}>
          <Paper sx={{ p: 2, display: 'flex', flexDirection: 'column' }}>
            <Typography variant="h6" gutterBottom>
              Recipe Tagging
              <Tooltip title="Select recipes to tag with component types and preferences for better meal suggestions">
                <IconButton size="small">
                  <InfoIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            </Typography>
            
            <TableContainer component={Paper} variant="outlined">
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell padding="checkbox">
                      <Checkbox
                        onChange={(e) => selectAllRecipes(e.target.checked)}
                        checked={selectedRecipes.length === recipes.length && recipes.length > 0}
                        indeterminate={selectedRecipes.length > 0 && selectedRecipes.length < recipes.length}
                      />
                    </TableCell>
                    <TableCell>ID</TableCell>
                    <TableCell>Title</TableCell>
                    <TableCell>Complexity</TableCell>
                    <TableCell>Cuisine</TableCell>
                    <TableCell>Component Type</TableCell>
                    <TableCell>Preferences</TableCell>
                    <TableCell>Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {loading && recipes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        <CircularProgress size={24} sx={{ my: 2 }} />
                      </TableCell>
                    </TableRow>
                  ) : recipes.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} align="center">
                        No recipes found
                      </TableCell>
                    </TableRow>
                  ) : (
                    recipes.map(recipe => (
                      <React.Fragment key={recipe.id}>
                        <TableRow>
                          <TableCell padding="checkbox">
                            <Checkbox
                              checked={selectedRecipes.includes(recipe.id)}
                              onChange={() => toggleRecipeSelection(recipe.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <IconButton
                              size="small"
                              onClick={() => toggleRecipeDetails(recipe.id)}
                            >
                              {expandedRecipeId === recipe.id ? <KeyboardArrowUpIcon /> : <KeyboardArrowDownIcon />}
                            </IconButton>
                            {recipe.id}
                          </TableCell>
                          <TableCell>
                            <Tooltip title={recipe.title}>
                              <Typography 
                                variant="body2" 
                                sx={{ 
                                  maxWidth: 200, 
                                  overflow: 'hidden', 
                                  textOverflow: 'ellipsis', 
                                  whiteSpace: 'nowrap' 
                                }}
                              >
                                {recipe.title}
                              </Typography>
                            </Tooltip>
                          </TableCell>
                          <TableCell>{recipe.complexity || 'N/A'}</TableCell>
                          <TableCell>{recipe.cuisine || 'N/A'}</TableCell>
                          <TableCell>
                            {recipe.component_type ? (
                              <Chip 
                                label={recipe.component_type} 
                                size="small" 
                                color="primary" 
                              />
                            ) : (
                              <Typography variant="body2" color="text.secondary">
                                Not tagged
                              </Typography>
                            )}
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5 }}>
                              {recipe.diet_type && (
                                <Chip label={recipe.diet_type} size="small" color="secondary" variant="outlined" />
                              )}
                              {recipe.cuisine && (!recipe.diet_type || recipe.cuisine !== recipe.diet_type) && (
                                <Chip label={recipe.cuisine} size="small" color="info" variant="outlined" />
                              )}
                              {recipe.spice_level && (
                                <Chip label={`Spice: ${recipe.spice_level}`} size="small" color="error" variant="outlined" />
                              )}
                              {recipe.recipe_format && (
                                <Chip label={recipe.recipe_format} size="small" color="success" variant="outlined" />
                              )}
                              {recipe.meal_prep_type && (
                                <Chip label={recipe.meal_prep_type} size="small" color="warning" variant="outlined" />
                              )}
                              {!recipe.diet_type && !recipe.cuisine && !recipe.spice_level && 
                               !recipe.recipe_format && !recipe.meal_prep_type && (
                                <Typography variant="body2" color="text.secondary">
                                  None
                                </Typography>
                              )}
                            </Box>
                          </TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 1 }}>
                              <Button
                                variant="outlined"
                                size="small"
                                component={Link}
                                to={`/recipes/${recipe.id}`}
                                target="_blank"
                              >
                                View
                              </Button>
                              <IconButton 
                                color="primary"
                                size="small"
                                onClick={() => handleEditRecipe(recipe)}
                              >
                                <EditIcon fontSize="small" />
                              </IconButton>
                              <IconButton 
                                color="error"
                                size="small"
                                onClick={() => {
                                  setRecipeToDelete(recipe);
                                  setDeleteConfirmOpen(true);
                                }}
                              >
                                <DeleteIcon fontSize="small" />
                              </IconButton>
                              <IconButton
                                size="small"
                                color="info"
                                onClick={() => handleCheckComponent(recipe.id)}
                              >
                                <InfoIcon fontSize="small" />
                              </IconButton>
                            </Box>
                          </TableCell>
                        </TableRow>
                        <TableRow>
                          <TableCell style={{ paddingBottom: 0, paddingTop: 0 }} colSpan={8}>
                            <Collapse in={expandedRecipeId === recipe.id} timeout="auto" unmountOnExit>
                              <Box sx={{ margin: 2 }}>
                                <Grid container spacing={2}>
                                  <Grid item xs={12} md={4}>
                                    <Typography variant="h6" gutterBottom component="div">
                                      Ingredients
                                    </Typography>
                                    <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
                                      {recipe.ingredients ? (
                                        Array.isArray(recipe.ingredients) ? (
                                          <ul>
                                            {recipe.ingredients.map((ingredient, idx) => (
                                              <li key={idx}>
                                                {typeof ingredient === 'string' 
                                                  ? ingredient 
                                                  : (typeof ingredient === 'object' && ingredient.name)
                                                    ? ingredient.name
                                                    : JSON.stringify(ingredient)
                                                }
                                              </li>
                                            ))}
                                          </ul>
                                        ) : (
                                          <Typography>{recipe.ingredients.toString()}</Typography>
                                        )
                                      ) : (
                                        <Typography color="text.secondary">
                                          No ingredients available
                                        </Typography>
                                      )}
                                    </Box>
                                  </Grid>
                                  <Grid item xs={12} md={4}>
                                    <Typography variant="h6" gutterBottom component="div">
                                      Instructions
                                    </Typography>
                                    <Box sx={{ maxHeight: '300px', overflow: 'auto' }}>
                                      {recipe.instructions ? (
                                        Array.isArray(recipe.instructions) ? (
                                          <ol>
                                            {recipe.instructions.map((step, idx) => (
                                              <li key={idx}>
                                                {typeof step === 'string' 
                                                  ? step 
                                                  : (typeof step === 'object' && step.text) 
                                                    ? step.text 
                                                    : JSON.stringify(step)
                                                }
                                              </li>
                                            ))}
                                          </ol>
                                        ) : (
                                          <Typography>{recipe.instructions.toString()}</Typography>
                                        )
                                      ) : (
                                        <Typography color="text.secondary">
                                          No instructions available
                                        </Typography>
                                      )}
                                    </Box>
                                  </Grid>
                                  <Grid item xs={12} md={4}>
                                    <Typography variant="h6" gutterBottom component="div">
                                      Details & Preferences
                                    </Typography>
                                    <Box sx={{ mb: 2 }}>
                                      <Typography variant="subtitle2" color="primary">Component Type</Typography>
                                      {recipe.component_type ? (
                                        <Chip 
                                          label={recipe.component_type} 
                                          size="small" 
                                          color="primary" 
                                          sx={{ mt: 0.5 }}
                                        />
                                      ) : (
                                        <Typography variant="body2" color="text.secondary">Not tagged</Typography>
                                      )}
                                      
                                      <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>Dietary</Typography>
                                      {recipe.diet_type ? (
                                        <Chip 
                                          label={recipe.diet_type} 
                                          size="small" 
                                          color="secondary" 
                                          variant="outlined"
                                          sx={{ mt: 0.5 }}
                                        />
                                      ) : (
                                        <Typography variant="body2" color="text.secondary">None specified</Typography>
                                      )}
                                      
                                      <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>Cuisine</Typography>
                                      {recipe.cuisine ? (
                                        <Chip 
                                          label={recipe.cuisine} 
                                          size="small" 
                                          color="info" 
                                          variant="outlined"
                                          sx={{ mt: 0.5 }}
                                        />
                                      ) : (
                                        <Typography variant="body2" color="text.secondary">None specified</Typography>
                                      )}
                                      
                                      <Typography variant="subtitle2" color="primary" sx={{ mt: 2 }}>Format & Prep</Typography>
                                      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                                        {recipe.recipe_format && (
                                          <Chip label={recipe.recipe_format} size="small" color="success" variant="outlined" />
                                        )}
                                        {recipe.meal_prep_type && (
                                          <Chip label={recipe.meal_prep_type} size="small" color="warning" variant="outlined" />
                                        )}
                                        {recipe.spice_level && (
                                          <Chip label={`Spice: ${recipe.spice_level}`} size="small" color="error" variant="outlined" />
                                        )}
                                        {recipe.prep_complexity && (
                                          <Chip label={`Complexity: ${recipe.prep_complexity}%`} size="small" color="default" variant="outlined" />
                                        )}
                                        {!recipe.recipe_format && !recipe.meal_prep_type && !recipe.spice_level && !recipe.prep_complexity && (
                                          <Typography variant="body2" color="text.secondary">None specified</Typography>
                                        )}
                                      </Box>
                                    </Box>
                                  </Grid>
                                </Grid>
                              </Box>
                            </Collapse>
                          </TableCell>
                        </TableRow>
                      </React.Fragment>
                    ))
                  )}
                </TableBody>
              </Table>
            </TableContainer>
            
            {totalPages > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', mt: 2 }}>
                <Pagination 
                  count={totalPages} 
                  page={page} 
                  onChange={handlePageChange}
                  color="primary"
                />
                <Box sx={{ ml: 2, display: 'flex', alignItems: 'center' }}>
                  <TextField
                    size="small"
                    label="Go to page"
                    type="number"
                    InputProps={{ 
                      inputProps: { 
                        min: 1, 
                        max: totalPages 
                      } 
                    }}
                    sx={{ width: 100 }}
                    onKeyPress={(e) => {
                      if (e.key === 'Enter') {
                        const targetPage = parseInt(e.target.value);
                        if (targetPage >= 1 && targetPage <= totalPages) {
                          handlePageChange(null, targetPage);
                        }
                      }
                    }}
                  />
                </Box>
              </Box>
            )}
            
            {debugData && (
              <Dialog
                open={!!debugData}
                onClose={() => setDebugData(null)}
                maxWidth="md"
                fullWidth
              >
                <DialogTitle>Component Debug Data</DialogTitle>
                <DialogContent>
                  <Typography variant="h6" gutterBottom>Recipe</Typography>
                  <pre>{JSON.stringify(debugData.recipe, null, 2)}</pre>
                  <Typography variant="h6" gutterBottom>Component</Typography>
                  <pre>{JSON.stringify(debugData.component, null, 2)}</pre>
                  <Typography variant="h6" gutterBottom>Preferences</Typography>
                  <pre>{JSON.stringify(debugData.preferences, null, 2)}</pre>
                </DialogContent>
                <DialogActions>
                  <Button onClick={() => setDebugData(null)}>Close</Button>
                </DialogActions>
              </Dialog>
            )}
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button 
                variant="outlined" 
                onClick={fetchRecipes} 
                disabled={loading}
              >
                Refresh Recipes
              </Button>
              <Button 
                variant="contained" 
                onClick={handleTagRecipesClick} 
                disabled={loading || selectedRecipes.length === 0}
              >
                Tag Selected Recipes ({selectedRecipes.length})
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
      
      <Dialog 
        open={tagDialogOpen} 
        onClose={() => setTagDialogOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>Tag Selected Recipes</DialogTitle>
        <Tabs
          value={tagDialogTab}
          onChange={handleTabChange}
          centered
          sx={{ borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="Component Type" />
          <Tab label="Recipe Preferences" />
        </Tabs>
        
        <DialogContent>
          {tagDialogTab === 0 ? (
            <FormControl component="fieldset" sx={{ mt: 1, width: '100%' }}>
              <FormLabel component="legend">Choose a component type for selected recipes:</FormLabel>
              {!customTagMode ? (
                <RadioGroup
                  value={selectedTag}
                  onChange={(e) => setSelectedTag(e.target.value)}
                >
                  {componentTypes.length > 0 && (
                    <>
                      <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>
                        Existing Component Types:
                      </Typography>
                      {componentTypes.map(type => (
                        <FormControlLabel 
                          key={type.component_type} 
                          value={type.component_type}
                          control={<Radio />} 
                          label={`${type.component_type} (${type.count})`} 
                        />
                      ))}
                    </>
                  )}
                  <Typography variant="subtitle2" sx={{ mt: 2, fontWeight: 'bold' }}>
                    Common Component Types:
                  </Typography>
                  {predefinedComponentTypes.map(type => (
                    <FormControlLabel 
                      key={type} 
                      value={type} 
                      control={<Radio />} 
                      label={type.replace('_', ' ')} 
                    />
                  ))}
                  <FormControlLabel
                    value="custom"
                    control={<Radio />}
                    label="Create custom component type..."
                    onClick={() => setCustomTagMode(true)}
                  />
                </RadioGroup>
              ) : (
                <Box sx={{ mt: 2 }}>
                  <TextField
                    autoFocus
                    fullWidth
                    label="Custom Component Type"
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    helperText="Use lowercase with underscores, e.g. 'breakfast_protein'"
                    InputProps={{
                      endAdornment: (
                        <IconButton 
                          onClick={() => setCustomTagMode(false)} 
                          edge="end"
                        >
                          <CloseIcon />
                        </IconButton>
                      )
                    }}
                  />
                </Box>
              )}
            </FormControl>
          ) : (
            <Box sx={{ mt: 1, width: '100%' }}>
              <Typography variant="subtitle1" sx={{ fontWeight: 'bold', mb: 2 }}>
                Recipe Preferences
              </Typography>
              <Grid container spacing={3}>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <FormLabel>Diet Type</FormLabel>
                    <Select
                      value={dietType}
                      onChange={(e) => setDietType(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>Select Diet Type...</em>
                      </MenuItem>
                      {dietTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <FormLabel>Cuisine Type</FormLabel>
                    <Select
                      value={recipeType}
                      onChange={(e) => setRecipeType(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>Select Cuisine Type...</em>
                      </MenuItem>
                      {recipeTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormLabel component="legend">Flavor Tags</FormLabel>
                  <FormGroup row>
                    {Object.keys(flavorTags).map((flavor) => (
                      <FormControlLabel
                        key={flavor}
                        control={
                          <Checkbox
                            checked={flavorTags[flavor]}
                            onChange={handleFlavorTagChange}
                            name={flavor}
                          />
                        }
                        label={flavor.charAt(0).toUpperCase() + flavor.slice(1)}
                      />
                    ))}
                  </FormGroup>
                </Grid>
                <Grid item xs={12}>
                  <FormControl component="fieldset">
                    <FormLabel component="legend">Spice Level</FormLabel>
                    <RadioGroup
                      row
                      value={spiceLevel}
                      onChange={(e) => setSpiceLevel(e.target.value)}
                    >
                      {['mild', 'medium', 'hot'].map((level) => (
                        <FormControlLabel
                          key={level}
                          value={level}
                          control={<Radio />}
                          label={level.charAt(0).toUpperCase() + level.slice(1)}
                        />
                      ))}
                    </RadioGroup>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <FormLabel>Recipe Format</FormLabel>
                    <Select
                      value={recipeFormat}
                      onChange={(e) => setRecipeFormat(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>Select Recipe Format...</em>
                      </MenuItem>
                      {recipeFormats.map((format) => (
                        <MenuItem key={format} value={format}>
                          {format}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12} sm={6}>
                  <FormControl fullWidth>
                    <FormLabel>Meal Prep Type</FormLabel>
                    <Select
                      value={mealPrepType}
                      onChange={(e) => setMealPrepType(e.target.value)}
                      displayEmpty
                    >
                      <MenuItem value="">
                        <em>Select Meal Prep Type...</em>
                      </MenuItem>
                      {mealPrepTypes.map((type) => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormControl fullWidth>
                    <FormLabel>Preparation Complexity: {prepComplexity}%</FormLabel>
                    <Slider
                      value={prepComplexity}
                      onChange={(e, newValue) => setPrepComplexity(newValue)}
                      aria-labelledby="complexity-slider"
                      valueLabelDisplay="auto"
                    />
                  </FormControl>
                </Grid>
                <Grid item xs={12}>
                  <FormLabel component="legend">Available Appliances</FormLabel>
                  <FormGroup row>
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedAppliances.airFryer}
                          onChange={handleApplianceChange}
                          name="airFryer"
                        />
                      }
                      label="Air Fryer"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedAppliances.instantPot}
                          onChange={handleApplianceChange}
                          name="instantPot"
                        />
                      }
                      label="Instant Pot"
                    />
                    <FormControlLabel
                      control={
                        <Checkbox
                          checked={selectedAppliances.crockPot}
                          onChange={handleApplianceChange}
                          name="crockPot"
                        />
                      }
                      label="Crock Pot"
                    />
                  </FormGroup>
                </Grid>
              </Grid>
            </Box>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={() => setTagDialogOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleTagConfirm} 
            variant="contained"
            disabled={loading}
          >
            Tag Recipes
          </Button>
        </DialogActions>
      </Dialog>
      
      <Dialog
        open={deleteConfirmOpen}
        onClose={() => setDeleteConfirmOpen(false)}
      >
        <DialogTitle>Confirm Delete</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Are you sure you want to delete "{recipeToDelete?.title}"? This action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
          <Button 
            onClick={handleDeleteRecipe} 
            color="error" 
            variant="contained"
            disabled={loading}
          >
            Delete
          </Button>
        </DialogActions>
      </Dialog>
      
      <RecipeEditor 
        recipeId={recipeToEdit}
        onSave={handleEditSave}
        onClose={() => setEditorOpen(false)}
        open={editorOpen}
      />
      
      {/* Add Recipe Dialog */}
      <AddRecipeForm
        open={addRecipeDialogOpen}
        onClose={() => setAddRecipeDialogOpen(false)}
        onSave={handleAddRecipeSuccess}
      />
      
      {alertMessage && (
        <Snackbar 
          open={alertOpen} 
          autoHideDuration={6000} 
          onClose={handleAlertClose}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={handleAlertClose} 
            severity={alertSeverity} 
            sx={{ width: '100%' }}
          >
            {alertMessage}
          </Alert>
        </Snackbar>
      )}
    </Container>
  );
}

export default RecipeAdminPanel;