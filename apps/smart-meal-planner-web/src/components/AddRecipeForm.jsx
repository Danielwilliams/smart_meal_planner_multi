import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Box,
  Chip,
  IconButton,
  CircularProgress,
  FormControlLabel,
  Switch,
  Divider,
  Paper,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Alert,
  Snackbar
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import axios from 'axios';

const complexityLevels = ['easy', 'medium', 'complex'];
const cuisineTypes = [
  'American', 'Italian', 'Mexican', 'Asian', 'Mediterranean',
  'Indian', 'French', 'Greek', 'Japanese', 'Thai', 'Chinese',
  'Korean', 'Spanish', 'Middle Eastern', 'Vietnamese',
  'Brazilian', 'Caribbean', 'Other'
];

const AddRecipeForm = ({ open, onClose, onSave }) => {
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
  
  // Basic recipe info
  const [title, setTitle] = useState('');
  const [source, setSource] = useState('Manual Entry');
  const [sourceUrl, setSourceUrl] = useState('');
  const [complexity, setComplexity] = useState('medium');
  const [cuisine, setCuisine] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [prepTime, setPrepTime] = useState('');
  const [cookTime, setCookTime] = useState('');
  const [servings, setServings] = useState(4);
  const [isVerified, setIsVerified] = useState(true);
  const [componentType, setComponentType] = useState('');
  
  // Ingredients and instructions
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState('');
  const [instructions, setInstructions] = useState([]);
  const [newInstruction, setNewInstruction] = useState('');
  
  // Nutritional info
  const [calories, setCalories] = useState('');
  const [protein, setProtein] = useState('');
  const [carbs, setCarbs] = useState('');
  const [fat, setFat] = useState('');
  
  // Tags and categories
  const [dietTags, setDietTags] = useState([]);
  const [newDietTag, setNewDietTag] = useState('');
  
  // Submission state
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const showAlert = (message, severity = 'info') => {
    setAlert({
      open: true,
      message,
      severity
    });
  };

  const handleCloseAlert = () => {
    setAlert({
      ...alert,
      open: false
    });
  };
  
  const handleAddIngredient = () => {
    if (newIngredient.trim()) {
      setIngredients([...ingredients, newIngredient.trim()]);
      setNewIngredient('');
    }
  };
  
  const handleRemoveIngredient = (index) => {
    setIngredients(ingredients.filter((_, i) => i !== index));
  };
  
  const handleAddInstruction = () => {
    if (newInstruction.trim()) {
      setInstructions([...instructions, newInstruction.trim()]);
      setNewInstruction('');
    }
  };
  
  const handleRemoveInstruction = (index) => {
    setInstructions(instructions.filter((_, i) => i !== index));
  };
  
  const handleAddDietTag = () => {
    if (newDietTag.trim() && !dietTags.includes(newDietTag.trim())) {
      setDietTags([...dietTags, newDietTag.trim()]);
      setNewDietTag('');
    }
  };
  
  const handleRemoveDietTag = (tag) => {
    setDietTags(dietTags.filter(t => t !== tag));
  };
  
  const validateForm = () => {
    if (!title) {
      showAlert('Recipe title is required', 'error');
      return false;
    }
    
    if (ingredients.length === 0) {
      showAlert('At least one ingredient is required', 'error');
      return false;
    }
    
    if (instructions.length === 0) {
      showAlert('At least one instruction is required', 'error');
      return false;
    }
    
    return true;
  };
  
  const resetForm = () => {
    setTitle('');
    setSource('Manual Entry');
    setSourceUrl('');
    setComplexity('medium');
    setCuisine('');
    setImageUrl('');
    setPrepTime('');
    setCookTime('');
    setServings(4);
    setIsVerified(true);
    setComponentType('');
    setIngredients([]);
    setNewIngredient('');
    setInstructions([]);
    setNewInstruction('');
    setCalories('');
    setProtein('');
    setCarbs('');
    setFat('');
    setDietTags([]);
    setNewDietTag('');
  };
  
  const handleSubmit = async () => {
    if (!validateForm()) return;
    
    try {
      setLoading(true);
      
      // Calculate total time
      const totalTime = (parseInt(prepTime) || 0) + (parseInt(cookTime) || 0);
      
      // Prepare nutrition per serving data
      const nutritionPerServing = {
        calories: calories || null,
        protein: protein || null,
        carbs: carbs || null,
        fat: fat || null
      };
      
      // Prepare recipe data
      const recipeData = {
        title,
        source,
        source_url: sourceUrl,
        complexity,
        cuisine,
        image_url: imageUrl,
        prep_time: prepTime ? parseInt(prepTime) : null,
        cook_time: cookTime ? parseInt(cookTime) : null,
        total_time: totalTime > 0 ? totalTime : null,
        servings: parseInt(servings),
        is_verified: isVerified,
        component_type: componentType,
        instructions: instructions,
        metadata: {
          ingredients_list: ingredients, // Store ingredients in metadata
          nutrition_per_serving: nutritionPerServing
        },
        diet_tags: dietTags
      };
      
      console.log('Saving recipe with data:', recipeData);
      
      // Send the request
      const response = await axios.post(`${API_BASE_URL}/recipe-admin/create-recipe`, recipeData, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Recipe added:', response.data);
      
      if (response.data.success) {
        showAlert('Recipe created successfully!', 'success');
        
        // Call the onSave callback with the response data
        if (onSave) {
          // Check if recipe is null and use submitted data as fallback
          const recipeData = response.data.recipe || {
            id: response.data.recipe_id,
            title: title,
            // Add other key properties that might be needed
            complexity: complexity,
            cuisine: cuisine
          };
          
          setTimeout(() => {
            onSave({
              success: response.data.success,
              recipe_id: response.data.recipe_id,
              recipe: recipeData
            });
            
            // Reset the form and close the dialog
            resetForm();
            onClose();
          }, 1500);
        }
      } else {
        showAlert(`Failed to create recipe: ${response.data.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error adding recipe:', error);
      showAlert(`Error creating recipe: ${error.response?.data?.message || error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="lg"
      fullWidth
    >
      <DialogTitle>Add New Recipe</DialogTitle>
      <DialogContent>
        <Grid container spacing={3}>
          {/* Basic Recipe Info */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Basic Information</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    required
                    label="Recipe Title"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Source"
                    value={source}
                    onChange={(e) => setSource(e.target.value)}
                    helperText="Where this recipe came from"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6}>
                  <TextField
                    fullWidth
                    label="Source URL"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    helperText="Original recipe URL (if applicable)"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Complexity</InputLabel>
                    <Select
                      value={complexity}
                      label="Complexity"
                      onChange={(e) => setComplexity(e.target.value)}
                    >
                      {complexityLevels.map(level => (
                        <MenuItem key={level} value={level}>
                          {level.charAt(0).toUpperCase() + level.slice(1)}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <FormControl fullWidth>
                    <InputLabel>Cuisine</InputLabel>
                    <Select
                      value={cuisine}
                      label="Cuisine"
                      onChange={(e) => setCuisine(e.target.value)}
                    >
                      <MenuItem value="">
                        <em>Select cuisine...</em>
                      </MenuItem>
                      {cuisineTypes.map(type => (
                        <MenuItem key={type} value={type}>
                          {type}
                        </MenuItem>
                      ))}
                    </Select>
                  </FormControl>
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    label="Component Type"
                    value={componentType}
                    onChange={(e) => setComponentType(e.target.value)}
                    helperText="e.g., main_protein, side_dish, carb_base"
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Prep Time (minutes)"
                    value={prepTime}
                    onChange={(e) => setPrepTime(e.target.value)}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Cook Time (minutes)"
                    value={cookTime}
                    onChange={(e) => setCookTime(e.target.value)}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={4}>
                  <TextField
                    fullWidth
                    type="number"
                    label="Servings"
                    value={servings}
                    onChange={(e) => setServings(e.target.value)}
                    InputProps={{ inputProps: { min: 1 } }}
                  />
                </Grid>
                
                <Grid item xs={12}>
                  <TextField
                    fullWidth
                    label="Image URL"
                    value={imageUrl}
                    onChange={(e) => setImageUrl(e.target.value)}
                    helperText="URL to an image of the prepared dish"
                  />
                  {imageUrl && (
                    <Box 
                      sx={{ 
                        mt: 2, 
                        display: 'flex', 
                        justifyContent: 'center',
                        border: '1px solid #ddd',
                        borderRadius: '4px',
                        p: 1
                      }}
                    >
                      <img 
                        src={imageUrl} 
                        alt={title} 
                        style={{ 
                          maxWidth: '100%', 
                          maxHeight: '200px',
                          objectFit: 'contain'
                        }} 
                      />
                    </Box>
                  )}
                </Grid>
                
                <Grid item xs={12}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={isVerified}
                        onChange={(e) => setIsVerified(e.target.checked)}
                      />
                    }
                    label="Mark as Verified Recipe"
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Ingredients */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Ingredients</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Add Ingredient"
                  value={newIngredient}
                  onChange={(e) => setNewIngredient(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddIngredient()}
                  placeholder="e.g., 2 cups flour"
                  helperText="Press Enter or click Add to add ingredient"
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleAddIngredient}>
                        <AddIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Box>
              
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {ingredients.length === 0 ? (
                  <ListItem>
                    <ListItemText secondary="No ingredients added yet" />
                  </ListItem>
                ) : (
                  ingredients.map((ingredient, index) => (
                    <ListItem key={index}>
                      <ListItemText primary={ingredient} />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => handleRemoveIngredient(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>
          </Grid>
          
          {/* Instructions */}
          <Grid item xs={12} md={6}>
            <Typography variant="h6" gutterBottom>Instructions</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Add Instruction Step"
                  value={newInstruction}
                  onChange={(e) => setNewInstruction(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddInstruction()}
                  multiline
                  rows={2}
                  placeholder="e.g., Preheat oven to 350°F (175°C)"
                  helperText="Press Enter or click Add to add step"
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleAddInstruction}>
                        <AddIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Box>
              
              <List dense sx={{ maxHeight: 300, overflow: 'auto' }}>
                {instructions.length === 0 ? (
                  <ListItem>
                    <ListItemText secondary="No instructions added yet" />
                  </ListItem>
                ) : (
                  instructions.map((instruction, index) => (
                    <ListItem key={index}>
                      <ListItemText 
                        primary={`${index + 1}. ${instruction}`} 
                        primaryTypographyProps={{ style: { whiteSpace: 'normal', wordBreak: 'break-word' } }}
                      />
                      <ListItemSecondaryAction>
                        <IconButton edge="end" onClick={() => handleRemoveInstruction(index)}>
                          <DeleteIcon />
                        </IconButton>
                      </ListItemSecondaryAction>
                    </ListItem>
                  ))
                )}
              </List>
            </Paper>
          </Grid>
          
          {/* Nutrition Info */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Nutrition Information (per serving)</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Grid container spacing={2}>
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Calories"
                    value={calories}
                    onChange={(e) => setCalories(e.target.value)}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Protein (g)"
                    value={protein}
                    onChange={(e) => setProtein(e.target.value)}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Carbs (g)"
                    value={carbs}
                    onChange={(e) => setCarbs(e.target.value)}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
                
                <Grid item xs={12} sm={6} md={3}>
                  <TextField
                    fullWidth
                    label="Fat (g)"
                    value={fat}
                    onChange={(e) => setFat(e.target.value)}
                    type="number"
                    InputProps={{ inputProps: { min: 0 } }}
                  />
                </Grid>
              </Grid>
            </Paper>
          </Grid>
          
          {/* Diet Tags */}
          <Grid item xs={12}>
            <Typography variant="h6" gutterBottom>Diet Tags</Typography>
            <Paper variant="outlined" sx={{ p: 2 }}>
              <Box sx={{ mb: 2 }}>
                <TextField
                  fullWidth
                  label="Add Diet Tag"
                  value={newDietTag}
                  onChange={(e) => setNewDietTag(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddDietTag()}
                  placeholder="e.g., vegetarian, gluten-free"
                  helperText="Press Enter or click Add to add tag"
                  InputProps={{
                    endAdornment: (
                      <IconButton onClick={handleAddDietTag}>
                        <AddIcon />
                      </IconButton>
                    ),
                  }}
                />
              </Box>
              
              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
                {dietTags.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No diet tags added yet
                  </Typography>
                ) : (
                  dietTags.map((tag) => (
                    <Chip
                      key={tag}
                      label={tag}
                      onDelete={() => handleRemoveDietTag(tag)}
                      color="primary"
                      variant="outlined"
                    />
                  ))
                )}
              </Box>
            </Paper>
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained" 
          color="primary"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Add Recipe'}
        </Button>
      </DialogActions>

      <Snackbar
        open={alert.open}
        autoHideDuration={6000}
        onClose={handleCloseAlert}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={handleCloseAlert} 
          severity={alert.severity} 
          sx={{ width: '100%' }}
        >
          {alert.message}
        </Alert>
      </Snackbar>
    </Dialog>
  );
};

export default AddRecipeForm;