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
    
    const verifySubscription = async () => {
      try {
        setLoading(true);
        
        // Wait a moment to ensure the webhook has been processed
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        // Get the updated subscription status
        const subscriptionData = await subscriptionService.getSubscriptionStatus();
        setSubscription(subscriptionData);
        
        if (!subscriptionData || subscriptionData.status !== 'active') {
          // If subscription is not active yet, try again after a delay
          setTimeout(async () => {
            const retryData = await subscriptionService.getSubscriptionStatus();
            setSubscription(retryData);
            setLoading(false);
          }, 3000);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error verifying subscription:', err);
        setError('Unable to verify your subscription status. Please contact support if you were charged.');
        setLoading(false);
      }
    };
    
    verifySubscription();
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
          
          {subscription && (
            <Box sx={{ mt: 4, mb: 4 }}>
              <Typography variant="h6" gutterBottom>
                Subscription Details
              </Typography>
              
              <Divider sx={{ mb: 2 }} />
              
              <Box sx={{ textAlign: 'left', mb: 2 }}>
                <Typography variant="body1">
                  <strong>Plan:</strong> {subscription.subscription_type.charAt(0).toUpperCase() + subscription.subscription_type.slice(1)}
                </Typography>
                <Typography variant="body1">
                  <strong>Amount:</strong> ${subscription.monthly_amount}/{subscription.currency.toLowerCase()}
                </Typography>
                <Typography variant="body1">
                  <strong>Status:</strong> Active
                </Typography>
                <Typography variant="body1">
                  <strong>Next Billing Date:</strong> {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString() : 'N/A'}
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