// src/pages/KrogerAuthCallback.jsx - Simple, minimal implementation that matches the single-user app
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Button } from '@mui/material';
import axios from 'axios';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  
  useEffect(() => {
    const code = searchParams.get('code');
    
    // Simple automatic redirect to backend callback endpoint
    const processAuth = async () => {
      try {
        // Instead of handling token exchange in the frontend, simply redirect to backend callback endpoint
        // This is exactly how the single-user app handles it
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
        
        // Using simple redirect approach - important: use GET not POST
        window.location.href = `${API_BASE_URL}/kroger/auth-callback?code=${code}`;
      } catch (err) {
        console.error('Error during Kroger auth processing:', err);
        setStatus('error');
        setMessage('An error occurred processing your Kroger authorization. Please try again.');
      }
    };
    
    if (code) {
      processAuth();
    } else {
      setStatus('error');
      setMessage('No authorization code provided. Please try again.');
    }
  }, [searchParams]);
  
  const handleManualReturn = () => {
    navigate('/cart');
  };
  
  return (
    <Box sx={{ p: 4, textAlign: 'center' }}>
      <Typography variant="h5" gutterBottom>Kroger Authorization</Typography>
      
      {status === 'processing' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', mt: 4 }}>
          <CircularProgress sx={{ mb: 2 }} />
          <Typography>{message}</Typography>
        </Box>
      )}
      
      {status === 'error' && (
        <Box sx={{ mt: 4 }}>
          <Typography color="error" sx={{ mb: 2 }}>{message}</Typography>
          <Button variant="contained" onClick={handleManualReturn}>
            Return to Cart
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default KrogerAuthCallback;
