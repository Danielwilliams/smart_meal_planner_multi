import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Container, Typography, Paper, Box, CircularProgress, Alert, Button } from '@mui/material';

function KrogerAuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  const [error, setError] = useState(null);
  
  useEffect(() => {
    // Enhanced debugging
    console.log("KrogerAuthCallback - Full URL:", window.location.href);
    
    const params = new URLSearchParams(location.search);
    const success = params.get('success');
    const errorMsg = params.get('error');
    
    console.log("KrogerAuthCallback params:", { success, error: errorMsg });
    
    if (success === 'true') {
      setStatus('success');
      setMessage('Kroger account connected successfully!');
      
      // Redirect to cart page after short delay
      setTimeout(() => {
        navigate('/cart');
      }, 2000);
    } else if (errorMsg) {
      setStatus('error');
      setError(`Connection failed: ${errorMsg}`);
    }
  }, [location, navigate]);
  
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
          
          <Box display="flex" justifyContent="center" mt={3}>
            <Button 
              variant="contained"
              onClick={() => navigate('/cart')}
            >
              {status === 'success' ? 'Continue to Cart' : 'Back to Cart'}
            </Button>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
}

export default KrogerAuthCallback;