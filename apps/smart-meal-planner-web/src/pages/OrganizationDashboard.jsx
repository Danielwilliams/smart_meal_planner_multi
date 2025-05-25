// src/pages/OrganizationDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Paper, Box, Button, TextField, 
  Grid, Card, CardContent, CardActions, Divider, Tabs,
  Tab, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Chip, Switch,
  FormControlLabel, Tooltip
} from '@mui/material';
import { 
  Add as AddIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Share as ShareIcon,
  Settings as SettingsIcon,
  Favorite as FavoriteIcon,
  CheckCircle as ActiveIcon,
  Cancel as InactiveIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';
import ClientSavedRecipes from '../components/ClientSavedRecipes';

function OrganizationDashboard() {
  const { user } = useAuth();
  const { 
    organization, 
    clients, 
    loading: orgLoading, 
    error: orgError, 
    isOwner,
    inviteClient 
  } = useOrganization();
  
  const navigate = useNavigate();
  const [tabValue, setTabValue] = useState(0);
  const [selectedClientForRecipes, setSelectedClientForRecipes] = useState(null);
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [sharedMenus, setSharedMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedClient, setSelectedClient] = useState(null);
  const [clientTab, setClientTab] = useState(0);
  const [invitations, setInvitations] = useState([]);
  const [invitationsLoading, setInvitationsLoading] = useState(false);

  // Redirect if not authenticated or not an organization account
  useEffect(() => {
    // Only redirect if user is loaded and not an organization
    if (user && user.account_type && user.account_type !== 'organization') {
      navigate('/home');
    }
  }, [user, navigate]);
  
  // Fetch shared menus
  useEffect(() => {
    const fetchSharedMenus = async () => {
      try {
        setLoading(true);
        
        // Check if API method exists and user is authenticated
        if (typeof apiService.getSharedMenus === 'function' && 
            user && 
            user.account_type === 'organization') {
          
          console.log('Attempting to fetch shared menus for organization user');
          
          // Use try/catch specifically for the API call to isolate errors
          try {
            const response = await apiService.getSharedMenus();
            // Ensure we have a valid array, or default to empty array
            setSharedMenus(Array.isArray(response) ? response : []);
            console.log('Shared menus fetched:', response);
          } catch (apiError) {
            console.error('API error while fetching shared menus:', apiError);
            // Set empty array instead of keeping old state
            setSharedMenus([]);
            setError('Could not load shared menus. Please try again later.');
          }
        } else {
          // If API method doesn't exist or user isn't authenticated
          console.log('Not fetching shared menus - either API method missing or user not org type');
          setSharedMenus([]);
        }
      } catch (err) {
        console.error('Unexpected error in fetchSharedMenus:', err);
        setError('An unexpected error occurred while loading menus');
        setSharedMenus([]);
      } finally {
        setLoading(false);
      }
    };
    
    // Only fetch when we're sure the user object is loaded and valid
    if (user && user.account_type === 'organization') {
      fetchSharedMenus();
    } else {
      // Reset shared menus if user isn't an organization
      setSharedMenus([]);
    }
  }, [user]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleOpenInviteDialog = () => {
    setInviteDialogOpen(true);
    setInviteEmail('');
    setInviteError('');
  };

  const handleCloseInviteDialog = () => {
    setInviteDialogOpen(false);
  };

  const handleSendInvite = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Please enter an email address');
      return;
    } 

    try {
      setInviteLoading(true);
      setInviteError('');
      
      // Fetch organizations if not already loaded
      if (!organization) {
        try {
          const orgs = await apiService.getUserOrganizations();
          if (!orgs || orgs.length === 0) {
            setInviteError('Organization not found. Please set up your organization first.');
            return;
          }
          
          // Use the first organization
          const orgId = orgs[0].id;
          const response = await apiService.inviteClient(orgId, inviteEmail.trim());
          
          setSnackbarMessage('Invitation sent successfully');
          setSnackbarOpen(true);
          handleCloseInviteDialog();
          // Refresh invitations list if we're on the invitations tab
          if (tabValue === 1) {
            loadInvitations();
          }
        } catch (orgErr) {
          console.error('Error fetching organization:', orgErr);
          setInviteError('Failed to load organization data. Please refresh the page.');
        }
      } else {
        // Use existing organization
        const response = await apiService.inviteClient(organization.id, inviteEmail.trim());
        
        setSnackbarMessage('Invitation sent successfully');
        setSnackbarOpen(true);
        handleCloseInviteDialog();
        // Refresh invitations list if we're on the invitations tab
        if (tabValue === 1) {
          loadInvitations();
        }
      }
    } catch (err) {
      console.error('Invite error:', err);
      setInviteError(err.response?.data?.detail || err.message || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const loadInvitations = async () => {
    if (!organization?.id) return;
    
    try {
      setInvitationsLoading(true);
      const response = await apiService.listInvitations(organization.id);
      setInvitations(response.invitations || []);
    } catch (error) {
      console.error('Error loading invitations:', error);
      setError('Failed to load invitations');
    } finally {
      setInvitationsLoading(false);
    }
  };

  const handleResendInvitation = async (invitationId) => {
    try {
      await apiService.resendInvitation(invitationId);
      setSnackbarMessage('Invitation resent successfully');
      setSnackbarOpen(true);
      loadInvitations(); // Refresh the list
    } catch (error) {
      console.error('Error resending invitation:', error);
      setSnackbarMessage('Failed to resend invitation');
      setSnackbarOpen(true);
    }
  };

  // Load invitations when organization changes or tab switches to invitations
  useEffect(() => {
    if (organization?.id && tabValue === 1) {
      loadInvitations();
    }
  }, [organization?.id, tabValue]);

  const handleViewClient = (client) => {
    // Set the selected client to show details in the dashboard
    setSelectedClient(client);
    setClientTab(0); // Default to profile tab
  };

  const handleCreateMenu = (client) => {
    // Option 1: Navigate to client profile page
    // navigate(`/organization/clients/${client.id}`);
    
    // Option 2: Show client details and select the saved recipes tab
    setSelectedClient(client);
    setClientTab(1); // Set to saved recipes tab
  };

  const handleShareMenu = (clientId) => {
    // Navigate to client profile page, then tab to the menus section
    navigate(`/organization/clients/${clientId}`, { state: { initialTab: 1 } });
  };
  
  const handleClientTabChange = (event, newValue) => {
    setClientTab(newValue);
  };
  
  const handleCloseClientDetails = () => {
    setSelectedClient(null);
  };

  const handleClientStatusToggle = async (client) => {
    try {
      const newStatus = client.status === 'active' ? 'inactive' : 'active';
      
      await apiService.updateClientStatus(organization.id, client.id, newStatus);
      
      setSnackbarMessage(
        `${client.name} has been ${newStatus === 'active' ? 'activated' : 'deactivated'} successfully`
      );
      setSnackbarOpen(true);
      
      // Refresh the clients list - this should happen automatically via OrganizationContext
      // but we can trigger a manual refresh if needed
      window.location.reload(); // Simple refresh for now
      
    } catch (err) {
      console.error('Error updating client status:', err);
      setSnackbarMessage(`Failed to update ${client.name}'s status`);
      setSnackbarOpen(true);
    }
  };

  if (loading || orgLoading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Just show the standard organization dashboard that focuses on client management
  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {organization?.name || user?.name || 'Organization Dashboard'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {organization?.description || 'Manage your clients and meal plans'}
        </Typography>
      </Box>

      {(error || orgError) && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error || orgError}
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
          <Tab label="Clients" icon={<PersonIcon />} />
          <Tab label="Invitations" icon={<EmailIcon />} />
          <Tab label="Shared Menus" icon={<MenuIcon />} />
          <Tab label="Client Recipes" icon={<FavoriteIcon />} />
          <Tab label="Settings" icon={<SettingsIcon />} />
        </Tabs>
      </Paper>

      {/* Clients Tab */}
      {tabValue === 0 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">
              Clients ({clients?.length || 0})
            </Typography>
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={handleOpenInviteDialog}
            >
              Invite Client
            </Button>
          </Box>

          <Grid container spacing={3}>
            {!clients || clients.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1">
                    No clients yet. Invite your first client to get started.
                  </Typography>
                </Paper>
              </Grid>
            ) : (
              clients.map((client) => (
                <Grid item xs={12} md={6} lg={4} key={client.id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">
                        {client.name}
                      </Typography>
                      <Typography color="text.secondary">
                        {client.email}
                      </Typography>
                      <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Chip 
                          label={client.role || 'Client'} 
                          size="small"
                          color="primary"
                          variant="outlined"
                        />
                        <Chip 
                          icon={client.status === 'active' ? <ActiveIcon /> : <InactiveIcon />}
                          label={client.status === 'active' ? 'Active' : 'Inactive'} 
                          size="small"
                          color={client.status === 'active' ? 'success' : 'error'}
                          variant="outlined"
                        />
                      </Box>
                      <Box sx={{ mt: 2 }}>
                        <Tooltip title={`${client.status === 'active' ? 'Deactivate' : 'Activate'} client account`}>
                          <FormControlLabel
                            control={
                              <Switch
                                checked={client.status === 'active'}
                                onChange={() => handleClientStatusToggle(client)}
                                size="small"
                              />
                            }
                            label={client.status === 'active' ? 'Active' : 'Inactive'}
                            labelPlacement="start"
                          />
                        </Tooltip>
                      </Box>
                    </CardContent>
                    <Divider />
                    <CardActions>
                      <Button 
                        size="small" 
                        onClick={() => navigate(`/organization/clients/${client.id}/preferences`)}
                      >
                        Set Preferences
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => handleViewClient(client)}
                      >
                        Manage Profile
                      </Button>
                      <Button 
                        size="small" 
                        color="primary"
                        variant="contained"
                        onClick={() => handleCreateMenu(client)}
                      >
                        Create Menu
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </>
      )}

      {/* Invitations Tab */}
      {tabValue === 1 && (
        <Box>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">
              Client Invitations
            </Typography>
            <Button
              variant="contained"
              startIcon={<EmailIcon />}
              onClick={handleOpenInviteDialog}
            >
              Send Invitation
            </Button>
          </Box>

          {invitationsLoading ? (
            <Box display="flex" justifyContent="center" p={4}>
              <CircularProgress />
            </Box>
          ) : (
            <Grid container spacing={2}>
              {invitations.length === 0 ? (
                <Grid item xs={12}>
                  <Card>
                    <CardContent sx={{ textAlign: 'center', py: 6 }}>
                      <EmailIcon sx={{ fontSize: 64, color: 'text.secondary', mb: 2 }} />
                      <Typography variant="h6" color="text.secondary" gutterBottom>
                        No invitations sent yet
                      </Typography>
                      <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                        Start by sending your first client invitation
                      </Typography>
                      <Button
                        variant="contained"
                        startIcon={<EmailIcon />}
                        onClick={handleOpenInviteDialog}
                      >
                        Send First Invitation
                      </Button>
                    </CardContent>
                  </Card>
                </Grid>
              ) : (
                invitations.map((invitation) => (
                  <Grid item xs={12} md={6} lg={4} key={invitation.id}>
                    <Card>
                      <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                          <Typography variant="h6" sx={{ wordBreak: 'break-word' }}>
                            {invitation.email}
                          </Typography>
                          <Chip
                            label={invitation.status}
                            color={
                              invitation.status === 'accepted' ? 'success' :
                              invitation.status === 'pending' ? 'warning' : 'default'
                            }
                            size="small"
                          />
                        </Box>

                        {invitation.user_name && (
                          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                            Name: {invitation.user_name}
                          </Typography>
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Sent: {new Date(invitation.created_at).toLocaleDateString()}
                        </Typography>

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                          Expires: {new Date(invitation.expires_at).toLocaleDateString()}
                        </Typography>

                        {invitation.is_expired && (
                          <Chip label="Expired" color="error" size="small" sx={{ mb: 1 }} />
                        )}

                        {invitation.is_attached && (
                          <Chip label="Client Active" color="success" size="small" sx={{ mb: 1 }} />
                        )}

                        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                          Status: {invitation.user_exists ? 'Account Created' : 'Pending Signup'} 
                          {invitation.is_attached && ' • Attached to Organization'}
                        </Typography>
                      </CardContent>

                      <CardActions>
                        {invitation.status === 'pending' && !invitation.is_expired && (
                          <Button
                            size="small"
                            onClick={() => handleResendInvitation(invitation.id)}
                            startIcon={<EmailIcon />}
                          >
                            Resend
                          </Button>
                        )}
                        {invitation.is_expired && (
                          <Button
                            size="small"
                            onClick={() => handleResendInvitation(invitation.id)}
                            startIcon={<EmailIcon />}
                            color="warning"
                          >
                            Send New Invitation
                          </Button>
                        )}
                      </CardActions>
                    </Card>
                  </Grid>
                ))
              )}
            </Grid>
          )}
        </Box>
      )}

      {/* Shared Menus Tab */}
      {tabValue === 2 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">
              Shared Menus ({sharedMenus.length})
            </Typography>
          </Box>
          
          <Grid container spacing={3}>
            {sharedMenus.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1">
                    You haven't shared any menus yet. Create a menu and share it with your clients.
                  </Typography>
                  <Button 
                    variant="contained" 
                    color="primary" 
                    sx={{ mt: 2 }}
                    onClick={() => navigate('/menu')}
                  >
                    Create Menu
                  </Button>
                </Paper>
              </Grid>
            ) : (
              sharedMenus.map((menu, index) => {
                // Ensure menu has id and created_at, with fallbacks
                const menuId = menu.menu_id || menu.id || `menu-${index}`;
                let dateStr = 'Menu';
                try {
                  // Try to format the date safely
                  if (menu.created_at) {
                    dateStr = `Menu from ${new Date(menu.created_at).toLocaleDateString()}`;
                  } else if (menu.date) {
                    dateStr = `Menu from ${new Date(menu.date).toLocaleDateString()}`;
                  }
                } catch (e) {
                  console.warn('Error formatting date:', e);
                }
                
                return (
                  <Grid item xs={12} md={6} key={menuId}>
                    <Card>
                      <CardContent>
                        <Typography variant="h6">
                          {menu.shared_with_name || menu.client_name || 'Client'}
                        </Typography>
                        <Typography variant="body2" color="text.secondary">
                          {menu.nickname || dateStr}
                        </Typography>
                        <Box sx={{ mt: 1 }}>
                          <Chip 
                            label={menu.permission_level || 'Read'} 
                            size="small"
                            color="primary"
                            variant="outlined"
                          />
                        </Box>
                      </CardContent>
                      <Divider />
                      <CardActions>
                        <Button 
                          size="small" 
                          onClick={() => navigate(`/menu?menuId=${menuId}`)}
                        >
                          View Menu
                        </Button>
                        <Button 
                          size="small" 
                          color="primary"
                          startIcon={<ShareIcon />}
                          onClick={() => navigate(`/menu?menuId=${menuId}&share=true`)}
                        >
                          Manage Sharing
                        </Button>
                      </CardActions>
                    </Card>
                  </Grid>
                );
              })
            )}
          </Grid>
        </>
      )}

      {/* Client Recipes Tab */}
      {tabValue === 3 && (
        <>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
            <Typography variant="h5">
              Client Saved Recipes
            </Typography>
          </Box>
          
          {!clients || clients.length === 0 ? (
            <Paper sx={{ p: 3, textAlign: 'center' }}>
              <Typography variant="body1">
                You don't have any clients yet. Invite clients to see their saved recipes here.
              </Typography>
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                sx={{ mt: 2 }}
                onClick={handleOpenInviteDialog}
              >
                Invite Client
              </Button>
            </Paper>
          ) : (
            <>
              {!selectedClientForRecipes ? (
                <Paper sx={{ p: 3 }}>
                  <Typography variant="h6" gutterBottom>
                    Select a Client
                  </Typography>
                  <Typography variant="body1" paragraph>
                    Choose a client to view their saved recipes:
                  </Typography>
                  <Grid container spacing={2}>
                    {clients.map((client) => (
                      <Grid item xs={12} sm={6} md={4} key={client.id}>
                        <Card sx={{ 
                          cursor: 'pointer', 
                          '&:hover': { boxShadow: 6 },
                          height: '100%'
                        }}>
                          <CardContent onClick={() => setSelectedClientForRecipes(client)}>
                            <Typography variant="h6">
                              {client.name}
                            </Typography>
                            <Typography color="text.secondary">
                              {client.email}
                            </Typography>
                          </CardContent>
                          <CardActions>
                            <Button 
                              fullWidth
                              variant="contained"
                              onClick={() => setSelectedClientForRecipes(client)}
                            >
                              View Recipes
                            </Button>
                          </CardActions>
                        </Card>
                      </Grid>
                    ))}
                  </Grid>
                </Paper>
              ) : (
                <Box>
                  <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 2 }}>
                    <Button 
                      variant="outlined"
                      onClick={() => setSelectedClientForRecipes(null)}
                    >
                      ← Back to Client Selection
                    </Button>
                  </Box>
                  <ClientSavedRecipes 
                    clientId={selectedClientForRecipes.id} 
                    clientName={selectedClientForRecipes.name} 
                  />
                </Box>
              )}
            </>
          )}
        </>
      )}

      {/* Settings Tab */}
      {tabValue === 4 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Organization Settings
          </Typography>
          <Typography variant="body1" paragraph>
            Manage your organization settings, default client preferences, and client management options.
          </Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6}>
              <Button 
                variant="contained" 
                fullWidth
                startIcon={<SettingsIcon />}
                onClick={() => navigate('/organization/settings')}
                sx={{ mb: 2 }}
              >
                Organization Settings
              </Button>
            </Grid>
            <Grid item xs={12} sm={6}>
              <Button 
                variant="outlined" 
                fullWidth
                onClick={() => navigate('/preferences-page')}
                sx={{ mb: 2 }}
              >
                Update Personal Profile
              </Button>
            </Grid>
          </Grid>
          <Box sx={{ mt: 2 }}>
            <Typography variant="body2" color="text.secondary">
              • Set default preferences for new clients<br/>
              • Configure client management settings<br/>
              • Update organization contact information
            </Typography>
          </Box>
        </Paper>
      )}

      {/* Invite Client Dialog */}
      <Dialog open={inviteDialogOpen} onClose={handleCloseInviteDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Invite Client</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            margin="dense"
            label="Email Address"
            type="email"
            fullWidth
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            error={!!inviteError}
            helperText={inviteError}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseInviteDialog}>
            Cancel
          </Button>
          <Button 
            onClick={handleSendInvite} 
            variant="contained"
            disabled={inviteLoading}
            startIcon={inviteLoading ? <CircularProgress size={20} /> : <EmailIcon />}
          >
            Send Invitation
          </Button>
        </DialogActions>
      </Dialog>

      {/* Client Details Panel - shown when a client is selected */}
      {selectedClient && (
        <Dialog
          open={!!selectedClient}
          onClose={handleCloseClientDetails}
          maxWidth="lg"
          fullWidth
        >
          <DialogTitle>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Typography variant="h6">
                Client: {selectedClient.name}
              </Typography>
              <Button
                variant="outlined"
                onClick={handleCloseClientDetails}
              >
                Close
              </Button>
            </Box>
          </DialogTitle>
          <DialogContent dividers>
            <Paper sx={{ mb: 3 }}>
              <Tabs
                value={clientTab}
                onChange={handleClientTabChange}
                indicatorColor="primary"
                textColor="primary"
                variant="fullWidth"
              >
                <Tab label="Profile" icon={<PersonIcon />} />
                <Tab label="Saved Recipes" icon={<FavoriteIcon />} />
                <Tab label="Menus" icon={<MenuIcon />} />
              </Tabs>
            </Paper>

            {/* Profile Tab */}
            {clientTab === 0 && (
              <Paper sx={{ p: 3 }}>
                <Grid container spacing={3}>
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Contact Information
                    </Typography>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="body1">
                        <strong>Name:</strong> {selectedClient.name}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Email:</strong> {selectedClient.email}
                      </Typography>
                      <Typography variant="body1">
                        <strong>Role:</strong> {selectedClient.role || 'Client'}
                      </Typography>
                    </Box>
                    
                    <Box sx={{ mt: 3 }}>
                      <Button
                        variant="contained"
                        onClick={() => navigate(`/organization/clients/${selectedClient.id}/preferences`)}
                      >
                        Manage Preferences
                      </Button>
                    </Box>
                  </Grid>
                  
                  <Grid item xs={12} md={6}>
                    <Typography variant="h6" gutterBottom>
                      Actions
                    </Typography>
                    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                      <Button 
                        variant="outlined" 
                        startIcon={<MenuIcon />}
                        onClick={() => navigate(`/organization/clients/${selectedClient.id}`)}
                      >
                        View Full Profile
                      </Button>
                      
                      <Button 
                        variant="outlined" 
                        color="primary"
                        startIcon={<AddIcon />}
                        onClick={() => navigate(`/menu?clientId=${selectedClient.id}`)}
                      >
                        Create New Menu
                      </Button>
                      
                      <Button 
                        variant="outlined" 
                        color="secondary"
                        startIcon={<ShareIcon />}
                        onClick={() => navigate(`/organization/clients/${selectedClient.id}`, { state: { initialTab: 1 } })}
                      >
                        Manage Shared Menus
                      </Button>
                    </Box>
                  </Grid>
                </Grid>
              </Paper>
            )}

            {/* Saved Recipes Tab */}
            {clientTab === 1 && (
              <ClientSavedRecipes 
                clientId={selectedClient.id} 
                clientName={selectedClient.name} 
              />
            )}

            {/* Menus Tab */}
            {clientTab === 2 && (
              <Paper sx={{ p: 3, textAlign: 'center' }}>
                <Typography variant="h6" gutterBottom>
                  Client Menus
                </Typography>
                <Typography variant="body1" paragraph>
                  This feature will allow you to view and manage all menus created for this client.
                </Typography>
                <Button
                  variant="contained"
                  onClick={() => navigate(`/organization/clients/${selectedClient.id}`, { state: { initialTab: 1 } })}
                >
                  Go to Client Menus
                </Button>
              </Paper>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Snackbar notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  );
}

export default OrganizationDashboard;