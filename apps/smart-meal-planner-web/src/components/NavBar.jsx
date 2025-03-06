import React from 'react';
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
import { useOrganization } from '../context/OrganizationContext';


function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const { organization, isOwner } = useOrganization();

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