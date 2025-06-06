// src/pages/CartPage.jsx
import React, { useState, useEffect } from 'react';
import InstacartCarrotIcon from '../assets/instacart/Instacart_Carrot.png';
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
  DialogActions,
  Paper,
  Accordion,
  AccordionSummary,
  AccordionDetails
} from '@mui/material';
import {
  Delete as DeleteIcon,
  Refresh as RefreshIcon,
  Clear as ClearIcon,
  Add as AddIcon,
  Remove as RemoveIcon,
  ShoppingCart as ShoppingCartIcon,
  Error as ErrorIcon,
  ExpandMore as ExpandMoreIcon,
  BugReport as BugReportIcon
} from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import { useNavigate } from 'react-router-dom';
import KrogerResults from '../components/KrogerResults';
// Walmart API integration removed due to API access issues
import InstacartResults from '../components/InstacartResults';
import InstacartRetailerSelector from '../components/InstacartRetailerSelector';
import InstacartSimpleTester from '../components/InstacartSimpleTester';
import { StoreSelector } from '../components/StoreSelector';
import krogerAuthService from '../services/krogerAuthService';
import instacartBackendService from '../services/instacartBackendService';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({
      error: error,
      errorInfo: errorInfo
    });
    console.error("CartPage Error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return null; // Don't show error UI to users
    }

    return this.props.children;
  }
}

function CartPage() {
  console.log("⚠️ DEBUG: CartPage rendering started");

  // All hooks must be called at the top level, not inside conditions
  const { user } = useAuth();
  console.log("⚠️ DEBUG: useAuth called", user);

  const navigate = useNavigate();
  console.log("⚠️ DEBUG: useNavigate called");

  const [showStoreSelector, setShowStoreSelector] = useState(false);
  const [showInstacartRetailerSelector, setShowInstacartRetailerSelector] = useState(false);
  const [currentStore, setCurrentStore] = useState(null);
  const [lastSearchedItems, setLastSearchedItems] = useState([]);
  const [instacartRetailer, setInstacartRetailer] = useState(() => {
    // Try to get from localStorage with safe parsing
    try {
      const savedRetailer = localStorage.getItem('instacart_retailer');
      if (savedRetailer && savedRetailer !== 'undefined' && savedRetailer !== 'null') {
        return JSON.parse(savedRetailer);
      }
    } catch (err) {
      console.error('Error parsing saved Instacart retailer:', err);
      // Clear bad data
      localStorage.removeItem('instacart_retailer');
    }
    // Default value
    return { id: 'publix', name: 'Publix' };
  });
  const [zipCode, setZipCode] = useState(() => {
    // Try to get from localStorage
    return localStorage.getItem('instacart_zip_code') || '';
  });

  const [internalCart, setInternalCart] = useState({
    kroger: [],
    instacart: []
  });

  const [searchResults, setSearchResults] = useState({
    kroger: [],
    instacart: []
  });

  const [loading, setLoading] = useState({
    cart: false,
    search: false,
    kroger: false,
    instacart: false
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

  // Instacart Shopping List state
  const [creatingShoppingList, setCreatingShoppingList] = useState(false);
  const [shoppingListUrl, setShoppingListUrl] = useState(null);
  const [showShoppingListDialog, setShowShoppingListDialog] = useState(false);

  console.log("⚠️ DEBUG: All hooks initialized");

  // Define all helper functions before they're used in any hooks
  const handleError = (err) => {
    console.log("⚠️ DEBUG: handleError called", err);
    if (!err) {
      setError('An unknown error occurred');
      setSnackbarMessage('An unknown error occurred');
      setSnackbarOpen(true);
      return;
    }

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
    console.log("⚠️ DEBUG: showKrogerError called", {title, message, needsReconnect});
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

  const clearSearchResults = (store) => {
    console.log("⚠️ DEBUG: clearSearchResults called", store);
    if (store) {
      setSearchResults(prev => ({ ...prev, [store]: [] }));
    } else {
      setSearchResults({ kroger: [], instacart: [] });
    }
  };

  const loadInternalCart = async () => {
    console.log("⚠️ DEBUG: loadInternalCart called", user?.userId);
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.getCartContents(user.userId);
      console.log("⚠️ DEBUG: Cart API response:", response);

      if (response?.status === 'success' && response?.cart) {
        console.log("⚠️ DEBUG: Setting cart data:", response.cart);
        setInternalCart(response.cart);
      }
    } catch (err) {
      console.error('⚠️ DEBUG: Cart load error:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const assignStore = async (items, store) => {
    console.log("⚠️ DEBUG: assignStore called", {items, store});
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.assignStoreToItems(user.userId, items, store);

      if (response.status === 'success' && response.cart) {
        setInternalCart(response.cart);
        setSnackbarMessage(`Items assigned to ${store ? store : 'store'}`);
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('⚠️ DEBUG: Store assignment error:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const checkKrogerCredentials = async () => {
    console.log("⚠️ DEBUG: Checking Kroger credentials");

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
    console.log("⚠️ DEBUG: handleStoreSearch called", store);
    try {
      // Make sure to reset search loading state
      setLoading(prev => ({ ...prev, search: false }));

      // Only check Kroger credentials if this is a Kroger search
      if (store === 'kroger') {
        // First, check if we have any items to search
        const storeItems = internalCart[store].map(item => item.name);
        if (storeItems.length === 0) {
          setError(`No items assigned to ${store}`);
          return;
        }

        // Pre-emptively set all store selection flags for better persistence
        const clientStoreLocation = localStorage.getItem('kroger_store_location') ||
                                   localStorage.getItem('kroger_store_location_id');

        if (clientStoreLocation) {
          console.log('Found store location in client storage:', clientStoreLocation);
          console.log('Setting all store selection flags for consistency');

          // Set all possible flags to ensure consistent experience
          localStorage.setItem('kroger_store_location', clientStoreLocation);
          localStorage.setItem('kroger_store_location_id', clientStoreLocation);
          localStorage.setItem('kroger_store_selected', 'true');
          localStorage.setItem('kroger_store_configured', 'true');
          localStorage.setItem('kroger_store_selection_done', 'true');
          sessionStorage.setItem('kroger_store_selection_complete', 'true');
          sessionStorage.removeItem('kroger_needs_store_selection');

          // Also update backend with this store location to ensure consistency
          console.log('Updating backend with client store location');
          apiService.updateKrogerLocation(clientStoreLocation)
            .then(updateResult => {
              console.log('Backend store location update result:', updateResult);
            })
            .catch(updateErr => {
              console.error('Error updating backend store location:', updateErr);
              // Continue despite errors - we've already set local flags
            });
        }

        // First try the backend for connection status
        try {
          console.log('Checking Kroger connection status with backend...');
          const status = await krogerAuthService.checkKrogerStatus();
          console.log('Backend connection status check result:', status);

          // If we have a valid connection with a store location, we can proceed
          if (status.is_connected && (status.store_location || status.store_location_id)) {
            console.log('Backend reports valid connection with store location:',
              status.store_location || status.store_location_id);

            // Get the store location from the response
            const backendStoreLocation = status.store_location || status.store_location_id;

            // Update local storage with backend data for consistency
            localStorage.setItem('kroger_store_location', backendStoreLocation);
            localStorage.setItem('kroger_store_location_id', backendStoreLocation);
            localStorage.setItem('kroger_store_selected', 'true');
            localStorage.setItem('kroger_store_configured', 'true');
            localStorage.setItem('kroger_connected', 'true');
            localStorage.setItem('kroger_store_selection_done', 'true');
            sessionStorage.setItem('kroger_store_selection_complete', 'true');

            // Clear any flags that would trigger store selection
            sessionStorage.removeItem('kroger_needs_store_selection');

            // Proceed with search (handled after this if block)
          }
          // If connected but no store location in backend BUT we have one in localStorage
          else if (status.is_connected && !status.store_location && !status.store_location_id && clientStoreLocation) {
            console.log('Backend connected but missing store location, using client location:', clientStoreLocation);

            // Try to update the backend with our local store location
            try {
              const updateResult = await apiService.updateKrogerLocation(clientStoreLocation);
              console.log('Updated backend with client store location:', updateResult);

              // No need to show store selector, proceed with the search
              console.log('Using client-side store location for search');
            } catch (updateError) {
              console.error('Error updating backend with client store location:', updateError);
              // Continue anyway - we'll use the client location for the search
            }
          }
          // If connected but no store location, show store selector
          else if (status.is_connected && !status.store_location && !status.store_location_id && !clientStoreLocation) {
            console.log('No store location in backend or client, showing store selector');
            setCurrentStore(store);
            setShowStoreSelector(true);
            setLoading(prev => ({ ...prev, search: false }));
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
            setLoading(prev => ({ ...prev, search: false }));
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
            setLoading(prev => ({ ...prev, search: false }));
            return;
          }

          // If connected but needs store selection or no store selected, show selector
          if (needsStoreSelection && (!storeLocation || !storeSelected)) {
            console.log('Store selection needed, showing store selector');
            setCurrentStore(store);
            setShowStoreSelector(true);
            setLoading(prev => ({ ...prev, search: false }));
            return;
          }

          console.log('Connected and store selected according to client-side data, proceeding with search');
        }
      }

      // Start the search process
      // Set loading state at the beginning of search
      setLoading(prev => ({ ...prev, search: true }));
      setError(null);

      // Get store items to search
      const storeItems = internalCart[store].map(item => item.name);
      setLastSearchedItems(storeItems);

      if (storeItems.length === 0) {
        setError(`No items assigned to ${store}`);
        setLoading(prev => ({ ...prev, search: false }));
        return;
      }

      // Choose the appropriate search function
      let searchFunction;
      if (store === 'kroger') {
        searchFunction = apiService.searchKrogerItems;
      } else if (store === 'instacart') {
        try {
          // Set loading state
          setLoading(prev => ({ ...prev, instacart: true }));

          // First check if the API is working
          console.log('Checking Instacart API status before search...');
          const apiStatus = await instacartBackendService.checkInstacartStatus();
          console.log('Instacart API status before search:', apiStatus);

          // If API is connected, attempt to use it directly for searching products
          if (apiStatus.is_connected) {
            console.log('Instacart API is connected, attempting to search products directly');

            try {
              // Get the retailer ID from localStorage
              const retailerId = instacartRetailer?.id;

              if (!retailerId) {
                console.warn('No retailer ID found, please select a retailer first');
                // Still proceed with basic mapping
                setSearchResults(prev => ({
                  ...prev,
                  instacart: internalCart.instacart.map(item => ({
                    id: item.name,
                    name: item.name,
                    original_query: item.name,
                    price: null,
                    image_url: null
                  }))
                }));
              } else {
                // Try to search for each item to get better product info
                console.log(`Searching for ${internalCart.instacart.length} items at retailer ${retailerId}`);

                const searchPromises = internalCart.instacart.map(async (item) => {
                  try {
                    // Use instacartBackendService for robust searching
                    const searchResults = await instacartBackendService.searchProducts(retailerId, item.name, 1);

                    if (searchResults && searchResults.length > 0) {
                      console.log(`Found match for "${item.name}":`, searchResults[0]);
                      return {
                        ...searchResults[0],
                        original_query: item.name
                      };
                    } else {
                      // Fall back to basic item info if no results
                      return {
                        id: item.name,
                        name: item.name,
                        original_query: item.name,
                        price: null,
                        image_url: null
                      };
                    }
                  } catch (searchErr) {
                    console.warn(`Error searching for "${item.name}":`, searchErr.message);
                    return {
                      id: item.name,
                      name: item.name,
                      original_query: item.name,
                      price: null,
                      image_url: null,
                      search_error: searchErr.message
                    };
                  }
                });

                // Wait for all searches to complete
                const searchResults = await Promise.all(searchPromises);

                // Update the search results with the product data
                setSearchResults(prev => ({
                  ...prev,
                  instacart: searchResults
                }));

                console.log('Updated search results with product data:', searchResults);
              }
            } catch (searchErr) {
              console.error('Error searching products:', searchErr);
              // Fall back to basic mapping
              setSearchResults(prev => ({
                ...prev,
                instacart: internalCart.instacart.map(item => ({
                  id: item.name,
                  name: item.name,
                  original_query: item.name,
                  price: null,
                  image_url: null
                }))
              }));
            }
          } else {
            // API is not connected, fall back to basic mapping
            console.log('Instacart API is not connected, using basic item mapping');
            setSearchResults(prev => ({
              ...prev,
              instacart: internalCart.instacart.map(item => ({
                id: item.name,
                name: item.name,
                original_query: item.name,
                price: null,
                image_url: null
              }))
            }));
          }
        } catch (err) {
          console.error('Error checking Instacart API status before search:', err);
          // Fall back to basic mapping on error
          setSearchResults(prev => ({
            ...prev,
            instacart: internalCart.instacart.map(item => ({
              id: item.name,
              name: item.name,
              original_query: item.name,
              price: null,
              image_url: null,
              error: err.message
            }))
          }));
        } finally {
          // Always make sure loading states are reset
          setLoading(prev => ({ ...prev, instacart: false, search: false }));
        }
        return;
      } else {
        // Fallback to avoid errors
        setError(`No search function available for store: ${store}`);
        setLoading(prev => ({ ...prev, search: false }));
        return;
      }

      // Execute the search
      const response = await searchFunction(storeItems);

      // Handle various response scenarios
      if (!response.success) {
        if (response.needs_setup || response.client_side_error) {
          // Before showing store selector, check if we already have a location in localStorage
          const savedStoreLocation = localStorage.getItem('kroger_store_location') ||
                                   localStorage.getItem('kroger_store_location_id');

          if (savedStoreLocation) {
            console.log('Store selection needed but found saved location:', savedStoreLocation);
            // Try updating backend and retrying search
            try {
              // Update backend with our saved location
              await apiService.updateKrogerLocation(savedStoreLocation);

              // Retry the search
              console.log('Retrying search with saved location');
              const retryResponse = await searchFunction(storeItems);

              if (retryResponse.success) {
                console.log('Retry search succeeded');
                // Update search results on success
                setSearchResults(prev => ({
                  ...prev,
                  [store]: retryResponse.results
                }));
                setLoading(prev => ({ ...prev, search: false }));
                return;
              }
            } catch (retryError) {
              console.error('Error retrying search with saved location:', retryError);
            }
          }

          // If we get here, we need to show the store selector
          console.log('Still need store selection, showing selector');
          setCurrentStore(store);
          setShowStoreSelector(true);
          setLoading(prev => ({ ...prev, search: false }));
          return;
        } else if (response.needs_reconnect) {
          showKrogerError(
            "Kroger Authentication Required",
            "Your Kroger session has expired. Please reconnect your account to continue.",
            true
          );
          setLoading(prev => ({ ...prev, search: false }));
          return;
        } else if (response.redirect) {
          window.location.href = response.redirect;
          return;
        }

        setError(response.message || `Failed to search ${store} items`);
        setLoading(prev => ({ ...prev, search: false }));
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
      console.error(`⚠️ DEBUG: Failed to search ${store} items:`, err);

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
      // Always reset all loading states in finally block
      setLoading(prev => ({
        ...prev,
        search: false,
        instacart: false,
        kroger: false
      }));
    }
  };

  const handleKrogerAuthError = async () => {
    console.log("⚠️ DEBUG: handleKrogerAuthError called");
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
    console.log("⚠️ DEBUG: handleReconnectKroger called");
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
        const redirectUri = 'https://smartmealplannerio.com/kroger/callback';
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
    console.log("⚠️ DEBUG: handleAddToCart called", {items, store});
    try {
      setLoading(prev => ({ ...prev, cart: true }));

      // For Kroger, first check if store selection is already done to avoid redundant prompts
      if (store === 'kroger') {
        // Check for store selection flags
        const storeLocation = localStorage.getItem('kroger_store_location') ||
                             localStorage.getItem('kroger_store_location_id');
        const storeSelected = localStorage.getItem('kroger_store_selected') === 'true' ||
                             localStorage.getItem('kroger_store_configured') === 'true' ||
                             sessionStorage.getItem('kroger_store_selection_complete') === 'true' ||
                             localStorage.getItem('kroger_store_selection_done') === 'true';

        console.log('Kroger store selection check before cart operation:', {
          storeLocation,
          storeSelected
        });

        // If we have a stored location and selection flag, set additional flags to prevent prompts
        if (storeLocation && storeSelected) {
          console.log('Store already selected, setting additional flags to prevent prompts');
          // Setting these flags will prevent the StoreSelector from showing
          sessionStorage.setItem('kroger_store_selection_complete', 'true');
          localStorage.setItem('kroger_store_selection_done', 'true');
          localStorage.setItem('kroger_store_selected', 'true');
          localStorage.setItem('kroger_store_configured', 'true');
          // Remove any store selection needed flag
          sessionStorage.removeItem('kroger_needs_store_selection');
        }
      }

      let response;

      // Use dedicated Kroger service for Kroger items
      if (store === 'kroger') {
        console.log('Using dedicated Kroger auth service for cart operation');
        response = await krogerAuthService.addToKrogerCart(items);

        // Check for reconnection needed - we need a user-authorized token with cart.basic:write scope
        if (!response.success) {
          console.log('Kroger error response:', response);

          // Check for needs_search flag (items without UPC codes)
          if (response.needs_search) {
            console.log('Items need to be searched first before adding to cart');
            setError('These items need to be searched for and selected before adding to cart. Please use the "Search Kroger" button first to find specific products.');
            setLoading(prev => ({ ...prev, cart: false }));
            return;
          }

          // Check for needs_setup flag (store selection needed)
          if (response.needs_setup) {
            console.log('Store selection needed according to response');
            // Try checking if we already have store location in localStorage before showing selector
            const storeLocation = localStorage.getItem('kroger_store_location') ||
                                 localStorage.getItem('kroger_store_location_id');

            if (storeLocation) {
              console.log('Found store location in localStorage:', storeLocation);
              // Use the stored location to update backend
              try {
                console.log('Updating backend with stored location');
                await apiService.updateKrogerLocation(storeLocation);
                // Retry cart operation
                console.log('Retrying cart operation with stored location');
                response = await krogerAuthService.addToKrogerCart(items);

                // If retry succeeds, continue with success flow
                if (response.success) {
                  console.log('Retry succeeded with stored location');
                  setSnackbarMessage(`Items added to Kroger cart successfully`);
                  setSnackbarOpen(true);
                  await loadInternalCart();
                  clearSearchResults(store);
                  setShowKrogerCartDialog(true);
                  setLoading(prev => ({ ...prev, cart: false }));
                  return;
                }
              } catch (updateErr) {
                console.error('Error updating backend with stored location:', updateErr);
                // Fall through to store selector if update fails
              }
            }

            // If we got here, we need to show store selector
            setCurrentStore('kroger');
            setShowStoreSelector(true);
            setLoading(prev => ({ ...prev, cart: false }));
            return;
          }

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
      console.error(`⚠️ DEBUG: Error adding to ${store} cart:`, err);

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
    console.log("⚠️ DEBUG: handleStoreSelect called", locationId);
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

        // IMPORTANT: Update the location with the backend FIRST before proceeding
        // This ensures cross-device persistence via the database
        let backendUpdateSuccess = false;
        try {
          console.log("Updating store location in backend DB...");
          const response = await apiService.updateKrogerLocation(locationId);

          console.log("Backend store location update response:", response);
          if (response && response.success) {
            console.log("Successfully updated store location in backend DB");
            backendUpdateSuccess = true;
          } else {
            console.warn("Backend returned non-success response:", response);
            // We'll continue with client-side only as fallback
          }
        } catch (updateErr) {
          console.error('Error updating store location with backend:', updateErr);

          // Check if this is a database schema issue
          if (updateErr.response?.data?.error?.includes('client_id') ||
              updateErr.response?.data?.error?.includes('column')) {
            console.log("Database schema issue detected, setting flag");
            localStorage.setItem('database_schema_issue', 'true');
          }
        }

        // Always close the store selector dialog
        setShowStoreSelector(false);

        // Show success message with info about backend persistence
        if (backendUpdateSuccess) {
          setSnackbarMessage('Store location saved to your account successfully');
        } else {
          setSnackbarMessage('Store location updated for this session');
        }
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
      console.error('⚠️ DEBUG: Store selection error:', err);

      // Handle gracefully - close dialog and show error in snackbar
      setShowStoreSelector(false);
      setSnackbarMessage('Error setting store location');
      setSnackbarOpen(true);
    }
  };

  const clearStoreItems = async (store) => {
    console.log("⚠️ DEBUG: clearStoreItems called", store);
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
      console.error('⚠️ DEBUG: Error clearing store items:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const updateItemQuantity = async (item, store, change) => {
    console.log("⚠️ DEBUG: updateItemQuantity called", {item, store, change});
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
      console.error('⚠️ DEBUG: Error updating item quantity:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  const removeItem = async (item, store) => {
    console.log("⚠️ DEBUG: removeItem called", {item, store});
    try {
      setLoading(prev => ({ ...prev, cart: true }));
      const response = await apiService.removeCartItem(user.userId, item.name, store);

      if (response.status === 'success') {
        await loadInternalCart();
        setSnackbarMessage('Item removed from cart');
        setSnackbarOpen(true);
      }
    } catch (err) {
      console.error('⚠️ DEBUG: Error removing item:', err);
      handleError(err);
    } finally {
      setLoading(prev => ({ ...prev, cart: false }));
    }
  };

  /**
   * Creates a direct Instacart shopping list from cart items
   * Using the Create Shopping List Page API
   */
  const createInstacartShoppingList = async () => {
    try {
      // Validate we have retailer ID and items
      if (!instacartRetailer?.id) {
        setError('Please select an Instacart retailer first');
        setShowInstacartRetailerSelector(true);
        return;
      }

      if (!internalCart.instacart || !Array.isArray(internalCart.instacart) || internalCart.instacart.length === 0) {
        setError('No items in your Instacart cart');
        return;
      }

      // Start creating shopping list
      setCreatingShoppingList(true);
      setSnackbarMessage('Creating Instacart shopping list...');
      setSnackbarOpen(true);

      // Extract item names with quantities from the cart
      const cartItems = internalCart.instacart.map(item => {
        // Ensure each item is properly formatted as a string
        if (!item) return null;

        // Convert object items to strings
        if (typeof item === 'object') {
          // Handle item with quantity
          if (item.name) {
            // Fix for redundancy in units - clean item properties for consistent formatting
            let formattedQuantity = '';

            // Log item to help debug format issues
            console.log('Processing item:', item);

            // Parse quantity from item name if it's embedded (like "1 lb Beef (ground)")
            let parsedQuantity = item.quantity;
            let cleanName = item.name;

            // Check if the name contains quantity information at the beginning
            // Pattern 1: Quantity with unit (e.g., "1 lb Beef (ground)", "2 tbsp Olive Oil")
            const quantityWithUnitPattern = /^(\d+(?:\.\d+)?(?:\/\d+)?)\s*(lb|lbs|oz|g|kg|cup|cups|tbsp|tsp|cloves?|pieces?|medium|large|small|cans?|slices?)\s+(.+)$/i;
            const quantityWithUnitMatch = item.name.match(quantityWithUnitPattern);

            // Pattern 2: Quantity without unit (e.g., "8 Corn Tortillas", "2 Bell Pepper")
            const quantityOnlyPattern = /^(\d+(?:\.\d+)?(?:\/\d+)?)\s+(.+)$/i;
            const quantityOnlyMatch = item.name.match(quantityOnlyPattern);

            if (quantityWithUnitMatch) {
              // Extract quantity, unit, and clean name
              const [, quantity, unit, ingredientName] = quantityWithUnitMatch;

              // Handle fractions
              if (quantity.includes('/')) {
                const [numerator, denominator] = quantity.split('/');
                parsedQuantity = parseFloat(numerator) / parseFloat(denominator);
              } else {
                parsedQuantity = parseFloat(quantity);
              }

              cleanName = ingredientName;
              console.log(`Parsed with unit "${item.name}" -> quantity: ${parsedQuantity}, unit: ${unit}, name: "${cleanName}"`);

              // Return the properly formatted item for Instacart
              return `${parsedQuantity} ${unit} ${cleanName}`;
            } else if (quantityOnlyMatch) {
              // Extract quantity and clean name (no unit)
              const [, quantity, ingredientName] = quantityOnlyMatch;

              // Handle fractions
              if (quantity.includes('/')) {
                const [numerator, denominator] = quantity.split('/');
                parsedQuantity = parseFloat(numerator) / parseFloat(denominator);
              } else {
                parsedQuantity = parseFloat(quantity);
              }

              cleanName = ingredientName;
              console.log(`Parsed without unit "${item.name}" -> quantity: ${parsedQuantity}, name: "${cleanName}"`);

              // Return the properly formatted item for Instacart
              return `${parsedQuantity} ${cleanName}`;
            }

            // If we reach here, parsing didn't match any patterns, use original logic
            console.log(`No parsing patterns matched for "${item.name}", using original logic`);

            if (item.quantity) {
              // If quantity already includes the unit (e.g., "2 cups"), use it directly
              if (typeof item.quantity === 'string' &&
                  (item.quantity.includes(' ') ||
                   item.quantity.toLowerCase() === 'to taste')) {
                formattedQuantity = item.quantity;
              }
              // For cases with redundant unit information, clean it up
              else if (item.unitOfMeasure || item.unit) {
                // Use only one unit source (not both) to avoid redundancy
                const unit = item.unitOfMeasure || item.unit;

                // Avoid redundant units where item.quantity already contains the unit
                // Check if quantity already ends with the unit
                if (typeof item.quantity === 'string' &&
                    (item.quantity.endsWith(unit) ||
                     item.quantity.toLowerCase().endsWith(unit.toLowerCase()))) {
                  formattedQuantity = item.quantity;
                } else {
                  // Handle case where we have both unitOfMeasure and unit with the same value
                  if (item.unitOfMeasure && item.unit &&
                      item.unitOfMeasure === item.unit) {
                    // Use only one instance of the unit
                    formattedQuantity = `${item.quantity} ${item.unit}`;
                  } else {
                    formattedQuantity = `${item.quantity} ${unit}`;
                  }
                }
              }
              // If no unit but has quantity, just use the quantity
              else if (item.quantity !== 1) {
                formattedQuantity = `${item.quantity}`;
              }
            }

            // Return properly formatted item with quantity in parentheses if available
            if (formattedQuantity && formattedQuantity !== '1') {
              return `${item.name} (${formattedQuantity})`;
            }
            return item.name;
          }
          return null;
        }

        // For simple string items
        return item;
      }).filter(Boolean); // Remove any null/undefined items

      // Double check we have items after filtering
      if (cartItems.length === 0) {
        setError('No valid items found in your Instacart cart');
        setCreatingShoppingList(false);
        return;
      }

      console.log(`Creating shopping list with ${cartItems.length} items for retailer ${instacartRetailer.id}`);
      console.log('First few items:', cartItems.slice(0, 3));

      // Clean retailer ID
      let retailerId = instacartRetailer.id;

      // Ensure retailer ID is a valid format (not numeric or containing special characters)
      if (!retailerId || retailerId.startsWith('retailer_') || /^\d+$/.test(retailerId)) {
        console.warn(`Invalid retailer ID detected: "${retailerId}", using "kroger" as fallback`);
        retailerId = 'kroger';  // Default to a known working retailer
      }

      // Call the backend service with the validated retailer ID
      const result = await instacartBackendService.createShoppingListUrl(
        retailerId,
        cartItems
      );

      if (result.success && result.url) {
        // Set the URL and show dialog
        setShoppingListUrl(result.url);
        setShowShoppingListDialog(true);
        setSnackbarMessage(`Shopping list created with ${result.item_count} items`);
        setSnackbarOpen(true);
      } else {
        // Better error handling
        let errorMessage = 'Failed to create shopping list';

        if (result.error) {
          errorMessage = result.error;
        }

        // Check for specific status codes
        if (result.status === 502) {
          errorMessage = 'Unable to connect to Instacart API. Please try again later.';
        } else if (result.status === 500) {
          // For 500 errors, check if there's a more detailed message in the response data
          if (result.data && result.data.detail) {
            errorMessage = `Server error: ${result.data.detail}`;
          } else {
            errorMessage = 'Server error while creating shopping list. Please try again.';
          }
        }

        throw new Error(errorMessage);
      }
    } catch (error) {
      console.error('Error creating Instacart shopping list:', error);

      // Create a user-friendly error message
      let userMessage = error.message || 'Unknown error';

      // Add specific advice for common error patterns
      if (userMessage.includes('API key')) {
        userMessage = 'Instacart API configuration error. Please contact support at support@smartmealplannerio.com.';
      } else if (userMessage.includes('timeout') || userMessage.includes('network')) {
        userMessage = 'Network timeout while connecting to Instacart. Please try again.';
      } else if (userMessage.includes('retailer')) {
        userMessage = 'Invalid retailer selection. Please try selecting a different retailer.';
      }

      setError(`Error creating shopping list: ${userMessage}`);

      // Show try again message after a short delay for serious errors
      if (error.response?.status >= 500 || error.message.includes('network')) {
        setTimeout(() => {
          setSnackbarMessage('Please try again or check with different items');
          setSnackbarOpen(true);
        }, 3000);
      }
    } finally {
      setCreatingShoppingList(false);
      setLoading(prev => ({ ...prev, instacart: false }));
    }
  };

  const renderStoreSection = (store, items, searchFn, ResultsComponent) => {
    // Make sure store is defined with a safe default for logging
    const safeStore = store || 'unknown';

    console.log(`⚠️ DEBUG: Rendering store section for ${safeStore}`, {
      store: safeStore,
      hasItems: items && items.length > 0,
      numberOfItems: items ? items.length : 0,
      searchFnProvided: Boolean(searchFn),
      ComponentProvided: Boolean(ResultsComponent)
    });

    try {
      // Defensive type checks - return early with error card if store is falsy
      if (!store) {
        return null; // Just return null to avoid rendering anything when store is falsy
      }

      // Safely get store name with capitalization
      let storeName = 'Unknown Store';
      if (store && typeof store === 'string') {
        if (store.length > 0) {
          // Extra safety check to ensure charAt doesn't fail
          try {
            storeName = `${store.charAt(0).toUpperCase()}${store.slice(1)}`;
          } catch (err) {
            console.error("Error capitalizing store name:", err);
            storeName = store; // Fallback to original store string
          }
        } else {
          storeName = "Store"; // Default if empty string
        }
      } else {
        console.warn(`Store is not a valid string: ${typeof store}`);
        return (
          <Card sx={{ mb: 4, p: 2, backgroundColor: '#fff3e0' }}>
            <Typography variant="h6" color="warning.main">Invalid Store Type</Typography>
            <Typography variant="body2">Expected string, received: {typeof store}</Typography>
          </Card>
        );
      }

      // Initial check for items array with defensive handling
      if (!items) {
        console.warn(`⚠️ DEBUG: Items is ${items} for ${store}`);
        items = [];
      } else if (!Array.isArray(items)) {
        console.warn(`⚠️ DEBUG: Items is not an array for ${store}:`, items);
        items = [];
      }

      // Check for search function
      if (!searchFn) {
        console.warn(`⚠️ DEBUG: No search function for ${store}`);
        searchFn = () => {
          console.log(`No search function provided for ${store}`);
          setError(`Cannot search for ${store} items - no search function available`);
        };
      }

      // Check for results component
      if (!ResultsComponent) {
        console.warn(`⚠️ DEBUG: No results component for ${store}`);
        return (
          <Card sx={{ mb: 4 }}>
            <CardContent>
              <Typography>No results component available for {storeName}</Typography>
            </CardContent>
          </Card>
        );
      }

      // Check if searchResults exists for this store with defensive checks
      const hasSearchResults = Boolean(
        searchResults &&
        typeof searchResults === 'object' &&
        store &&
        searchResults[store] &&
        Array.isArray(searchResults[store]) &&
        searchResults[store].length > 0
      );

      console.log(`⚠️ DEBUG: ${store} has search results: ${hasSearchResults}`);

      return (
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                {`${storeName} Items`}
              </Typography>
              <Box>
                <Tooltip title="Clear all items">
                  <IconButton
                    size="small"
                    onClick={() => clearStoreItems(store)}
                    disabled={!items || items.length === 0 || loading.cart}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Clear search results">
                  <IconButton
                    size="small"
                    onClick={() => clearSearchResults(store)}
                    disabled={!hasSearchResults}
                  >
                    <ClearIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {!items || items.length === 0 ? (
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
                      <Typography>{item?.name || "Unnamed item"}</Typography>
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
                  disabled={loading.search || (store && loading[store])}
                  startIcon={loading[store] ? <CircularProgress size={20} /> : <RefreshIcon />}
                >
                  {`Search ${storeName}`}
                </Button>

                {hasSearchResults && (
                  <Box sx={{ mt: 2 }}>
                    <ErrorBoundary>
                      <ResultsComponent
                        results={searchResults[store]}
                        onAddToCart={(items) => handleAddToCart(items, store)}
                      />
                    </ErrorBoundary>
                  </Box>
                )}
              </>
            )}
          </CardContent>
        </Card>
      );
    } catch (err) {
      console.error(`⚠️ DEBUG: Error rendering store section for ${store}:`, err);
      return (
        <Card sx={{ mb: 4, p: 2, backgroundColor: '#ffebee' }}>
          <Typography variant="h6" color="error">Error in {store || 'unknown'} section</Typography>
          <Typography variant="body2" component="pre" style={{ whiteSpace: 'pre-wrap' }}>
            {err ? err.toString() : 'Unknown error'}
          </Typography>
        </Card>
      );
    }
  };

  // Load cart contents on mount
  useEffect(() => {
    console.log("⚠️ DEBUG: Cart load effect triggered", user);
    if (user?.userId) {
      loadInternalCart();
    }
  }, [user]);

  // Process Kroger auth data when loading the cart page
  useEffect(() => {
    console.log("⚠️ DEBUG: Kroger auth effect triggered");
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
              krogerAuthRedirectUri || 'https://smartmealplannerio.com/kroger/callback'
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

  console.log("⚠️ DEBUG: About to render main component UI");
  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" gutterBottom>
        Shopping Cart
      </Typography>


      {/* Store Sections */}
      <ErrorBoundary>
        {/* Only render kroger section if internalCart exists */}
        {internalCart && renderStoreSection(
          'kroger',
          Array.isArray(internalCart?.kroger) ? internalCart.kroger : [],
          () => handleStoreSearch('kroger'),
          KrogerResults
        )}
      </ErrorBoundary>

      {/* Instacart Section */}
      <ErrorBoundary>
        <Card sx={{ mb: 4 }}>
          <CardContent>
            <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
              <Typography variant="h6">
                Instacart Items
              </Typography>
              <Box>
                <Tooltip title="Clear all items">
                  <IconButton
                    size="small"
                    onClick={() => clearStoreItems('instacart')}
                    disabled={!internalCart.instacart || !Array.isArray(internalCart.instacart) || internalCart.instacart.length === 0 || loading.cart}
                  >
                    <DeleteIcon />
                  </IconButton>
                </Tooltip>
              </Box>
            </Box>

            {/* Show items if they exist */}
            {internalCart?.instacart && Array.isArray(internalCart.instacart) && internalCart.instacart.length > 0 ? (
              <Box sx={{ mb: 2 }}>
                {internalCart.instacart.map((item, index) => {
                  // Extra safety check for null items
                  if (!item) return null;

                  return (
                    <Box
                      key={index}
                      sx={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        py: 1
                      }}
                    >
                      <Typography>{item?.name || "Unnamed item"}</Typography>
                      <Box display="flex" alignItems="center">
                        <IconButton
                          size="small"
                          onClick={() => item ? removeItem(item, 'instacart') : null}
                          disabled={loading.cart || !item}
                          sx={{ ml: 1 }}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
                      </Box>
                    </Box>
                  );
                })}
              </Box>
            ) : (
              <Typography color="text.secondary" sx={{ mb: 2 }}>
                No items assigned to Instacart
              </Typography>
            )}

            {/* Retailer Selector */}
            <Paper
              variant="outlined"
              sx={{ p: 2, mb: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <Box>
                <Typography variant="subtitle2" color="text.secondary">
                  Selected Retailer
                </Typography>
                <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
                  {instacartRetailer?.name || 'Select a retailer'}
                </Typography>
                {zipCode && (
                  <Typography variant="caption" color="text.secondary">
                    ZIP Code: {zipCode}
                  </Typography>
                )}
              </Box>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setShowInstacartRetailerSelector(true)}
              >
                Change Retailer
              </Button>
            </Paper>

            {/* Instacart API status and action buttons */}
            <Box display="flex" justifyContent="space-between" mt={2} flexWrap="wrap">
              <Box width="100%" mb={2}>
                <Button
                  variant="outlined"
                  size="small"
                  color="secondary"
                  onClick={async () => {
                    try {
                      setLoading(prev => ({...prev, instacart: true}));
                      const status = await instacartBackendService.checkInstacartStatus();
                      console.log('Instacart API status:', status);

                      // Show status in a snackbar
                      if (status.is_connected) {
                        setSnackbarMessage('Instacart API is connected and working properly');
                      } else {
                        setSnackbarMessage(`Instacart API status: Disconnected. ${status.message || ''}`);
                      }
                      setSnackbarOpen(true);
                    } catch (err) {
                      console.error('Error checking Instacart API status:', err);
                      setError('Error checking Instacart API status: ' + (err.message || 'Unknown error'));
                    } finally {
                      setLoading(prev => ({...prev, instacart: false}));
                    }
                  }}
                  disabled={loading.instacart}
                  sx={{ mb: 1 }}
                >
                  Check API Status
                </Button>
              </Box>


              {/* Official Instacart CTA Button */}
              <Box sx={{ mr: 1, mb: 1 }}>
                <Button
                  variant="contained"
                  onClick={createInstacartShoppingList}
                  disabled={creatingShoppingList ||
                    !internalCart.instacart || !Array.isArray(internalCart.instacart) ||
                    internalCart.instacart.length === 0 ||
                    !instacartRetailer?.id}
                  sx={{
                    height: 46,                     // Official height
                    py: '16px',                     // Official vertical padding
                    px: '18px',                     // Official horizontal padding
                    backgroundColor: '#003D29',     // Official dark background
                    color: '#FAF1E5',               // Official text color
                    fontWeight: 500,
                    textTransform: 'none',
                    borderRadius: '999px',          // Fully rounded
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    boxShadow: 'none',
                    '&:hover': {
                      backgroundColor: '#002A1C',   // Slightly darker on hover
                    },
                    '&:disabled': {
                      backgroundColor: '#ccc',
                      color: '#999'
                    }
                  }}
                >
                  {creatingShoppingList ? (
                    <CircularProgress size={20} color="inherit" />
                  ) : (
                    <Box component="img"
                      src={InstacartCarrotIcon}
                      alt="Instacart"
                      sx={{ height: 22, width: 'auto' }}  // Official 22px size
                    />
                  )}
                  Shop with Instacart
                </Button>
                <Typography
                  variant="caption"
                  sx={{
                    display: 'block',
                    mt: 0.5,
                    color: 'text.secondary',
                    fontSize: '0.75rem',
                    textAlign: 'center'
                  }}
                >
                  Powered by Instacart
                </Typography>
              </Box>

              {searchResults.instacart && searchResults.instacart.length > 0 ? (
                <Box sx={{ width: '100%', mt: 2 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Found {searchResults.instacart.length} items in Instacart
                  </Typography>

                  {instacartRetailer?.id && (
                    <InstacartResults
                      groceryItems={internalCart.instacart && Array.isArray(internalCart.instacart)
                        ? internalCart.instacart
                            .filter(item => item && typeof item === 'object' && item.name)
                            .map(item => item.name)
                        : []
                      }
                      retailerId={instacartRetailer?.id}
                      onSuccess={(cart) => {
                        setSnackbarMessage(`Items added to ${instacartRetailer?.name || 'Instacart'} cart successfully`);
                        setSnackbarOpen(true);
                        clearSearchResults('instacart');
                      }}
                      onError={(err) => {
                        // Use the user-friendly message if available
                        const errorMessage = err?.userMessage || err?.message || "Unknown error";
                        setError(`Error adding items to ${instacartRetailer?.name || 'Instacart'}: ${errorMessage}`);

                        // If this is an API connectivity issue, suggest checking status
                        if (errorMessage.includes('Network Error') || errorMessage.includes('API is unreachable')) {
                          setTimeout(() => {
                            setSnackbarMessage('Try clicking "Check API Status" to diagnose connection issues');
                            setSnackbarOpen(true);
                          }, 2000);
                        }
                      }}
                    />
                  )}
                </Box>
              ) : (
                <Typography color="text.secondary" sx={{ width: '100%', mt: 2 }}>
                  Items ready for Instacart checkout
                </Typography>
              )}
            </Box>
          </CardContent>
        </Card>
      </ErrorBoundary>



      {/* Store Selector Dialog */}
      <ErrorBoundary>
        <StoreSelector
          open={showStoreSelector}
          storeType={currentStore}
          onStoreSelect={handleStoreSelect}
          onClose={() => {
            setShowStoreSelector(false);
            // Reset loading state when closing the store selector
            setLoading(prev => ({
              ...prev,
              search: false,
              kroger: false,
              instacart: false
            }));
          }}
        />
      </ErrorBoundary>

      {/* Instacart Retailer Selector */}
      <ErrorBoundary>
        <InstacartRetailerSelector
          open={showInstacartRetailerSelector}
          onClose={() => {
            setShowInstacartRetailerSelector(false);
            // Reset loading state when closing the retailer selector
            // This ensures the search button will be responsive again
            setLoading(prev => ({
              ...prev,
              search: false,
              instacart: false
            }));
          }}
          onRetailerSelect={(retailerId, retailerObj) => {
            console.log('Selected Instacart retailer:', retailerId, retailerObj);
            // Ensure we have a valid object
            if (retailerObj && typeof retailerObj === 'object') {
              setInstacartRetailer(retailerObj);
              // Safe save to localStorage
              try {
                localStorage.setItem('instacart_retailer', JSON.stringify(retailerObj));
              } catch (err) {
                console.error('Error saving retailer to localStorage:', err);
              }
              // Also update the zip code
              if (retailerObj.address && retailerObj.address.zip_code) {
                setZipCode(retailerObj.address.zip_code);
                localStorage.setItem('instacart_zip_code', retailerObj.address.zip_code);
              }
            } else {
              console.error('Invalid retailer object:', retailerObj);
              // Use a default value
              setInstacartRetailer({ id: retailerId || 'publix', name: 'Retailer' });
            }
            setShowInstacartRetailerSelector(false);
            // Reset loading state after selecting a retailer
            setLoading(prev => ({
              ...prev,
              search: false,
              instacart: false
            }));
          }}
          defaultRetailerId={instacartRetailer?.id}
          initialZipCode={zipCode}
        />
      </ErrorBoundary>

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
          onClick={() => {
            // Allow closing the overlay by clicking on it
            // This fixes the issue where the button becomes unresponsive after dialog close
            setLoading(prev => ({ ...prev, search: false }));
          }}
        >
          <Box
            display="flex"
            flexDirection="column"
            alignItems="center"
            bgcolor="white"
            p={3}
            borderRadius={2}
            boxShadow={3}
            onClick={(e) => e.stopPropagation()} // Prevent clicks on inner box from closing
          >
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 2 }}>
              Searching for products...
            </Typography>
            <Button
              variant="outlined"
              size="small"
              sx={{ mt: 2 }}
              onClick={() => setLoading(prev => ({ ...prev, search: false }))}
            >
              Cancel Search
            </Button>
          </Box>
        </Box>
      )}


      {/* Instacart Shopping List Dialog */}
      <Dialog
        open={showShoppingListDialog}
        onClose={() => setShowShoppingListDialog(false)}
        maxWidth="sm"
        fullWidth
        PaperProps={{
          sx: {
            borderRadius: 2,
            overflow: 'hidden'
          }
        }}
      >
        <DialogTitle
          sx={{
            display: 'flex',
            alignItems: 'center',
            backgroundColor: '#43B02A', // Instacart green
            color: 'white',
            py: 2
          }}
        >
          <ShoppingCartIcon sx={{ mr: 1 }} />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Shop with Instacart
          </Typography>
        </DialogTitle>
        <DialogContent>
          <Typography variant="body1" paragraph sx={{ mt: 2 }}>
            We've created a direct link to Instacart with all your items pre-populated.
            Click the button below to open your shopping list on Instacart.
          </Typography>

          <Box sx={{ mt: 3, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <Button
              variant="contained"
              href={shoppingListUrl}
              target="_blank"
              rel="noopener noreferrer"
              sx={{
                height: 46,                     // Official height
                py: '16px',                     // Official vertical padding
                px: '18px',                     // Official horizontal padding
                backgroundColor: '#003D29',     // Official dark background
                color: '#FAF1E5',               // Official text color
                fontWeight: 500,
                textTransform: 'none',
                borderRadius: '999px',          // Fully rounded
                fontSize: '1rem',
                display: 'flex',
                alignItems: 'center',
                gap: 1.5,
                boxShadow: 'none',
                '&:hover': {
                  backgroundColor: '#002A1C',   // Slightly darker on hover
                }
              }}
            >
              <Box component="img"
                src={InstacartCarrotIcon}
                alt="Instacart"
                sx={{ height: 22, width: 'auto' }}  // Official 22px size
              />
              Shop with Instacart
            </Button>

            {/* Attribution required by guidelines */}
            <Typography
              variant="caption"
              sx={{
                mt: 1,
                color: 'text.secondary',
                fontSize: '0.75rem'
              }}
            >
              Powered by Instacart
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexGrow: 1 }}
          >
            Powered by Instacart
          </Typography>
          <Button onClick={() => setShowShoppingListDialog(false)}>
            Close
          </Button>
        </DialogActions>
      </Dialog>

      {/* Kroger Error Dialog */}
      <Dialog
        open={showErrorDialog}
        onClose={() => setShowErrorDialog(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>{errorDialogContent.title}</DialogTitle>
        <DialogContent>
          <DialogContentText>
            {errorDialogContent.message}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setShowErrorDialog(false)} color="primary">
            Cancel
          </Button>
          {errorDialogContent.needsReconnect && (
            <Button
              onClick={() => {
                setShowErrorDialog(false);
                handleReconnectKroger();
              }}
              variant="contained"
              color="primary"
            >
              Reconnect Kroger
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </Container>
  );
}

export default CartPage;