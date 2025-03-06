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

  const inviteClient = async (email