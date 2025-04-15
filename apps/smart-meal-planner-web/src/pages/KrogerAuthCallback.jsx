import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Container, Typography, Paper, Box, CircularProgress, Alert, Button } from '@mui/material';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  const [error, setError] = useState(null);
  
  useEffect(() => {
    console.log("KrogerAuthCallback - Full URL:", window.location.href);
    
    const code = searchParams.get('code');
    const errorMsg = searchParams.get('error');
    
    console.log("KrogerAuthCallback params:", { code, error: errorMsg });
    
    // Handle Kroger auth code (this is what we expect from Kroger OAuth redirect)
    if (code) {
      // Store code in session storage for the cart page to process
      sessionStorage.setItem('kroger_auth_code', code);
      sessionStorage.setItem('kroger_auth_redirect_uri', 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
      sessionStorage.setItem('kroger_auth_timestamp', Date.now().toString());
      
      // Set success state
      setStatus('success');
      setMessage('Kroger authorization received! Redirecting to cart...');
      
      // Redirect to cart page after short delay
      // The cart page will handle the actual token exchange
      setTimeout(() => {
        navigate('/cart');
      }, 1000);
      
      return;
    } else if (errorMsg) {
      // Handle error from Kroger OAuth
      setStatus('error');
      setError(`Connection failed: ${errorMsg}`);
    }
  }, [searchParams, location, navigate]);
  
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom align="center">
            {status === 'processing' ? 'Connecting to Kroger...' : 
             status === 'success' ? 'Authorization Received!' : 
             'Connection Failed'}
          </Typography>
          
          {status === 'processing' && (
            <Box display="flex" justifyContent="center" my={3}>
              <CircularProgress />
            </Box>
          )}
          
          {status === 'success' && (
            <Alert severity="success" sx={{ my: 2 }}>
              {message}
            </Alert>
          )}
          
          {status === 'error' && (
            <Alert severity="error" sx={{ my: 2 }}>
              {error}
            </Alert>
          )}
          
          <Box display="flex" justifyContent="center" mt={3}>
            <Button 
              variant="contained"
              onClick={() => navigate('/cart')}
            >
              {status === 'success' ? 'Continue to Cart' : 'Back to Cart'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default KrogerAuthCallback;