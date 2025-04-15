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

const handleStoreSearch = async (store) => {
  try {
    setLoading(prev => ({ ...prev, search: true }));
    setError(null);
    
    // Save the items we're searching for, to retry after store selection if needed
    const storeItems = internalCart[store].map(item => item.name);
    setLastSearchedItems(storeItems);
    
    if (storeItems.length === 0) {
      setError(`No items assigned to ${store}`);
      return;
    }

    if (store === 'kroger') {
      // First check if we have a Kroger store location ID
      const storedLocationId = localStorage.getItem('kroger_store_location_id');
      
      // Clear any previous store configuration flag to force fresh check
      localStorage.removeItem('kroger_store_configured');
      
      // Make the Kroger search request
      try {
        const response = await apiService.searchKrogerItems(storeItems);
        
        // If successful, store the results and return
        if (response.success) {
          setSearchResults(prev => ({
            ...prev,
            kroger: response.results
          }));
          return;
        }
        
        // Handle needs_setup response - this means we need to select a store
        if (response.needs_setup) {
          console.log("Kroger needs store selection");
          setCurrentStore('kroger');
          setShowStoreSelector(true);
          return;
        }
        
        // Handle redirects (for authentication)
        if (response.redirect) {
          window.location.href = response.redirect;
          return;
        }
        
        // Handle any other errors
        setError(response.message || "Failed to search Kroger items");
      } catch (krogerErr) {
        console.error("Kroger search error:", krogerErr);
        
        // If we get an error and have a stored location ID, try to use it
        if (storedLocationId) {
          try {
            console.log("Using stored Kroger location:", storedLocationId);
            await apiService.updateKrogerLocation(storedLocationId);
            
            // Retry the search with the stored location
            const retryResponse = await apiService.searchKrogerItems(storeItems);
            
            if (retryResponse.success) {
              setSearchResults(prev => ({
                ...prev,
                kroger: retryResponse.results
              }));
              return;
            }
            
            // If it still fails, show store selector
            setCurrentStore('kroger');
            setShowStoreSelector(true);
          } catch (retryErr) {
            console.error("Failed to use stored location:", retryErr);
            setCurrentStore('kroger');
            setShowStoreSelector(true);
          }
        } else {
          // No stored location, show selector
          setCurrentStore('kroger');
          setShowStoreSelector(true);
        }
      }
    } else {
      // Handle Walmart search normally
      try {
        const response = await apiService.searchWalmartItems(storeItems);
        
        if (response.success) {
          setSearchResults(prev => ({
            ...prev,
            walmart: response.results
          }));
        } else {
          setError(response.message || "Failed to search Walmart items");
        }
      } catch (walmartErr) {
        console.error("Walmart search error:", walmartErr);
        setError("Failed to search Walmart items");
      }
    }
  } catch (err) {
    console.error(`Store search error:`, err);
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
      // Log selection for debugging
      console.log(`Selected Kroger store: ${locationId}`);
      
      // Save location in localStorage for client-side caching
      localStorage.setItem('kroger_store_location_id', locationId);
      localStorage.setItem('kroger_store_configured', 'true');
      
      // Update backend with selected location
      const response = await apiService.updateKrogerLocation(locationId);
      
      if (response.success) {
        // Close the dialog
        setShowStoreSelector(false);
        setSnackbarMessage('Kroger store location set successfully');
        setSnackbarOpen(true);
        
        // Add small delay to let the location update propagate
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Retry the original search that triggered the store selection
        if (lastSearchedItems.length > 0) {
          // Use a direct approach to avoid showing the selector again
          try {
            setLoading(prev => ({ ...prev, search: true }));
            
            // Directly search Kroger with the selected location, bypass normal flow
            const searchResponse = await apiService.searchKrogerItems(lastSearchedItems);
            
            if (searchResponse.success) {
              setSearchResults(prev => ({
                ...prev,
                kroger: searchResponse.results
              }));
            } else {
              setError(searchResponse.message || "Failed to search Kroger with new location");
            }
          } catch (searchErr) {
            console.error("Error searching after store selection:", searchErr);
            setError("Failed to search with new store location");
          } finally {
            setLoading(prev => ({ ...prev, search: false }));
          }
        }
      } else {
        setError(response.message || "Failed to update store location");
      }
    }
  } catch (err) {
    console.error("Store selection error:", err);
    handleError(err);
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

