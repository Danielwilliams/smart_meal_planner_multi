import React, { useState, useCallback } from 'react';
import { 
  Box, Typography, TextField, Button, Card, CardContent, Alert,
  RadioGroup, Radio, FormControlLabel, FormControl, FormLabel,
  CircularProgress
} from '@mui/material';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';

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
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
          {signupComplete ? (
            // Success message UI
            <>
              <Alert severity="success" sx={{ mb: 2 }}>
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
                Proceed to Login
              </Button>
            </>
          ) : (
            // Sign up form
            <>
              <Typography variant="h5" gutterBottom>
                Create an Account
              </Typography>
              
              <form onSubmit={handleSignUp}>
                <TextField
                  label="Name"
                  fullWidth
                  margin="normal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
                <TextField
                  label="Email"
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
                />
                
                <FormControl component="fieldset" sx={{ my: 2 }}>
                  <FormLabel component="legend">Account Type</FormLabel>
                  <RadioGroup
                    row
                    name="account-type"
                    value={accountType}
                    onChange={(e) => setAccountType(e.target.value)}
                  >
                    <FormControlLabel 
                      value="individual" 
                      control={<Radio />} 
                      label="Individual" 
                    />
                    <FormControlLabel 
                      value="organization" 
                      control={<Radio />} 
                      label="Organization" 
                    />
                  </RadioGroup>
                </FormControl>
                
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
                  <Alert severity="error" sx={{ mt: 2 }}>
                    {error}
                  </Alert>
                )}
                
                <Button 
                  variant="contained" 
                  type="submit"
                  fullWidth
                  sx={{ mt: 2 }}
                  disabled={loading}
                >
                  {loading ? (
                    <>
                      <CircularProgress size={24} sx={{ mr: 1 }} />
                      Signing up...
                    </>
                  ) : (
                    'Sign Up'
                  )}
                </Button>
              </form>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignUpPage;