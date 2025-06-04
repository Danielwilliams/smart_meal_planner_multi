import React, { useState, useEffect } from 'react';
import { Alert, Button, Box, Typography, Chip } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import subscriptionService from '../services/subscriptionService';

function SubscriptionStatusBanner() {
  const [subscriptionStatus, setSubscriptionStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      try {
        const status = await subscriptionService.getSubscriptionStatus();
        setSubscriptionStatus(status);
      } catch (error) {
        console.error('Error fetching subscription status:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSubscriptionStatus();
  }, []);

  if (loading || !subscriptionStatus) {
    return null;
  }

  // Don't show banner for active paid subscriptions or grandfathered free users
  if (subscriptionStatus.status === 'active' && subscriptionStatus.subscription_type !== 'free') {
    return null;
  }

  // Don't show banner for grandfathered free users (no expiration date)
  if (subscriptionStatus.status === 'free_tier' && !subscriptionStatus.beta_expiration_date) {
    return null;
  }

  // Calculate days remaining for trial
  const getDaysRemaining = () => {
    if (subscriptionStatus.beta_expiration_date) {
      const expirationDate = new Date(subscriptionStatus.beta_expiration_date);
      const today = new Date();
      const diffTime = expirationDate - today;
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      return Math.max(0, diffDays);
    }
    return 0;
  };

  const daysRemaining = getDaysRemaining();
  const isExpired = daysRemaining <= 0;

  // Show different banners based on subscription status
  if (subscriptionStatus.status === 'free_tier' && !isExpired) {
    // Active trial
    return (
      <Alert 
        severity="info" 
        sx={{ mb: 2, borderRadius: 2 }}
        action={
          <Button 
            color="inherit" 
            size="small"
            onClick={() => navigate('/subscription')}
            variant="outlined"
          >
            Subscribe Now
          </Button>
        }
      >
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Chip 
            label={`${daysRemaining} days left`} 
            size="small" 
            color="primary" 
          />
          <Typography variant="body2">
            You're on a free trial. Subscribe to continue using Smart Meal Planner after your trial expires.
          </Typography>
        </Box>
      </Alert>
    );
  }

  if (subscriptionStatus.status === 'free_tier' && isExpired) {
    // Expired trial
    return (
      <Alert 
        severity="warning" 
        sx={{ mb: 2, borderRadius: 2 }}
        action={
          <Button 
            color="inherit" 
            size="small"
            onClick={() => navigate('/subscription')}
            variant="contained"
          >
            Subscribe to Continue
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>Trial Expired:</strong> Subscribe now to continue using Smart Meal Planner features.
        </Typography>
      </Alert>
    );
  }

  if (subscriptionStatus.status === 'canceled') {
    // Canceled subscription
    const periodEndDate = subscriptionStatus.current_period_end 
      ? new Date(subscriptionStatus.current_period_end).toLocaleDateString()
      : 'soon';

    return (
      <Alert 
        severity="error" 
        sx={{ mb: 2, borderRadius: 2 }}
        action={
          <Button 
            color="inherit" 
            size="small"
            onClick={() => navigate('/subscription')}
            variant="contained"
          >
            Reactivate
          </Button>
        }
      >
        <Typography variant="body2">
          <strong>Subscription Canceled:</strong> Your access will end on {periodEndDate}. Reactivate to continue using Smart Meal Planner.
        </Typography>
      </Alert>
    );
  }

  // Default: encourage subscription
  return (
    <Alert 
      severity="info" 
      sx={{ mb: 2, borderRadius: 2 }}
      action={
        <Button 
          color="inherit" 
          size="small"
          onClick={() => navigate('/subscription')}
          variant="outlined"
        >
          View Plans
        </Button>
      }
    >
      <Typography variant="body2">
        Get unlimited access to meal planning features with a Smart Meal Planner subscription.
      </Typography>
    </Alert>
  );
}

export default SubscriptionStatusBanner;