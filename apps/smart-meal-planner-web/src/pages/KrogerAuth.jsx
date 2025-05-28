import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Paper,
  Typography,
  Button,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import krogerAuthService from '../services/krogerAuthService';

// KrogerAuth component used to initiate the Kroger OAuth flow
function KrogerAuth() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [connecting, setConnecting] = useState(false);
  const [loginUrl, setLoginUrl] = useState(null);
  const [connectionStatus, setConnectionStatus] = useState(null);

  // Check the current Kroger connection status on component mount
  useEffect(() => {
    const checkConnection = async () => {
      try {
        setLoading(true);
        const status = await krogerAuthService.checkKrogerStatus();
        setConnectionStatus(status);
        
        if (status.is_connected) {
          // If already connected, redirect to cart or store selector
          if (status.needs_store_selection) {
            navigate('/kroger-store-selector');
          }
        }
      } catch (err) {
        setError("Error checking Kroger connection: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    
    checkConnection();
  }, [navigate]);

  // Handle the connect button click
  const handleConnect = async () => {
    try {
      setConnecting(true);
      setError(null);
      
      // Use the krogerAuthService to initiate reconnection
      const result = await krogerAuthService.reconnectKroger();
      
      if (result.success) {
        setLoginUrl(result.redirectUrl);
        // The redirect is handled by the service, but we set this for display purposes
      } else {
        setError(result.message || "Failed to connect to Kroger. Please try again.");
      }
    } catch (err) {
      setError("Error connecting to Kroger: " + err.message);
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Container maxWidth="sm">
        <Box sx={{ mt: 4, textAlign: 'center' }}>
          <CircularProgress />
          <Typography variant="body1" sx={{ mt: 2 }}>
            Checking Kroger connection status...
          </Typography>
        </Box>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Connect to Kroger
        </Typography>
        
        <Typography variant="body1" paragraph>
          Connect your Kroger account to add items from your shopping list directly to your Kroger cart.
        </Typography>

        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mt: 3, mb: 3 }}>
          <Typography variant="h6" gutterBottom>
            How it works:
          </Typography>
          
          <Typography variant="body2" paragraph>
            1. Click the "Connect to Kroger" button below
          </Typography>
          
          <Typography variant="body2" paragraph>
            2. You'll be redirected to Kroger's official login page
          </Typography>
          
          <Typography variant="body2" paragraph>
            3. Log in with your Kroger credentials
          </Typography>
          
          <Typography variant="body2" paragraph>
            4. Authorize Smart Meal Planner to access your Kroger cart
          </Typography>
          
          <Typography variant="body2" paragraph>
            5. Select your preferred Kroger store location
          </Typography>
        </Box>
        
        <Divider sx={{ my: 2 }} />
        
        <Box sx={{ mt: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Security Information:
          </Typography>
          
          <Typography variant="body2" paragraph>
            • Your Kroger password is never stored by Smart Meal Planner
          </Typography>
          
          <Typography variant="body2" paragraph>
            • Authentication happens directly on Kroger's website
          </Typography>
          
          <Typography variant="body2" paragraph>
            • You can disconnect your account at any time
          </Typography>
        </Box>
        
        {connectionStatus && connectionStatus.is_connected && (
          <Alert severity="success" sx={{ mt: 3 }}>
            Your Kroger account is already connected!
          </Alert>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 3 }}>
            {error}
          </Alert>
        )}
        
        <Box sx={{ mt: 4, display: 'flex', justifyContent: 'space-between' }}>
          <Button 
            variant="outlined" 
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            startIcon={<ShoppingCartIcon />}
            onClick={handleConnect}
            disabled={connecting}
          >
            {connecting ? 'Connecting...' : 'Connect to Kroger'}
          </Button>
        </Box>
        
        {connecting && !loginUrl && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
            <CircularProgress size={24} />
          </Box>
        )}
      </Paper>
    </Container>
  );
}

export default KrogerAuth;