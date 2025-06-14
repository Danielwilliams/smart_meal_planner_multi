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
        // Exit early if user isn't authenticated or isn't an organization account
        if (!isAuthenticated || !user) {
          console.log('Not authenticated or no user data, clearing org data');
          setOrganization(null);
          setClients([]);
          setIsOwner(false);
          return;
        }
        
        if (user.account_type !== 'organization' && user.account_type !== 'client') {
          console.log('User is not an organization or client account, clearing org data. Account type:', user.account_type);
          setOrganization(null);
          setClients([]);
          setIsOwner(false);
          return;
        }

        // Handle client accounts - they need their organization's data too
        if (user.account_type === 'client') {
          console.log('CLIENT ACCOUNT - setting up organization data for client:', user);
          
          // For clients, the organization data should be in the user object from login
          if (user.organization && user.organization.id) {
            console.log('Client has organization data in user object:', user.organization);
            setOrganization(user.organization);
            setIsOwner(false); // Clients are not owners
            setClients([]); // Clients don't see other clients
            setLoading(false);
            return;
          } else if (user.organization_id) {
            console.log('Client has organization ID, fetching details:', user.organization_id);
            try {
              setLoading(true);
              setError(null);
              
              const orgResponse = await apiService.getOrganizationDetails(user.organization_id);
              if (orgResponse && !orgResponse.error) {
                console.log('Successfully fetched organization for client:', orgResponse);
                setOrganization(orgResponse);
                setIsOwner(false); // Clients are not owners
                setClients([]); // Clients don't see other clients
                return;
              }
            } catch (error) {
              console.error('Error fetching organization for client:', error);
            } finally {
              setLoading(false);
            }
          }
          
          console.log('Client has no organization data, clearing org context');
          setOrganization(null);
          setClients([]);
          setIsOwner(false);
          return;
        }

        try {
          setLoading(true);
          setError(null);
          
          console.log('Fetching organization data for user:', user.userId || user.id);
          
          // Get user's organization info - try with additional error handling
          try {
            const orgResponse = await apiService.getUserOrganizations();
            console.log('Organization response:', orgResponse);
            
            // Handle case when API returns null or undefined
            if (!orgResponse) {
              console.warn('Received null/undefined organization response');
              setOrganization(null);
              setClients([]);
              return;
            }
            
            // Handle both array and object responses
            if (Array.isArray(orgResponse) && orgResponse.length > 0) {
              const userOrg = orgResponse[0];
              setOrganization(userOrg);
              
              // Compare using both userId and id for compatibility
              const userId = user.userId || user.id;
              const isOwnerOfOrg = userOrg.owner_id === userId;
              console.log('Checking ownership:', { orgOwnerId: userOrg.owner_id, userId, isOwner: isOwnerOfOrg });
              setIsOwner(isOwnerOfOrg);
              
              // Get an org ID even if format varies
              const orgId = userOrg.id || userOrg.organization_id;
              
              // Fetch clients only if we have a valid organization
              if (orgId) {
                fetchOrganizationClients(orgId);
              } else {
                console.warn('No organization ID found in response');
                setClients([]);
              }
            } else if (!Array.isArray(orgResponse) && orgResponse.id) {
              // Handle case when API returns a single organization object
              setOrganization(orgResponse);
              const userId = user.userId || user.id;
              setIsOwner(orgResponse.owner_id === userId);
              
              if (orgResponse.id) {
                fetchOrganizationClients(orgResponse.id);
              } else {
                console.warn('No organization ID found in response');
                setClients([]);
              }
            } else {
              console.log('No organizations found for user');
              setOrganization(null);
              setClients([]);
            }
          } catch (orgErr) {
            console.error('Failed to fetch organizations:', orgErr);
            setError('Failed to load organization data');
            setOrganization(null);
            setClients([]);
          }
        } catch (err) {
          console.error('Error in organization data fetch:', err);
          setError('Failed to load organization data');
          setOrganization(null);
          setClients([]);
        } finally {
          setLoading(false);
        }
      };
      
      // Helper function to fetch organization clients with consistent error handling
      const fetchOrganizationClients = async (orgId) => {
        console.log(`Fetching clients for organization ID: ${orgId}`);
        if (!orgId) {
          console.error('No organization ID provided for client fetch');
          setClients([]);
          return;
        }
        
        try {
          const clientsResponse = await apiService.getOrganizationClients(orgId);
          
          // Handle different response formats
          if (clientsResponse && clientsResponse.clients && Array.isArray(clientsResponse.clients)) {
            console.log(`Found ${clientsResponse.clients.length} clients in response.clients`);
            setClients(clientsResponse.clients);
          } else if (Array.isArray(clientsResponse)) {
            console.log(`Found ${clientsResponse.length} clients in array response`);
            setClients(clientsResponse);
          } else if (clientsResponse && typeof clientsResponse === 'object') {
            // Try to find any array property that might contain clients
            const possibleClientArrays = Object.entries(clientsResponse)
              .filter(([key, value]) => Array.isArray(value) && value.length > 0)
              .sort(([, a], [, b]) => b.length - a.length); // Sort by array length
            
            if (possibleClientArrays.length > 0) {
              const [arrayName, clientArray] = possibleClientArrays[0];
              console.log(`Using ${arrayName} with ${clientArray.length} items as clients`);
              setClients(clientArray);
            } else {
              console.warn('No client arrays found in response:', clientsResponse);
              setClients([]);
            }
          } else {
            console.warn('Unexpected clients response format:', clientsResponse);
            setClients([]);
          }
        } catch (clientErr) {
          console.error(`Error fetching clients for org ID ${orgId}:`, clientErr);
          setClients([]);
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

  const refreshClients = async () => {
    try {
      if (!organization) {
        console.log('No organization available for client refresh');
        return;
      }
      
      console.log('Refreshing clients for organization:', organization.id);
      const clientsResponse = await apiService.getOrganizationClients(organization.id);
      
      if (clientsResponse && clientsResponse.clients && Array.isArray(clientsResponse.clients)) {
        console.log(`Refreshed ${clientsResponse.clients.length} clients`);
        setClients(clientsResponse.clients);
      } else if (Array.isArray(clientsResponse)) {
        console.log(`Refreshed ${clientsResponse.length} clients`);
        setClients(clientsResponse);
      } else {
        console.warn('Unexpected format from client refresh');
        setClients([]);
      }
    } catch (err) {
      console.error('Error refreshing clients:', err);
      setError('Failed to refresh clients');
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
    shareMenuWithClient,
    refreshClients
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