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
  Tooltip,
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  ListItemButton,
  useMediaQuery,
  useTheme
} from '@mui/material';
import {
  AccountCircle as AccountIcon,
  Menu as MenuIcon,
  Dashboard as DashboardIcon,
  Person as PersonIcon,
  ExitToApp as LogoutIcon,
  Home as HomeIcon,
  Restaurant as RestaurantIcon,
  List as ListIcon,
  ShoppingCart as CartIcon,
  Bookmark as BookmarkIcon,
  Search as SearchIcon,
  Settings as SettingsIcon,
  AdminPanelSettings as AdminIcon,
  Build as CustomizeIcon,
  Support as SupportIcon,
  Payment as PaymentIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';

function NavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const navigate = useNavigate();
  const [organization, setOrganization] = useState(null);
  const [menuAnchorEl, setMenuAnchorEl] = useState(null);
  const [moreMenuAnchorEl, setMoreMenuAnchorEl] = useState(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  // Check user account types
  const isOrgAccount = user?.account_type === 'organization';
  const isClientAccount = user?.account_type === 'client';
  
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

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Define menu items for the "More" dropdown
  const moreItems = [
    { text: 'Custom Menu', icon: <CustomizeIcon />, path: '/custom-menu-builder' },
    { text: 'Preferences', icon: <SettingsIcon />, path: '/preferences-page' },
    { text: 'Subscription', icon: <PaymentIcon />, path: '/subscription' },
    { text: 'Support', icon: <SupportIcon />, path: '/support' }
  ];

  // Navigation items based on user type
  const getNavItems = () => {
    if (!isAuthenticated) {
      return [
        { text: 'Home', icon: <HomeIcon />, path: '/' },
        { text: 'Login', icon: <PersonIcon />, path: '/login' },
        { text: 'Get Subscription', icon: <PaymentIcon />, path: '/subscription' }
      ];
    }
    
    if (isClientAccount) {
      return [
        { text: 'Dashboard', icon: <DashboardIcon />, path: '/client-dashboard' },
        { text: 'Recipe Browser', icon: <SearchIcon />, path: '/recipes' },
        { text: 'Saved Recipes', icon: <BookmarkIcon />, path: '/saved-recipes' },
        { text: 'Cart', icon: <CartIcon />, path: '/cart' }
      ];
    }
    
    // Items that will appear in both main nav and drawer
    const mainItems = [
      { text: 'Home', icon: <HomeIcon />, path: '/' },
      { text: 'Your Food Journey', icon: <DashboardIcon />, path: '/profile' },
      { text: 'Menu', icon: <RestaurantIcon />, path: '/menu' },
      { text: 'Shopping List', icon: <ListIcon />, path: '/shopping-list' },
      { text: 'Cart', icon: <CartIcon />, path: '/cart' },
      { text: 'Saved Recipes', icon: <BookmarkIcon />, path: '/saved-recipes' },
      { text: 'Recipe Browser', icon: <SearchIcon />, path: '/recipes' }
    ];
    
    const items = [...mainItems, ...moreItems];
    
    if (isOrgAccount || user?.account_type === 'admin') {
      items.push(
        { text: 'Recipe Admin', icon: <AdminIcon />, path: '/recipe-admin' },
        { text: 'Manage Organization', icon: <DashboardIcon />, path: '/organization/dashboard' },
        { text: 'User Management', icon: <PersonIcon />, path: '/organization/users' }
      );
    }
    
    return items;
  };

  return (
    <>
      <AppBar position="static">
        <Toolbar sx={{ flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {/* Logo/Title Area */}
          <Typography
            variant="h6"
            component={Link}
            to="/"
            sx={{
              flexGrow: 0,
              mr: { xs: 0, md: 2 },
              textDecoration: 'none',
              color: 'inherit',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <img
              src="/favicon.ico"
              alt="Smart Meal Planner Logo"
              style={{
                width: 28,
                height: 28,
                marginRight: 8,
                borderRadius: 4
              }}
              onError={(e) => {
                e.target.style.display = 'none';
              }}
            />
            Smart Meal Planner IO
            {organization && !isMobile && (
              <Chip
                label={organization.name}
                size="small"
                color="secondary"
                sx={{ ml: 1 }}
              />
            )}
          </Typography>

          {/* Desktop Navigation Links */}
          {!isMobile && (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
              {isAuthenticated ? (
                <>
                  {/* Client account gets a simplified menu with their dashboard */}
                  {isClientAccount ? (
                    <>
                      <Button color="inherit" component={Link} to="/client-dashboard">
                        Dashboard
                      </Button>
                      <Button color="inherit" component={Link} to="/recipes">
                        Recipe Browser
                      </Button>
                      <Button color="inherit" component={Link} to="/saved-recipes">
                        Saved Recipes
                      </Button>
                      <Button color="inherit" component={Link} to="/cart">
                        Cart
                      </Button>
                    </>
                  ) : (
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
                      <Button color="inherit" component={Link} to="/recipes">
                        Recipe Browser
                      </Button>
                      <Button color="inherit" component={Link} to="/saved-recipes">
                        Saved Recipes
                      </Button>
                      
                      {/* Create a More dropdown for less frequently used items */}
                      <Box sx={{ position: 'relative' }}>
                        <Button 
                          color="inherit" 
                          onClick={(e) => setMoreMenuAnchorEl(e.currentTarget)}
                          endIcon={<MenuIcon fontSize="small" />}
                        >
                          More
                        </Button>
                        <Menu
                          anchorEl={moreMenuAnchorEl}
                          open={Boolean(moreMenuAnchorEl)}
                          onClose={() => setMoreMenuAnchorEl(null)}
                        >
                          {moreItems.map((item) => (
                            <MenuItem 
                              key={item.text}
                              component={Link} 
                              to={item.path}
                              onClick={() => setMoreMenuAnchorEl(null)}
                            >
                              <ListItemIcon>
                                {item.icon}
                              </ListItemIcon>
                              <ListItemText>{item.text}</ListItemText>
                            </MenuItem>
                          ))}
                          
                          {isOrgAccount && (
                            <MenuItem 
                              component={Link} 
                              to="/recipe-admin"
                              onClick={() => setMoreMenuAnchorEl(null)}
                            >
                              <ListItemIcon>
                                <AdminIcon fontSize="small" />
                              </ListItemIcon>
                              <ListItemText>Recipe Admin</ListItemText>
                            </MenuItem>
                          )}
                          
                          {isOrgAccount && (
                            <>
                              <MenuItem 
                                component={Link} 
                                to="/organization/dashboard"
                                onClick={() => setMoreMenuAnchorEl(null)}
                              >
                                <ListItemIcon>
                                  <DashboardIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>Organization</ListItemText>
                              </MenuItem>
                              <MenuItem 
                                component={Link} 
                                to="/organization/users"
                                onClick={() => setMoreMenuAnchorEl(null)}
                              >
                                <ListItemIcon>
                                  <PersonIcon fontSize="small" />
                                </ListItemIcon>
                                <ListItemText>User Management</ListItemText>
                              </MenuItem>
                            </>
                          )}
                        </Menu>
                      </Box>
                    </>
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
                </>
              ) : (
                <>
                  <Button color="inherit" component={Link} to="/">
                    Home
                  </Button>
                  <Button color="inherit" component={Link} to="/login">
                    Login
                  </Button>
                  <Button color="inherit" component={Link} to="/subscription">
                    Get Subscription
                  </Button>
                </>
              )}
            </Box>
          )}

          {/* Mobile Menu Toggle */}
          {isMobile && (
            <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
              {isAuthenticated && (
                <Tooltip title="Account">
                  <IconButton 
                    color="inherit" 
                    aria-label="account"
                    onClick={handleMenuOpen}
                  >
                    <AccountIcon />
                  </IconButton>
                </Tooltip>
              )}
              <IconButton 
                color="inherit" 
                aria-label="menu"
                onClick={handleDrawerToggle}
                edge="end"
              >
                <MenuIcon />
              </IconButton>
            </Box>
          )}

          {/* Account Menu (Desktop and Mobile) */}
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
                  {user?.account_type === 'organization' 
                    ? 'Organization Account' 
                    : user?.account_type === 'client'
                      ? 'Client Account'
                      : 'Individual Account'}
                </Typography>
              </Box>
            </MenuItem>
            <Divider />
            <MenuItem onClick={() => { handleMenuClose(); navigate('/profile'); }}>
              <DashboardIcon sx={{ mr: 1 }} fontSize="small" />
              Your Food Journey
            </MenuItem>
            <MenuItem onClick={() => { handleMenuClose(); navigate('/preferences-page'); }}>
              <SettingsIcon sx={{ mr: 1 }} fontSize="small" />
              Profile Settings
            </MenuItem>
            {isOrgAccount && (
              <MenuItem onClick={() => { handleMenuClose(); navigate('/organization/dashboard'); }}>
                <DashboardIcon sx={{ mr: 1 }} fontSize="small" />
                Organization Dashboard
              </MenuItem>
            )}
            {isClientAccount && (
              <MenuItem onClick={() => { handleMenuClose(); navigate('/client-dashboard'); }}>
                <DashboardIcon sx={{ mr: 1 }} fontSize="small" />
                Client Dashboard
              </MenuItem>
            )}
            <Divider />
            <MenuItem onClick={handleLogout}>
              <LogoutIcon sx={{ mr: 1 }} fontSize="small" />
              Logout
            </MenuItem>
          </Menu>
        </Toolbar>
      </AppBar>

      {/* Mobile Navigation Drawer */}
      <Drawer
        anchor="right"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        sx={{
          '& .MuiDrawer-paper': {
            width: { xs: '100%', sm: 300 },
            boxSizing: 'border-box',
            paddingTop: 1
          },
        }}
      >
        <Box
          sx={{ width: { xs: '100%', sm: 300 }, py: 1 }}
          role="presentation"
          onClick={handleDrawerToggle}
        >
          <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
            <Typography variant="h6" component="div">
              Menu
            </Typography>
          </Box>
          {organization && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mb: 2 }}>
              <Chip
                label={organization.name}
                size="small"
                color="secondary"
              />
            </Box>
          )}
          <Divider />
          <List>
            {getNavItems().map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton
                  component={Link}
                  to={item.path}
                  sx={{ py: 1.5 }} // Larger touch target
                >
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Box>
      </Drawer>
    </>
  );
}

export default NavBar;