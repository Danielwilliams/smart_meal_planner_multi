import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate, useLocation, Link as RouterLink } from 'react-router-dom';
import {
  Container, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Alert,
  Box,
  Paper,
  Divider,
  Link
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';

// Helper function to parse query parameters
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const query = useQuery();
  
  // Check if we have invitation parameters
  const isInvitation = query.get('invitation') === 'true';
  const invitationToken = query.get('token');
  const organizationId = query.get('org');
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [invitationInfo, setInvitationInfo] = useState(null);
  const [organizationName, setOrganizationName] = useState('');
  const [showResendVerification, setShowResendVerification] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);

  // Fetch invitation info if we have an invitation token and org id
  useEffect(() => {
    const fetchInvitationInfo = async () => {
      if (isInvitation && invitationToken && organizationId) {
        try {
          // Get organization details first
          try {
            const orgDetails = await apiService.getOrganizationDetails(organizationId);
            setOrganizationName(orgDetails.name || 'your nutrition provider');
          } catch (err) {
            console.error('Error fetching organization details:', err);
          }
          
          // Then check invitation validity
          const invInfo = await apiService.checkInvitation(invitationToken, organizationId);
          if (invInfo.valid) {
            setInvitationInfo(invInfo);
            // Pre-fill email field if provided
            if (invInfo.email) {
              setEmail(invInfo.email);
            }
          } else {
            setError('This invitation link is invalid or has expired.');
          }
        } catch (err) {
          console.error('Error checking invitation:', err);
          setError('There was a problem with your invitation link.');
        }
      }
    };
    
    fetchInvitationInfo();
  }, [isInvitation, invitationToken, organizationId]);

  const handleLogin = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    let retryCount = 0;
    const maxRetries = 1;

    while (retryCount <= maxRetries) {
      try {
        if (!executeRecaptcha) {
          throw new Error('reCAPTCHA not initialized');
        }

        const captchaToken = await executeRecaptcha('login');
        
        // Use the AuthContext login function that handles the API call
        const response = await login({
          email,
          password,
          captchaToken
        });

        console.log('Login Response:', response);
        
        // If we get here, login was successful, proceed with redirects
        
        // If this is an invitation login flow, redirect to the connect-to-organization page
        if (isInvitation && invitationToken && organizationId) {
          // Instead of accepting invitation here, redirect to the dedicated connection page
          navigate(`/connect-to-organization?token=${invitationToken}&org=${organizationId}`);
          return; // Exit early since we've already navigated
        }

        // Standard redirect flow (if not handling invitation)
        if (response.account_type === 'organization') {
          navigate('/organization/dashboard');
        } else if (response.account_type === 'client') {
          // Client account flow - send to client dashboard
          console.log('Navigating to client dashboard');
          navigate('/client-dashboard');
        } else {
          // Regular user flow
          if (response.progress?.has_preferences) {
            console.log('Navigating to /home');
            navigate('/home');
          } else {
            console.log('Navigating to /preferences-page');
            navigate('/preferences-page');
          }
        }
        
        // Success - break out of retry loop
        return;
        
      } catch (err) {
        console.error('Login attempt error:', {
          attempt: retryCount + 1,
          error: err,
          response: err.response,
          message: err.message
        });
        
        const errorDetail = err.response?.data?.detail || err.message || 'An unexpected error occurred during login';
        
        // Check if this is a connection error and we haven't retried yet
        if (retryCount < maxRetries && 
            (errorDetail.toLowerCase().includes('connection') || 
             errorDetail.toLowerCase().includes('closed') ||
             err.code === 'ERR_NETWORK')) {
          retryCount++;
          console.log(`Connection error detected, retrying (attempt ${retryCount + 1})...`);
          // Small delay before retry
          await new Promise(resolve => setTimeout(resolve, 500));
          continue; // Try again
        }
        
        // Not a connection error or max retries reached
        setError(errorDetail);
        
        // Check if this is a verification error
        if (errorDetail.includes('verify') || errorDetail.includes('verification')) {
          setShowResendVerification(true);
        }
        
        // Exit the retry loop
        break;
      }
    }
    
    setLoading(false);
  }, [email, password, executeRecaptcha, navigate, login, isInvitation, invitationToken, organizationId]);

  const handleResendVerification = async () => {
    if (!email) {
      setError('Please enter your email address first');
      return;
    }

    try {
      setResendLoading(true);
      await apiService.resendVerificationEmail(email);
      setResendSuccess(true);
      setError('Verification email sent successfully! Please check your inbox and spam folder.');
      setShowResendVerification(false);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend verification email. Please try again.');
    } finally {
      setResendLoading(false);
    }
  };

  const handleSignUp = () => {
    if (isInvitation && invitationToken && organizationId) {
      // If this is an invitation flow, redirect to client-specific signup
      navigate(`/client-signup?token=${invitationToken}&org=${organizationId}`);
    } else {
      // Regular signup
      navigate('/signup');
    }
  };

  // If this is an invitation-based login, show a specific client login interface
  if (isInvitation) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 8, mb: 8 }}>
          <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
            <Typography variant="h5" align="center" gutterBottom>
              Sign In as a Client
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Alert severity="info" sx={{ mb: 3 }}>
              You've been invited to join <strong>{organizationName}</strong> as a client. 
              Sign in with your existing account to accept this invitation.
            </Alert>
            
            {error && (
              <Alert severity="error" sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={invitationInfo?.email}
                helperText={invitationInfo?.email ? "Email from invitation" : ""}
              />
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                size="large"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In & Accept Invitation'}
              </Button>
            </form>

            <Box sx={{ textAlign: 'center', mt: 3 }}>
              <Typography variant="body2" gutterBottom>
                Don't have an account yet?
              </Typography>
              <Button 
                variant="outlined"
                color="secondary" 
                fullWidth
                onClick={handleSignUp}
                sx={{ mt: 1 }}
              >
                Create Client Account
              </Button>
            </Box>
            
            <Divider sx={{ my: 3 }} />
            
            <Typography variant="body2" align="center" color="text.secondary">
              If you're not expecting this invitation, you can safely ignore it.
            </Typography>
          </Paper>
        </Box>
      </Container>
    );
  }

  // Regular login interface (not invitation-based)
  return (
    <Container maxWidth="sm">
      <Box sx={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        mt: 8 
      }}>
        <Card sx={{ width: '100%', maxWidth: 400 }}>
          <CardContent>
            <Typography 
              component="h1" 
              variant="h5" 
              align="center" 
              gutterBottom
            >
              Sign In
            </Typography>

            {error && (
              <Alert severity={resendSuccess ? "success" : "error"} sx={{ mb: 2 }}>
                {error}
              </Alert>
            )}

            {showResendVerification && !resendSuccess && (
              <Alert severity="info" sx={{ mb: 2 }}>
                <Box>
                  <Typography variant="body2" sx={{ mb: 2 }}>
                    Your email hasn't been verified yet. Please check your inbox for the verification email, or request a new one.
                  </Typography>
                  <Button 
                    variant="outlined" 
                    size="small"
                    onClick={handleResendVerification}
                    disabled={resendLoading}
                  >
                    {resendLoading ? 'Sending...' : 'Resend Verification Email'}
                  </Button>
                </Box>
              </Alert>
            )}

            <form onSubmit={handleLogin}>
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                id="email"
                label="Email Address"
                name="email"
                autoComplete="email"
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              <TextField
                variant="outlined"
                margin="normal"
                required
                fullWidth
                name="password"
                label="Password"
                type="password"
                id="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              
              <Button
                type="submit"
                fullWidth
                variant="contained"
                color="primary"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? 'Signing In...' : 'Sign In'}
              </Button>
            </form>

            <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Button 
                color="primary" 
                onClick={() => navigate('/forgot-password')}
              >
                Forgot Password?
              </Button>
              <Button 
                color="secondary" 
                onClick={handleSignUp}
              >
                Sign Up
              </Button>
            </Box>
          </CardContent>
        </Card>
      </Box>
    </Container>
  );
}

export default LoginPage;