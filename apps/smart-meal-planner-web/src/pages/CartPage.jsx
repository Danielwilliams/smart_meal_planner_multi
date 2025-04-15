// src/pages/CartPage.jsx
import React, { useState, useEffect } from 'react';
import { 
  Container, 
  Typography, 
  Card, 
  CardContent, 
  Button, 
  Select, 
  MenuItem, 
  FormControl, 
  InputLabel, 
  Box, 
  CircularProgress, 
  Alert,
  Snackbar,
  IconButton,
  Tooltip,
  Divider,
  Grid
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import KrogerResults from '../components/KrogerResults';
import WalmartResults from '../components/WalmartResults';
import { StoreSelector } from '../components/StoreSelector';

function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [currentStore, setCurrentStore] = useState(null);
  const [lastSearchedItems, setLastSearchedItems] = useState([]);

  const [internalCart, setInternalCart] = useState({
    walmart: [],
    kroger: [],
    unassigned: []
  });
  
  const [searchResults, setSearchResults] = useState({
    walmart: [],
    kroger: []
  });
  
  const [loading, setLoading] = useState({
    cart: false,
    search: false,
    kroger: false,
    walmart: false
  });

  const [error, setError] = useState(null);
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState('');

  // Load cart contents on mount
  useEffect(() => {
    if (user?.userId) {
      loadInternalCart();
    }
  }, [user?.userId]);
  
  // Check for Kroger auth redirect return
  useEffect(() => {
    const checkKrogerRedirect = async () => {
      const wasRedirected = localStorage.getItem('kroger_auth_redirect') === 'true';
      const isConnected = localStorage.getItem('kroger_connected') === 'true';
      
      if (wasRedirected && isConnected) {
        console.log("Detected return from Kroger auth redirect");
        localStorage.removeItem('kroger_auth_redirect');
        
        // Display success message
        setSnackbarMessage("Successfully connected to Kroger!");
        setSnackbarOpen(true);
        
        // If we have kroger items, try searching for them again
        if (internalCart.kroger && internalCart.kroger.length > 0) {
          console.log("Auto-retrying Kroger search after successful auth");
          setTimeout(() => {
            handleStoreSearch('kroger');
          }, 1000); // Small delay to ensure UI is updated first
        }
      }
    };
    
    checkKrogerRedirect();
  }, []);

  const loadInternalCart = async () => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.getCartContents(user.userId);

      if (response?.status === 'success' && response?.cart) {
        setInternalCart(response.cart);
      }
    } catch (err) {
      console.error('Cart load error:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const handleError = (err) => {
    if (err.response?.status === 401) {
      navigate('/login');
      return;
    }
    const errorMessage = err.response?.data?.detail || err.message || 'An error occurred';
    setError(errorMessage);
    setSnackbarMessage(errorMessage);
    setSnackbarOpen(true);
  };

  const clearError = () => {
    setError(null);
  };

  const assignStore = async (items, store) => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.assignStoreToItems(user.userId, items, store);
      
      if (response.status === 'success' && response.cart) {
        setInternalCart(response.cart);
        setSnackbarMessage(`Items assigned to ${store}`);
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('Store assignment error:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

const checkKrogerCredentials = async () => {
  try {
    console.log("Checking Kroger connection status");
    
    // First check if we have a local indicator of connection
    const localConnected = localStorage.getItem('kroger_connected') === 'true';
    const hasLocalToken = !!localStorage.getItem('kroger_access_token');
    
    // Always verify with the server
    const status = await apiService.getKrogerConnectionStatus();
    const serverConnected = status.is_connected;
    
    console.log("Kroger connection status:", { 
      localConnected, 
      serverConnected,
      hasLocalToken,
      fullStatus: status
    });
    
    // Update local storage to match server status
    localStorage.setItem('kroger_connected', serverConnected ? 'true' : 'false');
    
    // If server says we're not connected but we have local tokens, try to restore the connection
    if (!serverConnected && hasLocalToken) {
      try {
        console.log("Server reports not connected but we have local tokens - attempting to restore connection");
        // Make a backend call to sync tokens from localStorage to server
        await apiService.syncKrogerTokens({
          access_token: localStorage.getItem('kroger_access_token'),
          refresh_token: localStorage.getItem('kroger_refresh_token') || ''
        });
        
        // Check connection again after sync
        const updatedStatus = await apiService.getKrogerConnectionStatus();
        if (updatedStatus.is_connected) {
          console.log("Successfully restored Kroger connection from local tokens");
          return true;
        }
      } catch (syncErr) {
        console.error("Failed to sync local tokens to server:", syncErr);
      }
    }
    
    // If we have a store location ID but we're not connected, clear it
    if (!serverConnected && !hasLocalToken && localStorage.getItem('kroger_store_location_id')) {
      console.log("Clearing invalid Kroger store location");
      localStorage.removeItem('kroger_store_location_id');
      localStorage.removeItem('kroger_store_configured');
    }
    
    // Determine final connection status
    const isConnected = serverConnected || (localConnected && hasLocalToken);
    return isConnected;
  } catch (err) {
    console.error("Error checking Kroger credentials:", err);
    
    // If we can't reach the server, fall back to local token check
    const hasLocalToken = !!localStorage.getItem('kroger_access_token');
    const fallbackConnected = localStorage.getItem('kroger_connected') === 'true' && hasLocalToken;
    console.log("Using fallback Kroger connection status:", fallbackConnected);
    
    return fallbackConnected;
  }
};

const handleKrogerAuthError = async () => {
  try {
    // Check for locally stored tokens first
    const hasLocalTokens = !!localStorage.getItem('kroger_access_token');
    
    if (hasLocalTokens) {
      try {
        console.log("Found local Kroger tokens, attempting to sync with server");
        await apiService.syncKrogerTokens({
          access_token: localStorage.getItem('kroger_access_token'),
          refresh_token: localStorage.getItem('kroger_refresh_token') || ''
        });
        
        // Check if sync worked
        const status = await apiService.getKrogerConnectionStatus();
        if (status.is_connected) {
          console.log("Successfully restored Kroger connection from local tokens");
          setSnackbarMessage("Kroger connection restored. Please try again.");
          setSnackbarOpen(true);
          return true;
        }
      } catch (syncErr) {
        console.error("Failed to sync local tokens:", syncErr);
      }
    }
    
    // Try refreshing the token
    try {
      console.log("Attempting to refresh Kroger token");
      const refreshResponse = await apiService.refreshKrogerToken();
      
      if (refreshResponse.success || refreshResponse.access_token) {
        console.log("Kroger token refresh successful");
        setSnackbarMessage("Kroger authentication refreshed. Please try again.");
        setSnackbarOpen(true);
        return true;
      }
    } catch (refreshErr) {
      console.log("Token refresh failed, will try reconnection", refreshErr);
    }
    
    // If refresh failed or wasn't successful, get login URL to reconnect
    console.log("Getting Kroger login URL for reconnection");
    const loginUrlResponse = await apiService.getKrogerLoginUrl();
    
    if (loginUrlResponse.login_url) {
      console.log("Redirecting to Kroger login:", loginUrlResponse.login_url);
      
      // Clear any existing tokens before redirecting
      localStorage.removeItem('kroger_access_token');
      localStorage.removeItem('kroger_refresh_token');
      
      // Save state to indicate we're redirecting for auth
      localStorage.setItem('kroger_auth_redirect', 'true');
      
      // Redirect to Kroger for authentication
      window.location.href = loginUrlResponse.login_url;
      return true;
    } else {
      console.error("No login URL received from Kroger");
      setError("Unable to get Kroger login URL. Please try again later.");
      return false;
    }
  } catch (err) {
    console.error("Kroger auth error handling failed:", err);
    setError("Unable to reconnect Kroger account. Please try again later.");
    return false;
  }
};

const handleStoreSearch = async (store) => {
  try {
    setLoading(prev => ({ ...prev, search: true }));
    setError(null);
    
    const storeItems = internalCart[store].map(item => item.name);
    setLastSearchedItems(storeItems);
    
    if (storeItems.length === 0) {
      setError(`No items assigned to ${store}`);
      return;
    }
    
    // For Kroger, perform more robust handling
    if (store === 'kroger') {
      // Check if we have a saved location ID before proceeding
      const savedLocationId = localStorage.getItem('kroger_store_location_id');
      console.log("Kroger search with saved location ID:", savedLocationId);
      
      // Check credentials first
      const hasCredentials = await checkKrogerCredentials();
      if (!hasCredentials) {
        console.log("No Kroger credentials found");
        const handled = await handleKrogerAuthError();
        if (!handled) {
          setError("Kroger account not connected. Please connect your account first.");
        }
        return;
      }
      
      // If we have a saved location ID, ensure it's set in the backend before searching
      if (savedLocationId) {
        try {
          console.log("Preemptively setting Kroger location before search");
          await apiService.updateKrogerLocation(savedLocationId);
          // No need to wait for response - we want to continue with the search
        } catch (locErr) {
          console.warn("Failed to preemptively set location:", locErr);
          // Continue with the search anyway - the API will tell us if location is needed
        }
      }
    }
    
    // Make the search request
    const searchFunction = store === 'kroger' 
      ? apiService.searchKrogerItems 
      : apiService.searchWalmartItems;
    
    const response = await searchFunction(storeItems);
    
    // Handle non-success responses
    if (!response.success) {
      // Handle store selection needed
      if (response.needs_setup) {
        console.log("Store selection needed");
        setCurrentStore(store);
        setShowStoreSelector(true);
        return;
      }
      
      // Handle authentication redirects
      if (response.redirect) {
        window.location.href = response.redirect;
        return;
      }
      
      // Handle auth error specifically
      if (response.auth_error) {
        const handled = await handleKrogerAuthError();
        if (!handled) {
          setError(response.message || "Authentication error");
        }
        return;
      }
      
      // Any other error
      setError(response.message || `Failed to search ${store} items`);
      return;
    }
    
    // Success path
    console.log(`${store} search results:`, response.results);
    setSearchResults(prev => ({
      ...prev,
      [store]: response.results
    }));
    
  } catch (err) {
    console.error(`${store} search error:`, err);
    setError(`Failed to search ${store} items: ${err.message}`);
  } finally {
    setLoading(prev => ({ ...prev, search: false }));
  }
};


  const handleAddToCart = async (items, store) => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      
      const addFunction = store === 'kroger' 
        ? apiService.addToKrogerCart 
        : apiService.addToWalmartCart;

      const response = await addFunction(items);

      // For successful response
      if (response.success) {
        setSnackbarMessage(`Items added to ${store} cart successfully`);
        setSnackbarOpen(true);
        await loadInternalCart();
        clearSearchResults(store);
        return;
      }
      
      // Special handling for Kroger-specific responses
      if (store === 'kroger') {
        // Handle token refresh
        if (response.token_refreshed) {
          setSnackbarMessage("Kroger authentication refreshed. Please try again.");
          setSnackbarOpen(true);
          // Retry the search
          await handleStoreSearch('kroger');
          return;
        }
        
        // Handle reconnection needed
        if (response.needs_reconnect) {
          setError("Your Kroger session has expired. Please reconnect your account.");
          // Get a new Kroger login URL
          try {
            const loginData = await apiService.getKrogerLoginUrl();
            if (loginData.url) {
              window.location.href = loginData.url;
              return;
            }
          } catch (loginErr) {
            console.error("Failed to get Kroger login URL:", loginErr);
          }
          return;
        }
        
        // Handle redirect needed
        if (response.redirect) {
          window.location.href = response.redirect;
          return;
        }
      }
      
      // Handle any other error response
      setError(response.message || "Failed to add items to cart");
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

const handleStoreSelect = async (locationId) => {
  try {
    if (currentStore === 'kroger') {
      console.log(`Selected Kroger store: ${locationId}`);
      
      // Update the Kroger location in the backend
      const response = await apiService.updateKrogerLocation(locationId);
      
      if (response.success) {
        // Close the dialog first
        setShowStoreSelector(false);
        
        // Show success message
        setSnackbarMessage('Kroger store location set successfully');
        setSnackbarOpen(true);
        
        // Retry the search if we have items to search
        if (lastSearchedItems.length > 0) {
          console.log("Retrying Kroger search after store selection");
          // Just call the normal search function - it will handle everything
          await handleStoreSearch('kroger');
        }
      } else {
        setError(response.message || "Failed to update store location");
      }
    }
  } catch (err) {
    console.error("Store selection error:", err);
    setError(err.message || "Error updating store location");
  }
};

  const clearSearchResults = (store) => {
    if (store) {
      setSearchResults(prev => ({ ...prev, [store]: [] }));
    } else {
      setSearchResults({ walmart: [], kroger: [] });
    }
  };

  const clearStoreItems = async (store) => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.clearStoreItems(user.userId, store);
      
      if (response.status === 'success') {
        setInternalCart(prev => ({
          ...prev,
          [store]: []
        }));
        clearSearchResults(store);
        setSnackbarMessage(`Cleared ${store} items`);
        setSnackbarOpen(true);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const updateItemQuantity = async (item, store, change) => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const newQuantity = Math.max(1, item.quantity + change);
      
      const response = await apiService.updateCartItemQuantity(
        user.userId,
        item.name,
        store,
        newQuantity
      );
      
      if (response.status === 'success') {
        await loadInternalCart();
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const removeItem = async (item, store) => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.removeCartItem(user.userId, item.name, store);
      
      if (response.status === 'success') {
        await loadInternalCart();
        setSnackbarMessage('Item removed from cart');
        setSnackbarOpen(true);
      }
    } catch (err) {
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const renderStoreSection = (store, items, searchFn, ResultsComponent) => (
    <Card sx={{ mb: 4 }}>
      <CardContent>
        <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
          <Typography variant="h6">
            {`${store.charAt(0).toUpperCase() + store.slice(1)} Items`}
          </Typography>
          <Box>
            <Tooltip title="Clear all items">
              <IconButton 
                size="small" 
                onClick={() => clearStoreItems(store)}
                disabled={items.length === 0 || loading.cart}
              >
                <DeleteIcon />
              </IconButton>
            </Tooltip>
            <Tooltip title="Clear search results">
              <IconButton 
                size="small" 
                onClick={() => clearSearchResults(store)}
                disabled={searchResults[store].length === 0}
              >
                <ClearIcon />
              </IconButton>
            </Tooltip>
          </Box>
        </Box>

        {items.length === 0 ? (
          <Typography color="text.secondary">
            {`No items assigned to ${store}`}
          </Typography>
        ) : (
          <>
            <Box sx={{ mb: 2 }}>
              {items.map((item, index) => (
                <Box 
                  key={index}
                  sx={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    py: 1
                  }}
                >
                  <Typography>{item.name}</Typography>
                  <Box display="flex" alignItems="center">
                    <IconButton
                      size="small"
                      onClick={() => updateItemQuantity(item, store, -1)}
                      disabled={item.quantity <= 1 || loading.cart}
                    >
                      <RemoveIcon fontSize="small" />
                    </IconButton>
                    <Typography sx={{ mx: 1 }}>
                      {item.quantity}
                    </Typography>
                    <IconButton
                      size="small"
                      onClick={() => updateItemQuantity(item, store, 1)}
                      disabled={loading.cart}
                    >
                      <AddIcon fontSize="small" />
                    </IconButton>
                    <IconButton
                      size="small"
                      onClick={() => removeItem(item, store)}
                      disabled={loading.cart}
                      sx={{ ml: 1 }}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>

            <Button
              variant="contained"
              onClick={searchFn}
              disabled={loading[store]}
              startIcon={loading[store] ? <CircularProgress size={20} /> : <RefreshIcon />}
            >
              {`Search ${store}`}
            </Button>

            {searchResults[store].length > 0 && (
              <Box sx={{ mt: 2 }}>
                <ResultsComponent 
                  results={searchResults[store]} 
                  onAddToCart={(items) => handleAddToCart(items, store)}
                />
              </Box>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shopping Cart
      </Typography>

      {/* Unassigned Items */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Unassigned Items
          </Typography>
          
          {internalCart.unassigned.length === 0 ? (
            <Typography color="text.secondary">No unassigned items</Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              {internalCart.unassigned.map((item, index) => (
                <Box key={index} sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Box display="flex" alignItems="center">
                    <Typography>{item.name}</Typography>
                    <Box display="flex" alignItems="center" ml={2}>
                      <IconButton
                        size="small"
                        onClick={() => updateItemQuantity(item, 'unassigned', -1)}
                        disabled={item.quantity <= 1 || loading.cart}
                      >
                        <RemoveIcon fontSize="small" />
                      </IconButton>
                      <Typography sx={{ mx: 1 }}>
                        {item.quantity}
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => updateItemQuantity(item, 'unassigned', 1)}
                        disabled={loading.cart}
                      >
                        <AddIcon fontSize="small" />
                      </IconButton>
                    </Box>
                  </Box>
                  <Box display="flex" alignItems="center">
                    <FormControl sx={{ minWidth: 120, mr: 1 }}>
                      <InputLabel>Store</InputLabel>
                      <Select
                        label="Store"
                        onChange={(e) => assignStore([item], e.target.value)}
                        disabled={loading.cart}
                      >
                        <MenuItem value="walmart">Walmart</MenuItem>
                        <MenuItem value="kroger">Kroger</MenuItem>
                      </Select>
                    </FormControl>
                    <IconButton
                      size="small"
                      onClick={() => removeItem(item, 'unassigned')}
                      disabled={loading.cart}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Store Sections */}
      {renderStoreSection('kroger', internalCart.kroger, () => handleStoreSearch('kroger'), KrogerResults)}
      {renderStoreSection('walmart', internalCart.walmart, () => handleStoreSearch('walmart'), WalmartResults)}

      {/* Error Display */}
      {error && (
        <Alert 
          severity="error" 
          sx={{ mt: 2 }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      )}

      {/* Store Selector Dialog */}
      <StoreSelector
        open={showStoreSelector}
        storeType={currentStore}
        onStoreSelect={handleStoreSelect}
        onClose={() => setShowStoreSelector(false)}
      />

      {/* Global loading indicator */}
      {loading.cart && (
        <Box 
          position="fixed" 
          bottom={16} 
          right={16}
          bgcolor="background.paper"
          borderRadius="50%"
          p={1}
          boxShadow={3}
        >
          <CircularProgress size={30} />
        </Box>
      )}

      {/* Snackbar notifications */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3000}
        onClose={() => setSnackbarOpen(false)}
        message={snackbarMessage}
      />
    </Container>
  );
}

export default CartPage;

