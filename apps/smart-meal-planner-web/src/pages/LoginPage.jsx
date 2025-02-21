import React, { useState, useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container, 
  Typography, 
  TextField, 
  Button, 
  Card, 
  CardContent, 
  Alert,
  Box
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useGoogleReCaptcha } from 'react-google-recaptcha-v3';
import apiService from '../services/apiService';  // Import apiService

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { executeRecaptcha } = useGoogleReCaptcha();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);


  const handleLogin = useCallback(async (e) => {
  e.preventDefault();
  setError('');
  setLoading(true);

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

    // Navigation based on response
    if (response.progress.has_preferences) {
      console.log('Navigating to /home');
      navigate('/home');
    } else {
      console.log('Navigating to /preferences-page');
      navigate('/preferences-page');
    }
  } catch (err) {
    console.error('Full Login Error:', {
      error: err,
      response: err.response,
      message: err.message
    });
    
    setError(
      err.response?.data?.detail || 
      err.message || 
      'An unexpected error occurred during login'
    );
  } finally {
    setLoading(false);
  }
}, [email, password, executeRecaptcha, navigate, login]);


  const handleSignUp = () => {
    navigate('/signup');
  };

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
              Sign in
            </Typography>

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