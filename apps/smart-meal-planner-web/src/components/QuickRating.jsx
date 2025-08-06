import React, { useState } from 'react';
import {
  Box,
  Typography,
  Snackbar,
  Alert,
  Tooltip
} from '@mui/material';
import StarRating from './StarRating';
import apiService from '../services/apiService';

const QuickRating = ({
  savedRecipeId,
  currentRating = 0,
  onRatingUpdate,
  label = "Quick Rating",
  size = "small"
}) => {
  const [loading, setLoading] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [error, setError] = useState('');

  const handleRatingChange = async (newRating) => {
    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('token');
      const access_token = localStorage.getItem('access_token');
      
      if (!token && !access_token) {
        setError('Please log in to rate recipes');
        setSnackbarMessage('Please log in to rate recipes');
        setSnackbarOpen(true);
        return;
      }

      const response = await apiService.updateQuickRating(savedRecipeId, newRating);

      if (response && (response.success || response.status === 'success')) {
        setSnackbarMessage('Rating updated!');
        setSnackbarOpen(true);
        
        if (onRatingUpdate) {
          onRatingUpdate(newRating);
        }
      } else {
        setSnackbarMessage('Rating may have been updated');
        setSnackbarOpen(true);
        
        if (onRatingUpdate) {
          onRatingUpdate(newRating);
        }
      }
    } catch (err) {
      console.error('Error updating quick rating:', err);
      const errorMessage = err.response?.data?.detail || err.message || 'Failed to update rating';
      setError(errorMessage);
      setSnackbarMessage(`Error: ${errorMessage}`);
      setSnackbarOpen(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Box display="flex" alignItems="center" gap={1}>
        <Typography variant="body2" color="text.secondary">
          {label}:
        </Typography>
        <Tooltip title="Click to rate this saved recipe">
          <Box>
            <StarRating
              value={currentRating}
              onChange={loading ? null : handleRatingChange}
              size={size}
              showValue={currentRating > 0}
              readOnly={loading}
            />
          </Box>
        </Tooltip>
      </Box>

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

export default QuickRating;