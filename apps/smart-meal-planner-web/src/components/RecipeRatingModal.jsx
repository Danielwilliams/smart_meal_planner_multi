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
  FormControlLabel,
  Checkbox,
  Slider,
  Divider,
  Alert,
  Grid,
  Paper
} from '@mui/material';
import StarRating from './StarRating';
import apiService from '../services/apiService';

const RecipeRatingModal = ({
  open,
  onClose,
  recipeId,
  recipeTitle,
  onRatingSubmitted
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingRating, setExistingRating] = useState(null);
  
  // Main rating state
  const [rating, setRating] = useState({
    rating_score: 0,
    rating_aspects: {
      taste: 0,
      ease_of_preparation: 0,
      ingredient_availability: 0,
      portion_size: 0,
      nutrition_balance: 0,
      presentation: 0
    },
    feedback_text: '',
    made_recipe: false,
    would_make_again: null,
    difficulty_rating: 0,
    time_accuracy: 0
  });

  // Load existing rating when modal opens
  useEffect(() => {
    if (open && recipeId) {
      loadExistingRating();
    }
  }, [open, recipeId]);

  const loadExistingRating = async () => {
    try {
      const token = localStorage.getItem('access_token');
      if (!token) return;

      const response = await apiService.get(`/ratings/recipes/${recipeId}/my-rating`);
      
      // Backend returns {"rating": {...}} if rating exists, or {"message": "No rating found"} if not
      if (response.data.rating) {
        const existingData = response.data.rating;
        setExistingRating(existingData);
        
        // Populate form with existing data
        setRating({
          rating_score: existingData.rating_score || 0,
          rating_aspects: existingData.rating_aspects || {
            taste: 0,
            ease_of_preparation: 0,
            ingredient_availability: 0,
            portion_size: 0,
            nutrition_balance: 0,
            presentation: 0
          },
          feedback_text: existingData.feedback_text || '',
          made_recipe: existingData.made_recipe || false,
          would_make_again: existingData.would_make_again,
          difficulty_rating: existingData.difficulty_rating || 0,
          time_accuracy: existingData.time_accuracy || 0
        });
      }
    } catch (err) {
      console.error('Error loading existing rating:', err);
    }
  };

  const handleSubmit = async () => {
    if (rating.rating_score === 0) {
      setError('Please provide an overall rating');
      return;
    }

    try {
      setLoading(true);
      setError('');

      const token = localStorage.getItem('access_token');
      if (!token) {
        setError('Please log in to submit a rating');
        return;
      }

      // Clean up the rating data
      const submitData = {
        rating_score: rating.rating_score,
        feedback_text: rating.feedback_text || null,
        made_recipe: rating.made_recipe || false,
        would_make_again: rating.would_make_again,
        difficulty_rating: rating.difficulty_rating > 0 ? rating.difficulty_rating : null,
        time_accuracy: rating.time_accuracy > 0 ? rating.time_accuracy : null
      };
      
      // Only include rating_aspects if at least one aspect has a value
      const hasAspects = Object.keys(rating.rating_aspects).some(key => 
        rating.rating_aspects[key] > 0
      );
      
      if (hasAspects) {
        // Filter out aspects with 0 values
        const filteredAspects = {};
        Object.keys(rating.rating_aspects).forEach(key => {
          if (rating.rating_aspects[key] > 0) {
            filteredAspects[key] = rating.rating_aspects[key];
          }
        });
        submitData.rating_aspects = filteredAspects;
      }

      console.log('Submitting rating data:', submitData);
      const response = await apiService.post(`/ratings/recipes/${recipeId}/rate`, submitData);
      console.log('Rating submission response:', response);

      // Check if response.data exists and has success property
      const responseData = response?.data || response;
      
      if (responseData && responseData.success) {
        // Show success for 2 seconds before closing
        setError('');
        setLoading(false);
        
        // Show success message
        const successMessage = responseData.message || 'Rating saved successfully!';
        setError(successMessage); // Temporarily use error state for success
        
        // Notify parent component
        onRatingSubmitted?.(rating);
        
        // Close modal after short delay to show success
        setTimeout(() => {
          onClose();
          
          // Reset form after closing
          setRating({
            rating_score: 0,
            rating_aspects: {
              taste: 0,
              ease_of_preparation: 0,
              ingredient_availability: 0,
              portion_size: 0,
              nutrition_balance: 0,
              presentation: 0
            },
            feedback_text: '',
            made_recipe: false,
            would_make_again: null,
            difficulty_rating: 0,
            time_accuracy: 0
          });
          setError('');
        }, 1500);
      } else {
        setError('Failed to save rating. Please try again.');
      }
    } catch (err) {
      console.error('Error submitting rating:', err);
      console.error('Error response data:', err.response?.data);
      
      // Handle validation errors from FastAPI
      let errorMessage = 'Failed to submit rating';
      if (err.response?.data?.detail) {
        // Check if detail is an array of validation errors
        if (Array.isArray(err.response.data.detail)) {
          errorMessage = err.response.data.detail.map(e => e.msg || e.message).join(', ');
        } else if (typeof err.response.data.detail === 'string') {
          errorMessage = err.response.data.detail;
        } else if (typeof err.response.data.detail === 'object') {
          // If it's an object, try to extract a message
          errorMessage = err.response.data.detail.msg || err.response.data.detail.message || JSON.stringify(err.response.data.detail);
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  const updateRatingAspect = (aspect, value) => {
    setRating(prev => ({
      ...prev,
      rating_aspects: {
        ...prev.rating_aspects,
        [aspect]: value
      }
    }));
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
    >
      <DialogTitle>
        Rate Recipe: {recipeTitle}
        {existingRating && (
          <Typography variant="body2" color="text.secondary">
            Updating your existing rating
          </Typography>
        )}
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ py: 2 }}>
          {/* Overall Rating */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Overall Rating *
            </Typography>
            <StarRating
              value={rating.rating_score}
              onChange={(value) => setRating(prev => ({ ...prev, rating_score: value }))}
              size="large"
              showValue
            />
          </Box>

          {/* Made Recipe Checkbox */}
          <Box sx={{ mb: 3 }}>
            <FormControlLabel
              control={
                <Checkbox
                  checked={rating.made_recipe}
                  onChange={(e) => setRating(prev => ({ 
                    ...prev, 
                    made_recipe: e.target.checked,
                    would_make_again: e.target.checked ? prev.would_make_again : null
                  }))}
                />
              }
              label="I have made this recipe"
            />
          </Box>

          {/* Would Make Again */}
          {rating.made_recipe && (
            <Box sx={{ mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                Would you make this recipe again?
              </Typography>
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Button
                  variant={rating.would_make_again === true ? "contained" : "outlined"}
                  onClick={() => setRating(prev => ({ ...prev, would_make_again: true }))}
                  color="success"
                  size="small"
                >
                  Yes
                </Button>
                <Button
                  variant={rating.would_make_again === false ? "contained" : "outlined"}
                  onClick={() => setRating(prev => ({ ...prev, would_make_again: false }))}
                  color="error"
                  size="small"
                >
                  No
                </Button>
              </Box>
            </Box>
          )}

          <Divider sx={{ my: 3 }} />

          {/* Detailed Aspect Ratings */}
          <Typography variant="h6" gutterBottom>
            Detailed Ratings (Optional)
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <StarRating
                label="Taste"
                value={rating.rating_aspects.taste}
                onChange={(value) => updateRatingAspect('taste', value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StarRating
                label="Ease of Preparation"
                value={rating.rating_aspects.ease_of_preparation}
                onChange={(value) => updateRatingAspect('ease_of_preparation', value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StarRating
                label="Ingredient Availability"
                value={rating.rating_aspects.ingredient_availability}
                onChange={(value) => updateRatingAspect('ingredient_availability', value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StarRating
                label="Portion Size"
                value={rating.rating_aspects.portion_size}
                onChange={(value) => updateRatingAspect('portion_size', value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StarRating
                label="Nutrition Balance"
                value={rating.rating_aspects.nutrition_balance}
                onChange={(value) => updateRatingAspect('nutrition_balance', value)}
                size="small"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <StarRating
                label="Presentation"
                value={rating.rating_aspects.presentation}
                onChange={(value) => updateRatingAspect('presentation', value)}
                size="small"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Difficulty and Time Accuracy */}
          <Grid container spacing={3}>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Difficulty Level (1 = Very Easy, 5 = Very Hard)
              </Typography>
              <Slider
                value={rating.difficulty_rating}
                onChange={(e, value) => setRating(prev => ({ ...prev, difficulty_rating: value }))}
                min={0}
                max={5}
                step={1}
                marks={[
                  { value: 0, label: 'Not Rated' },
                  { value: 1, label: 'Very Easy' },
                  { value: 3, label: 'Moderate' },
                  { value: 5, label: 'Very Hard' }
                ]}
                valueLabelDisplay="auto"
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <Typography gutterBottom>
                Time Accuracy (1 = Much Longer, 5 = Spot On)
              </Typography>
              <Slider
                value={rating.time_accuracy}
                onChange={(e, value) => setRating(prev => ({ ...prev, time_accuracy: value }))}
                min={0}
                max={5}
                step={1}
                marks={[
                  { value: 0, label: 'Not Rated' },
                  { value: 1, label: 'Much Longer' },
                  { value: 3, label: 'Close' },
                  { value: 5, label: 'Spot On' }
                ]}
                valueLabelDisplay="auto"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Feedback Text */}
          <TextField
            label="Additional Comments (Optional)"
            fullWidth
            multiline
            rows={4}
            value={rating.feedback_text}
            onChange={(e) => setRating(prev => ({ ...prev, feedback_text: e.target.value }))}
            placeholder="Share your experience with this recipe..."
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert 
              severity={error.includes('successfully') ? "success" : "error"} 
              sx={{ mt: 2 }}
            >
              {error}
            </Alert>
          )}
        </Box>
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={loading || rating.rating_score === 0}
        >
          {loading ? 'Submitting...' : existingRating ? 'Update Rating' : 'Submit Rating'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default RecipeRatingModal;