// meal_planner_frontend/web/src/pages/KrogerAuthCallback.jsx
import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Box, Typography } from '@mui/material';
import apiService from '../services/apiService';

function KrogerAuthCallback() {
  const [searchParams] = useSearchParams();
  const [message, setMessage] = useState('Exchanging token...');
  
  useEffect(() => {
    const code = searchParams.get('code');
    if (!code) {
      setMessage('No code provided');
      return;
    }
    // Option 1: direct exchange from frontend:
    // Option 2: call your backend /kroger/callback?code=..., let backend do the exchange
    // For now, let's do a simple approach:
    const doExchange = async () => {
      try {
        const resp = await apiService.exchangeKrogerAuthCode(code);
        setMessage(`Success! Access token: ${resp.access_token}`);
      } catch (err) {
        setMessage(`Error exchanging code: ${err.message}`);
      }
    };
    doExchange();
  }, [searchParams]);

  return (
    <Box sx={{ p: 2 }}>
      <Typography variant="h5">Kroger Authorization</Typography>
      <Typography variant="body1" sx={{ mt: 2 }}>
        {message}
      </Typography>
    </Box>
  );
}

export default KrogerAuthCallback;
