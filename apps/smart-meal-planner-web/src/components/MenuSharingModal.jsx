// src/components/MenuSharingModal.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Typography,
  List,
  ListItem,
  ListItemText,
  ListItemSecondaryAction,
  Chip,
  IconButton,
  CircularProgress,
  Alert,
  Box
} from '@mui/material';
import {
  Share as ShareIcon,
  Delete as DeleteIcon
} from '@mui/icons-material';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';

function MenuSharingModal({ 
  open, 
  onClose, 
  menuId,
  menuTitle
}) {
  const { clients, organization } = useOrganization();
  
  const [selectedClient, setSelectedClient] = useState('');
  const [permission, setPermission] = useState('read');
  const [sharedWith, setSharedWith] = useState([]);
  const [loading, setLoading] = useState(false);
  const [sharingLoading, setSharingLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  // Fetch existing sharing data when modal opens
  useEffect(() => {
    const fetchSharingData = async () => {
      if (!open || !menuId) return;
      
      try {
        setLoading(true);
        setError(null);
        
        const response = await apiService.getMenuSharingDetails(menuId);
        setSharedWith(response.shared_with || []);
      } catch (err) {
        console.error('Error fetching sharing data:', err);
        setError('Failed to load sharing information');
      } finally {
        setLoading(false);
      }
    };
    
    fetchSharingData();
  }, [open, menuId]);

  const handleShare = async () => {
    if (!selectedClient) return;
    
    try {
      setSharingLoading(true);
      setError(null);
      setSuccess(null);
      
      await apiService.shareMenuWithClient(menuId, selectedClient, permission);
      
      // Refresh the sharing list
      const response = await apiService.getMenuSharingDetails(menuId);
      setSharedWith(response.shared_with || []);
      
      setSuccess('Menu shared successfully');
      setSelectedClient('');
    } catch (err) {
      console.error('Error sharing menu:', err);
      setError(err.response?.data?.detail || 'Failed to share menu');
    } finally {
      setSharingLoading(false);
    }
  };

  const handleRemoveSharing = async (clientId) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);
      
      await apiService.removeMenuSharing(menuId, clientId);
      
      // Update local state to remove the client
      setSharedWith(prev => prev.filter(item => item.client_id !== clientId));
      
      setSuccess('Sharing removed successfully');
    } catch (err) {
      console.error('Error removing sharing:', err);
      setError(err.response?.data?.detail || 'Failed to remove sharing');
    } finally {
      setLoading(false);
    }
  };

  // Filter out clients who already have this menu shared with them
  const availableClients = clients.filter(client => 
    !sharedWith.some(share => share.client_id === client.id)
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Share Menu</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 2 }}>
            {success}
          </Alert>
        )}
        
        <Typography variant="subtitle1" gutterBottom>
          {menuTitle || `Menu #${menuId}`}
        </Typography>
        
        <Box sx={{ display: 'flex', gap: 2, mb: 3, mt: 2 }}>
          <FormControl fullWidth>
            <InputLabel>Client</InputLabel>
            <Select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              label="Client"
              disabled={availableClients.length === 0}
            >
              {availableClients.map((client) => (
                <MenuItem key={client.id} value={client.id}>
                  {client.name}
                </MenuItem>
              ))}
              {availableClients.length === 0 && (
                <MenuItem disabled value="">
                  All clients already have access
                </MenuItem>
              )}
            </Select>
          </FormControl>
          
          <FormControl sx={{ minWidth: 150 }}>
            <InputLabel>Permission</InputLabel>
            <Select
              value={permission}
              onChange={(e) => setPermission(e.target.value)}
              label="Permission"
            >
              <MenuItem value="read">Read Only</MenuItem>
              <MenuItem value="comment">Can Comment</MenuItem>
            </Select>
          </FormControl>
          
          <Button
            variant="contained"
            onClick={handleShare}
            disabled={!selectedClient || sharingLoading}
            startIcon={sharingLoading ? <CircularProgress size={20} /> : <ShareIcon />}
          >
            Share
          </Button>
        </Box>
        
        <Typography variant="subtitle1" gutterBottom>
          Currently Shared With
        </Typography>
        
        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 2 }}>
            <CircularProgress />
          </Box>
        ) : sharedWith.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            This menu isn't shared with anyone yet.
          </Typography>
        ) : (
          <List>
            {sharedWith.map((share) => (
              <ListItem key={share.client_id}>
                <ListItemText
                  primary={share.client_name}
                  secondary={`Permission: ${share.permission_level}`}
                />
                <ListItemSecondaryAction>
                  <IconButton 
                    edge="end" 
                    onClick={() => handleRemoveSharing(share.client_id)}
                    disabled={loading}
                  >
                    <DeleteIcon />
                  </IconButton>
                </ListItemSecondaryAction>
              </ListItem>
            ))}
          </List>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MenuSharingModal;