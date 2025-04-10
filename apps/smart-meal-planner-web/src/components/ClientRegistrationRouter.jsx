import React, { useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import ClientSignupPage from '../pages/ClientSignupPage';

/**
 * This component serves as a dedicated router for client registration flows.
 * It ensures that invitation parameters are preserved and passed to the client signup page.
 */
function ClientRegistrationRouter() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  // Extract token and org from URL parameters
  const token = searchParams.get('token');
  const orgId = searchParams.get('org');
  
  useEffect(() => {
    // Store parameters in localStorage for persistence
    if (token) localStorage.setItem('invitation_token', token);
    if (orgId) localStorage.setItem('invitation_org_id', orgId);
    
    // Set client signup flag
    localStorage.setItem('in_client_signup', 'true');
    
    // Log navigation for debugging
    console.log('ClientRegistrationRouter initialized with token:', token, 'and orgId:', orgId);
    
    // Clean up event when unmounting
    return () => {
      localStorage.removeItem('in_client_signup');
    };
  }, [token, orgId]);
  
  // If we don't have token/orgId in URL, try to get from localStorage
  useEffect(() => {
    if (!token && !orgId) {
      const storedToken = localStorage.getItem('invitation_token');
      const storedOrgId = localStorage.getItem('invitation_org_id');
      
      if (storedToken && storedOrgId) {
        // Redirect to the same page but with the parameters in the URL
        navigate(`/client-signup?token=${storedToken}&org=${storedOrgId}`, { replace: true });
      }
    }
  }, [token, orgId, navigate]);
  
  return <ClientSignupPage />;
}

export default ClientRegistrationRouter;