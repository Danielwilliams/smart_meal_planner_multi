// src/pages/ClientProfile.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Paper,
  Box,
  CircularProgress,
  Alert,
  Tabs,
  Tab,
  Button,
  Card,
  CardContent,
  CardActions,
  Grid,
  Divider
} from '@mui/material';
import {
  Person as PersonIcon,
  RestaurantMenu as MenuIcon,
  PlaylistAdd as PlaylistAddIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';

function ClientProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { organization, isOwner } = useOrganization();
  
  const [client, setClient] = useState(null);
  const [clientMenus, setClientMenus] = useState([]);
  const [sharedMenus, setSharedMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId || !organization) return;

      try {
        setLoading(true);
        setError(null);

        // Get client details
        const clientData = await apiService.getClientDetails(clientId);
        setClient(clientData);

        // Get menus shared with this client
        const sharedMenusData = await apiService.getMenusSharedWithClient(clientId);
        setSharedMenus(sharedMenusData || []);

        // If we're the organization owner, get client's own menus
        if (isOwner) {
          const clientMenusData = await apiService.getClientMenus(clientId);
          setClientMenus(clientMenusData || []);
        }
      } catch (err) {
        console.error('Error fetching client data:', err);
        setError('Failed to load client data');
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [clientId, organization, isOwner]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleCreateMenu = () => {
    navigate(`/menu/create?clientId=${clientId}`);
  };

  const handleViewMenu = (menuId) => {
    navigate(`/menu/${menuId}?clientId=${clientId}`);
  };

  const handleShareMenu = (menuId) => {
    navigate(`/menu/${menuId}/share?clientId=${clientId}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!client) {
    return (
      <Container maxWidth="md">
        <Alert severity="error">Client not found or you don't have access</Alert>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/organization/dashboard')}
          sx={{ mt: 2 }}
        >
          Back to Dashboard
        </Button>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {client.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {client.email}
        </Typography>
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

      <Paper sx={{ mb: 4 }}>
        <Tabs 
          value={tabValue} 
          onChange={handleTabChange}
          indicatorColor="primary"
          textColor="primary"
          variant="fullWidth"
        >
          <Tab label="Profile" icon={<PersonIcon />} />
          <Tab label="Shared Menus" icon={<MenuIcon />} />
          {isOwner && <Tab label="Client's Menus" icon={<PlaylistAddIcon />} />}
        </Tabs>
      </Paper>

      {/* Profile Tab */}
      {tabValue === 0 && (
        <Grid container spacing={3}>
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Client Information
                </Typography>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Name:</Typography>
                  <Typography variant="body1">{client.name}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Email:</Typography>
                  <Typography variant="body1">{client.email}</Typography>
                </Box>
                <Box sx={{ mb: 2 }}>
                  <Typography variant="subtitle2">Organization Role:</Typography>
                  <Typography variant="body1">{client.role || 'Client'}</Typography>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Client Preferences
                </Typography>
                {client.preferences ? (
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Diet Type:</Typography>
                      <Typography variant="body1">
                        {client.preferences.diet_type || 'Not specified'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Dietary Restrictions:</Typography>
                      <Typography variant="body1">
                        {client.preferences.dietary_restrictions || 'None'}
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body1">
                    No preferences set
                  </Typography>
                )}
              </CardContent>
              {isOwner && (
                <CardActions>
                  <Button size="small" onClick={() => navigate(`/clients/${clientId}/preferences`)}>
                    Edit Preferences
                  </Button>
                </CardActions>
              )}
            </Card>
          </Grid>
        </Grid>
      )}

      {/* Shared Menus Tab */}
      {tabValue === 1 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">
              Shared Menus ({sharedMenus.length})
            </Typography>
            {isOwner && (
              <Button
                variant="contained"
                startIcon={<ShareIcon />}
                onClick={() => navigate(`/menu/share?clientId=${clientId}`)}
              >
                Share Menu
              </Button>
            )}
          </Box>

          <Grid container spacing={3}>
            {sharedMenus.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1">
                    No menus have been shared with this client yet.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              sharedMenus.map((menu) => (
                <Grid item xs={12} md={6} key={menu.menu_id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">
                        {menu.nickname || `Menu from ${new Date(menu.created_at).toLocaleDateString()}`}
                      </Typography>
                      <Typography color="text.secondary">
                        Shared by: {menu.creator_name}
                      </Typography>
                      <Typography variant="body2" sx={{ mt: 1 }}>
                        Permission: {menu.permission_level}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions>
                      <Button 
                        size="small" 
                        onClick={() => handleViewMenu(menu.menu_id)}
                      >
                        View Menu
                      </Button>
                      {isOwner && (
                        <Button 
                          size="small"
                          color="secondary"
                          onClick={() => handleShareMenu(menu.menu_id)}
                        >
                          Manage Sharing
                        </Button>
                      )}
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </>
      )}

      {/* Client's Own Menus Tab (Owner Only) */}
      {isOwner && tabValue === 2 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">
              Client's Menus ({clientMenus.length})
            </Typography>
            <Button
              variant="contained"
              startIcon={<PlaylistAddIcon />}
              onClick={handleCreateMenu}
            >
              Create Menu
            </Button>
          </Box>

          <Grid container spacing={3}>
            {clientMenus.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1">
                    This client hasn't created any menus yet.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              clientMenus.map((menu) => (
                <Grid item xs={12} md={6} key={menu.menu_id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">
                        {menu.nickname || `Menu from ${new Date(menu.created_at).toLocaleDateString()}`}
                      </Typography>
                    </CardContent>
                    <Divider />
                    <CardActions>
                      <Button 
                        size="small" 
                        onClick={() => handleViewMenu(menu.menu_id)}
                      >
                        View Menu
                      </Button>
                      <Button 
                        size="small"
                        onClick={() => handleShareMenu(menu.menu_id)}
                      >
                        Share Menu
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </>
      )}
    </Container>
  );
}

export default ClientProfile;