// src/pages/AcceptInvitation.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  Button,
  CircularProgress,
  Alert,
  Stepper,
  Step,
  StepLabel
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

function AcceptInvitation() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  const [organizationName, setOrganizationName] = useState('');
  
  const token = searchParams.get('token');
  const orgId = searchParams.get('org');

  useEffect(() => {
    const validateInvitation = async () => {
      if (!token || !orgId) {
        setError('Invalid invitation link. Missing token or organization ID.');
        setLoading(false);
        return;
      }

      try {
        // Fetch organization details
        const orgDetails = await apiService.getOrganizationDetails(orgId);
        setOrganizationName(orgDetails.name);
        
        // If user is not authenticated, simply show info but don't try to accept
        if (!isAuthenticated) {
          setLoading(false);
          return;
        }
        
        // If authenticated, attempt to accept the invitation
        await apiService.acceptInvitation(token, orgId);
        setSuccess(true);
      } catch (err) {
        console.error('Error validating invitation:', err);
        setError(err.response?.data?.detail || 'Failed to process invitation');
      } finally {
        setLoading(false);
      }
    };

    validateInvitation();
  }, [token, orgId, isAuthenticated]);

  const handleLogin = () => {
    // Preserve the invitation parameters with a more explicit flow
    navigate(`/login?invitation=true&token=${token}&org=${orgId}`);
  };

  const handleSignUp = () => {
    // Redirect to dedicated client signup
    navigate(`/client-signup?token=${token}&org=${orgId}`);
  };

  const handleGoToDashboard = () => {
    // Redirect to the appropriate dashboard based on account type
    if (user?.account_type === 'client') {
      navigate('/client-dashboard');
    } else {
      navigate('/organization/dashboard');
    }
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md">
      <Typography variant="h4" gutterBottom>
        Organization Invitation
      </Typography>

      <Paper sx={{ p: 4, mt: 2 }}>
        {error ? (
          <>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Button variant="outlined" onClick={() => navigate('/')}>
              Return to Home
            </Button>
          </>
        ) : success ? (
          <>
            <Alert severity="success" sx={{ mb: 3 }}>
              You have successfully joined {organizationName}!
            </Alert>
            <Button variant="contained" onClick={handleGoToDashboard}>
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h5" gutterBottom>
              You've been invited to join {organizationName}
            </Typography>
            
            {isAuthenticated ? (
              <>
                <Typography paragraph>
                  Click the button below to accept the invitation and join this organization.
                </Typography>
                <Button 
                  variant="contained" 
                  onClick={async () => {
                    setLoading(true);
                    try {
                      await apiService.acceptInvitation(token, orgId);
                      setSuccess(true);
                    } catch (err) {
                      setError(err.response?.data?.detail || 'Failed to accept invitation');
                    } finally {
                      setLoading(false);
                    }
                  }}
                >
                  Accept Invitation
                </Button>
              </>
            ) : (
              <>
                <Typography paragraph>
                  You need to sign in or create an account to accept this invitation.
                </Typography>
                <Box sx={{ display: 'flex', gap: 2, mt: 2 }}>
                  <Button variant="contained" onClick={handleLogin}>
                    Sign In
                  </Button>
                  <Button variant="outlined" onClick={handleSignUp}>
                    Create Account
                  </Button>
                </Box>
              </>
            )}
          </>
        )}
      </Paper>
    </Container>
  );
}

export default AcceptInvitation;