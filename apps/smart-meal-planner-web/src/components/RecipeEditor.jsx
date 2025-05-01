// src/components/RecipeEditor.jsx
import React, { useState, useEffect, useRef } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Grid,
  Typography,
  CircularProgress,
  IconButton,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Paper,
  Box,
  Alert,
  Snackbar,
  Input
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import CheckIcon from '@mui/icons-material/Check';
import EditIcon from '@mui/icons-material/Edit';
import CloseIcon from '@mui/icons-material/Close';
import UploadIcon from '@mui/icons-material/Upload';
import ImageIcon from '@mui/icons-material/Image';
import axios from 'axios';

const RecipeEditor = ({ open, onClose, recipeId, onSave }) => {
  const [loading, setLoading] = useState(false);
  const [recipe, setRecipe] = useState(null);
  const [title, setTitle] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);
  const [ingredients, setIngredients] = useState([]);
  const [newIngredient, setNewIngredient] = useState('');
  const [instructions, setInstructions] = useState([]);
  const [newInstruction, setNewInstruction] = useState('');
  const fileInputRef = useRef(null);
  const [editingIngredientIndex, setEditingIngredientIndex] = useState(null);
  const [editingIngredientText, setEditingIngredientText] = useState('');
  const [editingInstructionIndex, setEditingInstructionIndex] = useState(null);
  const [editingInstructionText, setEditingInstructionText] = useState('');
  const [macros, setMacros] = useState({
    calories: '',
    protein: '',
    carbs: '',
    fat: ''
  });
  const [alert, setAlert] = useState({
    open: false,
    message: '',
    severity: 'info'
  });
  
  const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
  
  const showAlert = (message, severity = 'info') => {
    setAlert({
      open: true,
      message,
      severity
    });
  };
  
  // Handle image upload to S3
  const handleImageUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    
    // Check file type
    if (!file.type.includes('image/')) {
      showAlert('Please select an image file', 'error');
      return;
    }
    
    // Check file size (limit to 5MB)
    if (file.size > 5 * 1024 * 1024) {
      showAlert('Image file size must be less than 5MB', 'error');
      return;
    }
    
    try {
      setUploadingImage(true);
      
      // Create form data
      const formData = new FormData();
      formData.append('file', file);
      
      // Get the authentication token
      const token = localStorage.getItem('access_token');
      console.log("Auth token available:", !!token);
      
      if (!token) {
        showAlert('Authentication token not found. Please log in again.', 'error');
        return;
      }
      
      // Upload image with explicit headers
      const response = await axios.post(
        `${API_BASE_URL}/recipe-admin/upload-image`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'multipart/form-data',
            'Accept': 'application/json'
          },
          withCredentials: false
        }
      );
      
      if (response.data.success && response.data.image_url) {
        // Update image URL with the one returned from server
        setImageUrl(response.data.image_url);
        showAlert('Image uploaded successfully', 'success');
      } else {
        showAlert('Failed to upload image', 'error');
      }
    } catch (error) {
      console.error('Error uploading image:', error);
      showAlert(`Error uploading image: ${error.response?.data?.detail || error.message}`, 'error');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleCloseAlert = () => {
    setAlert({
      ...alert,
      open: false
    });
  };

  const handleEditIngredient = (index) => {
    setEditingIngredientIndex(index);
    setEditingIngredientText(ingredients[index]);
  };

  // function to save the edited ingredient
  const handleSaveIngredientEdit = () => {
    if (editingIngredientIndex !== null && editingIngredientText.trim()) {
      const updatedIngredients = [...ingredients];
      updatedIngredients[editingIngredientIndex] = editingIngredientText.trim();
      setIngredients(updatedIngredients);
      setEditingIngredientIndex(null);
      setEditingIngredientText('');
    }
  };

  // function to cancel editing
  const handleCancelIngredientEdit = () => {
    setEditingIngredientIndex(null);
    setEditingIngredientText('');
  };

  // Function to start editing an instruction
  const handleEditInstruction = (index) => {
    setEditingInstructionIndex(index);
    setEditingInstructionText(instructions[index]);
  };  

  // Function to save the edited instruction
  const handleSaveInstructionEdit = () => {
    if (editingInstructionIndex !== null && editingInstructionText.trim()) {
      const updatedInstructions = [...instructions];
      updatedInstructions[editingInstructionIndex] = editingInstructionText.trim();
      setInstructions(updatedInstructions);
      setEditingInstructionIndex(null);
      setEditingInstructionText('');
    }
  };  

  // Function to cancel editing
  const handleCancelInstructionEdit = () => {
    setEditingInstructionIndex(null);
    setEditingInstructionText('');
  };
  
  useEffect(() => {
    if (open && recipeId) {
      loadRecipeDetails();
    }
  }, [open, recipeId]);
  
  const loadRecipeDetails = async () => {
    try {
      setLoading(true);
      
      const response = await axios.get(`${API_BASE_URL}/scraped-recipes/${recipeId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      const recipeData = response.data;
      console.log('Loaded recipe data:', recipeData);
      console.log('Original title:', recipeData.title);
      console.log('Original image URL:', recipeData.image_url);
      
      setRecipe(recipeData);
      // Make sure to set the title exactly as it is in the database
      setTitle(recipeData.title || '');
      // Make sure to set the image URL exactly as it is in the database
      setImageUrl(recipeData.image_url || '');
      
      // First check recipe_data, then fall back to direct ingredients/instructions properties
      const recipeDataSource = recipeData.recipe_data || recipeData;
      
      // Check if metadata contains ingredients_list
      if (recipeData.metadata && recipeData.metadata.ingredients_list) {
        setIngredients(recipeData.metadata.ingredients_list);
        console.log('Loaded ingredients from metadata:', recipeData.metadata.ingredients_list);
      } else {
        // Handle ingredients from recipe_ingredients table or other sources
        if (recipeDataSource.ingredients) {
          if (Array.isArray(recipeDataSource.ingredients)) {
            setIngredients(recipeDataSource.ingredients.map(ing => 
              typeof ing === 'string' ? ing : ing.name || JSON.stringify(ing)
            ));
            console.log('Loaded ingredients from array:', recipeDataSource.ingredients);
          } else if (typeof recipeDataSource.ingredients === 'string') {
            try {
              const parsedIngredients = JSON.parse(recipeDataSource.ingredients);
              setIngredients(Array.isArray(parsedIngredients) ? 
                parsedIngredients.map(ing => typeof ing === 'string' ? ing : ing.name || JSON.stringify(ing)) : 
                [recipeDataSource.ingredients]
              );
              console.log('Loaded ingredients from JSON string:', parsedIngredients);
            } catch (e) {
              setIngredients([recipeDataSource.ingredients]);
              console.log('Loaded ingredients as single string:', recipeDataSource.ingredients);
            }
          }
        } else {
          setIngredients([]);
          console.log('No ingredients found in recipe data');
        }
      }
      
      // Handle instructions
      if (recipeDataSource.instructions) {
        if (Array.isArray(recipeDataSource.instructions)) {
          setInstructions(recipeDataSource.instructions.map(inst => 
            typeof inst === 'string' ? inst : inst.text || JSON.stringify(inst)
          ));
          console.log('Loaded instructions from array:', recipeDataSource.instructions);
        } else if (typeof recipeDataSource.instructions === 'string') {
          try {
            const parsedInstructions = JSON.parse(recipeDataSource.instructions);
            setInstructions(Array.isArray(parsedInstructions) ? 
              parsedInstructions.map(inst => typeof inst === 'string' ? inst : inst.text || JSON.stringify(inst)) : 
              [recipeDataSource.instructions]
            );
            console.log('Loaded instructions from JSON string:', parsedInstructions);
          } catch (e) {
            setInstructions([recipeDataSource.instructions]);
            console.log('Loaded instructions as single string:', recipeDataSource.instructions);
          }
        }
      } else {
        setInstructions([]);
        console.log('No instructions found in recipe data');
      }
      
      // Handle macros - check different possible sources in order of priority
      let macroData = { calories: '', protein: '', carbs: '', fat: '' };
      
      // First check for nutrition - this would come from the recipe_nutrition table
      if (recipeData.nutrition) {
        macroData = {
          calories: recipeData.nutrition.calories || '',
          protein: recipeData.nutrition.protein || '',
          carbs: recipeData.nutrition.carbs || '',
          fat: recipeData.nutrition.fat || ''
        };
        console.log('Found nutrition data from recipe_nutrition table:', macroData);
      }
      // Then check if metadata.nutrition_per_serving exists (from tagged recipes)
      else if (recipeData.metadata && recipeData.metadata.nutrition_per_serving) {
        macroData = {
          calories: recipeData.metadata.nutrition_per_serving.calories || '',
          protein: recipeData.metadata.nutrition_per_serving.protein || '',
          carbs: recipeData.metadata.nutrition_per_serving.carbs || '',
          fat: recipeData.metadata.nutrition_per_serving.fat || ''
        };
        console.log('Found nutrition_per_serving data from metadata:', macroData);
      }
      // Then check if nutrition_per_serving exists directly
      else if (recipeData.nutrition_per_serving) {
        macroData = {
          calories: recipeData.nutrition_per_serving.calories || '',
          protein: recipeData.nutrition_per_serving.protein || '',
          carbs: recipeData.nutrition_per_serving.carbs || '',
          fat: recipeData.nutrition_per_serving.fat || ''
        };
        console.log('Found direct nutrition_per_serving data:', macroData);
      }
      // Finally fall back to macros.perServing if available
      else if (recipeData.macros && recipeData.macros.perServing) {
        macroData = {
          calories: recipeData.macros.perServing.calories || '',
          protein: recipeData.macros.perServing.protein || '',
          carbs: recipeData.macros.perServing.carbs || '',
          fat: recipeData.macros.perServing.fat || ''
        };
        console.log('Found macros.perServing data:', macroData);
      }
      
      setMacros(macroData);
      
    } catch (error) {
      console.error('Error loading recipe details:', error);
      showAlert('Error loading recipe details: ' + (error.response?.data?.message || error.message), 'error');
    } finally {
      setLoading(false);
    }
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
  
  const handleSave = async () => {
    try {
      setLoading(true);
      
      // STEP 1: Update basic recipe information (no ingredients field)
      const basicUpdateData = {
        title: title,
        image_url: imageUrl,
        instructions: instructions,
        // Store ingredients in metadata since there's no ingredients column in scraped_recipes
        metadata: {
          ingredients_list: ingredients,
          nutrition_per_serving: {
            calories: macros.calories || null,
            protein: macros.protein || null,
            carbs: macros.carbs || null,
            fat: macros.fat || null
          }
        }
      };
      
      console.log('Updating recipe basic data:', basicUpdateData);
      console.log('API endpoint:', `${API_BASE_URL}/recipe-admin/update-recipe/${recipeId}`);
      
      // Send update request for basic data
      const response = await axios.patch(
        `${API_BASE_URL}/recipe-admin/update-recipe/${recipeId}`, 
        basicUpdateData, 
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
            'Content-Type': 'application/json'
          }
        }
      );
      
      console.log('Basic update response:', response.data);
      
      // STEP 2: Update nutrition data separately
      if (response.data?.success) {
        try {
          const nutritionData = {
            macros: {
              perServing: {
                calories: macros.calories || null,
                protein: macros.protein || null,
                carbs: macros.carbs || null,
                fat: macros.fat || null
              }
            }
          };
          
          console.log('Updating nutrition data:', nutritionData);
          
          const nutritionResponse = await axios.patch(
            `${API_BASE_URL}/recipe-admin/update-nutrition/${recipeId}`,
            nutritionData,
            {
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                'Content-Type': 'application/json'
              }
            }
          );
          
          console.log('Nutrition update response:', nutritionResponse.data);
        } catch (nutritionError) {
          console.error('Error updating nutrition (continuing):', nutritionError);
          // Continue even if nutrition update fails
        }
        
        showAlert('Recipe updated successfully!', 'success');
        
        // After successful update, fetch the updated recipe data
        try {
          const fetchResponse = await axios.get(`${API_BASE_URL}/scraped-recipes/${recipeId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          console.log('Updated recipe data:', fetchResponse.data);
          
          if (onSave) {
            setTimeout(() => {
              onSave(fetchResponse.data);
              onClose();
            }, 1500);
          }
        } catch (fetchError) {
          console.error('Error fetching updated recipe:', fetchError);
          // Even if fetch fails, still call onSave with the response data
          if (onSave) {
            setTimeout(() => {
              onSave(response.data);
              onClose();
            }, 1500);
          }
        }
      } else {
        showAlert(`Failed to update recipe: ${response.data?.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('Error updating recipe:', error);
      
      // Get detailed error information
      const errorDetail = error.response?.data?.detail || '';
      const errorMessage = error.response?.data?.message || error.message || 'Unknown error';
      
      // Log the raw response for debugging
      try {
        console.error('Raw error response:', JSON.stringify(error.response));
      } catch (e) {
        console.error('Could not stringify error response');
      }
      
      // Log detailed error information for debugging
      console.error('Error details:', {
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data,
        url: `${API_BASE_URL}/recipe-admin/update-recipe/${recipeId}`
      });
      
      // Show a more descriptive error message
      const displayMessage = errorDetail ? `${errorMessage} (${errorDetail})` : errorMessage;
      showAlert(`Error updating recipe: ${displayMessage}`, 'error');
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Dialog 
      open={open} 
      onClose={onClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>Edit Recipe</DialogTitle>
      
      <DialogContent>
        {loading && !recipe ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Grid container spacing={3}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Recipe Title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                margin="normal"
              />
            </Grid>
            
            <Grid item xs={12}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1 }}>
                <TextField
                  fullWidth
                  label="Image URL"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  margin="normal"
                  placeholder="https://example.com/image.jpg"
                  helperText="Enter URL or upload an image"
                  disabled={uploadingImage}
                />
                <input
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  ref={fileInputRef}
                  onChange={handleImageUpload}
                />
                <Button
                  variant="contained"
                  color="primary"
                  startIcon={uploadingImage ? <CircularProgress size={20} /> : <UploadIcon />}
                  onClick={() => fileInputRef.current.click()}
                  disabled={uploadingImage}
                  sx={{ mt: 2, height: '56px' }}
                >
                  {uploadingImage ? 'Uploading...' : 'Upload'}
                </Button>
              </Box>
              
              {imageUrl ? (
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
              ) : (
                <Box 
                  sx={{ 
                    mt: 2, 
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: '1px dashed #aaa',
                    borderRadius: '4px',
                    p: 3,
                    bgcolor: '#f9f9f9'
                  }}
                >
                  <ImageIcon sx={{ fontSize: 60, color: '#aaa', mb: 1 }} />
                  <Typography variant="body2" color="textSecondary">
                    No image selected. Enter a URL or upload an image.
                  </Typography>
                </Box>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Ingredients
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <List dense>
                  {ingredients.map((ingredient, index) => (
                    <ListItem key={index}>
                      {editingIngredientIndex === index ? (
                        // Editing mode
                        <Box sx={{ display: 'flex', width: '100%' }}>
                          <TextField
                            fullWidth
                            value={editingIngredientText}
                            onChange={(e) => setEditingIngredientText(e.target.value)}
                            onKeyPress={(e) => e.key === 'Enter' && handleSaveIngredientEdit()}
                            autoFocus
                          />
                          <IconButton onClick={handleSaveIngredientEdit} color="primary">
                            <CheckIcon />
                          </IconButton>
                          <IconButton onClick={handleCancelIngredientEdit}>
                            <CloseIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        // Display mode
                        <>
                          <ListItemText primary={ingredient} />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" onClick={() => handleEditIngredient(index)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton edge="end" onClick={() => handleRemoveIngredient(index)}>
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </>
                      )}
                    </ListItem>
                  ))}
                </List>
                
                <Box sx={{ display: 'flex', mt: 2 }}>
                  <TextField
                    fullWidth
                    label="New Ingredient"
                    value={newIngredient}
                    onChange={(e) => setNewIngredient(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddIngredient()}
                  />
                  <IconButton onClick={handleAddIngredient}>
                    <AddIcon />
                  </IconButton>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Instructions
              </Typography>
              <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
                <List dense>
                  {instructions.map((instruction, index) => (
                    <ListItem key={index}>
                      {editingInstructionIndex === index ? (
                        // Editing mode
                        <Box sx={{ display: 'flex', width: '100%' }}>
                          <TextField
                            fullWidth
                            multiline
                            rows={2}
                            value={editingInstructionText}
                            onChange={(e) => setEditingInstructionText(e.target.value)}
                            autoFocus
                          />
                          <IconButton onClick={handleSaveInstructionEdit} color="primary">
                            <CheckIcon />
                          </IconButton>
                          <IconButton onClick={handleCancelInstructionEdit}>
                            <CloseIcon />
                          </IconButton>
                        </Box>
                      ) : (
                        // Display mode
                        <>
                          <ListItemText 
                            primary={`${index + 1}. ${instruction}`} 
                            primaryTypographyProps={{ style: { whiteSpace: 'normal', wordBreak: 'break-word' } }}
                          />
                          <ListItemSecondaryAction>
                            <IconButton edge="end" onClick={() => handleEditInstruction(index)}>
                              <EditIcon />
                            </IconButton>
                            <IconButton edge="end" onClick={() => handleRemoveInstruction(index)}>
                              <DeleteIcon />
                            </IconButton>
                          </ListItemSecondaryAction>
                        </>
                      )}
                    </ListItem>
                  ))}
                </List>
                
                <Box sx={{ display: 'flex', mt: 2 }}>
                  <TextField
                    fullWidth
                    label="New Instruction"
                    value={newInstruction}
                    onChange={(e) => setNewInstruction(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && handleAddInstruction()}
                    multiline
                    rows={2}
                  />
                  <IconButton onClick={handleAddInstruction}>
                    <AddIcon />
                  </IconButton>
                </Box>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Typography variant="h6" gutterBottom>
                Macros (per serving)
              </Typography>
              <Paper variant="outlined" sx={{ p: 2 }}>
                <Grid container spacing={2}>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="Calories"
                      value={macros.calories}
                      onChange={(e) => setMacros({...macros, calories: e.target.value})}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="Protein (g)"
                      value={macros.protein}
                      onChange={(e) => setMacros({...macros, protein: e.target.value})}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="Carbs (g)"
                      value={macros.carbs}
                      onChange={(e) => setMacros({...macros, carbs: e.target.value})}
                      margin="normal"
                    />
                  </Grid>
                  <Grid item xs={6} sm={3}>
                    <TextField
                      fullWidth
                      label="Fat (g)"
                      value={macros.fat}
                      onChange={(e) => setMacros({...macros, fat: e.target.value})}
                      margin="normal"
                    />
                  </Grid>
                </Grid>
              </Paper>
            </Grid>
          </Grid>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button 
          onClick={handleSave} 
          color="primary" 
          variant="contained"
          disabled={loading}
        >
          {loading ? <CircularProgress size={24} /> : 'Save Changes'}
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

export default RecipeEditor;