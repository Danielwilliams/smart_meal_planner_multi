import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, Typography, CircularProgress, Box, Button } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import apiService from '../services/apiService';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  
  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      
      if (!token) {
        setStatus('error');
        setMessage('Invalid verification link');
        return;
      }
      
      try {
        const response = await apiService.verifyEmail(token);
        setStatus('success');
        setMessage(response.message);
      } catch (err) {
        setStatus('error');
        setMessage(err.response?.data?.detail || 'Error verifying email');
      }
    };
    
    verifyEmail();
  }, [searchParams]);
  
  return (
    <Box 
      display="flex" 
      justifyContent="center" 
      alignItems="center" 
      minHeight="100vh"
      bgcolor="#f5f5f5"
    >
      <Card sx={{ maxWidth: 400, width: '100%', m: 2 }}>
        <CardContent sx={{ textAlign: 'center', py: 4 }}>
          {status === 'loading' && (
            <>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="h6">
                Verifying your email...
              </Typography>
            </>
          )}
          
          {status === 'success' && (
            <>
              <CheckCircleIcon 
                sx={{ fontSize: 60, color: 'success.main', mb: 2 }} 
              />
              <Typography variant="h6" gutterBottom>
                Email Verified Successfully!
              </Typography>
              <Typography color="text.secondary" paragraph>
                {message}
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => navigate('/login')}
                sx={{ mt: 2 }}
              >
                Proceed to Login
              </Button>
            </>
          )}
          
          {status === 'error' && (
            <>
              <ErrorIcon 
                sx={{ fontSize: 60, color: 'error.main', mb: 2 }} 
              />
              <Typography variant="h6" gutterBottom>
                Verification Failed
              </Typography>
              <Typography color="error" paragraph>
                {message}
              </Typography>
              <Button 
                variant="contained" 
                onClick={() => navigate('/signup')}
                sx={{ mt: 2 }}
              >
                Back to Sign Up
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </Box>
  );
};

export default VerifyEmailPage;