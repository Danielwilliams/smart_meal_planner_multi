import React, { useState } from 'react';
import { 
  IconButton, 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions,
  TextField,
  Button,
  Alert,
  Snackbar
} from '@mui/material';
import BookmarkIcon from '@mui/icons-material/Bookmark';
import BookmarkBorderIcon from '@mui/icons-material/BookmarkBorder';
import axios from 'axios';
import apiService from '../services/apiService';

const RecipeSaveButton = ({ 
  scraped = false,
  scrapedRecipeId = null,
  menuId = null, 
  dayNumber = null, 
  mealTime = null, 
  recipeTitle, 
  isSaved = false, 
  savedId = null, 
  onSaveSuccess,
  onSaveError,
  recipeData = null
}) => {
  
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Generate a unique recipe ID using menu ID, day number, meal time if not provided
  const generateRecipeId = () => {
    if (scraped && scrapedRecipeId) {
      return `scraped-${scrapedRecipeId}`;
    }
    return `${menuId}-${dayNumber}-${mealTime}`;
  };

  const handleOpenDialog = (e) => {
    e.preventDefault(); // Prevent default link behavior
    e.stopPropagation(); // Prevent event bubbling
    
    if (!isSaved) {
      setOpen(true);
    } else {
      handleUnsave(e);
    }
  };

  const handleCloseDialog = () => {
    setOpen(false);
    setNotes('');
    setError('');
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Log important debugging details
      console.log('RecipeSaveButton - Save details:', { 
        scraped, 
        scrapedRecipeId,
        menuId,
        dayNumber,
        mealTime,
        recipeTitle
      });
      
      let saveData = {
        notes: notes
      };
      
      // If saving a scraped recipe
      if (scraped) {
        saveData = {
          ...saveData,
          scraped_recipe_id: scrapedRecipeId,
          recipe_name: recipeTitle,
          recipe_source: 'scraped'
        };
        
        // Add recipe data if provided
        if (recipeData) {
          saveData = {
            ...saveData,
            ingredients: recipeData.ingredients,
            instructions: recipeData.instructions,
            macros: recipeData.macros,
            complexity_level: recipeData.complexity_level,
            servings: recipeData.servings
          };
        }
      } else {
        // If saving a menu recipe
        saveData = {
          ...saveData,
          menu_id: menuId,
          recipe_id: generateRecipeId(),
          recipe_name: recipeTitle,
          day_number: dayNumber,
          meal_time: mealTime
        };
      }

      console.log('Saving recipe with data:', JSON.stringify(saveData, null, 2));

      // Use apiService which handles authentication and correct base URL
      const response = await apiService.saveRecipe(saveData, scraped);
      
      // Log the API response
      console.log('API Response:', response.data);
      
      // Extract saved_id from response
      const data = response.data;
      const savedId = data.saved_id;
      
      // Show success message
      setSnackbarMessage('Recipe saved successfully!');
      setSnackbarOpen(true);
      
      // Close dialog
      handleCloseDialog();
      
      // Call the success callback to update parent component state
      if (onSaveSuccess) {
        onSaveSuccess({
          isSaved: true, 
          savedId: savedId,
          menuId,
          recipeId: generateRecipeId(),
          mealTime
        });
      }
    } catch (err) {
      console.error('Save error:', err);
      console.error('Save error response:', err.response?.data);
      console.error('Save error details:', {
        status: err.response?.status,
        statusText: err.response?.statusText,
        detail: err.response?.data?.detail
      });
      setError(err.response?.data?.detail || err.message);
      
      // Call error callback if provided
      if (onSaveError) {
        onSaveError(err);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (e) => {
    e.preventDefault(); // Prevent default link behavior
    e.stopPropagation(); // Prevent event bubbling
    
    try {
      setLoading(true);
      
      // We must have a saved ID to unsave
      if (!savedId) {
        throw new Error('No saved ID provided');
      }
      
      await apiService.deleteRecipe(savedId);

      // Show success message
      setSnackbarMessage('Recipe removed from saved');
      setSnackbarOpen(true);
      
      // Call the success callback to update parent component state
      if (onSaveSuccess) {
        onSaveSuccess({
          isSaved: false,
          savedId: null
        });
      }
    } catch (err) {
      setError(err.response?.data?.detail || err.message);
      setSnackbarMessage(`Error: ${err.response?.data?.detail || err.message}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <IconButton
        color="primary"
        onClick={handleOpenDialog}
        disabled={loading}
        title={isSaved ? "Remove from saved recipes" : "Save recipe"}
      >
        {isSaved ? (
          <BookmarkIcon />
        ) : (
          <BookmarkBorderIcon />
        )}
      </IconButton>

      {/* Save Dialog */}
      <Dialog 
        open={open} 
        onClose={handleCloseDialog}
      >
        <DialogTitle>Save Recipe</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Notes (optional)"
            fullWidth
            multiline
            rows={4}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any notes about this recipe..."
          />
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave}
            variant="contained" 
            color="primary"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Recipe'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={error ? "error" : "success"}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RecipeSaveButton;