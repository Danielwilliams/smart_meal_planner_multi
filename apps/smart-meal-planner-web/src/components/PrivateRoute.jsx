import React from 'react';
import { Navigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Check if we're in the client signup flow - if so, don't redirect
  const inClientSignup = localStorage.getItem('in_client_signup') === 'true';
  
  // Check if token and org parameters are present (invitation parameters)
  const hasInvitationParams = searchParams.get('token') && searchParams.get('org');
  
  // Check if we have stored invitation parameters
  const hasStoredInvitationParams = 
    localStorage.getItem('invitation_token') && 
    localStorage.getItem('invitation_org_id');
  
  // Check if the current path is part of the client invitation flow
  const isClientInvitationFlow = 
    location.pathname === '/client-signup' || 
    location.pathname === '/accept-invitation' ||
    location.pathname === '/join-as-client' ||
    location.pathname === '/client-registration' ||
    location.pathname === '/connect-to-organization';

  if (loading) {
    return (
      <Box 
        display="flex" 
        justifyContent="center" 
        alignItems="center" 
        height="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }
  
  // Don't redirect if:
  // 1. We're in client signup flow
  // 2. We're on client invitation pages
  // 3. We have invitation parameters in the URL
  // 4. We have stored invitation parameters
  if (!isAuthenticated && (inClientSignup || isClientInvitationFlow || hasInvitationParams || hasStoredInvitationParams)) {
    console.log('Allowing access to protected route without authentication due to client invitation flow');
    return children;
  }

  // For regular protected routes, redirect to login if not authenticated
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default PrivateRoute;