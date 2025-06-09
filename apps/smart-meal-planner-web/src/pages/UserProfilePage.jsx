import React, { useState, useEffect } from 'react';
import {
  Container,
  Typography,
  Grid,
  Paper,
  Box,
  Card,
  CardContent,
  CardActions,
  Button,
  Chip,
  Avatar,
  Divider,
  LinearProgress,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  IconButton,
  Badge
} from '@mui/material';
import {
  Person as PersonIcon,
  TrendingUp as TrendingUpIcon,
  Restaurant as RestaurantIcon,
  Star as StarIcon,
  Recommend as RecommendIcon,
  AccessTime as TimeIcon,
  Assessment as AnalyticsIcon,
  MenuBook as MenuBookIcon,
  Favorite as FavoriteIcon,
  LocalDining as DiningIcon
} from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import UserPreferencesAnalytics from '../components/UserPreferencesAnalytics';

const UserProfilePage = () => {
  const [analytics, setAnalytics] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [topRecipes, setTopRecipes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (user?.user_id) {
      loadUserData();
    } else {
      setLoading(false);
      setError('Please log in to view your profile');
    }
  }, [user]);

  const loadUserData = async () => {
    try {
      setLoading(true);
      setError('');

      // Load user analytics
      try {
        const analyticsResponse = await apiService.get(`/analytics/users/${user.user_id}/personalization`);
        setAnalytics(analyticsResponse.data.insights);
      } catch (err) {
        console.log('Analytics not available yet');
      }

      // Load recommendations
      try {
        const recResponse = await apiService.get(`/ratings/recipes/recommended?limit=6`);
        setRecommendations(recResponse.data.recommendations || []);
      } catch (err) {
        console.log('Recommendations not available');
      }

      // Load top performing recipes
      try {
        const topResponse = await apiService.get(`/analytics/trends/recipe-performance?limit=8`);
        setTopRecipes(topResponse.data.top_recipes || []);
      } catch (err) {
        console.log('Top recipes not available');
      }

    } catch (err) {
      console.error('Error loading user data:', err);
      setError('Failed to load profile data');
    } finally {
      setLoading(false);
    }
  };

  const handleRecipeClick = (recipeId) => {
    navigate(`/recipe/${recipeId}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
          <CircularProgress />
        </Box>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ py: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  const hasRatings = analytics && analytics.preferences && analytics.preferences.total_ratings > 0;

  return (
    <Container maxWidth="lg" sx={{ py: 4 }}>
      {/* Header Section */}
      <Paper sx={{ p: 4, mb: 4, background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', color: 'white' }}>
        <Grid container spacing={3} alignItems="center">
          <Grid item>
            <Avatar sx={{ width: 80, height: 80, bgcolor: 'rgba(255,255,255,0.2)' }}>
              <PersonIcon sx={{ fontSize: 40 }} />
            </Avatar>
          </Grid>
          <Grid item xs>
            <Typography variant="h4" gutterBottom>
              Welcome back, {user?.name || 'Food Explorer'}!
            </Typography>
            <Typography variant="subtitle1" sx={{ opacity: 0.9 }}>
              Your personalized meal planning dashboard
            </Typography>
          </Grid>
        </Grid>
      </Paper>

      <Grid container spacing={4}>
        {/* Your Food Journey - Analytics Section */}
        {hasRatings ? (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3 }}>
              <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TrendingUpIcon color="primary" />
                Your Food Journey
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Insights from your recipe ratings and cooking adventures
              </Typography>
              
              <UserPreferencesAnalytics userId={user?.user_id} compact={false} />
            </Paper>
          </Grid>
        ) : (
          <Grid item xs={12}>
            <Paper sx={{ p: 3, mb: 3, textAlign: 'center' }}>
              <RestaurantIcon sx={{ fontSize: 60, color: 'text.secondary', mb: 2 }} />
              <Typography variant="h6" gutterBottom>
                Start Your Food Journey
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                Rate some recipes to unlock personalized insights and recommendations!
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => navigate('/recipes')}
                startIcon={<MenuBookIcon />}
              >
                Browse Recipes
              </Button>
            </Paper>
          </Grid>
        )}

        {/* Personalized Recommendations */}
        {recommendations.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RecommendIcon color="primary" />
                Recommended for You
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Based on your rating patterns and preferences
              </Typography>
              
              <Grid container spacing={2}>
                {recommendations.slice(0, 6).map((rec) => (
                  <Grid item xs={12} sm={6} md={4} key={rec.recipe_id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}
                      onClick={() => handleRecipeClick(rec.recipe_id)}
                    >
                      <CardContent>
                        <Typography variant="subtitle2" gutterBottom>
                          Recipe #{rec.recipe_id}
                        </Typography>
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <StarIcon sx={{ color: 'orange', fontSize: 16 }} />
                          <Typography variant="body2">
                            {rec.avg_rating?.toFixed(1)} ({rec.rating_count} ratings)
                          </Typography>
                        </Box>
                        <Typography variant="caption" color="text.secondary">
                          Recommended based on your preferences
                        </Typography>
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Community Favorites */}
        {topRecipes.length > 0 && (
          <Grid item xs={12}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <FavoriteIcon color="primary" />
                Community Favorites
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                Top-rated recipes loved by our community
              </Typography>
              
              <Grid container spacing={2}>
                {topRecipes.slice(0, 8).map((recipe) => (
                  <Grid item xs={12} sm={6} md={3} key={recipe.recipe_id}>
                    <Card 
                      sx={{ 
                        cursor: 'pointer',
                        transition: 'transform 0.2s',
                        '&:hover': { transform: 'translateY(-2px)' }
                      }}
                      onClick={() => handleRecipeClick(recipe.recipe_id)}
                    >
                      <CardContent sx={{ pb: 1 }}>
                        <Typography variant="subtitle2" gutterBottom noWrap>
                          {recipe.title || `Recipe #${recipe.recipe_id}`}
                        </Typography>
                        
                        <Box display="flex" alignItems="center" gap={1} mb={1}>
                          <StarIcon sx={{ color: 'orange', fontSize: 16 }} />
                          <Typography variant="body2">
                            {recipe.average_rating?.toFixed(1)}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            ({recipe.rating_count})
                          </Typography>
                        </Box>

                        {recipe.cuisine && (
                          <Chip 
                            label={recipe.cuisine} 
                            size="small" 
                            variant="outlined"
                            sx={{ fontSize: '0.7rem' }}
                          />
                        )}

                        {recipe.total_time && (
                          <Box display="flex" alignItems="center" gap={0.5} mt={1}>
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
                      </CardContent>
                    </Card>
                  </Grid>
                ))}
              </Grid>
            </Paper>
          </Grid>
        )}

        {/* Quick Actions */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<MenuBookIcon />}
                  onClick={() => navigate('/recipes')}
                >
                  Browse Recipes
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<DiningIcon />}
                  onClick={() => navigate('/menu')}
                >
                  Generate Menu
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<FavoriteIcon />}
                  onClick={() => navigate('/saved-recipes')}
                >
                  Saved Recipes
                </Button>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Button 
                  fullWidth 
                  variant="outlined" 
                  startIcon={<PersonIcon />}
                  onClick={() => navigate('/preferences')}
                >
                  Edit Preferences
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default UserProfilePage;