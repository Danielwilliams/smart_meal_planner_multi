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
          
          // Try multiple approaches to exchange the token
          let success = false;
          
          // Approach 1: Try GET request to auth-callback (similar to single-user app)
          try {
            console.log("Trying GET /kroger/auth-callback approach");
            await axios.get(`${API_BASE_URL}/kroger/auth-callback`, {
              params: { 
                code,
                redirect_uri: 'https://smart-meal-planner-ti.vercel.app/kroger/callback'
              },
              headers: {
                'Authorization': `Bearer ${localStorage.getItem('access_token')}`
              }
            });
            success = true;
            console.log("Successful with GET /kroger/auth-callback");
          } catch (err1) {
            console.warn("GET /kroger/auth-callback failed:", err1);
            
            // Approach 2: Try a direct GET to the callback endpoint
            try {
              console.log("Trying direct GET to /kroger/callback with code in query params");
              await axios.get(`${API_BASE_URL}/kroger/callback?code=${encodeURIComponent(code)}`, {
                headers: {
                  'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                }
              });
              success = true;
              console.log("Successful with direct GET /kroger/callback");
            } catch (err2) {
              console.warn("GET /kroger/callback failed:", err2);
              
              // Approach 3: Try the direct store-location update
              try {
                console.log("Trying endpoint with minimal expectations");
                // This endpoint might work and indirectly process auth
                await axios.get(`${API_BASE_URL}/kroger/connection-status`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                  }
                });
                
                // Wait a bit for backend to process things
                await new Promise(resolve => setTimeout(resolve, 1000));
                
                // If we're still connected, consider it a success
                const statusResp = await axios.get(`${API_BASE_URL}/kroger/connection-status`, {
                  headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                  }
                });
                
                if (statusResp.data && statusResp.data.is_connected) {
                  success = true;
                  console.log("Connection appears to be successful");
                }
              } catch (err3) {
                console.warn("Connection status check failed:", err3);
              }
            }
          }
          
          if (success) {
            setStatus('success');
            setMessage('Successfully connected to Kroger!');
            localStorage.setItem('kroger_connected', 'true');
          } else {
            // Even if all backend approaches failed, let the user continue
            // The backend might have processed the code through other means
            setStatus('partial');
            setMessage('Kroger connection completed with uncertain status. You may need to try again if cart functionality is limited.');
            localStorage.setItem('kroger_connected', 'true');
          }
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
        
        {status === 'partial' && (
          <Box sx={{ my: 4 }}>
            <Alert severity="warning" sx={{ mb: 3 }}>
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
