import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  Grid,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Alert,
  Button
} from '@mui/material';
import {
  Star as StarIcon,
  AccessTime as TimeIcon,
  Restaurant as RestaurantIcon,
  TrendingUp as TrendingIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

const RatingBasedRecommendations = ({ maxItems = 6, showTitle = true }) => {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.user_id) {
      loadRecommendations();
    } else {
      setLoading(false);
    }
  }, [user]);

  const loadRecommendations = async () => {
    try {
      setLoading(true);
      setError('');

      // Try to get personalized recommendations first
      try {
        const response = await apiService.get(`/ratings/recipes/recommended?limit=${maxItems}`);
        if (response.data.recommendations && response.data.recommendations.length > 0) {
          setRecommendations(response.data.recommendations);
          return;
        }
      } catch (err) {
        console.log('Personalized recommendations not available');
      }

      // Fallback to top community recipes
      try {
        const fallbackResponse = await apiService.get(`/analytics/trends/recipe-performance?limit=${maxItems}`);
        if (fallbackResponse.data.top_recipes) {
          // Transform top recipes to recommendation format
          const fallbackRecs = fallbackResponse.data.top_recipes.map(recipe => ({
            recipe_id: recipe.recipe_id,
            title: recipe.title,
            average_rating: recipe.average_rating,
            rating_count: recipe.rating_count,
            cuisine: recipe.cuisine,
            complexity: recipe.complexity,
            total_time: recipe.total_time,
            times_made: recipe.times_made,
            recommendation_type: 'community_favorite'
          }));
          setRecommendations(fallbackRecs);
        }
      } catch (err) {
        console.log('Fallback recommendations not available');
        setError('Recommendations not available');
      }

    } catch (err) {
      console.error('Error loading recommendations:', err);
      setError('Failed to load recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleRecipeClick = (recipeId) => {
    navigate(`/recipe/${recipeId}`);
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
      <Alert severity="info" sx={{ my: 1 }}>
        {error}
      </Alert>
    );
  }

  if (recommendations.length === 0) {
    return (
      <Box sx={{ textAlign: 'center', py: 3 }}>
        <RestaurantIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body2" color="text.secondary">
          Start rating recipes to get personalized recommendations!
        </Typography>
        <Button 
          variant="outlined" 
          sx={{ mt: 2 }}
          onClick={() => navigate('/recipes')}
        >
          Browse Recipes
        </Button>
      </Box>
    );
  }

  return (
    <Box>
      {showTitle && (
        <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <TrendingIcon color="primary" />
          {recommendations[0]?.recommendation_type === 'community_favorite' 
            ? 'Community Favorites' 
            : 'Recommended for You'}
        </Typography>
      )}
      
      <Grid container spacing={2}>
        {recommendations.slice(0, maxItems).map((recipe) => (
          <Grid item xs={12} sm={6} md={4} key={recipe.recipe_id}>
            <Card 
              sx={{ 
                cursor: 'pointer',
                transition: 'all 0.2s ease-in-out',
                '&:hover': { 
                  transform: 'translateY(-2px)',
                  boxShadow: 3
                }
              }}
              onClick={() => handleRecipeClick(recipe.recipe_id)}
            >
              <CardContent sx={{ pb: 2 }}>
                <Typography variant="subtitle2" gutterBottom noWrap>
                  {recipe.title || `Recipe #${recipe.recipe_id}`}
                </Typography>
                
                {/* Rating Display */}
                <Box display="flex" alignItems="center" gap={1} mb={1}>
                  <StarIcon sx={{ color: 'orange', fontSize: 16 }} />
                  <Typography variant="body2">
                    {recipe.average_rating ? recipe.average_rating.toFixed(1) : recipe.avg_rating?.toFixed(1)}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    ({recipe.rating_count} ratings)
                  </Typography>
                </Box>

                {/* Cuisine and Time */}
                <Box display="flex" gap={1} flexWrap="wrap" mb={1}>
                  {recipe.cuisine && (
                    <Chip 
                      label={recipe.cuisine} 
                      size="small" 
                      variant="outlined"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                  {recipe.complexity && (
                    <Chip 
                      label={recipe.complexity} 
                      size="small" 
                      variant="outlined"
                      color="secondary"
                      sx={{ fontSize: '0.7rem', height: '20px' }}
                    />
                  )}
                </Box>

                {/* Time and Social Proof */}
                <Box>
                  {recipe.total_time && (
                    <Box display="flex" alignItems="center" gap={0.5} mb={0.5}>
                      <TimeIcon sx={{ fontSize: 14, color: 'text.secondary' }} />
                      <Typography variant="caption" color="text.secondary">
                        {recipe.total_time} min
                      </Typography>
                    </Box>
                  )}

                  {recipe.times_made > 0 && (
                    <Typography variant="caption" color="success.main" display="block">
                      {recipe.times_made} people made this
                    </Typography>
                  )}

                  {recipe.recommendation_type === 'community_favorite' && (
                    <Typography variant="caption" color="primary.main" display="block" sx={{ mt: 0.5 }}>
                      Community favorite
                    </Typography>
                  )}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {recommendations.length > maxItems && (
        <Box sx={{ textAlign: 'center', mt: 2 }}>
          <Button 
            variant="outlined" 
            onClick={() => navigate('/recipes')}
          >
            View More Recommendations
          </Button>
        </Box>
      )}
    </Box>
  );
};

export default RatingBasedRecommendations;