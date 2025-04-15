// src/pages/KrogerAuthCallback.jsx - Handles Kroger OAuth callbacks at /kroger/callback
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  CircularProgress, 
  Alert,
  Button,
  Container,
  Paper
} from '@mui/material';
import apiService from '../services/apiService';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading'); // loading, success, error
  const [message, setMessage] = useState('Connecting to Kroger...');
  
  useEffect(() => {
    const code = searchParams.get('code');
    const redirectUri = searchParams.get('redirect_uri') || 'https://smart-meal-planner-multi.vercel.app/kroger/callback';
    
    if (!code) {
      setStatus('error');
      setMessage('No authorization code provided. Please try connecting your Kroger account again.');
      return;
    }
    
    // Log information about the callback
    console.log('Kroger auth callback received:', {
      code: `${code.substring(0, 10)}...`,
      redirectUri,
      state: searchParams.get('state')
    });
    
    const doExchange = async () => {
      try {
        setStatus('loading');
        
        // First try to exchange the code using our API service
        const resp = await apiService.exchangeKrogerAuthCode(code, redirectUri);
        console.log('Kroger token exchange response:', resp);
        
        // Store success in localStorage for immediate UI feedback
        localStorage.setItem('kroger_connected', 'true');
        
        // If we get an access token directly in the response, save it to localStorage
        // This is a temporary measure until the backend properly stores tokens
        if (resp.access_token) {
          localStorage.setItem('kroger_access_token', resp.access_token);
          if (resp.refresh_token) {
            localStorage.setItem('kroger_refresh_token', resp.refresh_token);
          }
        }
        
        setStatus('success');
        setMessage('Successfully connected to your Kroger account!');
      } catch (err) {
        console.error('Kroger auth error:', err);
        
        // If the exchange failed, show detailed error information
        const errorDetails = {
          message: err.message,
          responseStatus: err.response?.status,
          responseData: err.response?.data,
        };
        console.error('Detailed error information:', errorDetails);
        
        setStatus('error');
        setMessage(err.response?.data?.message || err.message || 'Failed to connect to Kroger. Please try again.');
      }
    };
    
    doExchange();
  }, [searchParams]);

  const handleReturnToCart = () => {
    navigate('/cart');
  };

  return (
    <Container maxWidth="sm" sx={{ mt: 4 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Kroger Account Connection
        </Typography>
        
        {status === 'loading' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
            <CircularProgress sx={{ mb: 2 }} />
            <Typography>{message}</Typography>
          </Box>
        )}
        
        {status === 'success' && (
          <>
            <Alert severity="success" sx={{ my: 2 }}>
              {message}
            </Alert>
            <Box sx={{ mt: 3 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleReturnToCart}
              >
                Return to Cart
              </Button>
            </Box>
          </>
        )}
        
        {status === 'error' && (
          <>
            <Alert severity="error" sx={{ my: 2 }}>
              {message}
            </Alert>
            <Box sx={{ mt: 3 }}>
              <Button 
                variant="contained" 
                color="primary" 
                onClick={handleReturnToCart}
              >
                Return to Cart
              </Button>
            </Box>
          </>
        )}
      </Paper>
    </Container>
  );
}

export default KrogerAuthCallback;
