import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Container, Typography, Paper, Box, CircularProgress, Alert, Button } from '@mui/material';
import apiService from '../services/apiService';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Enhanced debugging
    console.log("KrogerAuthCallback - Full URL:", window.location.href);
    
    const code = searchParams.get('code');
    const success = searchParams.get('success');
    const errorMsg = searchParams.get('error');
    
    console.log("KrogerAuthCallback params:", { code, success, error: errorMsg });
    
    // Check if we're coming from a reconnect attempt
    const reconnectPending = localStorage.getItem('kroger_reconnect_pending');
    const reconnectTimestamp = localStorage.getItem('kroger_reconnect_timestamp');
    
    // Clear reconnect flags
    if (reconnectPending) {
      localStorage.removeItem('kroger_reconnect_pending');
      localStorage.removeItem('kroger_reconnect_timestamp');
    }
    
    // Handle Kroger auth code
    if (code) {
      // Store code in session storage for backend to use on next page
      sessionStorage.setItem('kroger_auth_code', code);
      sessionStorage.setItem('kroger_auth_redirect_uri', 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
      sessionStorage.setItem('kroger_auth_timestamp', Date.now().toString());
      
      // Mark as connected in localStorage - we'll verify this later
      localStorage.setItem('kroger_connected', 'true');
      
      // Set success state
      setStatus('success');
      setMessage('Kroger authorization received! Redirecting to cart...');
      
      // Redirect to cart page after short delay
      // The cart page will handle the actual token exchange
      setTimeout(() => {
        navigate('/cart');
      }, 1500);
      
      return;
    }
    
    // Handle explicit success response
    if (success === 'true') {
      setStatus('success');
      setMessage('Kroger account connected successfully!');
      
      // Mark as connected in localStorage
      localStorage.setItem('kroger_connected', 'true');
      
      // Redirect to cart page after short delay
      setTimeout(() => {
        navigate('/cart');
      }, 1500);
    } else if (errorMsg) {
      setStatus('error');
      setError(`Connection failed: ${errorMsg}`);
    }
  }, [searchParams, location, navigate]);
  
  // Function to manually verify connection after auth
  const verifyConnection = async () => {
    try {
      setMessage('Verifying connection...');
      
      const status = await apiService.getKrogerConnectionStatus();
      
      if (status && status.is_connected) {
        setStatus('success');
        setMessage('Kroger connection verified successfully!');
        
        // Mark as connected in localStorage
        localStorage.setItem('kroger_connected', 'true');
        
        // Redirect to cart page after short delay
        setTimeout(() => {
          navigate('/cart');
        }, 1500);
      } else {
        setStatus('error');
        setError('Could not verify Kroger connection. Please try again.');
      }
    } catch (err) {
      console.error('Error verifying connection:', err);
      setStatus('error');
      setError('Failed to verify connection: ' + (err.message || 'Unknown error'));
    }
  };
  
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom align="center">
            {status === 'processing' ? 'Connecting to Kroger...' : 
             status === 'success' ? 'Successfully Connected!' : 
             'Connection Failed'}
          </Typography>
          
          {status === 'processing' && (
            <Box display="flex" justifyContent="center" my={3}>
              <CircularProgress />
            </Box>
          )}
          
          {status === 'success' && (
            <Alert severity="success" sx={{ my: 2 }}>
              {message}
            </Alert>
          )}
          
          {status === 'error' && (
            <>
              <Alert severity="error" sx={{ my: 2 }}>
                {error}
              </Alert>
              <Box mt={2}>
                <Typography variant="body2" color="textSecondary">
                  Debug information:
                </Typography>
                <Typography variant="body2" component="pre" 
                  sx={{ 
                    overflowX: 'auto', 
                    fontSize: '0.75rem',
                    bgcolor: '#f5f5f5',
                    p: 1,
                    borderRadius: 1
                  }}>
                  {`Path: ${location.pathname}\nSearch: ${location.search}`}
                </Typography>
              </Box>
            </>
          )}
          
          <Box display="flex" justifyContent="center" mt={3} gap={2}>
            <Button 
              variant="contained"
              onClick={() => navigate('/cart')}
            >
              {status === 'success' ? 'Continue to Cart' : 'Back to Cart'}
            </Button>
            
            {status === 'error' && (
              <Button 
                variant="outlined" 
                color="primary"
                onClick={verifyConnection}
              >
                Verify Connection
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default KrogerAuthCallback;