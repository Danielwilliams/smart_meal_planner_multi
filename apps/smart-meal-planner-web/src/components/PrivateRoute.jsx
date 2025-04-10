import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  
  // Check if we're in the client signup flow - if so, don't redirect
  const inClientSignup = localStorage.getItem('in_client_signup') === 'true';
  
  // Check if the current path is part of the client invitation flow
  const isClientInvitationFlow = 
    location.pathname === '/client-signup' || 
    location.pathname === '/accept-invitation';

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
  
  // Don't redirect if we're in client signup flow or on client invitation pages
  if (!isAuthenticated && (inClientSignup || isClientInvitationFlow)) {
    return children;
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

export default PrivateRoute;