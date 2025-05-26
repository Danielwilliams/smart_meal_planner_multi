// src/components/CustomRecipeCreationDialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  Grid,
  IconButton,
  Chip,
  Autocomplete,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Card,
  CardContent,
  Divider,
  Alert,
  CircularProgress,
  Tab,
  Tabs,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction
} from '@mui/material';
import {
  Add as AddIcon,
  Delete as DeleteIcon,
  DragIndicator as DragIcon,
  Restaurant as RecipeIcon,
  ShoppingCart as IngredientsIcon,
  MenuBook as StepsIcon,
  Info as InfoIcon
} from '@mui/icons-material';
import { useOrganization } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

function TabPanel({ children, value, index, ...other }) {
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      id={`recipe-creation-tabpanel-${index}`}
      aria-labelledby={`recipe-creation-tab-${index}`}
      {...other}
    >
      {value === index && (
        <Box sx={{ py: 2 }}>
          {children}
        </Box>
      )}
    </div>
  );
}

const CustomRecipeCreationDialog = ({ 
  open, 
  onClose, 
  onRecipeCreated, 
  editingRecipe = null,
  mode = 'organization' // 'organization' or 'user'
}) => {
  const { organization } = useOrganization();
  const { user } = useAuth();
  const [tabValue, setTabValue] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Recipe form state
  const [recipeForm, setRecipeForm] = useState({
    title: '',
    description: '',
    cuisine: '',
    total_time: '',
    servings: '',
    difficulty: '',
    image_url: '',
    diet_tags: []
  });

  // Ingredients state
  const [ingredients, setIngredients] = useState([
    { name: '', quantity: '', unit: '' }
  ]);

  // Steps state
  const [steps, setSteps] = useState([
    { step_number: 1, instruction: '' }
  ]);

  // Predefined options
  const cuisineOptions = [
    'American', 'Italian', 'Mexican', 'Chinese', 'Japanese', 'Indian', 'Thai', 
    'French', 'Mediterranean', 'Greek', 'Spanish', 'German', 'Korean', 'Vietnamese'
  ];

  const dietTagOptions = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'Keto', 'Paleo', 
    'Low-Carb', 'High-Protein', 'Low-Fat', 'Nut-Free', 'Soy-Free'
  ];

  const difficultyOptions = ['Easy', 'Medium', 'Hard'];

  const unitOptions = [
    'cup', 'cups', 'tbsp', 'tsp', 'oz', 'lb', 'g', 'kg', 'ml', 'l', 
    'piece', 'pieces', 'clove', 'cloves', 'slice', 'slices', 'can', 'cans',
    'bottle', 'bottles', 'package', 'packages', 'bunch', 'head', 'large', 'medium', 'small'
  ];

  // Initialize form when editing
  useEffect(() => {
    if (editingRecipe) {
      setRecipeForm({
        title: editingRecipe.title || '',
        description: editingRecipe.description || '',
        cuisine: editingRecipe.cuisine || '',
        total_time: editingRecipe.total_time || '',
        servings: editingRecipe.servings || '',
        difficulty: editingRecipe.difficulty || '',
        image_url: editingRecipe.image_url || '',
        diet_tags: editingRecipe.diet_tags || []
      });
      
      if (editingRecipe.ingredients && editingRecipe.ingredients.length > 0) {
        setIngredients(editingRecipe.ingredients);
      }
      
      if (editingRecipe.steps && editingRecipe.steps.length > 0) {
        setSteps(editingRecipe.steps.sort((a, b) => a.step_number - b.step_number));
      }
    }
  }, [editingRecipe]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setRecipeForm({
        title: '',
        description: '',
        cuisine: '',
        total_time: '',
        servings: '',
        difficulty: '',
        image_url: '',
        diet_tags: []
      });
      setIngredients([{ name: '', quantity: '', unit: '' }]);
      setSteps([{ step_number: 1, instruction: '' }]);
      setTabValue(0);
      setError('');
      setSuccess('');
    }
  }, [open]);

  const handleAddIngredient = () => {
    setIngredients(prev => [...prev, { name: '', quantity: '', unit: '' }]);
  };

  const handleRemoveIngredient = (index) => {
    if (ingredients.length > 1) {
      setIngredients(prev => prev.filter((_, i) => i !== index));
    }
  };

  const handleIngredientChange = (index, field, value) => {
    setIngredients(prev => prev.map((ingredient, i) => 
      i === index ? { ...ingredient, [field]: value } : ingredient
    ));
  };

  const handleAddStep = () => {
    setSteps(prev => [...prev, { step_number: prev.length + 1, instruction: '' }]);
  };

  const handleRemoveStep = (index) => {
    if (steps.length > 1) {
      setSteps(prev => prev.filter((_, i) => i !== index).map((step, i) => ({
        ...step,
        step_number: i + 1
      })));
    }
  };

  const handleStepChange = (index, value) => {
    setSteps(prev => prev.map((step, i) => 
      i === index ? { ...step, instruction: value } : step
    ));
  };

  const validateForm = () => {
    if (!recipeForm.title.trim()) {
      setError('Recipe title is required');
      return false;
    }

    const validIngredients = ingredients.filter(ing => ing.name.trim());
    if (validIngredients.length === 0) {
      setError('At least one ingredient is required');
      return false;
    }

    const validSteps = steps.filter(step => step.instruction.trim());
    if (validSteps.length === 0) {
      setError('At least one instruction step is required');
      return false;
    }

    return true;
  };

  const handleSubmit = async () => {
    setError('');
    setSuccess('');

    if (!validateForm()) {
      return;
    }

    try {
      setLoading(true);

      // Filter out empty ingredients and steps
      const validIngredients = ingredients.filter(ing => ing.name.trim());
      const validSteps = steps.filter(step => step.instruction.trim());

      const recipeData = {
        title: recipeForm.title,
        description: recipeForm.description,
        cuisine: recipeForm.cuisine,
        complexity: recipeForm.difficulty,
        total_time: recipeForm.total_time ? parseInt(recipeForm.total_time) : null,
        servings: recipeForm.servings ? parseInt(recipeForm.servings) : null,
        image_url: recipeForm.image_url,
        diet_tags: recipeForm.diet_tags,
        custom_tags: [],
        ingredients: validIngredients.map((ing, index) => ({
          name: ing.name,
          amount: ing.quantity,
          unit: ing.unit,
          sort_order: index + 1,
          is_optional: false
        })),
        steps: validSteps.map((step, index) => ({
          step_number: index + 1,
          instruction: step.instruction
        })),
        is_public: false
      };

      let response;
      if (editingRecipe) {
        response = await apiService.updateUserRecipe(editingRecipe.id, recipeData);
        setSuccess('Recipe updated successfully!');
      } else {
        const forOrganization = mode === 'organization';
        response = await apiService.createUserRecipe(recipeData, forOrganization);
        setSuccess('Recipe created successfully!');
      }

      // Notify parent component
      if (onRecipeCreated) {
        onRecipeCreated(response);
      }

      // Close dialog after short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1500);

    } catch (err) {
      console.error('Error saving recipe:', err);
      setError(editingRecipe ? 'Failed to update recipe' : 'Failed to create recipe');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="lg" fullWidth>
      <DialogTitle>
        <Box display="flex" alignItems="center" gap={1}>
          <RecipeIcon />
          {editingRecipe ? 'Edit Custom Recipe' : 'Create Custom Recipe'}
        </Box>
      </DialogTitle>
      
      <DialogContent>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {success && <Alert severity="success" sx={{ mb: 2 }}>{success}</Alert>}

        {/* Tabs Navigation */}
        <Paper sx={{ mb: 3 }}>
          <Tabs value={tabValue} onChange={(e, newValue) => setTabValue(newValue)}>
            <Tab label="Basic Info" icon={<InfoIcon />} />
            <Tab label="Ingredients" icon={<IngredientsIcon />} />
            <Tab label="Instructions" icon={<StepsIcon />} />
          </Tabs>
        </Paper>

        {/* Basic Information Tab */}
        <TabPanel value={tabValue} index={0}>
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Recipe Title"
                value={recipeForm.title}
                onChange={(e) => setRecipeForm(prev => ({ ...prev, title: e.target.value }))}
                required
                placeholder="Enter a descriptive recipe title"
              />
            </Grid>
            
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Description"
                multiline
                rows={3}
                value={recipeForm.description}
                onChange={(e) => setRecipeForm(prev => ({ ...prev, description: e.target.value }))}
                placeholder="Describe your recipe, what makes it special..."
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <Autocomplete
                freeSolo
                options={cuisineOptions}
                value={recipeForm.cuisine}
                onChange={(event, newValue) => {
                  setRecipeForm(prev => ({ ...prev, cuisine: newValue || '' }));
                }}
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Cuisine Type"
                    placeholder="e.g., Italian, Mexican, Asian..."
                  />
                )}
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <FormControl fullWidth>
                <InputLabel>Difficulty</InputLabel>
                <Select
                  value={recipeForm.difficulty}
                  onChange={(e) => setRecipeForm(prev => ({ ...prev, difficulty: e.target.value }))}
                  label="Difficulty"
                >
                  <MenuItem value="">Not specified</MenuItem>
                  {difficultyOptions.map(diff => (
                    <MenuItem key={diff} value={diff}>{diff}</MenuItem>
                  ))}
                </Select>
              </FormControl>
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Total Time (minutes)"
                type="number"
                value={recipeForm.total_time}
                onChange={(e) => setRecipeForm(prev => ({ ...prev, total_time: e.target.value }))}
                placeholder="e.g., 45"
              />
            </Grid>

            <Grid item xs={12} md={6}>
              <TextField
                fullWidth
                label="Servings"
                type="number"
                value={recipeForm.servings}
                onChange={(e) => setRecipeForm(prev => ({ ...prev, servings: e.target.value }))}
                placeholder="e.g., 4"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Image URL"
                value={recipeForm.image_url}
                onChange={(e) => setRecipeForm(prev => ({ ...prev, image_url: e.target.value }))}
                placeholder="https://example.com/recipe-image.jpg"
                helperText="Optional: Link to an image of your finished recipe"
              />
            </Grid>

            <Grid item xs={12}>
              <Autocomplete
                multiple
                freeSolo
                options={dietTagOptions}
                value={recipeForm.diet_tags}
                onChange={(event, newValue) => {
                  setRecipeForm(prev => ({ ...prev, diet_tags: newValue }));
                }}
                renderTags={(value, getTagProps) =>
                  value.map((option, index) => (
                    <Chip key={index} label={option} {...getTagProps({ index })} />
                  ))
                }
                renderInput={(params) => (
                  <TextField
                    {...params}
                    label="Diet Tags"
                    placeholder="Add dietary restrictions or tags..."
                    helperText="e.g., Vegetarian, Gluten-Free, Keto"
                  />
                )}
              />
            </Grid>
          </Grid>
        </TabPanel>

        {/* Ingredients Tab */}
        <TabPanel value={tabValue} index={1}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Ingredients</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddIngredient}
              size="small"
            >
              Add Ingredient
            </Button>
          </Box>

          <List>
            {ingredients.map((ingredient, index) => (
              <ListItem key={index} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 1 }}>
                <Grid container spacing={2} alignItems="center">
                  <Grid item xs={12} md={5}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Ingredient name"
                      value={ingredient.name}
                      onChange={(e) => handleIngredientChange(index, 'name', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <TextField
                      fullWidth
                      size="small"
                      placeholder="Quantity"
                      value={ingredient.quantity}
                      onChange={(e) => handleIngredientChange(index, 'quantity', e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={6} md={3}>
                    <Autocomplete
                      freeSolo
                      size="small"
                      options={unitOptions}
                      value={ingredient.unit}
                      onChange={(event, newValue) => {
                        handleIngredientChange(index, 'unit', newValue || '');
                      }}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          placeholder="Unit"
                          size="small"
                        />
                      )}
                    />
                  </Grid>
                  <Grid item xs={12} md={1}>
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveIngredient(index)}
                      disabled={ingredients.length === 1}
                      size="small"
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>
        </TabPanel>

        {/* Instructions Tab */}
        <TabPanel value={tabValue} index={2}>
          <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
            <Typography variant="h6">Instructions</Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleAddStep}
              size="small"
            >
              Add Step
            </Button>
          </Box>

          <List>
            {steps.map((step, index) => (
              <ListItem key={index} sx={{ border: '1px solid #e0e0e0', borderRadius: 1, mb: 2 }}>
                <Grid container spacing={2} alignItems="flex-start">
                  <Grid item xs={1}>
                    <Box
                      sx={{
                        width: 32,
                        height: 32,
                        borderRadius: '50%',
                        backgroundColor: 'primary.main',
                        color: 'white',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 'bold'
                      }}
                    >
                      {step.step_number}
                    </Box>
                  </Grid>
                  <Grid item xs={10}>
                    <TextField
                      fullWidth
                      multiline
                      rows={2}
                      placeholder={`Step ${step.step_number} instructions...`}
                      value={step.instruction}
                      onChange={(e) => handleStepChange(index, e.target.value)}
                    />
                  </Grid>
                  <Grid item xs={1}>
                    <IconButton
                      color="error"
                      onClick={() => handleRemoveStep(index)}
                      disabled={steps.length === 1}
                    >
                      <DeleteIcon />
                    </IconButton>
                  </Grid>
                </Grid>
              </ListItem>
            ))}
          </List>
        </TabPanel>
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || !recipeForm.title.trim()}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading 
            ? (editingRecipe ? 'Updating...' : 'Creating...') 
            : (editingRecipe ? 'Update Recipe' : 'Create Recipe')
          }
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default CustomRecipeCreationDialog;