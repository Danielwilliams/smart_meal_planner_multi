// src/components/BrandedNavBar.jsx
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
  Build as CustomizeIcon
} from '@mui/icons-material';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useBranding } from '../context/BrandingContext';
import apiService from '../services/apiService';

function BrandedNavBar() {
  const { isAuthenticated, user, logout } = useAuth();
  const { branding, getLogoUrl, getPlatformName, shouldShowOrganizationBranding } = useBranding();
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
  const isIndividualAccount = user?.account_type === 'individual';
  
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
            }
          }
        } catch (error) {
          console.error('Error fetching organization data:', error);
        }
      };
      
      fetchOrgData();
    }
  }, [isAuthenticated, user, isOrgAccount]);

  const handleMenuClick = (event) => {
    setMenuAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setMenuAnchorEl(null);
  };

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/');
    } catch (error) {
      console.error('Logout failed:', error);
    }
  };

  const handleDrawerToggle = () => {
    setDrawerOpen(!drawerOpen);
  };

  // Get the appropriate logo and title based on branding context
  const getLogoAndTitle = () => {
    // Individual users always see default branding
    if (isIndividualAccount) {
      return {
        logoSrc: "/favicon.ico",
        logoAlt: "Smart Meal Planner Logo",
        title: "Smart Meal Planner IO",
        showDefaultLogo: true
      };
    }

    // Organization-linked users may see custom branding
    if (shouldShowOrganizationBranding()) {
      const customLogo = getLogoUrl();
      const customTitle = getPlatformName();
      
      return {
        logoSrc: customLogo || "/favicon.ico",
        logoAlt: customLogo ? `${customTitle} Logo` : "Smart Meal Planner Logo",
        title: customTitle || "Smart Meal Planner IO",
        showDefaultLogo: !branding.features.hideDefaultLogo || !customLogo
      };
    }

    // Fallback to default for any other case
    return {
      logoSrc: "/favicon.ico",
      logoAlt: "Smart Meal Planner Logo", 
      title: "Smart Meal Planner IO",
      showDefaultLogo: true
    };
  };

  const { logoSrc, logoAlt, title, showDefaultLogo } = getLogoAndTitle();

  const getNavigationItems = () => {
    let moreItems = [];
    
    if (isOrgAccount) {
      moreItems = [
        { text: 'Organization Dashboard', icon: <DashboardIcon />, path: '/organization/dashboard' },
        { text: 'Recipe Admin', icon: <AdminIcon />, path: '/recipe-admin' },
        { text: 'Preferences', icon: <SettingsIcon />, path: '/preferences' },
        { text: 'Profile', icon: <PersonIcon />, path: '/profile' }
      ];
    } else if (isClientAccount) {
      moreItems = [
        { text: 'Client Dashboard', icon: <DashboardIcon />, path: '/client/dashboard' },
        { text: 'Preferences', icon: <SettingsIcon />, path: '/preferences' },
        { text: 'Profile', icon: <PersonIcon />, path: '/profile' }
      ];
    } else {
      moreItems = [
        { text: 'Preferences', icon: <SettingsIcon />, path: '/preferences' },
        { text: 'Profile', icon: <PersonIcon />, path: '/profile' }
      ];
    }
    
    // Items that will appear in both main nav and drawer
    const mainItems = [
      { text: 'Home', icon: <HomeIcon />, path: '/' },
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
        { text: 'Manage Organization', icon: <DashboardIcon />, path: '/organization/dashboard' }
      );
    }
    
    return items;
  };

  // Custom CSS injection for organization branding
  useEffect(() => {
    if (shouldShowOrganizationBranding() && branding.visual.customCSS) {
      const styleElement = document.createElement('style');
      styleElement.id = 'organization-custom-css';
      styleElement.textContent = branding.visual.customCSS;
      document.head.appendChild(styleElement);

      return () => {
        const existingStyle = document.getElementById('organization-custom-css');
        if (existingStyle) {
          existingStyle.remove();
        }
      };
    }
  }, [branding, shouldShowOrganizationBranding]);

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
            {showDefaultLogo && (
              <img
                src={logoSrc}
                alt={logoAlt}
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
            )}
            {title}
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
              {isAuthenticated && (
                <>
                  <Button color="inherit" component={Link} to="/">
                    <HomeIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Home
                  </Button>
                  <Button color="inherit" component={Link} to="/menu">
                    <RestaurantIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Menu
                  </Button>
                  <Button color="inherit" component={Link} to="/shopping-list">
                    <ListIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Shopping List
                  </Button>
                  <Button color="inherit" component={Link} to="/cart">
                    <CartIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Cart
                  </Button>
                  <Button color="inherit" component={Link} to="/saved-recipes">
                    <BookmarkIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Saved Recipes
                  </Button>
                  <Button color="inherit" component={Link} to="/recipes">
                    <SearchIcon fontSize="small" sx={{ mr: 0.5 }} />
                    Recipe Browser
                  </Button>

                  {/* More Menu for Additional Items */}
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
                      )}

                      {isClientAccount && (
                        <MenuItem 
                          component={Link} 
                          to="/client/dashboard"
                          onClick={() => setMoreMenuAnchorEl(null)}
                        >
                          <ListItemIcon>
                            <DashboardIcon fontSize="small" />
                          </ListItemIcon>
                          <ListItemText>Client Dashboard</ListItemText>
                        </MenuItem>
                      )}
                      
                      <MenuItem 
                        component={Link} 
                        to="/preferences"
                        onClick={() => setMoreMenuAnchorEl(null)}
                      >
                        <ListItemIcon>
                          <SettingsIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Preferences</ListItemText>
                      </MenuItem>
                      
                      <MenuItem 
                        component={Link} 
                        to="/profile"
                        onClick={() => setMoreMenuAnchorEl(null)}
                      >
                        <ListItemIcon>
                          <PersonIcon fontSize="small" />
                        </ListItemIcon>
                        <ListItemText>Profile</ListItemText>
                      </MenuItem>
                    </Menu>
                  </Box>
                </>
              )}
              
              {/* Authentication Section */}
              {isAuthenticated ? (
                <Box sx={{ position: 'relative' }}>
                  <IconButton
                    size="large"
                    edge="end"
                    aria-label="account of current user"
                    aria-controls="menu-appbar"
                    aria-haspopup="true"
                    onClick={handleMenuClick}
                    color="inherit"
                  >
                    <AccountIcon />
                  </IconButton>
                  <Menu
                    anchorEl={menuAnchorEl}
                    open={Boolean(menuAnchorEl)}
                    onClose={handleMenuClose}
                  >
                    <MenuItem onClick={handleMenuClose} component={Link} to="/profile">
                      <ListItemIcon>
                        <PersonIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Profile</ListItemText>
                    </MenuItem>
                    <MenuItem onClick={() => { handleMenuClose(); handleLogout(); }}>
                      <ListItemIcon>
                        <LogoutIcon fontSize="small" />
                      </ListItemIcon>
                      <ListItemText>Logout</ListItemText>
                    </MenuItem>
                  </Menu>
                </Box>
              ) : (
                <Box>
                  <Button color="inherit" component={Link} to="/login">
                    Login
                  </Button>
                  <Button color="inherit" component={Link} to="/signup">
                    Sign Up
                  </Button>
                </Box>
              )}
            </Box>
          )}

          {/* Mobile Menu Button */}
          {isMobile && isAuthenticated && (
            <IconButton
              color="inherit"
              aria-label="open drawer"
              edge="start"
              onClick={handleDrawerToggle}
            >
              <MenuIcon />
            </IconButton>
          )}

          {/* Mobile Authentication Buttons */}
          {isMobile && !isAuthenticated && (
            <Box>
              <Button color="inherit" component={Link} to="/login" size="small">
                Login
              </Button>
              <Button color="inherit" component={Link} to="/signup" size="small">
                Sign Up
              </Button>
            </Box>
          )}
        </Toolbar>
      </AppBar>

      {/* Mobile Drawer */}
      <Drawer
        anchor="left"
        open={drawerOpen}
        onClose={handleDrawerToggle}
        sx={{ display: { xs: 'block', md: 'none' } }}
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
                size="medium"
                color="primary"
              />
            </Box>
          )}
          <Divider />
          <List>
            {getNavigationItems().map((item) => (
              <ListItem key={item.text} disablePadding>
                <ListItemButton component={Link} to={item.path}>
                  <ListItemIcon>
                    {item.icon}
                  </ListItemIcon>
                  <ListItemText primary={item.text} />
                </ListItemButton>
              </ListItem>
            ))}
            <Divider />
            <ListItem disablePadding>
              <ListItemButton onClick={handleLogout}>
                <ListItemIcon>
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText primary="Logout" />
              </ListItemButton>
            </ListItem>
          </List>
        </Box>
      </Drawer>

      {/* Powered By Footer (only for organization branding) */}
      {shouldShowOrganizationBranding() && branding.features.showPoweredBy && (
        <Box 
          sx={{ 
            position: 'fixed', 
            bottom: 0, 
            right: 0, 
            p: 1, 
            bgcolor: 'background.paper',
            borderRadius: '4px 0 0 0',
            boxShadow: 1,
            fontSize: '0.75rem',
            color: 'text.secondary',
            zIndex: 1000
          }}
        >
          Powered by Smart Meal Planner
        </Box>
      )}
    </>
  );
}

export default BrandedNavBar;