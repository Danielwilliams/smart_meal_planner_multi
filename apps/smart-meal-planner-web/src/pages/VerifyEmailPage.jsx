import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, Typography, CircularProgress, Box, Button, ButtonGroup, Alert } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import apiService from '../services/apiService';

const VerifyEmailPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState('loading');
  const [message, setMessage] = useState('');
  const [hasInvitation, setHasInvitation] = useState(false);
  
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
        
        // Check if there's a pending invitation in localStorage
        const invitationToken = localStorage.getItem('invitation_token');
        const orgId = localStorage.getItem('invitation_org_id');
        
        if (invitationToken && orgId) {
          setHasInvitation(true);
        }
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
              
              {hasInvitation && (
                <Alert severity="info" sx={{ my: 2, textAlign: 'left' }}>
                  You have a pending invitation to join an organization. Please login to complete the connection.
                </Alert>
              )}
              
              <ButtonGroup orientation="vertical" fullWidth sx={{ mt: 2 }}>
                <Button 
                  variant="contained" 
                  onClick={() => navigate('/login')}
                  color="primary"
                >
                  Proceed to Login
                </Button>
                
                {hasInvitation && (
                  <Button 
                    variant="outlined"
                    onClick={() => {
                      const token = localStorage.getItem('invitation_token');
                      const orgId = localStorage.getItem('invitation_org_id');
                      navigate(`/login?invitation=true&token=${token}&org=${orgId}`);
                    }}
                    sx={{ mt: 1 }}
                    color="secondary"
                  >
                    Login & Connect to Organization
                  </Button>
                )}
              </ButtonGroup>
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