import React, { useState, useEffect, useCallback } from 'react';
import { 
  Box, Typography, TextField, Button, Card, CardContent, Alert,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel,
  CircularProgress, Container, Paper, Divider, Chip, Link
} from '@mui/material';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import subscriptionService from '../services/subscriptionService';
import { useNavigate, Link as RouterLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function SignUpPage() {
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
        recaptcha_token: recaptchaToken
      };
      
      // Call the signup API
      // Use post method with the correct endpoint
      const response = await apiService.post('/auth/signup', signupPayload);
      
      // Handle both direct response and response.data patterns
      if (response) {
        // Extract message from response or response.data
        const message = typeof response.data === 'object'
          ? response.data.message || "Account created successfully!"
          : response.message || "Account created successfully!";

        setSuccessMessage(message);
        
        // If we have subscription parameters, log in and redirect to subscription
        if (subscriptionPlan) {
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
          // Regular signup without subscription - redirect to login
          navigate('/login?message=signup-complete');
        }
      } else {
        setError('An unexpected error occurred. Please try again.');
      }
    } catch (err) {
      console.error('Signup error:', err);
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
        
        {successMessage && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {successMessage}
          </Alert>
        )}
        
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
      </Paper>
    </Container>
  );
}

export default SignUpPage;