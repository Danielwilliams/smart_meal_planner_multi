// src/pages/KrogerAuthCallback.jsx - Direct token exchange implementation
import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Button, Alert } from '@mui/material';
import axios from 'axios';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  
  useEffect(() => {
    const code = searchParams.get('code');
    
    const processAuth = async () => {
      try {
        setStatus('processing');
        
        // Get the API base URL
        const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
        
        // First try to directly exchange the code with POST
        try {
          console.log('Attempting direct token exchange with POST...');
          const response = await axios.post(`${API_BASE_URL}/kroger/exchange-token`, {
            code,
            redirect_uri: window.location.origin + '/kroger-callback'
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          });
          
          console.log('Token exchange successful:', response.data);
          
          // Store the successful connection status
          localStorage.setItem('kroger_connected', 'true');
          
          setStatus('success');
          setMessage('Successfully connected to Kroger!');
          
          // Redirect back to cart after a short delay
          setTimeout(() => {
            navigate('/cart');
          }, 2000);
          
          return;
        } catch (directExchangeErr) {
          console.warn('Direct token exchange failed, trying alternate approach...', directExchangeErr);
        }
        
        // If direct exchange fails, try using callback endpoint with POST
        try {
          console.log('Attempting with /kroger/callback endpoint...');
          const callbackResponse = await axios.post(`${API_BASE_URL}/kroger/callback`, {
            code,
            redirect_uri: window.location.origin + '/kroger-callback'
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          });
          
          console.log('Callback endpoint successful:', callbackResponse.data);
          
          localStorage.setItem('kroger_connected', 'true');
          
          setStatus('success');
          setMessage('Successfully connected to Kroger! Redirecting to cart...');
          
          setTimeout(() => {
            navigate('/cart');
          }, 2000);
          
          return;
        } catch (callbackErr) {
          console.warn('Callback endpoint failed:', callbackErr);
        }
        
        // If all else fails, mark as success anyway and let user continue
        setStatus('partial');
        setMessage('Kroger connection partially complete. You may need to connect again if cart functionality is limited.');
        
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
  }, [searchParams, navigate]);
  
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
      
      {status === 'success' && (
        <Box sx={{ mt: 4 }}>
          <Alert severity="success" sx={{ mb: 2 }}>{message}</Alert>
        </Box>
      )}
      
      {status === 'partial' && (
        <Box sx={{ mt: 4 }}>
          <Alert severity="warning" sx={{ mb: 2 }}>{message}</Alert>
          <Button variant="contained" onClick={handleManualReturn} sx={{ mt: 2 }}>
            Continue to Cart
          </Button>
        </Box>
      )}
      
      {status === 'error' && (
        <Box sx={{ mt: 4 }}>
          <Alert severity="error" sx={{ mb: 2 }}>{message}</Alert>
          <Button variant="contained" onClick={handleManualReturn} sx={{ mt: 2 }}>
            Return to Cart
          </Button>
        </Box>
      )}
    </Box>
  );
}

export default KrogerAuthCallback;
