import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Paper, 
  Typography, 
  Button,
  Box,
  Alert,
  CircularProgress,
  Divider,
  Card,
  CardContent,
  Link
} from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

// Helper function to parse query parameters
function useQuery() {
  return new URLSearchParams(useLocation().search);
}

const ClientInvitationConnect = () => {
  const query = useQuery();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useAuth();
  
  // Get token and org from URL parameters
  const token = query.get('token') || localStorage.getItem('invitation_token');
  const orgId = query.get('org') || localStorage.getItem('invitation_org_id');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [orgName, setOrgName] = useState('');
  const [invitationValid, setInvitationValid] = useState(false);
  const [connectionComplete, setConnectionComplete] = useState(false);

  useEffect(() => {
    // Redirect to login if not authenticated
    if (!isAuthenticated) {
      navigate(`/login?invitation=true&token=${token}&org=${orgId}`);
      return;
    }
    
    // Store params for persistence across navigation
    if (token) localStorage.setItem('invitation_token', token);
    if (orgId) localStorage.setItem('invitation_org_id', orgId);
    
    // Validate and process the invitation
    const processInvitation = async () => {
      try {
        setLoading(true);
        
        // First check if the invitation is valid
        const invitationInfo = await apiService.checkInvitation(token, orgId);
        if (!invitationInfo.valid) {
          setError('This invitation link is invalid or has expired.');
          setInvitationValid(false);
          setLoading(false);
          return;
        }
        
        setInvitationValid(true);
        
        // Get organization details
        try {
          const orgDetails = await apiService.getOrganizationDetails(orgId);
          setOrgName(orgDetails.name || 'your nutrition provider');
        } catch (err) {
          console.error('Error fetching organization details:', err);
          setOrgName('your nutrition provider');
        }
        
        // Check if user is already connected to this organization
        if (user?.account_type === 'client' && user?.organization_id === parseInt(orgId)) {
          setConnectionComplete(true);
        }
      } catch (err) {
        console.error('Error processing invitation:', err);
        setError('There was a problem with your invitation. Please contact your nutrition provider.');
      } finally {
        setLoading(false);
      }
    };
    
    processInvitation();
  }, [token, orgId, isAuthenticated, navigate, user]);

  const handleAcceptInvitation = async () => {
    try {
      setLoading(true);
      
      // Accept the invitation
      await apiService.acceptInvitation(token, orgId);
      
      // Update user information locally
      const userData = JSON.parse(localStorage.getItem('user') || '{}');
      userData.account_type = 'client';
      userData.organization_id = parseInt(orgId);
      localStorage.setItem('user', JSON.stringify(userData));
      
      setConnectionComplete(true);
    } catch (err) {
      console.error('Error accepting invitation:', err);
      if (err.response?.status === 401) {
        setError('Authentication required. Please try logging in again.');
      } else if (err.response?.data?.detail) {
        setError(`Error: ${err.response.data.detail}`);
      } else {
        setError('Failed to connect to organization. Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoToDashboard = () => {
    navigate('/client-dashboard');
  };

  if (loading) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="body1" sx={{ mt: 2 }}>
          Processing your invitation...
        </Typography>
      </Container>
    );
  }

  if (!invitationValid) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Typography variant="h5" component="h1" align="center" gutterBottom>
            Invalid Invitation
          </Typography>
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error || 'This invitation link is invalid or has expired.'}
          </Alert>
          <Box sx={{ textAlign: 'center', mt: 3 }}>
            <Button 
              variant="contained" 
              component={RouterLink} 
              to="/dashboard"
            >
              Go to Dashboard
            </Button>
          </Box>
        </Paper>
      </Container>
    );
  }

  if (connectionComplete) {
    return (
      <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
        <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
          <Box sx={{ mb: 3, display: 'flex', justifyContent: 'center' }}>
            <Alert severity="success" sx={{ display: 'inline-flex' }}>
              Congratulations! You're all set! 
            </Alert>
          </Box>
          <Typography variant="h6" gutterBottom>
            You're now connected to {orgName}
          </Typography>
          <Typography variant="body1" gutterBottom>
            Your client account has been set up successfully. You can now access your personalized nutrition resources.
          </Typography>
          <Card variant="outlined" sx={{ my: 3, bgcolor: '#f8f9fa' }}>
            <CardContent>
              <Typography variant="subtitle1" gutterBottom>
                What's next?
              </Typography>
              <Box sx={{ textAlign: 'left' }}>
                <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                  • Check your dashboard for meal plans shared by your nutrition provider
                </Typography>
                <Typography component="div" variant="body2" sx={{ mb: 1 }}>
                  • Set your nutrition preferences to get personalized recommendations
                </Typography>
                <Typography component="div" variant="body2">
                  • Explore recipes and create shopping lists
                </Typography>
              </Box>
            </CardContent>
          </Card>
          <Button
            variant="contained"
            color="primary"
            onClick={handleGoToDashboard}
            size="large"
            fullWidth
            sx={{ mt: 3 }}
          >
            Go to Client Dashboard
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="sm" sx={{ mt: 8, mb: 8 }}>
      <Paper elevation={3} sx={{ p: 4, borderRadius: 2 }}>
        <Typography variant="h5" component="h1" align="center" gutterBottom>
          Connect to {orgName}
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Alert severity="info" sx={{ mb: 3 }}>
          You've been invited to join <strong>{orgName}</strong> as a client. Click below to complete the connection.
        </Alert>
        
        <Card variant="outlined" sx={{ mb: 3, bgcolor: '#f8f9fa' }}>
          <CardContent>
            <Typography variant="subtitle1" gutterBottom fontWeight="bold">
              As a client of {orgName}, you'll have access to:
            </Typography>
            <Box component="ul" sx={{ pl: 2 }}>
              <Typography component="li" variant="body2">Personalized meal plans</Typography>
              <Typography component="li" variant="body2">Nutrition-optimized recipes</Typography>
              <Typography component="li" variant="body2">Grocery shopping lists</Typography>
              <Typography component="li" variant="body2">Online grocery ordering integration</Typography>
            </Box>
          </CardContent>
        </Card>
        
        <Button
          variant="contained"
          color="primary"
          onClick={handleAcceptInvitation}
          disabled={loading}
          size="large"
          fullWidth
          sx={{ mt: 2 }}
        >
          {loading ? <CircularProgress size={24} /> : "Connect to Organization"}
        </Button>
      </Paper>
    </Container>
  );
};

export default ClientInvitationConnect;