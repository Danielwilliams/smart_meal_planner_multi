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

const UserPreferencesAnalytics = ({ userId, compact = false }) => {
  const [preferences, setPreferences] = useState(null);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(!compact);
  const { user } = useAuth();

  useEffect(() => {
    if (userId || user?.user_id) {
      loadPreferences();
      loadInsights();
    }
  }, [userId, user]);

  const targetUserId = userId || user?.user_id;

  const loadPreferences = async () => {
    try {
      setLoading(true);
      const response = await apiService.get(`/analytics/users/${targetUserId}/preferences`);
      setPreferences(response.data.preferences);
    } catch (err) {
      console.error('Error loading preferences:', err);
      setError('Failed to load preferences');
    } finally {
      setLoading(false);
    }
  };

  const loadInsights = async () => {
    try {
      const response = await apiService.get(`/analytics/users/${targetUserId}/personalization`);
      setInsights(response.data.insights);
    } catch (err) {
      console.error('Error loading insights:', err);
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" py={2}>
        <CircularProgress />
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

  if (!preferences || preferences.total_ratings === 0) {
    return (
      <Alert severity="info" sx={{ my: 1 }}>
        No rating data available yet. Rate some recipes to see your personalized preferences!
      </Alert>
    );
  }

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

  if (compact && !expanded) {
    return renderCompactView();
  }

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