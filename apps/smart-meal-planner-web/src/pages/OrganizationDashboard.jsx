// src/pages/OrganizationDashboard.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Container, Typography, Paper, Box, Button, TextField, 
  Grid, Card, CardContent, CardActions, Divider, Tabs,
  Tab, Alert, CircularProgress, Dialog, DialogTitle,
  DialogContent, DialogActions, Snackbar, Chip
} from '@mui/material';
import { 
  Add as AddIcon,
  Email as EmailIcon,
  Person as PersonIcon,
  Menu as MenuIcon,
  Share as ShareIcon,
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';
import apiService from '../services/apiService';

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
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState('');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [sharedMenus, setSharedMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Redirect if not authenticated or not an organization account
  useEffect(() => {
    if (user && user.account_type !== 'organization') {
      navigate('/home');
    }
  }, [user, navigate]);
  
  // Fetch shared menus
  useEffect(() => {
    const fetchSharedMenus = async () => {
      try {
        setLoading(true);
        // Check if API method exists
        if (typeof apiService.getSharedMenus === 'function') {
          const response = await apiService.getSharedMenus();
          setSharedMenus(response || []);
        }
      } catch (err) {
        console.error('Error fetching shared menus:', err);
        setError('Failed to load shared menus');
      } finally {
        setLoading(false);
      }
    };
    
    if (user && user.account_type === 'organization') {
      fetchSharedMenus();
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
    
    // Make sure we have the organization object and ID
    if (!organization || !organization.id) {
      setInviteError('Organization information not available. Please refresh the page.');
      return;
    }
    
    // Log the organization object for debugging
    console.log('Using organization:', organization);
    
    // Call the API directly with organization ID
    const response = await apiService.inviteClient(organization.id, inviteEmail.trim());
    
    setSnackbarMessage('Invitation sent successfully');
    setSnackbarOpen(true);
    handleCloseInviteDialog();
  } catch (err) {
    console.error('Invite error:', err);
    setInviteError(err.response?.data?.detail || err.message || 'Failed to send invitation');
  } finally {
    setInviteLoading(false);
  }
};

  const handleViewClient = (clientId) => {
    navigate(`/organization/clients/${clientId}`);
  };

  const handleCreateMenu = (clientId) => {
    navigate(`/menu?clientId=${clientId}`);
  };

  const handleShareMenu = (clientId) => {
    navigate(`/menu?clientId=${clientId}`);
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
          <Tab label="Shared Menus" icon={<MenuIcon />} />
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
                      <Box sx={{ mt: 1 }}>
                        <Chip 
                          label={client.role || 'Client'} 
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
                        onClick={() => handleViewClient(client.id)}
                      >
                        View Profile
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => handleCreateMenu(client.id)}
                      >
                        Create Menu
                      </Button>
                      <Button 
                        size="small" 
                        onClick={() => handleShareMenu(client.id)}
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

      {/* Shared Menus Tab */}
      {tabValue === 1 && (
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
              sharedMenus.map((menu) => (
                <Grid item xs={12} md={6} key={menu.menu_id}>
                  <Card>
                    <CardContent>
                      <Typography variant="h6">
                        {menu.nickname || `Menu from ${new Date(menu.created_at).toLocaleDateString()}`}
                      </Typography>
                      <Typography variant="body2" color="text.secondary">
                        Shared with: {menu.shared_with_name || menu.client_name || 'Client'}
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
                        onClick={() => navigate(`/menu?menuId=${menu.menu_id}`)}
                      >
                        View Menu
                      </Button>
                      <Button 
                        size="small" 
                        color="primary"
                        startIcon={<ShareIcon />}
                        onClick={() => navigate(`/menu?menuId=${menu.menu_id}&share=true`)}
                      >
                        Manage Sharing
                      </Button>
                    </CardActions>
                  </Card>
                </Grid>
              ))
            )}
          </Grid>
        </>
      )}

      {/* Settings Tab */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Typography variant="h6" gutterBottom>
            Organization Settings
          </Typography>
          <Typography variant="body1" paragraph>
            Manage your organization profile and subscription.
          </Typography>
          <Button 
            variant="contained" 
            onClick={() => navigate('/preferences-page')}
          >
            Update Profile
          </Button>
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