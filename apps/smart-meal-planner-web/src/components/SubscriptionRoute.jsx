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

  // Allow the subscription page to be viewed without authentication
  // For other routes protected by SubscriptionRoute, redirect to subscription page
  if (!isAuthenticated) {
    // Special case for subscription-related paths - don't redirect
    if (location.pathname.startsWith('/subscription')) {
      return children;
    }
    return <Navigate to="/login" replace />;
  }

  // Log the subscription status for debugging
  console.log('Raw subscription status:', subscriptionStatus);

  // First attempt: Check if we received a valid response
  // If we received nothing, assume the backend created a free tier subscription and grant access
  if (!subscriptionStatus) {
    console.log('No subscription status received, assuming free tier access was granted');
    return children;
  }

  // Second attempt: check explicit subscription status flags

  // Check for a subscription in the response
  const hasSubscription = subscriptionStatus.has_subscription === true;

  // Check for active status
  const isActiveSubscription =
    subscriptionStatus.status === 'active' ||
    subscriptionStatus.status === 'trialing';

  // Check for free tier indicators
  const isFreeTier =
    subscriptionStatus.is_free_tier === true ||
    subscriptionStatus.subscription_type === 'free' ||
    subscriptionStatus.status === 'free_tier' ||
    subscriptionStatus.status === 'free';

  // Check for active access flag
  const hasAccessFlag =
    subscriptionStatus.is_active === true ||
    subscriptionStatus.has_access === true;

  // Check for active free trial
  const isFreeTrialActive =
    (subscriptionStatus.status === 'free_tier' || subscriptionStatus.status === 'free') &&
    subscriptionStatus.beta_expiration_date &&
    new Date(subscriptionStatus.beta_expiration_date) > new Date();

  // Check for grandfathered free user status
  const isGrandfatheredFreeUser =
    (subscriptionStatus.status === 'free_tier' || subscriptionStatus.status === 'free') &&
    !subscriptionStatus.beta_expiration_date;

  // Check if available_plans exists but is empty, indicating backend didn't find plans to suggest
  const hasNoPlans =
    subscriptionStatus.available_plans &&
    subscriptionStatus.available_plans.length === 0;

  // Log details for debugging
  console.log('Subscription access evaluation:', {
    hasSubscription,
    isActiveSubscription,
    isFreeTier,
    hasAccessFlag,
    isFreeTrialActive,
    isGrandfatheredFreeUser,
    hasNoPlans
  });

  // If we detect ANY indication of valid subscription access, grant access
  if (hasSubscription ||
      isActiveSubscription ||
      isFreeTrialActive ||
      isGrandfatheredFreeUser ||
      hasAccessFlag ||
      isFreeTier ||
      hasNoPlans) {
    console.log('Access granted based on subscription status');
    return children;
  }

  // Third attempt: check for a response that only has available_plans
  // If we got here but all we have is available_plans, that means the backend
  // didn't complete creating the free tier subscription
  if (subscriptionStatus &&
      subscriptionStatus.available_plans &&
      Object.keys(subscriptionStatus).length <= 2) {
    console.log('Backend responded with only available_plans, attempting to retry');

    // If this happens repeatedly, we should not block access
    const retryCount = sessionStorage.getItem('subscriptionRetryCount') || 0;
    sessionStorage.setItem('subscriptionRetryCount', parseInt(retryCount) + 1);

    // If we've tried more than 3 times, just grant access anyway
    if (parseInt(retryCount) >= 3) {
      console.log('Multiple retry attempts - granting access anyway');
      return children;
    }
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