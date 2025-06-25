import React, { useState, useCallback, useEffect } from 'react';
import { 
  Box, Typography, TextField, Button, Card, CardContent, Alert,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel,
  CircularProgress, Container, Paper, Divider, Chip, Link
} from '@mui/material';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function CreateAccount() {
  const navigate = useNavigate();
  const query = useQuery();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const { login } = useAuth();
  
  // Get subscription parameters from URL if available
  const subscriptionPlan = query.get('plan');
  const paymentProvider = query.get('provider') || 'stripe';
  const discountCode = query.get('discount');
  
  // Form state
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    account_type: 'individual'
  });
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  
  console.log('CreateAccount render - showVerificationMessage:', showVerificationMessage);
  
  // Debug effect to monitor state changes
  useEffect(() => {
    if (showVerificationMessage) {
      console.log('Verification message effect triggered - message should stay visible');
    }
  }, [showVerificationMessage]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prevData => ({
      ...prevData,
      [name]: value
    }));
  };
  
  const handleRecaptchaVerify = useCallback(async () => {
    if (!executeRecaptcha) {
      console.log('Execute recaptcha not available yet');
      return null;
    }
    
    try {
      const token = await executeRecaptcha('signup');
      return token;
    } catch (error) {
      console.error('Error executing reCAPTCHA:', error);
      return null;
    }
  }, [executeRecaptcha]);
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    
    // Basic validation
    if (!formData.email || !formData.password) {
      setError('Please fill in all required fields.');
      setLoading(false);
      return;
    }
    
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      setLoading(false);
      return;
    }
    
    try {
      // Get reCAPTCHA token if available
      let recaptchaToken = null;
      if (executeRecaptcha) {
        recaptchaToken = await handleRecaptchaVerify();
      }
      
      // Prepare the signup payload
      const signupPayload = {
        email: formData.email,
        password: formData.password,
        account_type: formData.account_type,
        name: formData.email.split('@')[0], // Use part of email as name
        captchaToken: recaptchaToken // Renamed to match what the backend expects
      };
      
      // Call the signup API
      // Use the signUp method which is designed to handle the signup flow
      const response = await apiService.signUp(signupPayload);
      
      console.log('Signup response:', response);
      console.log('Signup response type:', typeof response);
      console.log('Subscription plan:', subscriptionPlan);
      
      // Handle both direct response and response.data patterns
      if (response) {
        // Extract message from response or response.data
        const message = typeof response.data === 'object'
          ? response.data.message || "Account created successfully!"
          : response.message || "Account created successfully!";
        
        console.log('Setting success message:', message);
        setSuccessMessage(message);
        
        // If we have subscription parameters, log in and redirect to subscription
        if (subscriptionPlan) {
          console.log('Has subscription plan, handling subscription flow');
          try {
            // Log in with the new credentials
            const loginResponse = await login({
              email: formData.email,
              password: formData.password
            });
            
            if (loginResponse) {
              // Define success and cancel URLs
              const successUrl = `${window.location.origin}/subscription/success`;
              const cancelUrl = `${window.location.origin}/subscription/cancel`;
              
              // Import the subscription service dynamically to avoid circular dependencies
              const subscriptionService = await import('../services/subscriptionService').then(module => module.default);
              
              // Create checkout session
              const checkoutResponse = await subscriptionService.createCheckoutSession(
                subscriptionPlan,
                paymentProvider,
                successUrl,
                cancelUrl,
                discountCode
              );
              
              // Redirect to checkout
              if (checkoutResponse && checkoutResponse.checkout_url) {
                window.location.href = checkoutResponse.checkout_url;
                return;
              }
            }
          } catch (loginError) {
            console.error('Error logging in after signup:', loginError);
            // If auto-login fails, still allow the user to proceed manually
            navigate('/login?message=signup-complete&subscription=true');
            return;
          }
        } else {
          // Regular signup without subscription - show verification message
          console.log('Setting verification message to true');
          setSuccessMessage(''); // Clear any success message
          setShowVerificationMessage(true);
          return; // Prevent any further execution
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
      console.log('Error response:', err.response);
      console.log('Error message:', err.message);
      
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError('Failed to create account. Please try again later.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h4" component="h1" gutterBottom align="center">
          Create Account
        </Typography>
        
        {subscriptionPlan && (
          <Alert severity="info" sx={{ mb: 3 }}>
            <Typography variant="body2">
              <strong>You're signing up for the {subscriptionPlan.charAt(0).toUpperCase() + subscriptionPlan.slice(1)} plan.</strong> Complete your account creation to continue with subscription setup.
            </Typography>
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {successMessage && !showVerificationMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {successMessage}
          </Alert>
        )}
        
        {showVerificationMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            <Typography variant="h6" gutterBottom>
              Account Created Successfully!
            </Typography>
            <Typography variant="body2">
              Please check your email for a verification link. You'll need to verify your email address before you can log in to your account.
            </Typography>
            <Typography variant="body2" sx={{ mt: 1, fontStyle: 'italic' }}>
              Debug: Verification message is showing (showVerificationMessage = {showVerificationMessage.toString()})
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button 
                component={RouterLink} 
                to="/login" 
                variant="outlined" 
                color="primary"
              >
                Go to Login Page
              </Button>
            </Box>
          </Alert>
        )}
        
        {!showVerificationMessage && (
        <form onSubmit={handleSubmit}>
          <TextField
            label="Email"
            variant="outlined"
            fullWidth
            margin="normal"
            name="email"
            type="email"
            value={formData.email}
            onChange={handleChange}
            required
          />
          
          <TextField
            label="Password"
            variant="outlined"
            fullWidth
            margin="normal"
            name="password"
            type="password"
            value={formData.password}
            onChange={handleChange}
            required
          />
          
          <TextField
            label="Confirm Password"
            variant="outlined"
            fullWidth
            margin="normal"
            name="confirmPassword"
            type="password"
            value={formData.confirmPassword}
            onChange={handleChange}
            required
          />
          
          <FormControl component="fieldset" sx={{ mt: 2, mb: 2 }}>
            <FormLabel component="legend">Account Type</FormLabel>
            <RadioGroup
              name="account_type"
              value={formData.account_type}
              onChange={handleChange}
            >
              <FormControlLabel
                value="individual"
                control={<Radio />}
                label="Individual Account"
              />
              <FormControlLabel
                value="nutritionist"
                control={<Radio />}
                label="Nutritionist/Dietitian Account"
              />
            </RadioGroup>
          </FormControl>
          
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            size="large"
            sx={{ mt: 2 }}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Create Account'}
          </Button>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Typography variant="body2">
              Already have an account?{' '}
              <Link component={RouterLink} to="/login" color="primary">
                Log In
              </Link>
            </Typography>
          </Box>
        </form>
        )}
      </Paper>
    </Container>
  );
}

export default CreateAccount;