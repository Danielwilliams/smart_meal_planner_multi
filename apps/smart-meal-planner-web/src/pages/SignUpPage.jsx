import React, { useState, useCallback } from 'react';
import {
  Box, Typography, TextField, Button, Card, CardContent, Alert
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
  const { executeRecaptcha } = useGoogleReCaptcha();
  const navigate = useNavigate();

  const handleSignUp = useCallback(async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true); 

    try {
      if (!executeRecaptcha) {
        throw new Error('reCAPTCHA not initialized');
      } 

      // Get reCAPTCHA token
      const captchaToken = await executeRecaptcha('signup');
      
      // Attempt signup
      const response = await apiService.signUp({
        name,
        email,
        password,
        captchaToken
      }); 

      console.log('Signup Response:', response);
      
      // Set signup complete state
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
  }, [email, password, name, executeRecaptcha]);

  // If signup is complete, show verification message
  if (signupComplete) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
        <Card sx={{ maxWidth: 400, width: '100%' }}>
          <CardContent sx={{ textAlign: 'center' }}>
            <Alert severity="success" sx={{ mb: 2 }}>
              Registration successful!
            </Alert>
            <Typography variant="body1">
              A confirmation email has been sent to {email}.
              Please check your inbox and click the verification link to activate your account.
              You will not be able to log in until you verify your email.
            </Typography>
          </CardContent>
        </Card>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
      <Card sx={{ maxWidth: 400, width: '100%' }}>
        <CardContent>
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
              {loading ? 'Signing up...' : 'Sign Up'}
            </Button>
          </form>
        </CardContent>
      </Card>
    </Box>
  );
}

export default SignUpPage;