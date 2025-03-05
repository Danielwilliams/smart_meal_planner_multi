import React, { useState } from 'react';

const API_BASE_URL = 'https://www.smartmealplannerio.com';

// Create simple styled components
const IconButton = ({ children, onClick, disabled, size = 'medium' }) => {
  return (
    <button 
      onClick={onClick} 
      disabled={disabled}
      className={`rounded-full p-1 ${size === 'small' ? 'text-sm' : ''} 
                  hover:bg-gray-100 focus:outline-none transition-colors`}
      style={{ cursor: disabled ? 'not-allowed' : 'pointer' }}
    >
      {children}
    </button>
  );
};

const Dialog = ({ open, onClose, title, children, actions }) => {
  if (!open) return null;
  
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
        <div className="p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">{title}</h3>
        </div>
        <div className="p-4">
          {children}
        </div>
        <div className="p-4 border-t border-gray-200 flex justify-end space-x-2">
          {actions}
        </div>
      </div>
    </div>
  );
};

const TextField = ({ label, value, onChange, multiline, rows, placeholder }) => {
  return (
    <div className="mb-4">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      {multiline ? (
        <textarea
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={onChange}
          rows={rows || 4}
          placeholder={placeholder}
        />
      ) : (
        <input
          type="text"
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          value={value}
          onChange={onChange}
          placeholder={placeholder}
        />
      )}
    </div>
  );
};

const Button = ({ onClick, disabled, color = 'primary', children }) => {
  const colorClasses = {
    primary: 'bg-blue-500 hover:bg-blue-600 text-white',
    secondary: 'bg-gray-200 hover:bg-gray-300 text-gray-800'
  };
  
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`px-4 py-2 rounded-md ${colorClasses[color]} 
                 ${disabled ? 'opacity-50 cursor-not-allowed' : ''} 
                 transition-colors`}
    >
      {children}
    </button>
  );
};

const Alert = ({ severity, children }) => {
  const severityClasses = {
    error: 'bg-red-100 text-red-800 border-red-200',
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    info: 'bg-blue-100 text-blue-800 border-blue-200'
  };
  
  return (
    <div className={`p-3 rounded-md border ${severityClasses[severity]} mt-2`}>
      {children}
    </div>
  );
};

const Snackbar = ({ open, onClose, autoHideDuration, children }) => {
  React.useEffect(() => {
    if (open && autoHideDuration) {
      const timer = setTimeout(() => {
        onClose();
      }, autoHideDuration);
      return () => clearTimeout(timer);
    }
  }, [open, autoHideDuration, onClose]);
  
  if (!open) return null;
  
  return (
    <div className="fixed bottom-4 left-1/2 transform -translate-x-1/2 z-50">
      {children}
    </div>
  );
};

// Heart icons
const FavoriteIcon = ({ color }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 ${color === 'error' ? 'text-red-500' : 'text-gray-500'}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
  </svg>
);

const FavoriteBorderIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
  </svg>
);

const RecipeSaveButton = ({ 
  menuId, 
  dayNumber, 
  mealTime, 
  recipeTitle, 
  isSaved, 
  savedId, 
  onSaveSuccess 
}) => {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Generate a unique recipe ID using menu ID, day number, meal time if not provided
  const generateRecipeId = () => {
    return `${menuId}-${dayNumber}-${mealTime}`;
  };

  const handleOpenDialog = (e) => {
    e.stopPropagation(); // Prevent accordion from toggling
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
    const saveData = {
      menu_id: menuId,
      recipe_id: generateRecipeId(),
      recipe_name: recipeTitle,
      day_number: dayNumber,
      meal_time: mealTime,
      notes: notes
    };

    console.log('Save Request Details:', {
      fullUrl: `${API_BASE_URL}/saved-recipes/`,
      payload: saveData,
      tokenPresence: !!localStorage.getItem('access_token')
    });

    const response = await fetch(`${API_BASE_URL}/saved-recipes/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('access_token')}`
      },
      body: JSON.stringify(saveData)
    });

    console.log('Full Response:', {
      status: response.status,
      headers: Object.fromEntries(response.headers.entries())
    });


    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    // Safely parse the response - handle empty responses
    let data;
    const responseText = await response.text();
    
    if (responseText) {
      try {
        data = JSON.parse(responseText);
      } catch (parseError) {
        console.error('Failed to parse response:', responseText);
        throw new Error('Invalid response from server');
      }
    } else {
      console.warn('Empty response from server');
      data = { status: 'success', saved_id: null };
    }
    
    // Show success message
    setSnackbarMessage('Recipe saved successfully!');
    setSnackbarOpen(true);
    
    // Close dialog
    handleCloseDialog();
    
    // Call the success callback to update parent component state
    if (onSaveSuccess) {
      onSaveSuccess({
        isSaved: true, 
        savedId: data.saved_id,
        menuId,
        recipeId: generateRecipeId(),
        mealTime
      });
    }
  } catch (err) {
    console.error('Save error:', err);
    setError(err.message);
  } finally {
    setLoading(false);
  }
};

  const handleUnsave = async (e) => {
    e.stopPropagation(); // Prevent accordion from toggling
    
    try {
      setLoading(true);
      
      // If we have a saved ID, use it
      let url;
      if (savedId) {
        url = `${API_BASE_URL}/saved-recipes/${savedId}`;
      } else {
        // Otherwise query by generated recipe ID and meal time
        const checkResponse = await fetch(`/saved-recipes/check?menu_id=${menuId}&recipe_id=${generateRecipeId()}&meal_time=${mealTime}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('access_token')}`
          }
        });
        
        if (!checkResponse.ok) {
          throw new Error('Failed to find saved recipe');
        }
        
        const checkData = await checkResponse.json();
        if (!checkData.saved_id) {
          throw new Error('Could not determine which saved recipe to remove');
        }
        
        url = `${API_BASE_URL}/saved-recipes/${checkData.saved_id}`;
      }
      
      const deleteResponse = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('access_token')}`
        }
      });

      if (!deleteResponse.ok) {
        const data = await deleteResponse.json();
        throw new Error(data.detail || 'Failed to unsave recipe');
      }

      // Show success message
      setSnackbarMessage('Recipe removed from saved');
      setSnackbarOpen(true);
      
      // Call the success callback to update parent component state
      if (onSaveSuccess) {
        onSaveSuccess({
          isSaved: false,
          menuId,
          recipeId: generateRecipeId(),
          mealTime
        });
      }
    } catch (err) {
      setError(err.message);
      setSnackbarMessage(`Error: ${err.message}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-block">
      <div title={isSaved ? "Remove from favorites" : "Save to favorites"}>
        <IconButton
          size="small"
          onClick={handleOpenDialog}
          disabled={loading}
        >
          {isSaved ? (
            <FavoriteIcon color="error" />
          ) : (
            <FavoriteBorderIcon />
          )}
        </IconButton>
      </div>

      {/* Save Dialog */}
      <Dialog 
        open={open} 
        onClose={handleCloseDialog}
        title="Save Recipe"
        actions={
          <>
            <Button onClick={handleCloseDialog} color="secondary">
              Cancel
            </Button>
            <Button 
              onClick={handleSave}
              disabled={loading}
            >
              {loading ? 'Saving...' : 'Save Recipe'}
            </Button>
          </>
        }
      >
        <TextField
          label="Notes (optional)"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          multiline
          rows={4}
          placeholder="Add any notes about this recipe..."
        />
        {error && (
          <Alert severity="error">
            {error}
          </Alert>
        )}
      </Dialog>

      {/* Snackbar for notifications */}
      <Snackbar
        open={snackbarOpen}
        onClose={() => setSnackbarOpen(false)}
        autoHideDuration={3000}
      >
        <Alert severity={error ? "error" : "success"}>
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </div>
  );
};

export default RecipeSaveButton;