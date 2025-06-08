import React, { useState } from 'react';
import {
  IconButton,
  Button,
  Tooltip,
  Snackbar,
  Alert
} from '@mui/material';
import StarIcon from '@mui/icons-material/Star';
import StarBorderIcon from '@mui/icons-material/StarBorder';
import RecipeRatingModal from './RecipeRatingModal';

const RateRecipeButton = ({
  recipeId,
  recipeTitle,
  hasRating = false,
  currentRating = 0,
  onRatingUpdate,
  variant = 'icon', // 'icon' or 'button'
  size = 'medium',
  showText = false
}) => {
  const [modalOpen, setModalOpen] = useState(false);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  const handleOpenModal = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
  };

  const handleRatingSubmitted = (rating) => {
    setSnackbarMessage('Rating submitted successfully!');
    setSnackbarOpen(true);
    
    // Call parent callback
    if (onRatingUpdate) {
      onRatingUpdate({
        hasRating: true,
        rating: rating.rating_score,
        fullRating: rating
      });
    }
  };

  const buttonText = hasRating 
    ? `Update Rating (${currentRating.toFixed(1)})` 
    : 'Rate Recipe';

  const tooltipText = hasRating 
    ? `Current rating: ${currentRating.toFixed(1)} stars - Click to update` 
    : 'Rate this recipe';

  if (variant === 'button') {
    return (
      <>
        <Button
          variant={hasRating ? "contained" : "outlined"}
          startIcon={hasRating ? <StarIcon /> : <StarBorderIcon />}
          onClick={handleOpenModal}
          size={size}
          color={hasRating ? "primary" : "inherit"}
        >
          {showText ? buttonText : (hasRating ? 'Update' : 'Rate')}
        </Button>

        <RecipeRatingModal
          open={modalOpen}
          onClose={handleCloseModal}
          recipeId={recipeId}
          recipeTitle={recipeTitle}
          onRatingSubmitted={handleRatingSubmitted}
        />

        <Snackbar
          open={snackbarOpen}
          autoHideDuration={3000}
          onClose={() => setSnackbarOpen(false)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        >
          <Alert 
            onClose={() => setSnackbarOpen(false)} 
            severity="success"
          >
            {snackbarMessage}
          </Alert>
        </Snackbar>
      </>
    );
  }

  // Icon variant (default)
  return (
    <>
      <Tooltip title={tooltipText}>
        <IconButton
          onClick={handleOpenModal}
          color={hasRating ? "primary" : "default"}
          size={size}
        >
          {hasRating ? <StarIcon /> : <StarBorderIcon />}
        </IconButton>
      </Tooltip>

      <RecipeRatingModal
        open={modalOpen}
        onClose={handleCloseModal}
        recipeId={recipeId}
        recipeTitle={recipeTitle}
        onRatingSubmitted={handleRatingSubmitted}
      />

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity="success"
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
    </>
  );
};

export default RateRecipeButton;