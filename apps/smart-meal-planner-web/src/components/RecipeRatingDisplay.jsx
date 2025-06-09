import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Paper,
  Chip,
  Divider,
  CircularProgress,
  Alert,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemAvatar,
  ListItemText,
  Avatar
} from '@mui/material';
import PersonIcon from '@mui/icons-material/Person';
import StarRating from './StarRating';
import apiService from '../services/apiService';

const RecipeRatingDisplay = ({ recipeId, compact = false }) => {
  const [ratings, setRatings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (recipeId) {
      loadRatings();
    }
  }, [recipeId]);

  const loadRatings = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`Loading ratings for recipe ID: ${recipeId}`);
      const response = await apiService.get(`/ratings/recipes/${recipeId}/ratings`);
      console.log('Ratings response:', response.data);
      setRatings(response.data);
    } catch (err) {
      console.error('Error loading ratings:', err);
      console.error('Error details:', err.response?.data);
      setError('Failed to load ratings');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error) {
    return (
      <Alert severity="error" sx={{ my: 1 }}>
        {error}
      </Alert>
    );
  }

  if (!ratings || ratings.total_ratings === 0) {
    return (
      <Box sx={{ py: 2, textAlign: 'center' }}>
        <Typography variant="body2" color="text.secondary">
          No ratings yet. Be the first to rate this recipe!
        </Typography>
      </Box>
    );
  }

  const { summary, recent_reviews } = ratings;

  if (compact) {
    return (
      <Box display="flex" alignItems="center" gap={1}>
        <StarRating
          value={summary.average_rating}
          readOnly
          showValue
          showCount
          count={summary.total_ratings}
          size="small"
        />
        {summary.times_made > 0 && (
          <Chip
            label={`${summary.times_made} made`}
            size="small"
            variant="outlined"
            color="success"
          />
        )}
      </Box>
    );
  }

  return (
    <Paper sx={{ p: 3, my: 2 }}>
      <Typography variant="h6" gutterBottom>
        Recipe Ratings
      </Typography>

      {/* Rating Summary */}
      <Box sx={{ mb: 3 }}>
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Box display="flex" alignItems="center" gap={2} mb={2}>
              <StarRating
                value={summary.average_rating}
                readOnly
                size="large"
                showValue
              />
              <Box>
                <Typography variant="h6">
                  {summary.average_rating?.toFixed(1)}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  Based on {summary.total_ratings} rating{summary.total_ratings !== 1 ? 's' : ''}
                </Typography>
              </Box>
            </Box>

            {/* Quick Stats */}
            <Box display="flex" gap={1} flexWrap="wrap">
              {summary.times_made > 0 && (
                <Chip
                  label={`${summary.times_made} made this`}
                  color="success"
                  variant="outlined"
                  size="small"
                />
              )}
              {summary.remake_percentage > 0 && (
                <Chip
                  label={`${summary.remake_percentage}% would make again`}
                  color="primary"
                  variant="outlined"
                  size="small"
                />
              )}
            </Box>
          </Grid>

          <Grid item xs={12} md={6}>
            {/* Rating Breakdown */}
            {summary.avg_difficulty && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Average Difficulty: {summary.avg_difficulty?.toFixed(1)}/5
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(summary.avg_difficulty / 5) * 100}
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
            
            {summary.avg_time_accuracy && (
              <Box sx={{ mb: 2 }}>
                <Typography variant="body2" gutterBottom>
                  Time Accuracy: {summary.avg_time_accuracy?.toFixed(1)}/5
                </Typography>
                <LinearProgress
                  variant="determinate"
                  value={(summary.avg_time_accuracy / 5) * 100}
                  color="secondary"
                  sx={{ height: 8, borderRadius: 4 }}
                />
              </Box>
            )}
          </Grid>
        </Grid>
      </Box>

      {/* Recent Reviews */}
      {recent_reviews && recent_reviews.length > 0 && (
        <>
          <Divider sx={{ my: 2 }} />
          <Typography variant="h6" gutterBottom>
            Recent Reviews
          </Typography>
          
          <List>
            {recent_reviews.slice(0, 3).map((review, index) => (
              <ListItem key={index} alignItems="flex-start">
                <ListItemAvatar>
                  <Avatar>
                    <PersonIcon />
                  </Avatar>
                </ListItemAvatar>
                <ListItemText
                  primary={
                    <Box display="flex" alignItems="center" gap={1} mb={1}>
                      <StarRating
                        value={review.rating_score}
                        readOnly
                        size="small"
                        showValue
                      />
                      <Typography variant="body2" color="text.secondary">
                        by {review.user_name || 'Anonymous'}
                      </Typography>
                      {review.made_recipe && (
                        <Chip
                          label="Made it"
                          size="small"
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                  secondary={
                    <Box>
                      {review.feedback_text && (
                        <Typography variant="body2" sx={{ mb: 1 }}>
                          "{review.feedback_text}"
                        </Typography>
                      )}
                      <Typography variant="caption" color="text.secondary">
                        {new Date(review.updated_at).toLocaleDateString()}
                      </Typography>
                    </Box>
                  }
                />
              </ListItem>
            ))}
          </List>
          
          {recent_reviews.length > 3 && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              + {recent_reviews.length - 3} more review{recent_reviews.length - 3 !== 1 ? 's' : ''}
            </Typography>
          )}
        </>
      )}
    </Paper>
  );
};

export default RecipeRatingDisplay;