// src/pages/KrogerAuthCallback.jsx - Simple implementation
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Container, Paper, Alert, Button } from '@mui/material';
import axios from 'axios';

function KrogerAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  
  useEffect(() => {
    const code = searchParams.get('code');
    
    console.log('KrogerAuthCallback received:', { 
      hasCode: !!code,
      url: window.location.href
    });
    
    const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
    
    // Simplified approach - directly redirect to backend endpoint
    if (code) {
      // Navigate to backend URL with the code - this should trigger the backend's auth flow
      window.location.href = `${API_BASE_URL}/kroger/auth-callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent('https://smart-meal-planner-multi.vercel.app/kroger/callback')}`;
    } else {
      setStatus('error');
      setMessage('No code received from Kroger. Please try again.');
      
      // Redirect back to cart after delay
      setTimeout(() => {
        navigate('/cart');
      }, 3000);
    }
  }, [searchParams, navigate]);
  
  const handleManualReturn = () => {
    navigate('/cart');
  };
  
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Kroger Authorization
        </Typography>
        
        {status === 'processing' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
            <CircularProgress sx={{ mb: 3 }} />
            <Typography variant="body1" sx={{ mb: 2 }}>
              {message}
            </Typography>
          </Box>
        )}
        
        {status === 'error' && (
          <Box sx={{ my: 4 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Button variant="contained" onClick={handleManualReturn}>
              Return to Cart
            </Button>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default KrogerAuthCallback;
