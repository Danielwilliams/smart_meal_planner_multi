import React, { useState, useCallback } from 'react';
import { 
  Box, Typography, TextField, Button, Card, CardContent, Alert,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel,
  CircularProgress, Container, Paper, Divider, Chip
} from '@mui/material';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import { useNavigate, Link as RouterLink } from 'react-router-dom';

function SignUpPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [signupComplete, setSignupComplete] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resendError, setResendError] = useState('');
  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();
  const [accountType, setAccountType] = useState('individual');
  const [organizationName, setOrganizationName] = useState('');

  const handleSignUp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!executeRecaptcha) {
        throw new Error('reCAPTCHA not initialized');
      }

      const captchaToken = await executeRecaptcha('signup');
      
      // Prepare payload based on account type
      const payload = {
        name,
        email,
        password,
        captchaToken,
        account_type: accountType
      };
      
      // Add organization name if signing up as organization
      if (accountType === 'organization' && organizationName) {
        payload.organization_name = organizationName;
      }
      
      const response = await apiService.signUp(payload);
      setSignupComplete(true);
    } catch (err) {
      console.error('Signup Error:', err);
      setError(
        err.response?.data?.detail || 
        err.message || 
        'An unexpected error occurred during signup'
      );
    } finally {
      setLoading(false);
    }
  };

  const handleResendVerification = async () => {
    setResendLoading(true);
    setResendSuccess(false);
    setResendError('');

    try {
      // Call a new API endpoint to request a new verification email
      const response = await apiService.resendVerificationEmail(email);
      setResendSuccess(true);
    } catch (err) {
      console.error('Resend verification email error:', err);
      setResendError(
        err.response?.data?.detail || 
        err.message || 
        'Failed to resend verification email'
      );
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
          <Chip 
            label={accountType === 'individual' ? "INDIVIDUAL SIGNUP" : "ORGANIZATION SIGNUP"} 
            color="primary"
            sx={{ fontWeight: 'bold', mb: 1 }}
          />
        </Box>
        
        <Typography variant="h5" align="center" gutterBottom>
          Create {accountType === 'organization' ? 'an Organization' : 'a Personal'} Account
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        <Alert severity="info" sx={{ mb: 3 }}>
          <Typography variant="body2">
            <strong>Note:</strong> This form is for creating {accountType === 'organization' ? 'organization' : 'individual'} accounts. 
            If you received an invitation to join as a client, please use the invitation link sent to you.
          </Typography>
        </Alert>
        
        {signupComplete ? (
          // Success message UI
          <>
            <Alert severity="success" sx={{ mb: 3 }}>
              Registration successful!
            </Alert>
            <Typography variant="body1" sx={{ mb: 3 }}>
              A confirmation email has been sent to <strong>{email}</strong>.
              Please check your inbox and click the verification link to activate your account.
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              You will not be able to log in until you verify your email.
            </Typography>

            {/* Resend verification email section */}
            <Box sx={{ mb: 3, mt: 2 }}>
              <Typography variant="body2" sx={{ mb: 1 }}>
                Didn't receive the email? 
              </Typography>
              
              {resendSuccess ? (
                <Alert severity="success" sx={{ mb: 2 }}>
                  Verification email resent successfully!
                </Alert>
              ) : resendError ? (
                <Alert severity="error" sx={{ mb: 2 }}>
                  {resendError}
                </Alert>
              ) : null}
              
              <Button 
                variant="outlined" 
                fullWidth
                onClick={handleResendVerification}
                disabled={resendLoading}
                sx={{ mb: 2 }}
              >
                {resendLoading ? (
                  <CircularProgress size={24} sx={{ mr: 1 }} />
                ) : null}
                Resend Verification Email
              </Button>
            </Box>

            <Button 
              variant="contained" 
              fullWidth
              onClick={() => navigate('/login')}
            >
              Proceed to Login (Subscribe After Verification)
            </Button>
          </>
        ) : (
          // Sign up form
          <>
            <FormControl component="fieldset" sx={{ mb: 3, width: '100%' }}>
              <FormLabel component="legend">I want to create an account as:</FormLabel>
              <RadioGroup
                row
                name="account-type"
                value={accountType}
                onChange={(e) => setAccountType(e.target.value)}
                sx={{ justifyContent: 'center', mt: 1 }}
              >
                <FormControlLabel 
                  value="individual" 
                  control={<Radio />} 
                  label="Individual User" 
                />
                <FormControlLabel 
                  value="organization" 
                  control={<Radio />} 
                  label="Organization" 
                />
              </RadioGroup>
            </FormControl>
            
            <Card variant="outlined" sx={{ mb: 3, bgcolor: '#f8f9fa' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  {accountType === 'organization' 
                    ? 'As an organization, you can:' 
                    : 'As an individual user, you can:'}
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  {accountType === 'organization' ? (
                    <>
                      <Typography component="li" variant="body2">Invite and manage client accounts</Typography>
                      <Typography component="li" variant="body2">Create and assign personalized meal plans</Typography>
                      <Typography component="li" variant="body2">Share nutrition resources with clients</Typography>
                      <Typography component="li" variant="body2">Track client nutrition progress</Typography>
                    </>
                  ) : (
                    <>
                      <Typography component="li" variant="body2">Generate personalized meal plans</Typography>
                      <Typography component="li" variant="body2">Save favorite recipes</Typography>
                      <Typography component="li" variant="body2">Create grocery shopping lists</Typography>
                      <Typography component="li" variant="body2">Use online grocery ordering integration</Typography>
                    </>
                  )}
                </Box>
              </CardContent>
            </Card>
            
            <form onSubmit={handleSignUp}>
              <TextField
                label="Full Name"
                fullWidth
                margin="normal"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <TextField
                label="Email Address"
                type="email"
                fullWidth
                margin="normal"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <TextField
                label="Password"
                type="password"
                fullWidth
                margin="normal"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                helperText="Password must be at least 8 characters"
              />
              
              {accountType === 'organization' && (
                <TextField
                  label="Organization Name"
                  fullWidth
                  margin="normal"
                  value={organizationName}
                  onChange={(e) => setOrganizationName(e.target.value)}
                  required
                />
              )}
              
              {error && (
                <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
                  {error}
                </Alert>
              )}
              
              <Button 
                variant="contained" 
                type="submit"
                fullWidth
                size="large"
                sx={{ mt: 3, mb: 2 }}
                disabled={loading}
              >
                {loading ? (
                  <>
                    <CircularProgress size={24} sx={{ mr: 1 }} />
                    Signing up...
                  </>
                ) : (
                  `Create ${accountType === 'organization' ? 'Organization' : 'Account'}`
                )}
              </Button>
              
              <Divider sx={{ my: 2 }} />
              
              <Box sx={{ textAlign: 'center' }}>
                <Typography variant="body2" gutterBottom>
                  Already have an account?
                </Typography>
                <Button 
                  component={RouterLink} 
                  to="/login"
                  variant="outlined"
                >
                  Sign In
                </Button>
              </Box>
            </form>
          </>
        )}
      </Paper>
    </Container>
  );
}

export default SignUpPage;