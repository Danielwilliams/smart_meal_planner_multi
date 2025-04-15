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
      const processKrogerAuthCode = async () => {
        try {
          console.log(`Processing Kroger auth code: ${code.substring(0, 10)}...`);
          
          // Forward to backend with the correct URI
          const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
          const authCallbackUrl = `${API_BASE_URL}/kroger/auth-callback?code=${encodeURIComponent(code)}&redirect_uri=${encodeURIComponent('https://smart-meal-planner-multi.vercel.app/kroger/callback')}`;
          
          // First try the fetch API to get the response
          console.log("Sending code to backend:", authCallbackUrl);
          
          try {
            console.log("Using POST method with fetch API");
            
            // Make a POST request to the auth-callback endpoint instead of GET
            const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'https://smartmealplannermulti-production.up.railway.app';
            const postUrl = `${API_BASE_URL}/kroger/auth-callback`;
            
            // Use application/x-www-form-urlencoded content type as per OAuth 2.0 standards
            const response = await fetch(postUrl, {
              method: 'POST',
              credentials: 'include',
              headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/x-www-form-urlencoded'
              },
              body: new URLSearchParams({
                code: code,
                redirect_uri: 'https://smart-meal-planner-multi.vercel.app/kroger/callback',
                grant_type: 'authorization_code',
                state: 'from-frontend'
              })
            });
            
            if (!response.ok) {
              throw new Error(`Backend responded with status ${response.status}`);
            }
            
            const data = await response.json();
            console.log("Backend auth response:", data);
            
            // Mark as connected in localStorage
            localStorage.setItem('kroger_connected', 'true');
            
            // Set success state
            setStatus('success');
            setMessage(data.message || 'Kroger account connected successfully!');
            
            // Redirect to cart page after short delay
            setTimeout(() => {
              navigate('/cart');
            }, 2000);
            
            return;
          } catch (fetchError) {
            console.error("Error using fetch API:", fetchError);
            
            // Try one more approach with axios
            try {
              console.log("Trying axiosInstance from apiService");
              const { axiosInstance } = await import('../services/apiService');
              
              // Use URLSearchParams to ensure proper format for OAuth 2.0
              const params = new URLSearchParams();
              params.append('code', code);
              params.append('redirect_uri', 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
              params.append('grant_type', 'authorization_code');
              params.append('state', 'from-frontend');
              
              const response = await axiosInstance.post('/kroger/auth-callback', params, {
                headers: {
                  'Content-Type': 'application/x-www-form-urlencoded'
                }
              });
              
              console.log("Axios response:", response.data);
              
              // Mark as connected in localStorage
              localStorage.setItem('kroger_connected', 'true');
              
              // Set success state
              setStatus('success');
              setMessage(response.data.message || 'Kroger account connected successfully!');
              
              // Redirect to cart page after short delay
              setTimeout(() => {
                navigate('/cart');
              }, 2000);
              
              return;
            } catch (axiosError) {
              console.error("Error using axios:", axiosError);
              
              // Last resort: use the apiService directly
              try {
                console.log("Trying apiService.exchangeKrogerAuthCode");
                const apiService = await import('../services/apiService').then(m => m.default);
                
                const result = await apiService.exchangeKrogerAuthCode(code);
                console.log("apiService response:", result);
                
                // Mark as connected in localStorage
                localStorage.setItem('kroger_connected', 'true');
                
                // Set success state
                setStatus('success');
                setMessage(result.message || 'Kroger account connected successfully!');
                
                // Redirect to cart page after short delay
                setTimeout(() => {
                  navigate('/cart');
                }, 2000);
                
                return;
              } catch (apiServiceError) {
                console.error("All auth methods failed:", apiServiceError);
                throw apiServiceError; // Re-throw to be caught by outer catch
              }
            }
          }
        } catch (err) {
          console.error("Error processing auth code:", err);
          setStatus('error');
          setError(`Failed to process authentication: ${err.message}`);
        }
      };
      
      processKrogerAuthCode();
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
      }, 2000);
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