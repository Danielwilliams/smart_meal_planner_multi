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
  Snackbar
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import KrogerResults from '../components/KrogerResults';

function CartPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

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
    search: false
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

  // Update the handleStoreSearch function in CartPage.jsx:

const handleStoreSearch = async (store) => {
  try {
    setLoading(prev => ({ ...prev, search: true }));
    const storeItems = internalCart[store].map(item => item.name);
    
    if (storeItems.length === 0) {
      setError(`No items assigned to ${store}`);
      return;
    }

    const response = await apiService.searchStoreItems({
      items: storeItems,
      store
    });

    if (response.status === 'error') {
      if (response.redirect) {
        // Different handling based on the type of error
        if (response.needs_setup) {
          // Redirect to preferences page to set up Kroger
          navigate('/preferences-page');
        } else if (response.needs_credentials) {
          // Prompt to add Kroger API credentials
          setSnackbarMessage('Please add Kroger API credentials in preferences');
          setSnackbarOpen(true);
          navigate('/preferences-page');
        } else if (response.needs_login) {
          // Redirect to Kroger login
          window.location.href = response.redirect;
        }
      }
      return;
    }

    // Rest of the existing search handling...
  } catch (err) {
    setError(`Failed to search ${store}`);
    console.error(err);
  } finally {
    setLoading(prev => ({ ...prev, search: false }));
  }
};


  const handleAddToKrogerCart = async (items) => {
  try {
    setLoading(prev => ({ ...prev, cart: true }));
    
    const response = await apiService.addToKrogerCart({
      items: items.map(item => ({
        upc: item.upc,
        quantity: 1
      }))
    });

    if (response.success) {
      setSnackbarMessage('Items added to Kroger cart successfully');
      setSnackbarOpen(true);
      await loadInternalCart();
    }
  } catch (err) {
    console.error('Error adding to Kroger cart:', err);
    // Note: Redirection is now handled in apiService
    handleError(err);
  } finally {
    setLoading(prev => ({ ...prev, cart: false }));
  }
};

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
                  <Typography>{item.name} (x{item.quantity})</Typography>
                  <FormControl sx={{ minWidth: 120 }}>
                    <InputLabel>Store</InputLabel>
                    <Select
                      label="Store"
                      onChange={(e) => assignStore([item], e.target.value)}
                    >
                      <MenuItem value="walmart">Walmart</MenuItem>
                      <MenuItem value="kroger">Kroger</MenuItem>
                    </Select>
                  </FormControl>
                </Box>
              ))}
            </Box>
          )}
        </CardContent>
      </Card>

      {/* Kroger Section */}
      <Card sx={{ mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom>
            Kroger Items
          </Typography>

          {internalCart.kroger.length === 0 ? (
            <Typography color="text.secondary">No items assigned to Kroger</Typography>
          ) : (
            <>
              {internalCart.kroger.map((item, index) => (
                <Typography key={index}>
                  {item.name} (x{item.quantity})
                </Typography>
              ))}

              <Button
                variant="contained"
                onClick={() => handleStoreSearch('kroger')}
                disabled={loading.search}
                sx={{ mt: 2 }}
              >
                {loading.search ? <CircularProgress size={24} /> : 'Search Kroger'}
              </Button>

              {searchResults.kroger.length > 0 && (
                <KrogerResults 
                  results={searchResults.kroger} 
                  onAddToCart={handleAddToKrogerCart}
                />
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Error Display */}
      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

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