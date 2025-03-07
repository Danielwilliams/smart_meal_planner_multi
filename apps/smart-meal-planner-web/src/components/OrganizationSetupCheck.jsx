// src/components/OrganizationSetupCheck.jsx
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

const OrganizationSetupCheck = ({ children }) => {
  const { user, isAuthenticated, accountType } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const checkOrganizationSetup = async () => {
      if (!isAuthenticated || accountType !== 'organization') {
        return;
      }

      try {
        // Check if the user has an organization already set up
        const organizations = await apiService.getUserOrganizations();
        
        if (!organizations || organizations.length === 0) {
          // Redirect to organization setup if none exists
          navigate('/organization/setup', { replace: true });
        }
      } catch (err) {
        console.error('Error checking organization setup:', err);
      }
    };

    checkOrganizationSetup();
  }, [isAuthenticated, accountType, navigate]);

  return children;
};

export default OrganizationSetupCheck;