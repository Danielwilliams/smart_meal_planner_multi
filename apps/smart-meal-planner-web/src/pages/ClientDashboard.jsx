import React, { useState, useEffect, useContext } from 'react';
import { 
  Box, 
  Typography, 
  Container, 
  Grid, 
  Card, 
  CardContent, 
  CardMedia, 
  CardActions,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  Chip
} from '@mui/material';
import { useNavigate } from 'react-router-dom';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
import FastfoodIcon from '@mui/icons-material/Fastfood';
import apiService from '../services/apiService';
import { OrganizationContext } from '../context/OrganizationContext';
import { useAuth } from '../context/AuthContext';

const ClientDashboard = () => {
  const navigate = useNavigate();
  const { organization } = useContext(OrganizationContext);
  const { user, updateUser } = useAuth();
  const [sharedMenus, setSharedMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [savedRecipes, setSavedRecipes] = useState([]);

  useEffect(() => {
    const fetchClientData = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Use the new client dashboard endpoint which will fetch everything at once
        const dashboardResponse = await apiService.getClientDashboard();
        
        console.log('🏠 ClientDashboard: Received dashboard response:', dashboardResponse);
        
        if (dashboardResponse) {
          setSharedMenus(dashboardResponse.shared_menus || []);
          setSavedRecipes(dashboardResponse.shared_recipes || []);
          
          // Check if the dashboard response includes organization data
          if (dashboardResponse.organization && user?.account_type === 'client') {
            console.log('🏠 ClientDashboard: Found organization data, updating user context:', dashboardResponse.organization);
            
            // Update the user context with organization information
            updateUser({
              organization_id: dashboardResponse.organization.id,
              organization: dashboardResponse.organization
            });
          }
        }
      } catch (err) {
        console.error('Error fetching client data:', err);
        setError('Failed to load your data. Please try again later.');
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientData();
  }, []);

  const handleViewMenu = (menuId) => {
    // Use the regular menu display path with menuId parameter
    console.log(`Navigating to menu display with menu ID: ${menuId}`);
    // Check if user is client
    const isClient = user?.role === 'client' || user?.account_type === 'client';
    navigate(`/menu-display/${menuId}${isClient ? '?source=client' : ''}`);
  };
  
  const handleViewGroceryList = (menuId) => {
    console.log(`Navigating to grocery list with menu ID: ${menuId}`);
    // Use the shopping-list path which is the component that handles grocery lists
    navigate(`/shopping-list/${menuId}?source=client`);
  };

  const handleBrowseRecipes = () => {
    navigate('/recipes');
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="70vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 8 }}>
      <Box sx={{ mb: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          My Dashboard
        </Typography>
        
        {user?.account_type === 'client' && organization && (
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            You are a client of <strong>{organization.name}</strong>
          </Typography>
        )}
        
        {error && (
          <Alert severity="error" sx={{ mt: 2, mb: 2 }}>
            {error}
          </Alert>
        )}
      </Box>
      
      {/* Actions */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <MenuBookIcon fontSize="large" color="primary" />
                <Typography variant="h5" component="h2" ml={1}>
                  Browse Recipes
                </Typography>
              </Box>
              <Typography variant="body2">
                Explore our recipe collection and find meals that match your preferences.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                color="primary" 
                fullWidth
                onClick={handleBrowseRecipes}
              >
                Browse Recipes
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <FastfoodIcon fontSize="large" color="primary" />
                <Typography variant="h5" component="h2" ml={1}>
                  My Menus
                </Typography>
              </Box>
              <Typography variant="body2">
                View meal plans shared with you by your nutrition expert.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                color="primary" 
                fullWidth
                disabled={sharedMenus.length === 0}
                onClick={() => sharedMenus.length > 0 && handleViewMenu(sharedMenus[0].menu_id || sharedMenus[0].id)}
              >
                {sharedMenus.length === 0 ? 'No Menus Available' : 'View Latest Menu'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
        
        <Grid item xs={12} md={4}>
          <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            <CardContent sx={{ flexGrow: 1 }}>
              <Box display="flex" alignItems="center" mb={2}>
                <ShoppingCartIcon fontSize="large" color="primary" />
                <Typography variant="h5" component="h2" ml={1}>
                  Shopping List
                </Typography>
              </Box>
              <Typography variant="body2">
                Generate shopping lists from your meal plans and send to grocery stores.
              </Typography>
            </CardContent>
            <CardActions>
              <Button 
                size="small" 
                color="primary" 
                fullWidth
                disabled={sharedMenus.length === 0}
                onClick={() => sharedMenus.length > 0 && handleViewGroceryList(sharedMenus[0].menu_id || sharedMenus[0].id)}
              >
                {sharedMenus.length === 0 ? 'No Lists Available' : 'View Shopping List'}
              </Button>
            </CardActions>
          </Card>
        </Grid>
      </Grid>
      
      {/* Shared Menus Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          My Meal Plans
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {sharedMenus.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            You don't have any meal plans yet. Your nutrition expert will share them with you when ready.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {sharedMenus.map((menu) => (
              <Grid item xs={12} sm={6} md={4} key={menu.menu_id || menu.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {menu.title || menu.nickname || menu.name || "Meal Plan"}
                    </Typography>
                    
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mb: 1 }}>
                      <Chip 
                        size="small" 
                        label={`${menu.meal_count || menu.duration || 7} days`} 
                        color="primary" 
                        variant="outlined" 
                      />
                      {menu.shared_at && (
                        <Chip 
                          size="small" 
                          label={`Shared: ${new Date(menu.shared_at).toLocaleDateString()}`} 
                          color="secondary" 
                          variant="outlined" 
                        />
                      )}
                      {menu.organization_name && (
                        <Chip 
                          size="small" 
                          label={`By: ${menu.organization_name}`} 
                          variant="outlined" 
                        />
                      )}
                    </Box>
                    
                    <Typography variant="body2" color="text.secondary">
                      {menu.description || menu.message || "A personalized meal plan created for you."}
                    </Typography>
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      color="primary"
                      onClick={() => handleViewMenu(menu.menu_id || menu.id)}
                    >
                      View Menu
                    </Button>
                    <Button 
                      size="small" 
                      color="secondary"
                      onClick={() => handleViewGroceryList(menu.menu_id || menu.id)}
                    >
                      Shopping List
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Box>
      
      {/* Saved Recipes Section */}
      <Box sx={{ mb: 4 }}>
        <Typography variant="h5" component="h2" gutterBottom>
          My Saved Recipes
        </Typography>
        <Divider sx={{ mb: 2 }} />
        
        {savedRecipes.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            You haven't saved any recipes yet. Browse recipes to find and save your favorites.
          </Typography>
        ) : (
          <Grid container spacing={3}>
            {savedRecipes.slice(0, 6).map((recipe) => (
              <Grid item xs={12} sm={6} md={4} key={recipe.id}>
                <Card sx={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
                  <CardMedia
                    component="img"
                    height="140"
                    image={recipe.image_url || "https://via.placeholder.com/300x140?text=Recipe"}
                    alt={recipe.recipe_name || "Recipe"}
                  />
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {recipe.recipe_name || "Recipe"}
                    </Typography>
                    
                    {recipe.notes && (
                      <Typography variant="body2" color="text.secondary">
                        {recipe.notes}
                      </Typography>
                    )}
                  </CardContent>
                  <CardActions>
                    <Button 
                      size="small" 
                      color="primary"
                      onClick={() => navigate(`/recipes/${recipe.scraped_recipe_id}`)}
                    >
                      View Recipe
                    </Button>
                  </CardActions>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
        
        {savedRecipes.length > 6 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
            <Button 
              variant="outlined" 
              color="primary"
              onClick={() => navigate('/saved-recipes')}
            >
              View All Saved Recipes ({savedRecipes.length})
            </Button>
          </Box>
        )}
      </Box>
    </Container>
  );
};

export default ClientDashboard;