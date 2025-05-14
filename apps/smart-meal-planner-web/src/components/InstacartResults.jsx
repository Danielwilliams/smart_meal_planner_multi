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
import instacartBackendService from '../services/instacartBackendService';

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
      // First check API status from our backend
      console.log('Checking Instacart API connectivity through backend...');
      try {
        const apiStatus = await instacartBackendService.checkInstacartStatus();
        console.log('Instacart API status check result:', apiStatus);

        if (!apiStatus.is_connected) {
          console.warn('Instacart API not properly connected:', apiStatus);

          // Show a detailed error message
          setError(
            <div>
              <div><strong>Instacart API Connection Issue</strong></div>
              <div>Status: {apiStatus.status || 'disconnected'}</div>
              <div>Message: {apiStatus.message || 'Connection failed'}</div>
              <div>
                <small>
                  Please check that the Instacart API is properly configured on the backend server.
                </small>
              </div>
            </div>
          );
          return;
        }
      } catch (statusError) {
        console.error('Error checking API status:', statusError);
        // Continue with the search anyway, as our backend may still work
      }

      // Validate retailer ID
      if (!retailerId) {
        setError('Please select an Instacart retailer before searching');
        return;
      }

      console.log(`Searching products for retailer: ${retailerId}`);

      // Search for each item
      const results = {};
      const searchErrors = [];

      for (const item of groceryItems) {
        // Skip empty items
        if (!item || !item.trim()) continue;

        try {
          console.log(`Searching for "${item}" at retailer ${retailerId}...`);

          // Use the backend service for searching
          const productResults = await instacartBackendService.searchProducts(retailerId, item, 3);

          // Validate that we have valid product IDs for each result
          if (Array.isArray(productResults)) {
            const validatedResults = productResults.map(product => {
              // Ensure product ID exists
              if (!product.id) {
                return {
                  ...product,
                  id: `product_${Math.random().toString(36).substring(2, 10)}`,
                  _isGeneratedId: true
                };
              }
              return product;
            });

            results[item] = validatedResults;
            console.log(`Found ${validatedResults.length} results for "${item}"`, validatedResults);
          } else {
            console.warn(`Unexpected result type for "${item}"`, productResults);
            results[item] = [];
            searchErrors.push({
              item,
              error: 'Unexpected result format from API'
            });
          }
        } catch (err) {
          console.error(`Error searching for "${item}":`, err);
          results[item] = { error: err.message };
          searchErrors.push({
            item,
            error: err.message
          });
        }
      }

      // If all searches failed, show a comprehensive error
      if (searchErrors.length === groceryItems.length) {
        console.error('All searches failed with errors:', searchErrors);

        // Try to identify the most common error for better feedback
        const errorMessages = searchErrors.map(e => e.error);
        const mostCommonError = errorMessages.sort((a, b) =>
          errorMessages.filter(e => e === a).length - errorMessages.filter(e => e === b).length
        ).pop();

        setError(
          <div>
            <div><strong>Search Failed for All Items</strong></div>
            <div>Most common error: {mostCommonError || 'Unknown error'}</div>
            <div>
              <small>
                This could be due to:
                <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                  <li>API key authentication issues</li>
                  <li>Retailer ID may be invalid</li>
                  <li>Network connectivity problems</li>
                  <li>Service may be temporarily unavailable</li>
                </ul>
              </small>
            </div>
          </div>
        );
      } else if (searchErrors.length > 0) {
        // Some searches failed but not all
        console.warn(`${searchErrors.length} out of ${groceryItems.length} searches failed`);
      }

      setSearchResults(results);
      setDialogStep('results');
    } catch (err) {
      console.error('Error searching items:', err);

      // Provide more user-friendly error messages based on error type
      if (err.message && err.message.includes('Network Error')) {
        setError(
          <div>
            <div><strong>Network Error</strong></div>
            <div>The Instacart API is not reachable. Please check your internet connection.</div>
            <div>
              <small>Technical details: {err.message}</small>
            </div>
            <div>
              <small>
                Troubleshooting steps:
                <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                  <li>Check your internet connection</li>
                  <li>Verify that https://connect.dev.instacart.tools is accessible</li>
                  <li>Try again later</li>
                </ul>
              </small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 404) {
        setError(
          <div>
            <div><strong>API Endpoint Not Found (404)</strong></div>
            <div>The Instacart service endpoint could not be found.</div>
            <div>
              <small>This could be due to API changes or service downtime.</small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 403) {
        setError(
          <div>
            <div><strong>Access Denied (403)</strong></div>
            <div>Your API key does not have permission to access this resource.</div>
            <div>
              <small>Check that your API key has the correct permissions and is properly formatted.</small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 401) {
        setError(
          <div>
            <div><strong>Authentication Failed (401)</strong></div>
            <div>The API rejected your authentication credentials.</div>
            <div>
              <small>
                Make sure your authorization header is in the correct format:
                <pre style={{ marginTop: 5, padding: 5, backgroundColor: '#f5f5f5' }}>
                  Authorization: InstacartAPI YOUR_API_KEY
                </pre>
              </small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 500) {
        setError(
          <div>
            <div><strong>Server Error (500)</strong></div>
            <div>The Instacart server encountered an error processing your request.</div>
            <div>
              <small>This is likely a temporary issue. Please try again later.</small>
            </div>
          </div>
        );
      } else {
        setError(
          <div>
            <div><strong>Error Searching Items</strong></div>
            <div>{err.message || 'An unknown error occurred'}</div>
            <div>
              <small>Check the console for more detailed error information.</small>
            </div>
          </div>
        );
      }
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
      // Verify we have valid items and a retailer ID first
      if (!cartItems.length) {
        setError('Please select at least one item to add to your cart');
        return;
      }

      if (!retailerId) {
        setError('No retailer selected. Please select a retailer first.');
        return;
      }

      // Format items for cart creation
      const items = cartItems.map(item => ({
        product_id: item.product.id,
        quantity: 1
      }));

      console.log(`Creating cart with ${items.length} items at retailer ${retailerId}...`);

      // Create cart using the backend service
      const cart = await instacartBackendService.createCart(retailerId, items);

      // Verify the cart was created successfully
      if (!cart || !cart.id) {
        console.error('Cart created but missing ID:', cart);
        throw new Error('Cart created but missing required information');
      }

      console.log('Cart created successfully:', cart);

      // Update state with cart details
      setCartId(cart.id);
      setCheckoutUrl(cart.checkout_url);
      setDialogStep('cart');

      // Store successful cart creation in localStorage for diagnostics
      localStorage.setItem('instacart_last_cart_created', Date.now().toString());
      localStorage.setItem('instacart_last_cart_id', cart.id);

      // Call success callback
      if (onSuccess) {
        onSuccess(cart);
      }
    } catch (err) {
      console.error('Error creating Instacart cart:', err);

      // Provide rich, detailed error messages with troubleshooting steps
      let errorContent;

      // Check for specific error types
      if (err.message && err.message.includes('Network Error')) {
        errorContent = (
          <div>
            <div><strong>Network Error</strong></div>
            <div>Unable to connect to the Instacart cart service.</div>
            <div>
              <small>Technical details: {err.message}</small>
            </div>
            <div>
              <small>
                Troubleshooting steps:
                <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                  <li>Check your internet connection</li>
                  <li>Verify that https://connect.dev.instacart.tools is accessible</li>
                  <li>Try again in a few minutes</li>
                </ul>
              </small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 404) {
        errorContent = (
          <div>
            <div><strong>API Endpoint Not Found (404)</strong></div>
            <div>The Instacart cart service endpoint could not be found.</div>
            <div>
              <small>This could be due to API changes or service downtime.</small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 401) {
        errorContent = (
          <div>
            <div><strong>Authentication Failed (401)</strong></div>
            <div>The API rejected your authentication credentials.</div>
            <div>
              <small>
                Make sure your authorization header is in the correct format:
                <pre style={{ marginTop: 5, padding: 5, backgroundColor: '#f5f5f5' }}>
                  Authorization: InstacartAPI YOUR_API_KEY
                </pre>
              </small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 403) {
        errorContent = (
          <div>
            <div><strong>Access Denied (403)</strong></div>
            <div>Your API key does not have permission to access the cart API.</div>
            <div>
              <small>
                Check that your API key:
                <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                  <li>Has cart creation permissions</li>
                  <li>Is properly formatted</li>
                  <li>Has not expired</li>
                </ul>
              </small>
            </div>
          </div>
        );
      } else if (err.response && err.response.status === 500) {
        errorContent = (
          <div>
            <div><strong>Server Error (500)</strong></div>
            <div>The Instacart server encountered an internal error.</div>
            <div>
              <small>
                This could be due to:
                <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                  <li>Invalid product IDs in the cart</li>
                  <li>Server-side validation failures</li>
                  <li>Temporary service disruption</li>
                </ul>
                Try again with fewer items or different products.
              </small>
            </div>
          </div>
        );
      } else {
        // Generic error with any available details
        errorContent = (
          <div>
            <div><strong>Error Creating Instacart Cart</strong></div>
            <div>{err.message || 'An unknown error occurred'}</div>
            <div>
              <small>
                Please try:
                <ul style={{ marginTop: 5, paddingLeft: 20 }}>
                  <li>Selecting fewer items</li>
                  <li>Using the diagnostic tools to check API connectivity</li>
                  <li>Verifying the retailer ID is correct</li>
                  <li>Trying again later</li>
                </ul>
              </small>
            </div>
          </div>
        );
      }

      // Set the formatted error content
      setError(errorContent);

      // Create a user-friendly message for the callback
      const userMessage = err.response?.status
        ? `Error (${err.response.status}): ${err.message || 'Could not create cart'}`
        : err.message || 'Error creating Instacart cart';

      // Call error callback with enhanced error object
      if (onError) {
        onError({
          ...err,
          userMessage,
          apiPath: localStorage.getItem('instacart_api_path'),
          isConnected: localStorage.getItem('instacart_api_connected') === 'true'
        });
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
    const hasValidResults = items.some(item => {
      const results = searchResults[item];
      return Array.isArray(results) && results.length > 0;
    });

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

        {!hasValidResults && (
          <Alert severity="warning" sx={{ mb: 2 }}>
            No valid product matches found. Please try a different retailer or search terms.
          </Alert>
        )}

        <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
          {items.map((item, index) => {
            const results = searchResults[item];

            // Skip if there was an error or no results
            if (!results || results.error || !Array.isArray(results) || results.length === 0) {
              return (
                <ListItem key={`${item}-${index}`} divider>
                  <ListItemText
                    primary={item}
                    secondary={
                      results && results.error
                        ? `Error: ${results.error}`
                        : "No matching products found"
                    }
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

            // Best match - ensure it exists
            const bestMatch = results[0];
            if (!bestMatch || !bestMatch.id) {
              return (
                <ListItem key={`${item}-${index}`} divider>
                  <ListItemText
                    primary={item}
                    secondary="Invalid product data received"
                  />
                  <Chip
                    icon={<ErrorIcon />}
                    label="Data Error"
                    color="error"
                    variant="outlined"
                    size="small"
                  />
                </ListItem>
              );
            }

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
                      <Typography variant="caption" component="span" sx={{ color: 'text.secondary', mr: 1 }}>
                        ID: {bestMatch.id.substring(0, 8)}...
                      </Typography>
                      {bestMatch.price && (
                        <Chip
                          label={`$${typeof bestMatch.price === 'number' ? bestMatch.price.toFixed(2) : bestMatch.price}`}
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
            disabled={cartItems.length === 0 || loading || !hasValidResults}
            onClick={createInstacartCart}
            startIcon={loading ? <CircularProgress size={20} /> : <BasketIcon />}
          >
            {loading ? "Creating Cart..." : "Create Instacart Cart"}
          </Button>
        </Box>

        {/* Information about API Status */}
        <Box mt={3}>
          <Button
            size="small"
            variant="text"
            color="info"
            onClick={async () => {
              try {
                setLoading(true);
                const status = await instacartBackendService.checkInstacartStatus();
                setError(`API Status: ${status.is_connected ? 'Connected' : 'Disconnected'}. ${status.message || ''}. Using retailer: ${retailerId}`);
              } catch (err) {
                setError(`Error checking API status: ${err.message}`);
              } finally {
                setLoading(false);
              }
            }}
          >
            Check API Status
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