import React, { useState, useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box, Card, CardContent, Typography, Button, Alert } from '@mui/material';
import subscriptionService from '../services/subscriptionService';

function SubscriptionRoute({ children }) {
  const { isAuthenticated, loading: authLoading, user } = useAuth();
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [subscriptionLoading, setSubscriptionLoading] = useState(true);
  const [error, setError] = useState(null);
  const location = useLocation();

  useEffect(() => {
    const checkSubscription = async () => {
      if (!isAuthenticated) {
        setSubscriptionLoading(false);
        return;
      }

      try {
        setSubscriptionLoading(true);
        const status = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(status);
      } catch (err) {
        console.error('Error checking subscription status:', err);
        setError('Failed to check subscription status');
        setSubscriptionStatus(null);
      } finally {
        setSubscriptionLoading(false);
      }
    };

    checkSubscription();
  }, [isAuthenticated]);

  // Show loading while checking authentication or subscription
  if (authLoading || subscriptionLoading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
      >
        <CircularProgress />
        <Typography variant="body1" sx={{ ml: 2 }}>
          {authLoading ? 'Checking authentication...' : 'Checking subscription...'}
        </Typography>
      </Box>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Check subscription status
  const isActiveSubscription = subscriptionStatus && 
    (subscriptionStatus.status === 'active' || subscriptionStatus.status === 'trialing');

  const isFreeTrialActive = subscriptionStatus && 
    subscriptionStatus.status === 'free_tier' && 
    subscriptionStatus.beta_expiration_date &&
    new Date(subscriptionStatus.beta_expiration_date) > new Date();

  // Check if user is a grandfathered free user (no expiration date = permanent free access)
  const isGrandfatheredFreeUser = subscriptionStatus && 
    subscriptionStatus.status === 'free_tier' && 
    !subscriptionStatus.beta_expiration_date;

  // Allow access if user has active subscription, active free trial, or is grandfathered
  if (isActiveSubscription || isFreeTrialActive || isGrandfatheredFreeUser) {
    return children;
  }

  // Show subscription required page
  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto', mt: 8 }}>
      <Card>
        <CardContent sx={{ textAlign: 'center', p: 4 }}>
          <Typography variant="h4" gutterBottom color="primary">
            Subscription Required
          </Typography>
          
          {error && (
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
          )}
          
          <Typography variant="body1" sx={{ mb: 3 }}>
            To access Smart Meal Planner features, you need an active subscription.
          </Typography>
          
          {subscriptionStatus?.status === 'free_tier' && (
            <Alert severity="info" sx={{ mb: 3 }}>
              Your free trial has expired. Subscribe to continue using Smart Meal Planner.
            </Alert>
          )}
          
          {subscriptionStatus?.status === 'canceled' && (
            <Alert severity="warning" sx={{ mb: 3 }}>
              Your subscription was canceled. Reactivate to continue using Smart Meal Planner.
            </Alert>
          )}
          
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', mt: 3 }}>
            <Button 
              variant="contained" 
              color="primary"
              size="large"
              onClick={() => window.location.href = '/subscription'}
            >
              View Subscription Plans
            </Button>
            
            <Button 
              variant="outlined"
              size="large"
              onClick={() => window.location.href = '/'}
            >
              Back to Home
            </Button>
          </Box>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SubscriptionRoute;