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
  Share as ShareIcon
  Settings as SettingsIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import { useOrganization } from '../context/OrganizationContext';

function OrganizationDashboard() {
  const { user } = useAuth();
  const { 
    organization, 
    clients, 
    loading, 
    error, 
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

  // Redirect if not authenticated
   // Redirect individual users who try to access this page directly
  useEffect(() => {
    if (user && user.account_type === 'individual') {
      navigate('/home');
    }
  }, [user, navigate]);

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
      
      const response = await inviteClient(inviteEmail.trim());
      
      setSnackbarMessage('Invitation sent successfully');
      setSnackbarOpen(true);
      handleCloseInviteDialog();
    } catch (err) {
      setInviteError(err.response?.data?.detail || 'Failed to send invitation');
    } finally {
      setInviteLoading(false);
    }
  };

  const handleViewClient = (clientId) => {
    navigate(`/clients/${clientId}`);
  };

  const handleCreateMenu = (clientId) => {
    navigate(`/menu/create?clientId=${clientId}`);
  };

  const handleShareMenu = (clientId) => {
    navigate(`/menu/share?clientId=${clientId}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  // Organization creation UI if no organization exists
  if (!organization) {
    return (
      <Container maxWidth="md">
        <Typography variant="h4" gutterBottom>
          Create Your Organization
        </Typography>
        <Paper sx={{ p: 3, mt: 2 }}>
          <Typography variant="body1" paragraph>
            Create an organization to manage your clients and share meal plans.
          </Typography>
          <Button 
            variant="contained" 
            color="primary"
            onClick={() => navigate('/organization/create')}
          >
            Create Organization
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg">
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" gutterBottom>
          {organization.name}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          {organization.description}
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
              Clients ({clients.length})
            </Typography>
            {isOwner && (
              <Button
                variant="contained"
                startIcon={<AddIcon />}
                onClick={handleOpenInviteDialog}
              >
                Invite Client
              </Button>
            )}
          </Box>

          <Grid container spacing={3}>
            {clients.length === 0 ? (
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
                          label={client.role} 
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