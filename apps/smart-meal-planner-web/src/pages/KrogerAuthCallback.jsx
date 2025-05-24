import React, { useEffect, useState } from 'react';
import { useSearchParams, useLocation, useNavigate } from 'react-router-dom';
import { Container, Typography, Paper, Box, CircularProgress, Alert, Button } from '@mui/material';
import axios from 'axios';
import krogerAuthService from '../services/krogerAuthService';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  
  const [status, setStatus] = useState('processing');
  const [message, setMessage] = useState('Processing Kroger authorization...');
  const [error, setError] = useState(null);
  const [tokenInfo, setTokenInfo] = useState(null);
  
  useEffect(() => {
    console.log("=== KrogerAuthCallback - Processing Auth Response ===");
    console.log("Full URL:", window.location.href);
    
    const code = searchParams.get('code');
    const stateParam = searchParams.get('state');
    const errorMsg = searchParams.get('error');
    
    // Verify state parameter if available
    const storedState = localStorage.getItem('kroger_auth_state');
    const stateValid = stateParam && storedState && stateParam === storedState;
    
    console.log("KrogerAuthCallback params:", { 
      code: code ? `${code.substring(0, 10)}...` : null,
      state: stateParam,
      stateValid,
      error: errorMsg 
    });
    
    // Clear auth pending flag
    localStorage.removeItem('kroger_auth_pending');
    localStorage.removeItem('kroger_auth_state');
    
    // Remove database schema issue flag - we want to try the backend first
    localStorage.removeItem('database_schema_issue');
    
    // Clear any outdated store selection flags to ensure fresh selection if needed
    localStorage.removeItem('kroger_store_selection_done');
    sessionStorage.removeItem('kroger_store_selection_complete');
    
    // Handle Kroger auth code (this is what we expect from Kroger OAuth redirect)
    if (code) {
      const processAuthCode = async () => {
        try {
          // Store auth code for diagnostics
          sessionStorage.setItem('kroger_auth_code', code);
          sessionStorage.setItem('kroger_auth_redirect_uri', process.env.KROGER_REDIRECT_URI || 'https://smart-meal-planner-multi.vercel.app/kroger/callback');
          sessionStorage.setItem('kroger_auth_timestamp', Date.now().toString());
          
          if (stateParam) {
            sessionStorage.setItem('kroger_auth_state_valid', stateValid.toString());
          }
          
          // Mark connected in localStorage as pre-emptive fallback
          localStorage.setItem('kroger_connected', 'true');
          localStorage.setItem('kroger_connected_at', new Date().toISOString());
          localStorage.setItem('kroger_last_auth_code', code.substring(0, 10) + '...');
          
          setMessage('Processing authorization...');
          
          // Try to process the auth code with the backend
          try {
            const processingResult = await krogerAuthService.processAuthCode(
              code, 
              process.env.KROGER_REDIRECT_URI || 'https://smart-meal-planner-multi.vercel.app/kroger/callback'
            );
            
            console.log('Auth code processing result:', processingResult);
            
            if (processingResult.success) {
              setStatus('success');
              setMessage('Kroger authorization successful! Redirecting to cart...');
              
              // Check if we need to select a store
              // First check if a store location is already in the profile
              try {
                const statusCheck = await krogerAuthService.checkKrogerStatus();
                console.log("Checking if store selection is needed:", statusCheck);
                
                if (statusCheck.is_connected && statusCheck.store_location) {
                  // We already have a store location, no need to select again
                  console.log("Store location already set:", statusCheck.store_location);
                  
                  // Set store location in localStorage for client-side use
                  localStorage.setItem('kroger_store_location', statusCheck.store_location);
                  localStorage.setItem('kroger_store_location_id', statusCheck.store_location);
                  localStorage.setItem('kroger_store_selected', 'true');
                  localStorage.setItem('kroger_store_configured', 'true');
                  
                  // Clear any store selection flags
                  sessionStorage.removeItem('kroger_needs_store_selection');
                } else {
                  // Need to select a store
                  console.log("No store location found, will need to select one");
                  sessionStorage.setItem('kroger_needs_store_selection', 'true');
                }
              } catch (statusErr) {
                console.error("Error checking store status:", statusErr);
                // Default to needing store selection if we can't check
                sessionStorage.setItem('kroger_needs_store_selection', 'true');
              }
            } else {
              // Even if backend processing failed, we might still be able to proceed
              setStatus('warning');
              setMessage('Had some issues processing the auth code, but proceeding...');
              
              // Set store selection needed flag
              sessionStorage.setItem('kroger_needs_store_selection', 'true');
            }
          } catch (processingErr) {
            console.error('Error processing auth code:', processingErr);
            
            // Even if processing fails, we can still proceed with client-side fallbacks
            setStatus('warning');
            setMessage('Had issues connecting with Kroger servers. Will proceed anyway...');
            
            // Set store selection needed flag
            sessionStorage.setItem('kroger_needs_store_selection', 'true');
          }
          
          // Clean up any reconnection flags
          localStorage.removeItem('kroger_reconnect_attempted');
          
          // Redirect to cart page after a short delay
          setTimeout(() => {
            navigate('/cart');
          }, 1500);
        } catch (err) {
          console.error('Error in code exchange process:', err);
          
          // Even if there's an error, still set the connected flag and redirect
          // This helps prevent getting stuck in auth loops
          localStorage.setItem('kroger_connected', 'true');
          localStorage.setItem('kroger_connected_at', new Date().toISOString());
          
          setStatus('warning');
          setMessage('Encountered an issue but will proceed to cart anyway...');
          
          setTimeout(() => {
            navigate('/cart');
          }, 2000);
        }
      };
      
      processAuthCode();
    } else if (errorMsg) {
      // Handle error from Kroger OAuth
      console.error('Kroger OAuth error:', errorMsg);
      setStatus('error');
      setError(`Connection failed: ${errorMsg}`);
      
      // Clear any partial connection flags
      localStorage.removeItem('kroger_connected');
      localStorage.removeItem('kroger_connected_at');
      localStorage.removeItem('kroger_reconnect_attempted');
      
      // After 3 seconds, redirect back to cart anyway
      setTimeout(() => {
        navigate('/cart');
      }, 3000);
    } else {
      // Neither code nor error was received
      console.error('No code or error received from Kroger OAuth');
      setStatus('error');
      setError('No authorization code received from Kroger. Please try again.');
      
      // Clear any partial connection flags
      localStorage.removeItem('kroger_connected');
      localStorage.removeItem('kroger_connected_at');
      localStorage.removeItem('kroger_reconnect_attempted');
      
      // After 3 seconds, redirect back to cart anyway
      setTimeout(() => {
        navigate('/cart');
      }, 3000);
    }
  }, [searchParams, location, navigate]);
  
  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 3 }}>
          <Typography variant="h5" gutterBottom align="center">
            {status === 'processing' ? 'Connecting to Kroger...' : 
             status === 'success' ? 'Authorization Received!' : 
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
            <Alert severity="error" sx={{ my: 2 }}>
              {error}
            </Alert>
          )}
          
          {/* Debug info for troubleshooting */}
          {tokenInfo && (
            <Box mt={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
              <Typography variant="subtitle2">Debug Information:</Typography>
              <pre style={{ fontSize: '0.75rem', overflow: 'auto' }}>
                {JSON.stringify(tokenInfo, null, 2)}
              </pre>
            </Box>
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