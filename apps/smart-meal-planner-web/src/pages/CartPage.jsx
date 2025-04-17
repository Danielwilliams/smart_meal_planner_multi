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
  
  // Process Kroger auth data when loading the cart page
  useEffect(() => {
    // Check for Kroger auth-related data
    const krogerAuthCode = sessionStorage.getItem('kroger_auth_code');
    const krogerAuthRedirectUri = sessionStorage.getItem('kroger_auth_redirect_uri');
    const krogerConnected = localStorage.getItem('kroger_connected');
    const reconnectAttempted = localStorage.getItem('kroger_reconnect_attempted');
    const storeSelected = localStorage.getItem('kroger_store_selected');
    const storeLocation = localStorage.getItem('kroger_store_location');
    
    console.log('================[ Kroger Auth Check ]================');
    console.log('krogerAuthCode exists:', !!krogerAuthCode);
    console.log('krogerAuthRedirectUri:', krogerAuthRedirectUri);
    console.log('krogerConnected flag:', krogerConnected);
    console.log('reconnectAttempted flag:', reconnectAttempted);
    console.log('storeSelected flag:', storeSelected);
    console.log('storeLocation:', storeLocation);
    
    // Choose the appropriate action based on auth state
    const processKrogerAuth = async () => {
      try {
        // CASE 1: We have an auth code from a redirect
        if (krogerAuthCode) {
          console.log('CASE 1: Processing Kroger auth code from redirect');
          setSnackbarMessage("Processing Kroger connection...");
          setSnackbarOpen(true);
          
          try {
            // Process the auth code
            const result = await krogerAuthService.processAuthCode(
              krogerAuthCode, 
              krogerAuthRedirectUri || 'https://smart-meal-planner-multi.vercel.app/kroger/callback'
            );
            
            console.log("Auth code processing result:", result);
            
            if (result && (result.success || result.client_side_fallback)) {
              // Success case - clear session storage
              sessionStorage.removeItem('kroger_auth_code');
              sessionStorage.removeItem('kroger_auth_redirect_uri');
              sessionStorage.removeItem('kroger_auth_timestamp');
              
              // Show success message
              setSnackbarMessage("Successfully connected to Kroger!");
              setSnackbarOpen(true);
              
              // Check if we need to select a store
              if (!storeLocation && !storeSelected) {
                console.log('Store selection needed after auth code processing');
                setCurrentStore('kroger');
                setShowStoreSelector(true);
              }
            } else {
              throw new Error("Auth code processing didn't return success");
            }
          } catch (processingError) {
            console.error("Error processing auth code:", processingError);
            
            // Even on error, we'll attempt to continue with client-side tracking
            localStorage.setItem('kroger_connected', 'true');
            localStorage.setItem('kroger_connected_at', new Date().toISOString());
            
            // Clean up session storage
            sessionStorage.removeItem('kroger_auth_code');
            sessionStorage.removeItem('kroger_auth_redirect_uri');
            sessionStorage.removeItem('kroger_auth_timestamp');
            
            // Show partial success message
            setSnackbarMessage("Connected to Kroger with limited functionality!");
            setSnackbarOpen(true);
            
            // Still check if we need to select a store
            if (!storeLocation && !storeSelected) {
              console.log('Store selection needed after auth code processing');
              setCurrentStore('kroger');
              setShowStoreSelector(true);
            }
          }
        } 
        // CASE 2: Reconnection attempt flag is set
        else if (reconnectAttempted) {
          console.log('CASE 2: Reconnection was attempted');
          
          // Clear reconnect flags
          localStorage.removeItem('kroger_reconnect_attempted');
          localStorage.removeItem('kroger_reconnect_timestamp');
          
          // Check connection status
          try {
            const status = await krogerAuthService.checkKrogerStatus();
            console.log("Connection status after reconnect:", status);
            
            if (status && status.is_connected) {
              console.log("Kroger connection verified after reconnect");
              
              // Update local connection flags
              localStorage.setItem('kroger_connected', 'true');
              localStorage.setItem('kroger_connected_at', new Date().toISOString());
              
              // Show success message
              setSnackbarMessage("Successfully reconnected to Kroger!");
              setSnackbarOpen(true);
              
              // Check if we need to select a store
              if (!status.store_location && !storeLocation && !storeSelected) {
                console.log('Store selection needed after reconnect');
                setCurrentStore('kroger');
                setShowStoreSelector(true);
              }
            } else {
              console.warn("Kroger connection verification failed after reconnect");
              
              // Show error dialog
              showKrogerError(
                "Kroger Connection Issue",
                "We couldn't verify your Kroger connection. Please try reconnecting again.",
                true
              );
            }
          } catch (statusErr) {
            console.error("Error checking status after reconnect:", statusErr);
            
            // Use client-side tracking if API verification fails
            if (krogerConnected === 'true') {
              console.log("Using client-side connection tracking as fallback");
              
              // Show partial success message
              setSnackbarMessage("Connected to Kroger with limited functionality!");
              setSnackbarOpen(true);
              
              // Check if we need to select a store
              if (!storeLocation && !storeSelected) {
                console.log('Store selection needed after reconnect');
                setCurrentStore('kroger');
                setShowStoreSelector(true);
              }
            } else {
              // If not even client-side connected, show error
              showKrogerError(
                "Kroger Connection Failed",
                "We couldn't connect to your Kroger account. Please try again.",
                true
              );
            }
          }
        }
        // CASE 3: Connected but no auth code or reconnect attempt
        else if (krogerConnected === 'true') {
          console.log('CASE 3: Kroger already connected');
          
          // Verify connection is still valid
          try {
            const status = await krogerAuthService.checkKrogerStatus();
            console.log("Verifying existing Kroger connection:", status);
            
            if (!status || !status.is_connected) {
              console.warn("Existing Kroger connection is no longer valid");
              
              // Clear invalid connection state
              localStorage.removeItem('kroger_connected');
              localStorage.removeItem('kroger_connected_at');
              
              // Show reconnect dialog only if actually needed for search
              if (internalCart.kroger && internalCart.kroger.length > 0) {
                showKrogerError(
                  "Kroger Connection Expired",
                  "Your Kroger connection has expired. Please reconnect to continue.",
                  true
                );
              }
            } else if (!status.store_location && !storeLocation && !storeSelected) {
              // Connection is valid but no store selected
              console.log('Store selection needed for existing connection');
              
              // Show store selector after a brief delay to allow UI to settle
              setTimeout(() => {
                setCurrentStore('kroger');
                setShowStoreSelector(true);
              }, 1000);
            }
          } catch (verifyErr) {
            console.error("Error verifying existing connection:", verifyErr);
            
            // Assume connection is still valid if we can't verify
            // We'll find out when the user tries to search
          }
        }
        // CASE 4: No Kroger auth state found, do nothing special
      } catch (err) {
        console.error("Unhandled error in Kroger auth processing:", err);
        
        // Clear any partial state
        sessionStorage.removeItem('kroger_auth_code');
        sessionStorage.removeItem('kroger_auth_redirect_uri');
        sessionStorage.removeItem('kroger_auth_timestamp');
        
        // Only show error if actively trying to connect
        if (krogerAuthCode || reconnectAttempted) {
          showKrogerError(
            "Kroger Connection Error",
            "We encountered an error while connecting to Kroger. Please try again.",
            true
          );
        }
      }
    };
    
    // Run the processor if we have any Kroger auth state to handle
    if (krogerAuthCode || krogerConnected === 'true' || reconnectAttempted) {
      processKrogerAuth();
    }
  }, [internalCart.kroger]);

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

  // Check if Kroger credentials are valid
  const checkKrogerCredentials = async () => {
    console.log("Checking Kroger credentials");
    
    try {
      // First try to get Kroger status from the backend
      console.log("Getting Kroger connection status from backend");
      const status = await krogerAuthService.checkKrogerStatus();
      console.log("Backend Kroger status:", status);
      
      // If the backend says we're connected and have a store location, we're good to go
      if (status && status.is_connected && status.store_location) {
        console.log("Backend reports valid Kroger connection with store location:", status.store_location);
        
        // Update localStorage with the store location from the backend for consistency
        localStorage.setItem('kroger_store_location', status.store_location);
        localStorage.setItem('kroger_store_location_id', status.store_location);
        localStorage.setItem('kroger_store_selected', 'true');
        localStorage.setItem('kroger_connected', 'true');
        
        // Clear any store selection flags to prevent the dialog from showing again
        sessionStorage.removeItem('kroger_needs_store_selection');
        
        return true;
      }
      
      // If connected but no store location, show the store selector
      if (status && status.is_connected && !status.store_location) {
        console.log("Connected but no store location set in backend, showing store selector");
        setCurrentStore('kroger');
        setShowStoreSelector(true);
        return false;
      }
      
      // If we get here, we're not properly connected according to the backend
      console.log("Not properly connected according to backend, checking local state");
    } catch (err) {
      console.error("Error checking Kroger status with backend:", err);
      console.log("Falling back to client-side state checks");
    }
    
    // Fall back to checking client-side state
    const storeSelectionComplete = sessionStorage.getItem('kroger_store_selection_complete') === 'true';
    const storeSelectionDone = localStorage.getItem('kroger_store_selection_done') === 'true'; 
    const storeLocation = localStorage.getItem('kroger_store_location') || 
                          localStorage.getItem('kroger_store_location_id');
    const isConnected = localStorage.getItem('kroger_connected') === 'true';
    
    // If we have a recent store selection with location, we're good
    if ((storeSelectionComplete || storeSelectionDone) && storeLocation) {
      console.log("Store selection is complete and we have a location from client-side");
      localStorage.setItem('kroger_connected', 'true');
      return true;
    }
    
    // If connected but no store location, show the store selector
    if (isConnected && !storeLocation) {
      console.log("Connected but no store location from client-side, showing store selector");
      setCurrentStore('kroger');
      setShowStoreSelector(true);
      return false;
    }
    
    // If connected with store location, we're good
    if (isConnected && storeLocation) {
      console.log("Connected with store location from client-side");
      return true;
    }
    
    // Not connected at all, show reconnect dialog
    console.log("Not connected according to client-side state, showing reconnect dialog");
    showKrogerError(
      "Kroger Connection Required",
      "You need to connect your Kroger account before searching for items.",
      true
    );
    return false;
  };

  const handleStoreSearch = async (store) => {
    try {
      // Only check Kroger credentials if this is a Kroger search
      if (store === 'kroger') {
        // First, check if we have any items to search
        const storeItems = internalCart[store].map(item => item.name);
        if (storeItems.length === 0) {
          setError(`No items assigned to ${store}`);
          return;
        }
        
        // First try the backend for connection status
        try {
          console.log('Checking Kroger connection status with backend...');
          const status = await krogerAuthService.checkKrogerStatus();
          console.log('Backend connection status check result:', status);
          
          // If we have a valid connection with a store location, we can proceed
          if (status.is_connected && status.store_location) {
            console.log('Backend reports valid connection with store location:', status.store_location);
            
            // Update local storage with backend data for consistency
            localStorage.setItem('kroger_store_location', status.store_location);
            localStorage.setItem('kroger_store_location_id', status.store_location);
            localStorage.setItem('kroger_store_selected', 'true');
            localStorage.setItem('kroger_connected', 'true');
            
            // Clear any flags that would trigger store selection
            sessionStorage.removeItem('kroger_needs_store_selection');
            
            // Proceed with search (handled after this if block)
          } 
          // If connected but no store location, show store selector
          else if (status.is_connected && !status.store_location) {
            console.log('Backend reports connected but no store location set');
            setCurrentStore(store);
            setShowStoreSelector(true);
            return;
          }
          // If not connected at all, show reconnect dialog
          else if (!status.is_connected) {
            console.log('Backend reports not connected, showing reconnect dialog');
            showKrogerError(
              "Kroger Connection Required",
              "You need to connect your Kroger account before searching for items.",
              true
            );
            return;
          }
        } catch (statusError) {
          console.error('Error checking backend connection status:', statusError);
          
          // Fall back to client-side checks if backend check fails
          console.log('Falling back to client-side state checks...');
          
          // Check if store selection is needed
          const needsStoreSelection = sessionStorage.getItem('kroger_needs_store_selection') === 'true';
          
          // Check for store selection status
          const storeLocation = localStorage.getItem('kroger_store_location') || 
                              localStorage.getItem('kroger_store_location_id');
          const storeSelected = localStorage.getItem('kroger_store_selected') === 'true' || 
                              localStorage.getItem('kroger_store_configured') === 'true' ||
                              sessionStorage.getItem('kroger_store_selection_complete') === 'true' ||
                              localStorage.getItem('kroger_store_selection_done') === 'true';
          
          // Check connection status from client-side flags
          const isConnected = localStorage.getItem('kroger_connected') === 'true';
          
          // If not connected, show reconnect dialog
          if (!isConnected) {
            console.log('Not connected according to client-side data, showing connect dialog');
            showKrogerError(
              "Kroger Connection Required",
              "You need to connect your Kroger account before searching for items.",
              true
            );
            return;
          }
          
          // If connected but needs store selection or no store selected, show selector
          if (needsStoreSelection || !storeLocation || !storeSelected) {
            console.log('Store selection needed, showing store selector');
            setCurrentStore(store);
            setShowStoreSelector(true);
            return;
          }
          
          console.log('Connected and store selected according to client-side data, proceeding with search');
        }
      }
      
      // Start the search process
      setLoading(prev => ({ ...prev, search: true }));
      setError(null);
      
      // Get store items to search
      const storeItems = internalCart[store].map(item => item.name);
      setLastSearchedItems(storeItems);
      
      if (storeItems.length === 0) {
        setError(`No items assigned to ${store}`);
        return;
      }

      // Choose the appropriate search function
      const searchFunction = store === 'kroger' 
        ? apiService.searchKrogerItems 
        : apiService.searchWalmartItems;

      // Execute the search
      const response = await searchFunction(storeItems);

      // Handle various response scenarios
      if (!response.success) {
        if (response.needs_setup || response.client_side_error) {
          // Show store selector
          setCurrentStore(store);
          setShowStoreSelector(true);
          return;
        } else if (response.needs_reconnect) {
          showKrogerError(
            "Kroger Authentication Required",
            "Your Kroger session has expired. Please reconnect your account to continue.",
            true
          );
          return;
        } else if (response.redirect) {
          window.location.href = response.redirect;
          return;
        }
        
        setError(response.message || `Failed to search ${store} items`);
        return;
      }

      // Update search results on success
      setSearchResults(prev => ({
        ...prev,
        [store]: response.results
      }));
      
      // Clear any store selection flags now that we've successfully searched
      sessionStorage.removeItem('kroger_needs_store_selection');

    } catch (err) {
      console.error(`Failed to search ${store} items:`, err);
      
      // Always set database schema issue flag on errors
      localStorage.setItem('database_schema_issue', 'true');
      
      // For Kroger, check if we need to reconnect
      if (store === 'kroger') {
        const isConnected = localStorage.getItem('kroger_connected') === 'true';
        
        if (isConnected) {
          setError("Error searching items. Please try again or reconnect your Kroger account.");
        } else {
          showKrogerError(
            "Kroger Authentication Required",
            "Please connect your Kroger account to continue.",
            true
          );
        }
      } else {
        setError(`Failed to search ${store} items: ${err.message || 'Unknown error'}`);
      }
    } finally {
      setLoading(prev => ({ ...prev, search: false }));
    }
  };

  const handleKrogerAuthError = async () => {
    try {
      // First attempt to refresh the token
      console.log("Attempting to refresh Kroger token via auth service");
      const refreshResult = await krogerAuthService.getKrogerToken();
      
      if (refreshResult.success) {
        setSnackbarMessage("Kroger connection refreshed successfully");
        setSnackbarOpen(true);
        return true;
      } else {
        // If refresh fails, show reconnect dialog
        console.log("Token refresh failed, showing reconnect dialog");
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
      // Close any open error dialog
      setShowErrorDialog(false);
      
      // Show connecting message
      setSnackbarMessage("Redirecting to Kroger login for cart access...");
      setSnackbarOpen(true);
      
      console.log('Initiating Kroger reconnection for cart operations');
      
      // Mark the starting time of the reconnection attempt
      const reconnectStartTime = Date.now();
      localStorage.setItem('kroger_reconnect_start_time', reconnectStartTime.toString());
      
      // Remove any schema issue flag to try backend first
      localStorage.removeItem('database_schema_issue');
      
      // Use krogerAuthService to handle reconnection with proper fallbacks
      try {
        console.log('Using krogerAuthService to handle reconnection');
        await krogerAuthService.reconnectKroger();
        
        // No further actions needed because krogerAuthService will handle the redirect
        return;
      } catch (serviceError) {
        console.error('Error using krogerAuthService for reconnection:', serviceError);
        
        // If the service fails, fall back to direct OAuth URL construction
        console.log('Falling back to direct OAuth URL construction');
        
        // Use hardcoded client ID for consistency (same as in krogerAuthService)
        const clientId = 'smartmealplannerio-243261243034247652497361364a447078555731455949714a464f61656e5a676b444e552e42796961517a4f4576367156464b3564774c3039777a614700745159802496692';
        const redirectUri = 'https://smart-meal-planner-multi.vercel.app/kroger/callback';
        // These scopes are for authorization_code flow which is used in user OAuth process
        // Make sure to include cart.basic:write scope for cart operations
        const scope = 'product.compact cart.basic:write profile.compact';
        const state = Math.random().toString(36).substring(2, 15);
        
        // Log the client ID and redirect URI being used
        console.log("Using hardcoded values:", { 
          clientId: clientId.substring(0, 10) + '...',
          redirectUri
        });
        
        // Store the state to verify when we're redirected back
        localStorage.setItem('kroger_auth_state', state);
        
        // Clear any existing store selection flags to ensure fresh selection
        sessionStorage.removeItem('kroger_store_selection_complete');
        localStorage.removeItem('kroger_store_selection_done');
        sessionStorage.removeItem('kroger_needs_store_selection');
        
        // Explicitly set these flags to help with debugging
        localStorage.setItem('kroger_reconnect_attempted', 'true');
        localStorage.setItem('kroger_auth_pending', 'true');
        
        // Construct the OAuth URL directly
        const authUrl = `https://api.kroger.com/v1/connect/oauth2/authorize?scope=${encodeURIComponent(scope)}&response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&state=${state}`;
        
        console.log("Redirecting directly to:", authUrl);
        window.location.href = authUrl;
      }
      
      // Set a backup timer to detect if redirect doesn't happen (browser popup blocked, etc)
      setTimeout(() => {
        const currentTime = Date.now();
        const startTime = parseInt(localStorage.getItem('kroger_reconnect_start_time') || '0', 10);
        
        if (currentTime - startTime >= 3000 && document.visibilityState !== 'hidden') {
          console.error("Redirect didn't happen! Possible popup blocking or other issue");
          setError("Failed to open Kroger login. Please check if popups are blocked in your browser.");
          
          // Clean up flags if redirect fails
          localStorage.removeItem('kroger_reconnect_attempted');
          localStorage.removeItem('kroger_auth_pending');
        }
      }, 3000);
      
    } catch (err) {
      console.error("Kroger reconnect error:", err);
      setError("Failed to reconnect to Kroger. Please try again.");
      
      // Clean up flags on error
      localStorage.removeItem('kroger_reconnect_attempted');
      localStorage.removeItem('kroger_auth_pending');
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
        
        // Check for reconnection needed - we need a user-authorized token with cart.basic:write scope
        if (!response.success) {
          console.log('Kroger error response:', response);
          
          // Check for needs_reconnect flag or specific error messages
          if (response.needs_reconnect || 
              response.message === "An unexpected error occurred" ||
              (response.message && response.message.includes("Server needs restarting"))) {
            
            console.log('Kroger reconnection needed');
            showKrogerError(
              "Kroger Cart Authorization Required", 
              "Your Kroger session requires cart permissions. Please reconnect your account to add items to cart.",
              true
            );
            setLoading(prev => ({ ...prev, cart: false }));
            return;
          }
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
        console.log('Updating Kroger store location to:', locationId);
        
        // Save the location ID locally right away for fast client-side tracking
        localStorage.setItem('kroger_store_location', locationId);
        localStorage.setItem('kroger_store_location_id', locationId);
        localStorage.setItem('kroger_store_selected', 'true');
        localStorage.setItem('kroger_store_timestamp', Date.now().toString());
        localStorage.setItem('kroger_store_configured', 'true');
        
        // Set flags to prevent location selection loops
        sessionStorage.setItem('kroger_store_selection_complete', 'true');
        localStorage.setItem('kroger_store_selection_done', 'true');
        
        // Clear the store selection needed flag
        sessionStorage.removeItem('kroger_needs_store_selection');
        
        // First try to update the location with the backend - critical for persistence!
        console.log("Updating store location in backend DB...");
        apiService.updateKrogerLocation(locationId)
          .then(response => {
            console.log("Backend store location update response:", response);
            if (response && response.success) {
              console.log("Successfully updated store location in backend DB");
            } else {
              console.warn("Backend returned non-success response:", response);
              // We'll continue anyway since we have the location stored locally
            }
          })
          .catch(updateErr => {
            console.error('Error updating store location with backend:', updateErr);
            
            // Check if this is a database schema issue
            if (updateErr.response?.data?.error?.includes('client_id') || 
                updateErr.response?.data?.error?.includes('column')) {
              console.log("Database schema issue detected, setting flag");
              localStorage.setItem('database_schema_issue', 'true');
            }
            
            // Continue despite the error - we'll use the locally stored location
          });
        
        // Always close the store selector dialog
        setShowStoreSelector(false);
        
        // Show success message regardless of backend success
        setSnackbarMessage('Store location updated successfully');
        setSnackbarOpen(true);
        
        // Wait a short time before attempting search to ensure storage is updated
        if (lastSearchedItems && lastSearchedItems.length > 0) {
          try {
            console.log('Attempting search with newly selected store after delay...');
            
            // Small delay to ensure all updates are complete
            setTimeout(async () => {
              try {
                await handleStoreSearch('kroger');
              } catch (delayedSearchErr) {
                console.error('Error in delayed search:', delayedSearchErr);
                setSnackbarMessage('Store selected but search failed. Please try searching again.');
                setSnackbarOpen(true);
              }
            }, 500);
          } catch (searchErr) {
            console.error('Error setting up delayed search:', searchErr);
            // Show a warning but don't block the user
            setSnackbarMessage('Store selected but search failed. Please try searching again.');
            setSnackbarOpen(true);
          }
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

  // Already defined earlier in the file, removing duplicate

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