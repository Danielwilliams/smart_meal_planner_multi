// src/components/NavBar.jsx
import React, { useState, useEffect } from 'react';
import { 
  AppBar, 
  Toolbar, 
  Typography, 
  Button, 
  Box,
  Chip,
  Menu,
  MenuItem,
  IconButton,
  Divider,
  Tooltip
} from '@mui/material';
import { 
  AccountCircle as AccountIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Check if the user has an organization account
  const isOrgAccount = user?.account_type === 'organization';
  
  // Fetch organization data directly in this component
  useEffect(() => {
    // Only fetch if the user is authenticated
    if (isAuthenticated && user) {
      const fetchOrgData = async () => {
        try {
          // Only try to fetch organization data if user is an organization account
          if (isOrgAccount) {
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
            } else if (typeof apiService.getUserOrganizations === 'function') {
              // Try another alternate method name
              const orgResponse = await apiService.getUserOrganizations();
              if (orgResponse && orgResponse.length > 0) {
                setOrganization(orgResponse[0]);
              }
            } else {
              console.error('No organization API method found');
            }
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
  }, [isAuthenticated, user, isOrgAccount]);

  const handleLogout = () => {
    logout();
    navigate('/login');
    setMenuAnchorEl(null);
  };

  const handleMenuOpen = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleMobileMenuToggle = () => {
    setMobileMenuOpen(!mobileMenuOpen);
  };

  return (
    <AppBar position="static">
      <Toolbar>
        {/* Logo/Title Area */}
        <Typography 
          variant="h6" 
          component={Link} 
          to="/"
          sx={{ 
            flexGrow: 1, 
            textDecoration: 'none', 
            color: 'inherit',
            display: 'flex',
            alignItems: 'center'
          }}
        >
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

        {/* Mobile Menu Toggle (only displayed on small screens) */}
        <Box sx={{ display: { xs: 'block', md: 'none' } }}>
          <IconButton 
            color="inherit" 
            aria-label="menu"
            onClick={handleMobileMenuToggle}
          >
            <MenuIcon />
          </IconButton>
        </Box>

        {/* Desktop Navigation Links */}
        <Box sx={{ display: { xs: mobileMenuOpen ? 'flex' : 'none', md: 'flex' }, flexDirection: { xs: 'column', md: 'row' } }}>
          {isAuthenticated ? (
            <>
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
              
              {/* Organization navigation - only show for organization accounts */}
              {isOrgAccount && (
                <Button 
                  color="inherit" 
                  component={Link} 
                  to="/organization/dashboard"
                >
                  Manage Organization
                </Button>
              )}
              
              {/* User Menu */}
              <Tooltip title={user?.name || "Account"}>
                <IconButton 
                  color="inherit" 
                  aria-label="account"
                  onClick={handleMenuOpen}
                  sx={{ ml: 1 }}
                >
                  <AccountIcon />
                </IconButton>
              </Tooltip>
              <Menu
                anchorEl={menuAnchorEl}
                open={Boolean(menuAnchorEl)}
                onClose={handleMenuClose}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
              >
                <MenuItem disabled>
                  <Box sx={{ display: 'flex', flexDirection: 'column' }}>
                    <Typography variant="body1">{user?.name || 'User'}</Typography>
                    <Typography variant="body2" color="textSecondary">
                      {user?.email || ''}
                    </Typography>
                    <Typography variant="caption" color="primary">
                      {user?.account_type === 'organization' ? 'Organization Account' : 'Individual Account'}
                    </Typography>
                  </Box>
                </MenuItem>
                <Divider />
                <MenuItem onClick={() => { handleMenuClose(); navigate('/preferences-page'); }}>
                  <PersonIcon sx={{ mr: 1 }} fontSize="small" />
                  Profile Settings
                </MenuItem>
                {isOrgAccount && (
                  <MenuItem onClick={() => { handleMenuClose(); navigate('/organization/dashboard'); }}>
                    <DashboardIcon sx={{ mr: 1 }} fontSize="small" />
                    Organization Dashboard
                  </MenuItem>
                )}
                <Divider />
                <MenuItem onClick={handleLogout}>
                  <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
                  Logout
                </MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button color="inherit" component={Link} to="/">
                Home
              </Button>
              <Button color="inherit" component={Link} to="/login">
                Login
              </Button>
              <Button color="inherit" component={Link} to="/signup">
                Sign Up
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
}

export default NavBar;