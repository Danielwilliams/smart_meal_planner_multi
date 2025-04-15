// src/pages/KrogerAuthCallback.jsx
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
    if (!code) {
      setStatus('error');
      setMessage('No authorization code provided. Please try connecting your Kroger account again.');
      return;
    }
    
    const doExchange = async () => {
      try {
        setStatus('loading');
        const resp = await apiService.exchangeKrogerAuthCode(code);
        
        // Store success in localStorage for immediate UI feedback
        localStorage.setItem('kroger_connected', 'true');
        
        setStatus('success');
        setMessage('Successfully connected to your Kroger account!');
      } catch (err) {
        console.error('Kroger auth error:', err);
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
