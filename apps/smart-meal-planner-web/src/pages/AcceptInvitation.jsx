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
  Card,
  CardContent,
  Divider
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
  const [invitationEmail, setInvitationEmail] = useState('');
  
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
        
        // Check invitation validity and get associated email
        const invitationCheck = await apiService.checkInvitation(token, orgId);
        if (invitationCheck.valid) {
          setInvitationEmail(invitationCheck.email);
        }
        
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
    // Redirect directly to dedicated client signup
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

  // Always redirect non-authenticated users to the client signup page
  // This solves the issue of the accept-invitation endpoint not working correctly
  useEffect(() => {
    if (!loading && !isAuthenticated && !error) {
      // Force redirect to client signup regardless of invitationEmail status
      navigate(`/client-signup?token=${token}&org=${orgId}`);
    }
  }, [loading, isAuthenticated, token, orgId, navigate, error]);

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md">
      <Typography variant="h4" align="center" gutterBottom sx={{ mt: 4 }}>
        Client Invitation
      </Typography>

      <Paper elevation={3} sx={{ p: 4, mt: 2, borderRadius: 2 }}>
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
            <Typography paragraph>
              You can now access all nutrition plans and resources provided by your nutrition coach.
            </Typography>
            <Button variant="contained" onClick={handleGoToDashboard} fullWidth>
              Go to Dashboard
            </Button>
          </>
        ) : (
          <>
            <Typography variant="h5" align="center" gutterBottom>
              You've been invited to join {organizationName}
            </Typography>
            
            <Divider sx={{ my: 2 }} />
            
            <Card variant="outlined" sx={{ mb: 3, bgcolor: '#f8f9fa' }}>
              <CardContent>
                <Typography variant="subtitle1" gutterBottom fontWeight="bold">
                  As a client of {organizationName}, you'll have access to:
                </Typography>
                <Box component="ul" sx={{ pl: 2 }}>
                  <Typography component="li" variant="body2">Personalized meal plans</Typography>
                  <Typography component="li" variant="body2">Nutrition-optimized recipes</Typography>
                  <Typography component="li" variant="body2">Grocery shopping lists</Typography>
                  <Typography component="li" variant="body2">Online grocery ordering integration</Typography>
                </Box>
              </CardContent>
            </Card>
            
            {isAuthenticated ? (
              <>
                <Typography paragraph>
                  Click the button below to accept the invitation and join this organization as a client.
                </Typography>
                <Button 
                  variant="contained" 
                  fullWidth
                  size="large"
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
                <Typography paragraph variant="h6" align="center">
                  Create a client account to access your nutrition plan
                </Typography>
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, mt: 2 }}>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    size="large"
                    onClick={handleSignUp}
                    fullWidth
                  >
                    Create Client Account
                  </Button>
                  <Typography align="center" variant="body2" sx={{ mt: 1 }}>
                    Already have an account? 
                  </Typography>
                  <Button variant="outlined" onClick={handleLogin}>
                    Sign In with Existing Account
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