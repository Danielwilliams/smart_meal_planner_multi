// src/pages/KrogerAuthCallback.jsx - Handles both frontend and backend redirect URIs
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Box, Typography, CircularProgress, Container, Paper, Alert } from '@mui/material';
import axios from 'axios';

function KrogerAuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    
    console.log('KrogerAuthCallback received:', { 
      hasCode: !!code, 
      hasState: !!state,
      url: window.location.href
    });
    
    // Store in localStorage that we've seen the Kroger callback
    localStorage.setItem('kroger_auth_seen', 'true');
    
    // If we have a code, we need to manually forward it to the backend
    const processAuth = async () => {
      try {
        if (code) {
          setStatus('processing');
          setMessage('Forwarding authentication to backend...');
          
          // Get the API base URL
          const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
          
          // Forward the code to the backend for processing
          // Send it to the token exchange endpoint
          await axios.post(`${API_BASE_URL}/kroger/exchange-token`, {
            code,
            // Use the same redirect URI that we used in the authorization URL
            redirect_uri: 'https://smartmealplannerio.vercel.app/kroger/callback'
          }, {
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`
            }
          });
          
          setStatus('success');
          setMessage('Successfully connected to Kroger!');
          localStorage.setItem('kroger_connected', 'true');
        }
      } catch (err) {
        console.error('Error forwarding code to backend:', err);
        setStatus('error');
        setMessage('Error connecting to Kroger. Please try again.');
      } finally {
        // Redirect to cart after processing (success or failure)
        setTimeout(() => {
          navigate('/cart');
        }, 3000);
      }
    };
    
    if (code) {
      processAuth();
    } else {
      // If no code present, just redirect back to cart after a delay
      const redirectTimer = setTimeout(() => {
        navigate('/cart');
      }, 3000);
      
      return () => clearTimeout(redirectTimer);
    }
  }, [searchParams, navigate]);
  
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
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              You will be redirected to the cart page in a few seconds.
            </Typography>
          </Box>
        )}
        
        {status === 'success' && (
          <Box sx={{ my: 4 }}>
            <Alert severity="success" sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Redirecting to cart...
            </Typography>
          </Box>
        )}
        
        {status === 'error' && (
          <Box sx={{ my: 4 }}>
            <Alert severity="error" sx={{ mb: 3 }}>
              {message}
            </Alert>
            <Typography variant="body2" color="text.secondary">
              Redirecting to cart...
            </Typography>
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default KrogerAuthCallback;
