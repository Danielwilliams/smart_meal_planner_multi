import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  TextField, 
  Button,
  Box,
  Link,
  Step, 
  Stepper, 
  StepLabel,
  Card,
  CardContent,
  Alert,
  CircularProgress,
  Divider,
  useTheme,
  Chip
} from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import ClientOnboardingForm from '../components/ClientOnboardingForm';

// Helper function to parse query parameters
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const ClientSignupPage = () => {
  const theme = useTheme();
  const query = useQuery();
  const navigate = useNavigate();
  const { login } = useAuth();
  const { executeRecaptcha } = useGoogleReCaptcha();
  
  // Get token and org from URL parameters with multiple fallbacks
  let token = query.get('token');
  let orgId = query.get('org');
  
  // Check local storage as fallback for token and org (in case they were lost in redirects)
  if (!token) {
    token = localStorage.getItem('invitation_token');
  } else {
    // Store for persistence
    localStorage.setItem('invitation_token', token);
  }
  
  if (!orgId) {
    orgId = localStorage.getItem('invitation_org_id');
  } else {
    // Store for persistence
    localStorage.setItem('invitation_org_id', orgId);
  }
  
  // Enable debug mode for this component
  console.log("Client signup loaded with token:", token, "and orgId:", orgId);
  
  const [activeStep, setActiveStep] = useState(0);
  const [orgName, setOrgName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tokenValid, setTokenValid] = useState(true);
  const [invitationAccepted, setInvitationAccepted] = useState(false);
  const [newUserId, setNewUserId] = useState(null);
  const [signupData, setSignupData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    account_type: 'client',
    invitation_token: token,
    organization_id: orgId ? parseInt(orgId) : null
  });
  
  // Just set a flag for PrivateRoute to check
  useEffect(() => {
    // Add flag to localStorage to indicate we're in client signup flow
    localStorage.setItem('in_client_signup', 'true');
    
    // Store invitation parameters for better persistence
    if (token) localStorage.setItem('invitation_token', token);
    if (orgId) localStorage.setItem('invitation_org_id', orgId);
    
    // Log information for debugging
    console.log('ClientSignupPage loaded with token:', token, 'and orgId:', orgId);
    
    // Clean up function to remove the flag when component unmounts
    return () => {
      localStorage.removeItem('in_client_signup');
    };
  }, [token, orgId]);

  // Fetch organization name
  useEffect(() => {
    const fetchOrganizationDetails = async () => {
      if (!orgId) {
        setTokenValid(false);
        setError('Invalid invitation link. Please contact your nutrition provider.');
        return;
      }
      
      try {
        console.log('Fetching organization details for:', orgId);
        const response = await apiService.getOrganizationDetails(orgId);
        console.log('Organization details response:', response);
        setOrgName(response.name || 'Your nutrition provider');
      } catch (err) {
        console.error('Error fetching organization:', err);
        // Always use a fallback name
        setOrgName('Your nutrition provider');
      }
    };
    
    // Also check invitation validity
    const checkInvitation = async () => {
      if (!token || !orgId) {
        setTokenValid(false);
        setError('Invalid invitation link. Please contact your nutrition provider.');
        return;
      }
      
      try {
        // Call an endpoint to validate invitation token without accepting it
        const response = await apiService.checkInvitation(token, orgId);
        
        if (response.valid) {
          // If the invitation is valid and has an associated email, pre-fill it
          setSignupData(prev => ({
            ...prev,
            email: response.email || ''
          }));
        } else {
          setTokenValid(false);
          setError('This invitation link has expired or is invalid. Please contact your nutrition provider.');
        }
      } catch (err) {
        console.error('Error checking invitation:', err);
        setTokenValid(false);
        setError('Unable to verify invitation. Please contact your nutrition provider.');
      }
    };
    
    fetchOrganizationDetails();
    checkInvitation();
    
    // Make sure we stay on this page
    const preventRedirect = (e) => {
      // If we're trying to navigate away, prevent it
      if (window.location.pathname !== '/client-signup') {
        e.preventDefault();
      }
    };
    
    // Add this to prevent navigation events
    window.addEventListener('beforeunload', preventRedirect);
    
    return () => {
      window.removeEventListener('beforeunload', preventRedirect);
    };
  }, [token, orgId]);
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setSignupData(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    
    // Validate form
    if (signupData.password !== signupData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    
    if (signupData.password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    
    try {
      setLoading(true);
      
      // Execute reCAPTCHA and get token
      if (!executeRecaptcha) {
        throw new Error('reCAPTCHA not initialized');
      }
      
      // Get captcha token
      const captchaToken = await executeRecaptcha('client_signup');
      
      console.log('Signing up client with data:', {
        name: signupData.name,
        email: signupData.email,
        account_type: 'client'
      });
      
      // First create the user account
      const signupResponse = await apiService.signUp({
        name: signupData.name,
        email: signupData.email,
        password: signupData.password,
        account_type: 'client',
        captchaToken: captchaToken,        // Add the captcha token
        organization_id: signupData.organization_id  // Make sure organization ID is included
      });
      
      // Capture the new user ID for onboarding forms
      if (signupResponse && signupResponse.user_id) {
        setNewUserId(signupResponse.user_id);
      }
      
      // Move to next step
      setActiveStep(1);
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.response?.data?.detail || 'Error creating account. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  const handleAcceptInvitation = async () => {
    try {
      setLoading(true);
      
      console.log('Accepting invitation with token and orgId:', { token, orgId });
      
      // Accept the invitation with the token and org ID
      const acceptResponse = await apiService.acceptInvitation(token, orgId);
      console.log('Invitation accepted successfully:', acceptResponse);
      
      // Update user account type in auth context
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      userData.account_type = 'client';
      userData.organization_id = orgId;
      localStorage.setItem('user', JSON.stringify(userData));
      
      setInvitationAccepted(true);
      setActiveStep(2); // Go to onboarding forms after accepting invitation
    } catch (err) {
      console.error('Error accepting invitation:', err);
      
      // Detailed error handling
      if (err.response?.status === 401) {
        setError('Authentication required. Please verify your email and log in first.');
      } else if (err.response?.status === 404) {
        setError('Invitation not found. It may have expired.');
      } else if (err.response?.data?.detail) {
        setError(`Error: ${err.response.data.detail}`);
      } else {
        setError('Failed to connect to organization. Please try again or contact support at support@smartmealplannerio.com.');
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleGoToDashboard = () => {
    navigate('/client-dashboard');
  };
  
  // Render different steps based on activeStep
  const renderStep = () => {
    switch (activeStep) {
      case 0:
        return (
          <Box component="form" onSubmit={handleSubmit} sx={{ mt: 3 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="name"
              label="Your Name"
              name="name"
              autoComplete="name"
              value={signupData.name}
              onChange={handleChange}
              autoFocus
            />
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              value={signupData.email}
              onChange={handleChange}
              disabled={signupData.email !== ''}
              helperText={signupData.email !== '' ? "Email is pre-filled from your invitation" : ""}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="new-password"
              value={signupData.password}
              onChange={handleChange}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="confirmPassword"
              label="Confirm Password"
              type="password"
              id="confirmPassword"
              value={signupData.confirmPassword}
              onChange={handleChange}
            />
            <Button
              type="submit"
              fullWidth
              variant="contained"
              size="large"
              sx={{ mt: 3, mb: 2 }}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : "Create Client Account"}
            </Button>
            <Box sx={{ mt: 2, textAlign: 'center' }}>
              <Typography variant="body2">
                Already have an account?{' '}
                <Link component={RouterLink} to={`/login?invitation=true&token=${token}&org=${orgId}`}>
                  Sign in
                </Link>
              </Typography>
            </Box>
          </Box>
        );
      case 1:
        return (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Alert severity="success" sx={{ display: 'inline-flex' }}>
                Account Created Successfully!
              </Alert>
            </Box>
            <Typography variant="body1" gutterBottom sx={{ fontWeight: 'bold' }}>
              Important: Please verify your email first
            </Typography>
            <Box sx={{ bgcolor: '#f8f9fa', p: 3, borderRadius: 1, mb: 3 }}>
              <Typography variant="body1" gutterBottom>
                We've sent a verification link to your email. Please complete these steps:
              </Typography>
              <Box sx={{ textAlign: 'left', mt: 2 }}>
                <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                  1. Check your email for a verification link from Smart Meal Planner
                </Typography>
                <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                  2. Click the verification link to activate your account
                </Typography>
                <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                  3. Return to the login page and sign in with your credentials
                </Typography>
                <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                  4. After signing in, you'll be prompted to connect to {orgName}
                </Typography>
              </Box>
            </Box>
            <Button
              variant="contained"
              color="primary"
              component={RouterLink}
              to="/login"
              size="large"
              fullWidth
              sx={{ mt: 2 }}
            >
              Go to Login Page
            </Button>
          </Box>
        );
      case 2:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom textAlign="center">
              Complete Your Onboarding
            </Typography>
            <Typography variant="body1" color="text.secondary" sx={{ mb: 3, textAlign: 'center' }}>
              Please fill out the custom forms from {orgName} to complete your setup.
            </Typography>
            
            {orgId && newUserId ? (
              <ClientOnboardingForm
                organizationId={parseInt(orgId)}
                clientId={newUserId}
                onComplete={() => setActiveStep(3)}
                onSkip={() => setActiveStep(3)}
              />
            ) : (
              <Box sx={{ textAlign: 'center' }}>
                <Alert severity="info" sx={{ mb: 3 }}>
                  Unable to load onboarding forms. You can complete these later in your profile.
                </Alert>
                <Button
                  variant="contained"
                  onClick={() => setActiveStep(3)}
                >
                  Continue
                </Button>
              </Box>
            )}
          </Box>
        );
      case 3:
        return (
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
              <Alert severity="success" sx={{ display: 'inline-flex' }}>
                Congratulations! You're all set! 
              </Alert>
            </Box>
            <Typography variant="h6" gutterBottom>
              You're now connected to {orgName}
            </Typography>
            <Typography variant="body1" gutterBottom>
              Your client account has been set up successfully. You can now access your personalized nutrition resources.
            </Typography>
            <Card variant="outlined" sx={{ my: 3, bgcolor: '#f8f9fa' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom>
                  What's next?
                </Typography>
                <Box sx={{ textAlign: 'left' }}>
                  <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                    • Check your dashboard for meal plans shared by your nutrition provider
                  </Typography>
                  <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                    • Set your nutrition preferences to get personalized recommendations
                  </Typography>
                  <Typography component="div" variant="body2">
                    • Explore recipes and create shopping lists
                  </Typography>
                </Box>
              </CardContent>
            </Card>
            <Button
              variant="contained"
              color="primary"
              onClick={handleGoToDashboard}
              size="large"
              fullWidth
              sx={{ mt: 3 }}
            >
              Go to Client Dashboard
            </Button>
          </Box>
        );
      default:
        return null;
    }
  };
  
  if (!tokenValid) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" component="h1" align="center" gutterBottom>
            Invalid Invitation
          </Typography>
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button 
              variant="contained" 
              component={RouterLink} 
              to="/login"
            >
              Go to Login
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }
  
  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', mb: 2 }}>
          <Chip 
            label="CLIENT REGISTRATION" 
            sx={{ 
              bgcolor: theme.palette.primary.main, 
              color: 'white',
              fontWeight: 'bold',
              mb: 1
            }} 
          />
        </Box>
        
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          Join {orgName} as a Client
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Stepper activeStep={activeStep} sx={{ mt: 3, mb: 4 }}>
          <Step>
            <StepLabel>Create Account</StepLabel>
          </Step>
          <Step>
            <StepLabel>Verify Email</StepLabel>
          </Step>
          <Step>
            <StepLabel>Onboarding</StepLabel>
          </Step>
          <Step>
            <StepLabel>Complete</StepLabel>
          </Step>
        </Stepper>
        
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Card variant="outlined" sx={{ mb: 3, bgcolor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              As a client of {orgName}, you'll have access to:
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" variant="body2">Personalized meal plans</Typography>
              <Typography component="li" variant="body2">Nutrition-optimized recipes</Typography>
              <Typography component="li" variant="body2">Grocery shopping lists</Typography>
              <Typography component="li" variant="body2">Online grocery ordering integration</Typography>
            </Box>
          </CardContent>
        </Card>
        
        {renderStep()}
      </Paper>
    </Container>
  );
};

export default ClientSignupPage;