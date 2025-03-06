// Modified NavBar.jsx with correct apiService method
import React, { useState, useEffect } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box,
  Chip 
} from '@mui/material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  
  // Fetch organization data directly in this component
  useEffect(() => {
    // Only fetch if the user is authenticated
    if (isAuthenticated && user) {
      const fetchOrgData = async () => {
        try {
          // Check if the method exists before calling it
          if (typeof apiService.getOrganizations === 'function') {
            const orgResponse = await apiService.getOrganizations();
            if (orgResponse && orgResponse.length > 0) {
              setOrganization(orgResponse[0]);
            }
          } else if (typeof apiService.getUserOrganization === 'function') {
            // Try alternate method name
            const orgResponse = await apiService.getUserOrganization();
            if (orgResponse) {
              setOrganization(orgResponse);
            }
          } else {
            console.error('No organization API method found');
          }
        } catch (err) {
          console.error('Error fetching organization data in NavBar:', err);
        }
      };
      
      fetchOrgData();
    } else {
      // Reset organization when not authenticated
      setOrganization(null);
    }
  }, [isAuthenticated, user]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography variant="h6" sx={{ flexGrow: 1 }}>
          Smart Meal Planner
          {organization && (
            <Chip
              label={organization.name}
              size="small"
              color="secondary"
              sx={{ ml: 1 }}
            />
          )}
          
        </Typography>
        {isAuthenticated ? (
          <Box>
            <Button color="inherit" component={Link} to="/">
              Home
            </Button>
            <Button color="inherit" component={Link} to="/menu">
              Menu
            </Button>
            <Button color="inherit" component={Link} to="/shopping-list">
              Shopping List
            </Button>
            <Button color="inherit" component={Link} to="/cart">
              Cart
            </Button>
            <Button color="inherit" component={Link} to="/saved-recipes">
              Saved Recipes
            </Button>
            <Button color="inherit" component={Link} to="/preferences-page">
              Preferences
            </Button>
            
            {/* Add organization navigation */}
            <Button 
              color="inherit" 
              component={Link} 
              to={organization ? "/organization/dashboard" : "/organization/create"}
            >
              {organization ? "Organization" : "Create Organization"}
            </Button>
            
            <Button color="inherit" onClick={handleLogout}>
              Logout
            </Button>
          </Box>
        ) : (
          <Box>
            <Button color="inherit" component={Link} to="/">
              Home
            </Button>
            <Button color="inherit" component={Link} to="/login">
              Login
            </Button>
            <Button color="inherit" component={Link} to="/signup">
              Sign Up
            </Button>
          </Box>
        )}
      </Toolbar>
    </AppBar>
  );
}

export default NavBar;