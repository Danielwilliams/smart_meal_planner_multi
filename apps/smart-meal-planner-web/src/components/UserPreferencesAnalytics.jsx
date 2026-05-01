import React, { useState, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Chip,
  LinearProgress,
  Alert,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemText,
  Card,
  CardContent,
  Button,
  Collapse
} from '@mui/material';
import {
  ExpandMore as ExpandMoreIcon,
  Restaurant as RestaurantIcon,
  AccessTime as TimeIcon,
  Assessment as AnalyticsIcon,
  TrendingUp as TrendingUpIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

const UserPreferencesAnalytics = ({ userId, compact = false, showDemo = false, ratingCount = 0 }) => {
  const [preferences, setPreferences] = useState(null);
  const [insights, setInsights] = useState(null);
  const [communityTrends, setCommunityTrends] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(!compact);
  const { user } = useAuth();

  useEffect(() => {
    const targetUserId = userId || user?.userId;
    if (targetUserId) {
      loadPreferences();
      loadInsights();
    } else {
      setLoading(false);
      setError('User not found');
    }
    // Always load community trends as fallback
    loadCommunityTrends();
  }, [userId, user]);

  const targetUserId = userId || user?.userId;

  const loadPreferences = async () => {
    try {
      setLoading(true);
      setError('');
      
      console.log(`Loading analytics for user ${targetUserId}`);
      const response = await apiService.get(`/analytics/users/${targetUserId}/preferences`);
      console.log('Analytics response:', response);
      
      if (response.data && response.data.preferences) {
        setPreferences(response.data.preferences);
      } else {
        console.log('No preferences data in response');
        setPreferences(null);
      }
    } catch (err) {
      console.error('Error loading preferences:', err);
      console.error('Error details:', err.response?.data);
      
      // Handle specific error cases
      if (err.response?.status === 401) {
        setError('Please log in to view analytics');
      } else if (err.response?.status === 403) {
        setError('Access denied');
      } else if (err.response?.status === 404) {
        setError('Analytics not available');
      } else {
        setError(''); // Don't show error for missing analytics - it's optional
        setPreferences(null);
      }
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    try {
      console.log(`Loading insights for user ${targetUserId}`);
      const response = await apiService.get(`/analytics/users/${targetUserId}/personalization`);
      if (response.data && response.data.insights) {
        setInsights(response.data.insights);
      }
    } catch (err) {
      console.error('Error loading insights:', err);
      // Don't set error state for insights - they're optional
    }
  };

  const loadCommunityTrends = async () => {
    try {
      console.log('Loading community trends');
      const response = await apiService.get('/analytics/trends/cuisine-popularity?limit=10');
      if (response.data) {
        setCommunityTrends(response.data);
      }
    } catch (err) {
      console.error('Error loading community trends:', err);
      // Community trends are optional fallback
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={1}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (error && error !== '') {
    return (
      <Alert severity="error" sx={{ my: 1 }}>
        {error}
      </Alert>
    );
  }

  // Show progressive content based on rating count
  const showFullAnalytics = preferences && preferences.total_ratings >= 5;
  const showBasicAnalytics = preferences && preferences.total_ratings >= 1;
  const showDemoContent = showDemo || (!preferences || preferences.total_ratings === 0);

  const renderCompactView = () => (
    <Card sx={{ mb: 2 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={1}>
          <Typography variant="h6" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <AnalyticsIcon />
            Your Food Preferences
          </Typography>
          <Button
            endIcon={<ExpandMoreIcon sx={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)' }} />}
            onClick={() => setExpanded(!expanded)}
            size="small"
          >
            {expanded ? 'Show Less' : 'Show More'}
          </Button>
        </Box>
        
        <Grid container spacing={2}>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Recipes Rated: {preferences.total_ratings}
            </Typography>
          </Grid>
          <Grid item xs={6}>
            <Typography variant="body2" color="text.secondary">
              Avg Rating: {preferences.average_rating.toFixed(1)}/5
            </Typography>
          </Grid>
        </Grid>

        {preferences.cuisine_preferences.top_cuisines.length > 0 && (
          <Box mt={2}>
            <Typography variant="body2" gutterBottom>Top Cuisines:</Typography>
            <Box display="flex" gap={1} flexWrap="wrap">
              {preferences.cuisine_preferences.top_cuisines.slice(0, 3).map((cuisine) => (
                <Chip key={cuisine} label={cuisine} size="small" variant="outlined" />
              ))}
            </Box>
          </Box>
        )}
      </CardContent>
    </Card>
  );

  const renderDemoView = () => (
    <Grid container spacing={3}>
      {/* What to Expect Card */}
      <Grid item xs={12} md={4}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <AnalyticsIcon color="primary" />
              What to Expect
            </Typography>
            <Typography variant="body2" paragraph>
              As you rate recipes, we'll learn your preferences:
            </Typography>
            <List dense>
              <ListItem>
                <ListItemText primary="• Favorite cuisines & flavors" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Preferred cooking times" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Complexity preferences" />
              </ListItem>
              <ListItem>
                <ListItemText primary="• Dietary patterns" />
              </ListItem>
            </List>
          </CardContent>
        </Card>
      </Grid>

      {/* Community Trends Card */}
      <Grid item xs={12} md={4}>
        <Card variant="outlined" sx={{ height: '100%' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <TrendingUpIcon color="primary" />
              Popular Right Now
            </Typography>
            {communityTrends?.popular_cuisines ? (
              <>
                <Typography variant="body2" gutterBottom>
                  Top cuisines in our community:
                </Typography>
                <Box display="flex" gap={1} flexWrap="wrap" mt={1}>
                  {communityTrends.popular_cuisines.slice(0, 5).map((item) => (
                    <Chip 
                      key={item.cuisine} 
                      label={`${item.cuisine} (${item.rating_count})`} 
                      size="small" 
                      variant="outlined"
                    />
                  ))}
                </Box>
              </>
            ) : (
              <Typography variant="body2" color="text.secondary">
                Loading community trends...
              </Typography>
            )}
          </CardContent>
        </Card>
      </Grid>

      {/* Getting Started Card */}
      <Grid item xs={12} md={4}>
        <Card variant="outlined" sx={{ height: '100%', bgcolor: 'primary.light', color: 'primary.contrastText' }}>
          <CardContent>
            <Typography variant="h6" gutterBottom>
              Ready to Start?
            </Typography>
            <Typography variant="body2" paragraph>
              Rate just 5 recipes to unlock your personalized food journey!
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="h4" sx={{ fontWeight: 'bold' }}>
                {ratingCount}/5
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(ratingCount / 5) * 100} 
                sx={{ 
                  mt: 1, 
                  height: 8, 
                  borderRadius: 4,
                  bgcolor: 'primary.dark',
                  '& .MuiLinearProgress-bar': {
                    bgcolor: 'common.white'
                  }
                }}
              />
            </Box>
          </CardContent>
        </Card>
      </Grid>
    </Grid>
  );

  const renderFullView = () => (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
        <AnalyticsIcon />
        Your Food Preferences & Analytics
      </Typography>

      <Grid container spacing={3}>
        {/* Overview Stats */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>Overview</Typography>
              <Box mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Recipes Rated: {preferences.total_ratings}
                </Typography>
              </Box>
              <Box mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Average Rating: {preferences.average_rating.toFixed(1)}/5
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={(preferences.average_rating / 5) * 100} 
                  sx={{ mt: 0.5 }}
                />
              </Box>
              {insights && (
                <Box>
                  <Typography variant="body2" color="text.secondary">
                    Personalization: {insights.recommendation_confidence}
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={insights.personalization_strength * 100} 
                    sx={{ mt: 0.5 }}
                    color="secondary"
                  />
                </Box>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Cuisine Preferences */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <RestaurantIcon />
                Cuisine Preferences
              </Typography>
              {preferences.cuisine_preferences.top_cuisines.length > 0 ? (
                <>
                  <Box display="flex" gap={1} flexWrap="wrap" mb={2}>
                    {preferences.cuisine_preferences.top_cuisines.slice(0, 5).map((cuisine) => (
                      <Chip key={cuisine} label={cuisine} size="small" color="primary" />
                    ))}
                  </Box>
                  <Typography variant="body2" color="text.secondary">
                    Diversity Score: {preferences.cuisine_preferences.diversity_score} different cuisines
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  Try rating recipes from different cuisines to see your preferences!
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* Time & Complexity */}
        <Grid item xs={12} md={4}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <TimeIcon />
                Cooking Style
              </Typography>
              <Box mb={1}>
                <Typography variant="body2" color="text.secondary">
                  Preferred Time: {preferences.time_preferences.preferred_time_range}
                </Typography>
              </Box>
              {preferences.complexity_preferences.preferred_difficulty && (
                <Box mb={1}>
                  <Typography variant="body2" color="text.secondary">
                    Difficulty Level: {preferences.complexity_preferences.preferred_difficulty}/5
                  </Typography>
                  <LinearProgress 
                    variant="determinate" 
                    value={(preferences.complexity_preferences.preferred_difficulty / 5) * 100} 
                    sx={{ mt: 0.5 }}
                    color="warning"
                  />
                </Box>
              )}
              <Typography variant="body2" color="text.secondary">
                Cooking Engagement: {(preferences.behavioral_insights.cooking_engagement * 100).toFixed(0)}%
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* AI Insights */}
        {insights && insights.ai_prompt_suggestions.length > 0 && (
          <Grid item xs={12}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TrendingUpIcon />
                  AI Personalization Insights
                </Typography>
                <List dense>
                  {insights.ai_prompt_suggestions.map((suggestion, index) => (
                    <ListItem key={index} disablePadding>
                      <ListItemText 
                        primary={suggestion}
                        primaryTypographyProps={{ variant: 'body2' }}
                      />
                    </ListItem>
                  ))}
                </List>
                <Divider sx={{ my: 1 }} />
                <Typography variant="caption" color="text.secondary">
                  These insights help us personalize your meal recommendations
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Detailed Aspects */}
        {preferences.aspect_preferences.most_important_aspects.length > 0 && (
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>What Matters Most to You</Typography>
                <Box display="flex" gap={1} flexWrap="wrap">
                  {preferences.aspect_preferences.most_important_aspects.map((aspect) => (
                    <Chip 
                      key={aspect} 
                      label={aspect.replace('_', ' ')} 
                      size="small" 
                      variant="outlined"
                      color="secondary"
                    />
                  ))}
                </Box>
              </CardContent>
            </Card>
          </Grid>
        )}

        {/* Behavioral Insights */}
        <Grid item xs={12} md={6}>
          <Card variant="outlined">
            <CardContent>
              <Typography variant="h6" gutterBottom>Your Cooking Behavior</Typography>
              <Typography variant="body2" gutterBottom>
                Recipe Satisfaction Rate: {(preferences.behavioral_insights.recipe_satisfaction * 100).toFixed(0)}%
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={preferences.behavioral_insights.recipe_satisfaction * 100} 
                sx={{ mb: 1 }}
                color="success"
              />
              <Typography variant="body2" color="text.secondary">
                Total Recipes Made: {preferences.behavioral_insights.total_recipes_made}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Paper>
  );

  // Decide what to render based on rating count and state
  if (showDemoContent) {
    return renderDemoView();
  }

  if (compact && !expanded) {
    return renderCompactView();
  }

  // For users with 1-4 ratings, show a simplified view with available data
  if (showBasicAnalytics && !showFullAnalytics) {
    return (
      <Paper sx={{ p: 3 }}>
        <Grid container spacing={3}>
          {/* Basic Stats */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Your Progress</Typography>
                <Box mb={2}>
                  <Typography variant="body2" color="text.secondary">
                    Recipes Rated: {preferences.total_ratings}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Average Rating: {preferences.average_rating.toFixed(1)}/5
                  </Typography>
                </Box>
                <Typography variant="body2" color="primary" gutterBottom>
                  Rate {5 - preferences.total_ratings} more recipes for full insights!
                </Typography>
                <LinearProgress 
                  variant="determinate" 
                  value={(preferences.total_ratings / 5) * 100} 
                  sx={{ mt: 1 }}
                />
              </CardContent>
            </Card>
          </Grid>

          {/* Early Insights */}
          <Grid item xs={12} md={6}>
            <Card variant="outlined">
              <CardContent>
                <Typography variant="h6" gutterBottom>Early Insights</Typography>
                {preferences.cuisine_preferences.top_cuisines.length > 0 && (
                  <>
                    <Typography variant="body2" gutterBottom>
                      Cuisines you've enjoyed:
                    </Typography>
                    <Box display="flex" gap={1} flexWrap="wrap">
                      {preferences.cuisine_preferences.top_cuisines.map((cuisine) => (
                        <Chip key={cuisine} label={cuisine} size="small" color="primary" />
                      ))}
                    </Box>
                  </>
                )}
              </CardContent>
            </Card>
          </Grid>

          {/* Community comparison */}
          {communityTrends && (
            <Grid item xs={12}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    How You Compare
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    See how your preferences align with our community as you rate more recipes.
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
          )}
        </Grid>
      </Paper>
    );
  }

  // Full analytics for 5+ ratings
  return (
    <>
      {compact && renderCompactView()}
      <Collapse in={expanded}>
        {renderFullView()}
      </Collapse>
    </>
  );
};

export default UserPreferencesAnalytics;