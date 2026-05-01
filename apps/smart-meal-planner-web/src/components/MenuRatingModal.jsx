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
  Divider,
  Alert,
  Grid
} from '@mui/material';
import StarRating from './StarRating';
import apiService from '../services/apiService';

const MenuRatingModal = ({
  open,
  onClose,
  menuId,
  menuTitle,
  onRatingSubmitted
}) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [existingRating, setExistingRating] = useState(null);
  
  const [rating, setRating] = useState({
    rating_score: 0,
    rating_aspects: {
      variety: 0,
      practicality: 0,
      family_approval: 0
    },
    feedback_text: '',
    variety_rating: 0,
    practicality_rating: 0,
    family_approval_rating: 0,
    would_use_again: null
  });

  useEffect(() => {
    if (open && menuId) {
      loadExistingRating();
    }
  }, [open, menuId]);

  const loadExistingRating = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await apiService.get(`/ratings/menus/${menuId}/ratings`);
      
      // Note: Menu ratings endpoint might need adjustment for user-specific ratings
      // This is a placeholder for when we add user-specific menu rating retrieval
      
    } catch (err) {
      console.error('Error loading existing menu rating:', err);
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

      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to submit a rating');
        return;
      }

      const submitData = {
        ...rating,
        rating_aspects: {
          variety: rating.variety_rating,
          practicality: rating.practicality_rating,
          family_approval: rating.family_approval_rating
        },
        variety_rating: rating.variety_rating > 0 ? rating.variety_rating : null,
        practicality_rating: rating.practicality_rating > 0 ? rating.practicality_rating : null,
        family_approval_rating: rating.family_approval_rating > 0 ? rating.family_approval_rating : null
      };

      const response = await apiService.post(`/ratings/menus/${menuId}/rate`, submitData);

      if (response.data.success) {
        onRatingSubmitted?.(rating);
        onClose();
        
        // Reset form
        setRating({
          rating_score: 0,
          rating_aspects: {
            variety: 0,
            practicality: 0,
            family_approval: 0
          },
          feedback_text: '',
          variety_rating: 0,
          practicality_rating: 0,
          family_approval_rating: 0,
          would_use_again: null
        });
      }
    } catch (err) {
      console.error('Error submitting menu rating:', err);
      setError(err.response?.data?.detail || 'Failed to submit rating');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    onClose();
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle>
        Rate Menu: {menuTitle}
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

          <Divider sx={{ my: 3 }} />

          {/* Aspect Ratings */}
          <Typography variant="h6" gutterBottom>
            Detailed Ratings
          </Typography>
          
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <StarRating
                label="Variety of Meals"
                value={rating.variety_rating}
                onChange={(value) => setRating(prev => ({ ...prev, variety_rating: value }))}
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <StarRating
                label="Practicality & Ease"
                value={rating.practicality_rating}
                onChange={(value) => setRating(prev => ({ ...prev, practicality_rating: value }))}
                size="medium"
              />
            </Grid>
            <Grid item xs={12}>
              <StarRating
                label="Family Approval"
                value={rating.family_approval_rating}
                onChange={(value) => setRating(prev => ({ ...prev, family_approval_rating: value }))}
                size="medium"
              />
            </Grid>
          </Grid>

          <Divider sx={{ my: 3 }} />

          {/* Would Use Again */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="body1" gutterBottom>
              Would you use this menu plan again?
            </Typography>
            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant={rating.would_use_again === true ? "contained" : "outlined"}
                onClick={() => setRating(prev => ({ ...prev, would_use_again: true }))}
                color="success"
                size="small"
              >
                Yes
              </Button>
              <Button
                variant={rating.would_use_again === false ? "contained" : "outlined"}
                onClick={() => setRating(prev => ({ ...prev, would_use_again: false }))}
                color="error"
                size="small"
              >
                No
              </Button>
            </Box>
          </Box>

          {/* Feedback Text */}
          <TextField
            label="Additional Comments (Optional)"
            fullWidth
            multiline
            rows={4}
            value={rating.feedback_text}
            onChange={(e) => setRating(prev => ({ ...prev, feedback_text: e.target.value }))}
            placeholder="Share your thoughts about this menu plan..."
            sx={{ mb: 2 }}
          />

          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
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
          {loading ? 'Submitting...' : 'Submit Rating'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default MenuRatingModal;