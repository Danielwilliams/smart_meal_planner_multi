import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import subscriptionService from '../services/subscriptionService';
import {
  Container,
  Typography,
  Box,
  Paper,
  Button,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

const SubscriptionSuccessPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (!isAuthenticated) {
      navigate('/login');
      return;
    }

    const checkoutSessionId = searchParams.get('session_id');
    console.log('Checkout session ID:', checkoutSessionId);

    // Always show success even if we can't verify details yet
    const verifySubscription = async () => {
      try {
        setLoading(true);

        // Wait a moment to ensure the webhook has been processed
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          // Get the updated subscription status
          const subscriptionData = await subscriptionService.getSubscriptionStatus();
          console.log('Subscription data:', subscriptionData);
          setSubscription(subscriptionData);

          if (!subscriptionData || !subscriptionData.has_subscription) {
            // If subscription is not active yet, try again after a delay
            setTimeout(async () => {
              try {
                const retryData = await subscriptionService.getSubscriptionStatus();
                console.log('Retry subscription data:', retryData);
                setSubscription(retryData);
              } catch (retryErr) {
                console.error('Error in retry:', retryErr);
                // Still show success even if we can't get the details
              } finally {
                setLoading(false);
              }
            }, 5000);
          } else {
            setLoading(false);
          }
        } catch (fetchErr) {
          console.error('Error fetching subscription:', fetchErr);
          // Don't show an error, just set loading to false
          // The page will still show a success message
          setLoading(false);
        }
      } catch (err) {
        console.error('Error in subscription verification flow:', err);
        // Don't show an error to the user since payment went through
        setLoading(false);
      }
    };

    // Start verification
    verifySubscription();

    // Set a timeout to stop loading after 10 seconds regardless
    // This ensures users don't get stuck on loading screen
    const timeoutId = setTimeout(() => {
      setLoading(false);
    }, 10000);

    return () => clearTimeout(timeoutId);
  }, [isAuthenticated, navigate, searchParams]);
  
  const handleContinue = () => {
    // Redirect based on account type
    if (user?.account_type === 'organization') {
      navigate('/organization/dashboard');
    } else {
      navigate('/home');
    }
  };
  
  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress size={60} sx={{ mb: 4 }} />
        <Typography variant="h5" gutterBottom>
          Finalizing Your Subscription...
        </Typography>
        <Typography variant="body1" color="textSecondary">
          Please wait while we confirm your payment and activate your subscription.
        </Typography>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      {error ? (
        <Alert severity="error" sx={{ mb: 4 }}>
          {error}
        </Alert>
      ) : (
        <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
          <CheckCircleIcon sx={{ fontSize: 80, color: 'success.main', mb: 2 }} />

          <Typography variant="h4" component="h1" gutterBottom>
            Subscription Successful!
          </Typography>

          <Typography variant="body1" paragraph>
            Thank you for subscribing to Smart Meal Planner. Your account has been successfully upgraded.
          </Typography>

          {subscription && subscription.has_subscription && (
            <Box sx={{ mt: 4, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Subscription Details
              </Typography>

              <Divider sx={{ mb: 2 }} />

              <Box sx={{ textAlign: 'left', mb: 2 }}>
                <Typography variant="body1">
                  <strong>Plan:</strong> {subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1)}
                </Typography>
                {subscription.renews_at && (
                  <Typography variant="body1">
                    <strong>Next Billing Date:</strong> {new Date(subscription.renews_at).toLocaleDateString()}
                  </Typography>
                )}
                <Typography variant="body1">
                  <strong>Status:</strong> {subscription.is_active ? 'Active' : 'Processing'}
                </Typography>
              </Box>
            </Box>
          )}
          
          <Button 
            variant="contained" 
            color="primary" 
            size="large"
            onClick={handleContinue}
            sx={{ mt: 2 }}
          >
            Continue to Dashboard
          </Button>
        </Paper>
      )}
    </Container>
  );
};

export default SubscriptionSuccessPage;