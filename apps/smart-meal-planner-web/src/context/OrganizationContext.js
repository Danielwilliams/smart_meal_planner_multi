// src/context/OrganizationContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { useAuth } from './AuthContext';

// Create the context
const OrganizationContext = createContext(undefined);

// Provider component
export const OrganizationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
      const fetchOrganizationData = async () => {
        if (!isAuthenticated || !user || user.account_type !== 'organization') return;    

        try {
          setLoading(true);
          setError(null);
          
          // Get user's organization info - use get instead of post
          const orgResponse = await apiService.getUserOrganizations();
          
          console.log('Organization response:', orgResponse);
          
          if (orgResponse && orgResponse.length > 0) {
            const userOrg = orgResponse[0];
            setOrganization(userOrg);
            setIsOwner(userOrg.owner_id === user.userId);
            
            // Fetch clients only if we have a valid organization
            if (userOrg.id) {
              try {
                const clientsResponse = await apiService.getOrganizationClients(userOrg.id);
                setClients(clientsResponse || []);
              } catch (clientErr) {
                console.error('Error fetching clients:', clientErr);
              }
            }
          } else {
            console.log('No organizations found for user');
          }
        } catch (err) {
          console.error('Error fetching organization data:', err);
          setError('Failed to load organization data');
        } finally {
          setLoading(false);
        }
      };

  fetchOrganizationData();
}, [isAuthenticated, user]);

  const inviteClient = async (email) => {
    try {
      if (!organization) {
        throw new Error('No organization found');
      }
      
      setLoading(true);
      const response = await apiService.inviteClient(organization.id, email);
      return response;
    } catch (err) {
      setError('Failed to invite client');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const addClientToOrganization = async (clientId, role = 'client') => {
    try {
      if (!organization) throw new Error('No organization found');
      
      setLoading(true);
      await apiService.addClientToOrganization(organization.id, clientId, role);
      
      // Refresh client list
      const clientsResponse = await apiService.getOrganizationClients(organization.id);
      setClients(clientsResponse || []);
      
      return true;
    } catch (err) {
      setError('Failed to add client');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const shareMenuWithClient = async (menuId, clientId, permissionLevel = 'read') => {
    try {
      setLoading(true);
      await apiService.shareMenuWithClient(menuId, clientId, permissionLevel);
      return true;
    } catch (err) {
      setError('Failed to share menu');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  // Create a value object with all the context data
  const contextValue = {
    organization,
    clients,
    loading,
    error,
    isOwner,
    inviteClient,
    addClientToOrganization,
    shareMenuWithClient
  };

  return (
    <OrganizationContext.Provider value={contextValue}>
      {children}
    </OrganizationContext.Provider>
  );
};

// Custom hook to use the context
export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

// Export both named and default for flexibility
export { OrganizationContext };
export default OrganizationContext;