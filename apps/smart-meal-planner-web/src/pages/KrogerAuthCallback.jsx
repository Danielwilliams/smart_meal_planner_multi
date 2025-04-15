// src/pages/KrogerAuthCallback.jsx - Informational placeholder for backend OAuth flow
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Typography, CircularProgress, Container, Paper } from '@mui/material';

function KrogerAuthCallback() {
  const navigate = useNavigate();
  
  // Set a timeout to redirect to the cart page after a delay
  useEffect(() => {
    // Store in localStorage that we've seen the Kroger callback
    localStorage.setItem('kroger_auth_seen', 'true');
    
    // Set a timeout to redirect
    const redirectTimer = setTimeout(() => {
      navigate('/cart');
    }, 5000);
    
    return () => clearTimeout(redirectTimer);
  }, [navigate]);
  
  return (
    <Container maxWidth="sm" sx={{ mt: 8 }}>
      <Paper elevation={3} sx={{ p: 4, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Kroger Authorization
        </Typography>
        
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
          <CircularProgress sx={{ mb: 3 }} />
          <Typography variant="body1" sx={{ mb: 2 }}>
            Kroger authorization in progress...
          </Typography>
          <Typography variant="body2" color="text.secondary">
            The backend is processing your Kroger authorization.
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            You will be redirected to the cart page in a few seconds.
          </Typography>
        </Box>
      </Paper>
    </Container>
  );
}

export default KrogerAuthCallback;
