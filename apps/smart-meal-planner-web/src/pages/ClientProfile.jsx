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
  Settings as SettingsIcon,
  Add as AddIcon,
  ShoppingCart as CartIcon,
  Share as ShareIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import ClientMenuGenerator from '../components/ClientMenuGenerator';

function ClientProfile() {
  const { clientId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [client, setClient] = useState(null);
  const [clientMenus, setClientMenus] = useState([]);
  const [clientPreferences, setClientPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [tabValue, setTabValue] = useState(0);
  const [menuGenerated, setMenuGenerated] = useState(false);

  useEffect(() => {
    const fetchClientData = async () => {
      if (!clientId) return;

      try {
        setLoading(true);
        setError(null);

        // Get client details
        const clientData = await apiService.getClientDetails(clientId);
        setClient(clientData);

        // Get client's preferences
        try {
          const clientPrefs = await apiService.getUserPreferences(clientId);
          setClientPreferences(clientPrefs);
        } catch (prefErr) {
          console.log('Client preferences not found:', prefErr);
          // Don't set error for this - it's normal for new clients not to have preferences
        }

        // Get client's menus
        try {
          const clientMenusData = await apiService.getClientMenus(clientId);
          setClientMenus(clientMenusData || []);
        } catch (menuErr) {
          console.log('Client menus not found:', menuErr);
          // Don't set error for this - it's normal for clients not to have menus yet
        }
      } catch (err) {
        console.error('Error fetching client data:', err);
        setError('Failed to load client data');
      } finally {
        setLoading(false);
      }
    };

    fetchClientData();
  }, [clientId, menuGenerated]);

  const handleTabChange = (event, newValue) => {
    setTabValue(newValue);
  };

  const handleEditPreferences = () => {
    navigate(`/organization/clients/${clientId}/preferences`);
  };

  const handleViewMenu = (menuId) => {
    navigate(`/menu/${menuId}`);
  };

  const handleShareMenu = (menuId) => {
    navigate(`/menu/${menuId}/share`);
  };

  const handleViewCart = () => {
    navigate(`/cart?clientId=${clientId}`);
  };

  const handleMenuGenerated = (newMenu) => {
    setMenuGenerated(true);
    // Refresh the menus list
    setTimeout(() => {
      apiService.getClientMenus(clientId)
        .then(menus => {
          setClientMenus(menus || []);
          setMenuGenerated(false);
        })
        .catch(err => {
          console.error('Error refreshing menus:', err);
          setMenuGenerated(false);
        });
    }, 1000);
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
          <Tab label="Menus" icon={<MenuIcon />} />
          <Tab label="Preferences" icon={<SettingsIcon />} />
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
              </CardContent>
              <CardActions>
                <Button
                  startIcon={<CartIcon />}
                  onClick={handleViewCart}
                >
                  View Client's Cart
                </Button>
              </CardActions>
            </Card>
          </Grid>
          
          <Grid item xs={12} md={6}>
            <Card>
              <CardContent>
                <Typography variant="h6" gutterBottom>
                  Client Preferences
                </Typography>
                {clientPreferences ? (
                  <>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Diet Type:</Typography>
                      <Typography variant="body1">
                        {clientPreferences.diet_type || 'Not specified'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Dietary Restrictions:</Typography>
                      <Typography variant="body1">
                        {clientPreferences.dietary_restrictions || 'None'}
                      </Typography>
                    </Box>
                    <Box sx={{ mb: 2 }}>
                      <Typography variant="subtitle2">Calorie Goal:</Typography>
                      <Typography variant="body1">
                        {clientPreferences.calorie_goal || 'Not specified'} kcal/day
                      </Typography>
                    </Box>
                  </>
                ) : (
                  <Typography variant="body1">
                    No preferences set
                  </Typography>
                )}
              </CardContent>
              <CardActions>
                <Button
                  size="small"
                  onClick={handleEditPreferences}
                >
                  {clientPreferences ? 'Edit Preferences' : 'Set Preferences'}
                </Button>
              </CardActions>
            </Card>
          </Grid>
        </Grid>
      )}

// Continuing the ClientProfile.jsx file

      {/* Menus Tab */}
      {tabValue === 1 && (
        <>
          <ClientMenuGenerator 
            client={client} 
            onMenuGenerated={handleMenuGenerated}
          />

          <Typography variant="h6" gutterBottom>
            Client's Menus
          </Typography>
          
          <Grid container spacing={3}>
            {clientMenus.length === 0 ? (
              <Grid item xs={12}>
                <Paper sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1">
                    No menus generated for this client yet.
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                    Use the menu generator above to create a personalized meal plan.
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
                      <Typography variant="body2" color="text.secondary">
                        {menu.days_count || 7} days of meals
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
                        startIcon={<ShareIcon />}
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

      {/* Preferences Tab */}
      {tabValue === 2 && (
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
            <Typography variant="h6">
              Nutrition & Dietary Preferences
            </Typography>
            <Button 
              variant="contained"
              onClick={handleEditPreferences}
            >
              {clientPreferences ? 'Edit Preferences' : 'Set Preferences'}
            </Button>
          </Box>
          
          {clientPreferences ? (
            <Grid container spacing={3}>
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">Diet Type:</Typography>
                  <Typography variant="body1">
                    {clientPreferences.diet_type || 'Not specified'}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">Dietary Restrictions:</Typography>
                  <Typography variant="body1">
                    {clientPreferences.dietary_restrictions || 'None'}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">Disliked Ingredients:</Typography>
                  <Typography variant="body1">
                    {clientPreferences.disliked_ingredients || 'None'}
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">Recipe Types:</Typography>
                  <Typography variant="body1">
                    {clientPreferences.recipe_type || 'Not specified'}
                  </Typography>
                </Box>
              </Grid>
              
              <Grid item xs={12} md={6}>
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">Nutrition Goals:</Typography>
                  <Typography variant="body1">
                    Calories: {clientPreferences.calorie_goal || 2000} kcal/day
                  </Typography>
                  <Typography variant="body1">
                    Protein: {clientPreferences.macro_protein || 40}%
                  </Typography>
                  <Typography variant="body1">
                    Carbs: {clientPreferences.macro_carbs || 30}%
                  </Typography>
                  <Typography variant="body1">
                    Fat: {clientPreferences.macro_fat || 30}%
                  </Typography>
                </Box>
                
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle1">Meal Configuration:</Typography>
                  <Typography variant="body1">
                    Meal Times: {
                      Object.entries(clientPreferences.meal_times || {})
                        .filter(([_, enabled]) => enabled)
                        .map(([meal]) => meal.charAt(0).toUpperCase() + meal.slice(1))
                        .join(', ') || 'Not specified'
                    }
                  </Typography>
                  <Typography variant="body1">
                    Servings Per Meal: {clientPreferences.servings_per_meal || 1}
                  </Typography>
                  {clientPreferences.meal_times?.snacks && (
                    <Typography variant="body1">
                      Snacks Per Day: {clientPreferences.snacks_per_day || 0}
                    </Typography>
                  )}
                </Box>
              </Grid>
            </Grid>
          ) : (
            <Alert severity="info">
              No preferences have been set for this client yet. Click "Set Preferences" to configure this client's dietary needs and preferences.
            </Alert>
          )}
        </Paper>
      )}

      <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
        <Button 
          variant="outlined" 
          onClick={() => navigate('/organization/dashboard')}
        >
          Back to Dashboard
        </Button>
      </Box>
    </Container>
  );
}

export default ClientProfile;