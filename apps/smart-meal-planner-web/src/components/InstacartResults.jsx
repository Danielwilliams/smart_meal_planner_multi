import React, { useState, useEffect } from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Button,
  Grid,
  Divider,
  CircularProgress,
  List,
  ListItem,
  ListItemText,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  Chip
} from '@mui/material';
import {
  ShoppingBasket as BasketIcon,
  CheckCircle as CheckCircleIcon,
  Error as ErrorIcon,
  OpenInNew as OpenInNewIcon
} from '@mui/icons-material';
import instacartService from '../services/instacartService';

/**
 * Component to display Instacart search results and cart management
 */
const InstacartResults = ({ 
  groceryItems,
  retailerId,
  onSuccess,
  onError
}) => {
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState({});
  const [cartItems, setCartItems] = useState([]);
  const [cartId, setCartId] = useState(null);
  const [checkoutUrl, setCheckoutUrl] = useState(null);
  const [error, setError] = useState(null);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogStep, setDialogStep] = useState('searching'); // searching, results, cart
  
  // Set dialog to be open by default so user sees the search immediately
  useEffect(() => {
    setShowDialog(true);
  }, []);

  const searchAllItems = async () => {
    setLoading(true);
    setError(null);
    setSearchResults({});
    setCartItems([]);
    setCartId(null);
    setCheckoutUrl(null);
    setDialogStep('searching');
    
    try {
      // Search for each item
      const results = {};
      
      for (const item of groceryItems) {
        // Skip empty items
        if (!item || !item.trim()) continue;
        
        try {
          const productResults = await instacartService.searchProducts(retailerId, item, 3);
          results[item] = productResults;
        } catch (err) {
          console.error(`Error searching for "${item}":`, err);
          results[item] = { error: err.message };
        }
      }
      
      setSearchResults(results);
      setDialogStep('results');
    } catch (err) {
      console.error('Error searching items:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const addToCart = (item, product) => {
    setCartItems(prev => [
      ...prev,
      {
        name: item,
        product
      }
    ]);
  };
  
  const removeFromCart = (index) => {
    setCartItems(prev => prev.filter((_, i) => i !== index));
  };
  
  const createInstacartCart = async () => {
    setLoading(true);
    setError(null);
    
    try {
      // Format items for cart creation
      const items = cartItems.map(item => ({
        product_id: item.product.id,
        quantity: 1
      }));
      
      // Create cart
      const cart = await instacartService.createCart(retailerId, items);
      
      setCartId(cart.id);
      setCheckoutUrl(cart.checkout_url);
      setDialogStep('cart');
      
      if (onSuccess) {
        onSuccess(cart);
      }
    } catch (err) {
      console.error('Error creating Instacart cart:', err);
      setError(err.message);
      
      if (onError) {
        onError(err);
      }
    } finally {
      setLoading(false);
    }
  };
  
  const handleClose = () => {
    setShowDialog(false);
  };
  
  const renderSearchStep = () => (
    <Box sx={{ textAlign: 'center', py: 4 }}>
      <CircularProgress size={60} sx={{ mb: 3 }} />
      <Typography variant="h6">
        Searching Instacart for your items...
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
        This may take a moment as we search for {groceryItems.length} items.
      </Typography>
    </Box>
  );
  
  const renderResultsStep = () => {
    const items = Object.keys(searchResults);
    
    return (
      <Box>
        <Typography variant="h6" gutterBottom>
          Search Results ({items.length} items)
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
          {items.map((item, index) => {
            const results = searchResults[item];
            
            // Skip if there was an error or no results
            if (!results || results.error || results.length === 0) {
              return (
                <ListItem key={`${item}-${index}`} divider>
                  <ListItemText 
                    primary={item}
                    secondary="No matching products found"
                  />
                  <Chip 
                    icon={<ErrorIcon />} 
                    label="Not Found" 
                    color="error" 
                    variant="outlined" 
                    size="small"
                  />
                </ListItem>
              );
            }
            
            // Best match
            const bestMatch = results[0];
            const isInCart = cartItems.some(cartItem => 
              cartItem.name === item && cartItem.product.id === bestMatch.id
            );
            
            return (
              <ListItem key={`${item}-${index}`} divider>
                <ListItemText 
                  primary={item}
                  secondary={
                    <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                      <Typography variant="body2" component="span" sx={{ mr: 1 }}>
                        Match: {bestMatch.name} 
                      </Typography>
                      {bestMatch.price && (
                        <Chip 
                          label={`$${bestMatch.price.toFixed(2)}`} 
                          size="small" 
                          color="primary" 
                          variant="outlined"
                        />
                      )}
                    </Box>
                  }
                />
                <Button
                  variant={isInCart ? "contained" : "outlined"}
                  color={isInCart ? "success" : "primary"}
                  size="small"
                  onClick={() => isInCart 
                    ? removeFromCart(cartItems.findIndex(ci => ci.name === item))
                    : addToCart(item, bestMatch)
                  }
                  startIcon={isInCart ? <CheckCircleIcon /> : <BasketIcon />}
                >
                  {isInCart ? "Added" : "Add"}
                </Button>
              </ListItem>
            );
          })}
        </List>
        
        <Box sx={{ mt: 3, display: 'flex', justifyContent: 'space-between' }}>
          <Typography variant="body2">
            {cartItems.length} of {items.length} items ready to add
          </Typography>
          <Button
            variant="contained"
            color="primary"
            disabled={cartItems.length === 0 || loading}
            onClick={createInstacartCart}
            startIcon={<BasketIcon />}
          >
            {loading ? <CircularProgress size={24} /> : "Create Instacart Cart"}
          </Button>
        </Box>
      </Box>
    );
  };
  
  const renderCartStep = () => (
    <Box>
      <Typography variant="h6" gutterBottom>
        Instacart Cart Created!
      </Typography>
      
      <Alert severity="success" sx={{ mb: 3 }}>
        Your Instacart cart has been created with {cartItems.length} items.
      </Alert>
      
      <Typography variant="body1" paragraph>
        Your items have been added to an Instacart cart. You can now proceed to checkout
        to complete your purchase.
      </Typography>
      
      <Box sx={{ mt: 3, display: 'flex', justifyContent: 'center' }}>
        <Button
          variant="contained"
          color="primary"
          href={checkoutUrl}
          target="_blank"
          rel="noopener noreferrer"
          startIcon={<OpenInNewIcon />}
        >
          Proceed to Instacart Checkout
        </Button>
      </Box>
    </Box>
  );
  
  const renderDialogContent = () => {
    switch (dialogStep) {
      case 'searching':
        return renderSearchStep();
      case 'results':
        return renderResultsStep();
      case 'cart':
        return renderCartStep();
      default:
        return null;
    }
  };
  
  // Auto-start the search when the component mounts
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (groceryItems && groceryItems.length > 0) {
      // Start search automatically when component renders
      searchAllItems();
    }
  }, []);

  return (
    <Box>
      <Dialog
        open={showDialog}
        onClose={handleClose}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle>
          <Box display="flex" alignItems="center">
            <BasketIcon sx={{ mr: 1 }} />
            Instacart
          </Box>
        </DialogTitle>
        <DialogContent>
          {renderDialogContent()}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleClose} color="secondary">
            {dialogStep === 'cart' ? 'Close' : 'Cancel'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default InstacartResults;