import React, { useEffect } from 'react';
import { Box, Typography, Paper, Container, Button, CircularProgress } from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import krogerAuthService from '../services/krogerAuthService';

function KrogerAuth() {
  useEffect(() => {
    // Start Kroger auth immediately on page load
    const startAuth = async () => {
      try {
        await krogerAuthService.reconnectKroger();
      } catch (error) {
        console.error('Error starting Kroger authentication:', error);
      }
    };
    
    // Short delay to allow page to render before redirect
    const timer = setTimeout(() => {
      startAuth();
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  const handleConnectClick = () => {
    krogerAuthService.reconnectKroger();
  };

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 4, textAlign: 'center' }}>
        <Typography variant="h4" gutterBottom>
          Connect to Kroger
        </Typography>
        
        <Box sx={{ my: 3 }}>
          <Typography variant="body1" paragraph>
            You're being redirected to Kroger to authorize your account connection.
          </Typography>
          <Typography variant="body1" paragraph>
            This allows Smart Meal Planner to add items to your Kroger cart for easy grocery shopping.
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            <Typography variant="body2" color="text.secondary">
              Redirecting to Kroger...
            </Typography>
          </Box>
        </Box>
        
        <Box sx={{ mt: 4 }}>
          <Typography variant="body2" color="text.secondary" gutterBottom>
            Not being redirected automatically?
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={handleConnectClick}
            startIcon={<ShoppingCartIcon />}
          >
            Connect Manually
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default KrogerAuth;