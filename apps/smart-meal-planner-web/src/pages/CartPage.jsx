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
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions
} from '@mui/material';
import { 
  Delete as DeleteIcon, 
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ShoppingCart as ShoppingCartIcon,
  Error as ErrorIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import KrogerResults from '../components/KrogerResults';
import WalmartResults from '../components/WalmartResults';
import { StoreSelector } from '../components/StoreSelector';
import krogerAuthService from '../services/krogerAuthService';

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
  const [showKrogerCartDialog, setShowKrogerCartDialog] = useState(false);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [errorDialogContent, setErrorDialogContent] = useState({
    title: '',
    message: '',
    needsReconnect: false
  });

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

  const showKrogerError = (title, message, needsReconnect = false) => {
    setErrorDialogContent({
      title: title,
      message: message,
      needsReconnect: needsReconnect
    });
    setShowErrorDialog(true);
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
      // Add credential check for Kroger
      if (store === 'kroger') {
        const credentialsValid = await checkKrogerCredentials();
        if (!credentialsValid) {
          return;
        }
      }
      
      setLoading(prev => ({ ...prev, search: true }));
      setError(null);
      
      const storeItems = internalCart[store].map(item => item.name);
      setLastSearchedItems(storeItems);
      
      if (storeItems.length === 0) {
        setError(`No items assigned to ${store}`);
        return;
      }

      const searchFunction = store === 'kroger' 
        ? apiService.searchKrogerItems 
        : apiService.searchWalmartItems;

      const response = await searchFunction(storeItems);

      // Check for store selection needed
      if (!response.success) {
        if (response.needs_setup) {
          // Show store selector instead of redirecting to preferences
          setCurrentStore(store);
          setShowStoreSelector(true);
          return;
        }
        if (response.redirect) {
          window.location.href = response.redirect;
          return;
        }
        setError(response.message);
        return;
      }

      setSearchResults(prev => ({
        ...prev,
        [store]: response.results
      }));

    } catch (err) {
      console.error(`Failed to search ${store} items:`, err);
      
      // Check if this is a Kroger auth error
      if (store === 'kroger' && 
          (err.response?.status === 401 || 
           (err.response?.data?.error && 
            err.response?.data?.error.includes('Invalid Access Token')))) {
        handleKrogerAuthError();
        return;
      }
      
      setError(`Failed to search ${store} items: ${err.message || 'Unknown error'}`);
    } finally {
      setLoading(prev => ({ ...prev, search: false }));
    }
  };

  const handleKrogerAuthError = async () => {
    try {
      // First attempt to refresh the token
      const refreshResult = await apiService.refreshKrogerTokenExplicit();
      
      if (refreshResult.success) {
        setSnackbarMessage("Kroger connection refreshed successfully");
        setSnackbarOpen(true);
        return true;
      } else {
        // If refresh fails, show reconnect dialog
        showKrogerError(
          "Kroger Authentication Required", 
          "Your Kroger session has expired. Please reconnect your account to continue.",
          true
        );
        return false;
      }
    } catch (err) {
      console.error("Error handling Kroger auth:", err);
      showKrogerError(
        "Kroger Authentication Error", 
        "There was a problem with your Kroger connection. Please reconnect your account.",
        true
      );
      return false;
    }
  };

  const handleReconnectKroger = async () => {
    try {
      setShowErrorDialog(false);
      setSnackbarMessage("Reconnecting to Kroger...");
      setSnackbarOpen(true);
      
      const result = await apiService.reconnectKroger();
      // No need to check result since reconnectKroger will redirect if successful
    } catch (err) {
      console.error("Kroger reconnect error:", err);
      setError("Failed to reconnect to Kroger. Please try again.");
    }
  };

const handleAddToCart = async (items, store) => {
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      
      let response;
      
      // Use dedicated Kroger service for Kroger items
      if (store === 'kroger') {
        console.log('Using dedicated Kroger auth service for cart operation');
        response = await krogerAuthService.addToKrogerCart(items);
        
        // Check for reconnection needed - ADD OR UPDATE THIS BLOCK
        if (!response.success && response.needs_reconnect) {
          console.log('Kroger reconnection needed');
          showKrogerError(
            "Kroger Authentication Required", 
            "Your Kroger session has expired. Please reconnect your account to continue.",
            true
          );
          setLoading(prev => ({ ...prev, cart: false }));
          return;
        }
        
        // Check if it was a timeout
        if (!response.success && response.timeout) {
          setError(response.message || 'The request timed out. Check your Kroger cart directly.');
          setShowKrogerCartDialog(true);
          setLoading(prev => ({ ...prev, cart: false }));
          return;
        }
        
        // Handle general errors
        if (!response.success) {
          setError(response.message || 'Failed to add items to Kroger cart');
          setLoading(prev => ({ ...prev, cart: false }));
          return;
        }
        
        // Success
        setSnackbarMessage(`Items added to Kroger cart successfully`);
        setSnackbarOpen(true);
        await loadInternalCart();
        clearSearchResults(store);
        setShowKrogerCartDialog(true);
      } else {
        // Use regular API service for Walmart
        response = await apiService.addToWalmartCart(items);
        
        if (response.success) {
          setSnackbarMessage(`Items added to ${store} cart successfully`);
          setSnackbarOpen(true);
          await loadInternalCart();
          clearSearchResults(store);
        } else {
          setError(response.message || `Failed to add items to ${store} cart`);
        }
      }
    } catch (err) {
      console.error(`Error adding to ${store} cart:`, err);
      
      // Special handling for timeout errors
      if (err.code === 'ECONNABORTED' || err.message?.includes('timeout')) {
        // For timeouts, assume the operation might have succeeded anyway
        setError(`The request to ${store} took too long to respond. The items might have been added to your cart anyway. Please check your ${store} cart directly.`);
        
        // For Kroger timeouts, offer direct cart link
        if (store === 'kroger') {
          setShowKrogerCartDialog(true);
        }
        
        return;
      }
      
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };
  
  const handleStoreSelect = async (locationId) => {
    try {
      if (currentStore === 'kroger') {
        const response = await apiService.updateKrogerLocation(locationId);
        
        // Very defensive handling
        setShowStoreSelector(false); // Close the dialog regardless of success/failure
        
        if (response && response.success) {
          setSnackbarMessage('Store location updated successfully');
          setSnackbarOpen(true);
          
          // Only try to search again if we have items
          if (lastSearchedItems && lastSearchedItems.length > 0) {
            try {
              await handleStoreSearch('kroger');
            } catch (searchErr) {
              console.error('Error searching after store select:', searchErr);
              // Don't let this error bubble up
            }
          }
        } else {
          // Still display a positive message to avoid UI errors
          console.warn('Received non-success response:', response);
          setSnackbarMessage('Store selection completed');
          setSnackbarOpen(true);
        }
      }
    } catch (err) {
      console.error('Store selection error:', err);
      // Handle gracefully - close dialog and show error in snackbar
      setShowStoreSelector(false);
      setSnackbarMessage('Error setting store location');
      setSnackbarOpen(true);
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

  const checkKrogerCredentials = async () => {
    try {
      const result = await apiService.checkKrogerCredentials();
      console.log('Kroger credentials status:', result);
      
      // If credentials are missing, prompt the user to connect
      if (!result.has_credentials || !result.has_access_token) {
        console.error('Kroger credentials missing or invalid');
        
        // Show a dialog to the user
        showKrogerError(
          "Kroger Connection Required", 
          "You need to connect your Kroger account before searching for items.",
          true
        );
        return false;
      } else {
        console.log('Kroger credentials are valid');
        return true;
      }
    } catch (err) {
      console.error('Error checking Kroger credentials:', err);
      setError('Failed to check Kroger account status');
      return false;
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
              disabled={loading.search || loading[store]}
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

      {/* Kroger Cart Dialog */}
      <Dialog 
        open={showKrogerCartDialog} 
        onClose={() => setShowKrogerCartDialog(false)}
      >
        <DialogTitle>Items Added to Kroger Cart</DialogTitle>
        <DialogContent>
          <DialogContentText>
            Your items have been successfully added to your Kroger cart.
            Would you like to view your cart on Kroger's website?
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowKrogerCartDialog(false)} color="primary">
            Continue Shopping
          </Button>
          <Button 
            onClick={() => {
              window.open('https://www.kroger.com/cart', '_blank');
              setShowKrogerCartDialog(false);
            }} 
            variant="contained" 
            color="primary"
            startIcon={<ShoppingCartIcon />}
          >
            Go to Kroger Cart
          </Button>
        </DialogActions>
      </Dialog>

      {/* Error Dialog with Reconnect Option */}
      <Dialog
        open={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
      >
        <DialogTitle>
          <Box display="flex" alignItems="center" gap={1}>
            <ErrorIcon color="error" />
            {errorDialogContent.title}
          </Box>
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {errorDialogContent.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowErrorDialog(false)} color="primary">
            Close
          </Button>
          {errorDialogContent.needsReconnect && (
            <Button 
              onClick={handleReconnectKroger} 
              variant="contained" 
              color="primary"
            >
              Reconnect Kroger Account
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* Global loading indicators */}
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
      
      {/* Search loading overlay */}
      {loading.search && (
        <Box 
          position="fixed"
          top={0}
          left={0}
          right={0}
          bottom={0}
          display="flex"
          alignItems="center"
          justifyContent="center"
          bgcolor="rgba(255, 255, 255, 0.7)"
          zIndex={9999}
        >
          <Box 
            display="flex" 
            flexDirection="column" 
            alignItems="center" 
            bgcolor="white" 
            p={3} 
            borderRadius={2}
            boxShadow={3}
          >
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Searching for products...
            </Typography>
          </Box>
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