// src/context/OrganizationContext.js
import React, { createContext, useContext, useState, useEffect } from 'react';
import apiService from '../services/apiService';
import { useAuth } from './AuthContext';

const OrganizationContext = createContext();

export const OrganizationProvider = ({ children }) => {
  const { user, isAuthenticated } = useAuth();
  const [organization, setOrganization] = useState(null);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isOwner, setIsOwner] = useState(false);

  useEffect(() => {
    const fetchOrganizationData = async () => {
      if (!isAuthenticated || !user) return;

      try {
        setLoading(true);
        setError(null);
        
        // Get user's organization info
        const orgResponse = await apiService.getUserOrganizations();
        
        if (orgResponse && orgResponse.length > 0) {
          const userOrg = orgResponse[0];
          setOrganization(userOrg);
          setIsOwner(userOrg.owner_id === user.userId);
          
          // If user is owner, fetch clients
          if (userOrg.owner_id === user.userId) {
            const clientsResponse = await apiService.getOrganizationClients(userOrg.id);
            setClients(clientsResponse || []);
          }
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

  const createOrganization = async (orgData) => {
    try {
      setLoading(true);
      const newOrg = await apiService.createOrganization(orgData);
      setOrganization(newOrg);
      setIsOwner(true);
      setClients([]);
      return newOrg;
    } catch (err) {
      setError('Failed to create organization');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const inviteClient = async (email) => {
    try {
      if (!organization) throw new Error('No organization found');
      
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

  return (
    <OrganizationContext.Provider value={{
      organization,
      clients,
      loading,
      error,
      isOwner,
      createOrganization,
      inviteClient,
      addClientToOrganization,
      shareMenuWithClient
    }}>
      {children}
    </OrganizationContext.Provider>
  );
};

export const useOrganization = () => {
  const context = useContext(OrganizationContext);
  if (context === undefined) {
    throw new Error('useOrganization must be used within an OrganizationProvider');
  }
  return context;
};

export default OrganizationContext;