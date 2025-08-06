// src/components/RecipeSaveDialog.jsx
import React, { useState } from 'react';
import { 
  Dialog, 
  DialogTitle, 
  DialogContent, 
  DialogActions, 
  Button, 
  TextField,
  IconButton,
  Snackbar,
  Alert
} from '@mui/material';
import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

const API_BASE_URL = 'https://www.smartmealplannerio.com';

const RecipeSaveDialog = ({ 
  menuId, 
  dayNumber, 
  mealTime, 
  recipeTitle, 
  isSaved = false,
  savedId = null,
  onSaveSuccess = () => {}
}) => {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbar, setSnackbar] = useState({
    open: false,
    message: '',
    severity: 'success'
  });

  // Generate unique recipe ID
  const generateRecipeId = () => {
    // Create a consistent hash that can be used as a unique identifier
    return Math.abs(hashCode(`${menuId}-${dayNumber}-${mealTime}`));
  };  

  function hashCode(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash;
  };

  const handleOpen = (e) => {
    e?.stopPropagation();
    if (!isSaved) {
      setOpen(true);
    } else {
      handleUnsave(e);
    }
  };

  const handleClose = () => {
    setOpen(false);
    setNotes('');
    setError('');
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      const saveData = {
        menu_id: menuId,
        recipe_id: generateRecipeId(),
        recipe_name: recipeTitle,
        day_number: dayNumber,
        meal_time: mealTime,
        notes: notes
      };
      
      console.log('Saving recipe:', saveData);
      
      // Use the working endpoint instead of the failing one
      const response = await fetch(`${API_BASE_URL}/saved-recipes-alt/scraped`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        },
        body: JSON.stringify(saveData)
      });

      // Handle response safely
      let data;
      const responseText = await response.text();
      
      try {
        data = responseText ? JSON.parse(responseText) : { status: 'success' };
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }
      
      if (!response.ok) {
        throw new Error(data.detail || `Error ${response.status}`);
      }

      setSnackbar({
        open: true,
        message: 'Recipe saved successfully!',
        severity: 'success'
      });
      
      handleClose();
      
      onSaveSuccess({
        isSaved: true,
        savedId: data.saved_id,
        menuId,
        recipeId: generateRecipeId(),
        mealTime,
        recipeTitle
      });
    } catch (err) {
      console.error('Save error:', err);
      setError(err.message);
      setSnackbar({
        open: true,
        message: `Error: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUnsave = async (e) => {
    e?.stopPropagation();
    
    try {
      setLoading(true);
      
      if (!savedId) {
        // Try to find the saved_id if not provided
        const checkResponse = await fetch(`${API_BASE_URL}/saved-recipes/check?menu_id=${menuId}&recipe_id=${generateRecipeId()}&meal_time=${mealTime}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        
        const checkData = await checkResponse.json();
        
        if (!checkData.is_saved) {
          // Recipe isn't actually saved
          onSaveSuccess({
            isSaved: false,
            menuId,
            recipeId: generateRecipeId(),
            mealTime
          });
          return;
        }
        
        savedId = checkData.saved_id;
      }
      
      const response = await fetch(`${API_BASE_URL}/saved-recipes/${savedId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Failed to remove saved recipe');
      }

      setSnackbar({
        open: true,
        message: 'Recipe removed from saved',
        severity: 'success'
      });
      
      onSaveSuccess({
        isSaved: false,
        menuId,
        recipeId: generateRecipeId(),
        mealTime
      });
    } catch (err) {
      console.error('Unsave error:', err);
      setSnackbar({
        open: true,
        message: `Error: ${err.message}`,
        severity: 'error'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSnackbarClose = () => {
    setSnackbar({ ...snackbar, open: false });
  };

  return (
    <>
      <IconButton 
        size="small" 
        onClick={handleOpen}
        disabled={loading}
      >
        {isSaved ? 
          <FavoriteIcon color="error" /> : 
          <FavoriteBorderIcon />}
      </IconButton>

      <Dialog 
        open={open} 
        onClose={handleClose}
        maxWidth="sm"
        fullWidth
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
          <Button onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleSave} 
            variant="contained"
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Recipe'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={handleSnackbarClose}
      >
        <Alert 
          onClose={handleSnackbarClose}
          severity={snackbar.severity}
        >
          {snackbar.message}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RecipeSaveDialog;