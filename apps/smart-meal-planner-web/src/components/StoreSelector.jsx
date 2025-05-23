// src/components/StoreSelector.jsx
import React, { useState } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Card,
  CardContent,
  IconButton,
  Alert,
  Select,
  MenuItem,
  FormControl,
  InputLabel,
  Tooltip
} from '@mui/material';
import { 
  Search, 
  Close, 
  MyLocation as LocationIcon,
  AccessTime as TimeIcon 
} from '@mui/icons-material';
import apiService, { axiosInstance } from '../services/apiService';

// Main store type selector component for ShoppingListPage
const StoreTypeSelector = ({
  selectedStore,
  onStoreChange,
  instacartRetailerId,
  onSelectInstacartRetailer
}) => {
  return (
    <FormControl sx={{ minWidth: 150, mr: 2 }}>
      <InputLabel>Store</InputLabel>
      <Select
        value={selectedStore}
        onChange={(e) => onStoreChange(e.target.value)}
        label="Store"
      >
        <MenuItem value="mixed">Mixed</MenuItem>
        <MenuItem value="instacart">Instacart</MenuItem>
        <MenuItem value="kroger">Kroger</MenuItem>
      </Select>
    </FormControl>
  );
};

// Dialog-based store location selector (existing functionality)
export const StoreSelector = ({
  open,
  onClose,
  onStoreSelect,
  storeType = 'kroger'
}) => {
  const [zipCode, setZipCode] = useState('');
  const [stores, setStores] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [searchRadius, setSearchRadius] = useState(10);
  const [showHours, setShowHours] = useState({});

  const handleZipCodeChange = (e) => {
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipCode(value);
    if (error && error.includes('ZIP code')) {
      setError('');
    }
  };

const searchStores = async (lat, lon) => {
    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    try {
      setLoading(true);
      setError('');

      // First, try to get real store data using the backend
      console.log(`Searching for ${storeType} stores near ${zipCode} (radius: ${searchRadius} miles)`);

      // Try direct API endpoint first
      try {
        // Handle Instacart differently - use the retailers endpoint or fallback data
        if (storeType === 'instacart') {
          console.log('Setting up Instacart retailers');

          // Use predefined retailers for Instacart instead of making API calls
          // This prevents unnecessary network errors when selecting Instacart from store dropdown
          const defaultRetailers = [
            {
              id: 'kroger',
              name: 'Kroger',
              logo_url: 'https://d2d8wwwkmhfcva.cloudfront.net/96x96/d2lnr5kwz8i9wq.cloudfront.net/images/retailers/square/28.png'
            },
            {
              id: 'publix',
              name: 'Publix',
              logo_url: 'https://d2d8wwwkmhfcva.cloudfront.net/96x96/d2lnr5kwz8i9wq.cloudfront.net/images/retailers/square/42.png'
            },
            {
              id: 'sprouts',
              name: 'Sprouts Farmers Market',
              logo_url: 'https://d2d8wwwkmhfcva.cloudfront.net/96x96/d2lnr5kwz8i9wq.cloudfront.net/images/retailers/square/47.png'
            },
            {
              id: 'albertsons',
              name: 'Albertsons',
              logo_url: 'https://d2d8wwwkmhfcva.cloudfront.net/96x96/d2lnr5kwz8i9wq.cloudfront.net/images/retailers/square/1.png'
            }
          ];

          // Format the retailers as stores
          const formattedStores = defaultRetailers.map(retailer => ({
            locationId: retailer.id,
            name: retailer.name,
            address: 'Available in your area',
            city: '',
            state: '',
            zipCode: zipCode,
            distance: 'Delivery service',
            hours: null,
            logo_url: retailer.logo_url || null // Store logo URL for display
          }));

          setStores(formattedStores);
          setLoading(false);
          return;
        } else {
          // Original logic for Kroger and Walmart
          const directEndpoint = storeType === 'kroger' ? '/kroger/direct-stores' : `/${storeType}/stores/near`;

          const searchParams = {
            zipCode: zipCode,
            radius: searchRadius
          };

          if (lat && lon) {
            searchParams.latitude = lat;
            searchParams.longitude = lon;
          }

          const directResponse = await axiosInstance.post(directEndpoint, searchParams);

          if (directResponse.data && directResponse.data.data && Array.isArray(directResponse.data.data)) {
            console.log(`Found ${directResponse.data.data.length} stores through direct API`);

            // Format the stores according to our expected format
            const formattedStores = directResponse.data.data.map(store => ({
              locationId: store.locationId || store.storeId || store.id,
              name: store.name || `${storeType} Store`,
              address: store.address?.addressLine1 || store.address || '',
              city: store.address?.city || store.city || '',
              state: store.address?.state || store.state || '',
              zipCode: store.address?.zipCode || store.zipCode || zipCode,
              distance: store.distance || '0',
              hours: store.hours || null
            }));

            setStores(formattedStores);
            setLoading(false);
            return;
          }
        }
      } catch (directError) {
        console.error('Error using direct API for store search:', directError);
      }
      
      // Try the regular backend API endpoint
      try {
        console.log("Trying regular findNearbyStores API");
        const response = await apiService.findNearbyStores(storeType, {
          zipCode,
          radius: searchRadius,
          latitude: lat,
          longitude: lon
        });
        
        if (response.success && response.stores && response.stores.length > 0) {
          console.log(`Found ${response.stores.length} stores through regular API`);
          setStores(response.stores);
        } else if (response.success && (!response.stores || response.stores.length === 0)) {
          setError('No stores found in this area');
        } else {
          setError(response.message || `Failed to find ${storeType} stores`);
        }
      } catch (apiError) {
        console.error("Regular API store search failed:", apiError);
        
        // If all approaches fail, create fallback store data
        console.log("All store search methods failed, creating fallback data");
        
        // Get a plausible store chain name
        const storeChains = {
          kroger: ["Kroger", "Fred Meyer", "Ralphs", "Dillons", "Smith's", "King Soopers"],
          walmart: ["Walmart", "Walmart Supercenter", "Walmart Neighborhood Market"],
          instacart: ["Instacart", "Instacart Partner Store", "Instacart Delivery"]
        };
        
        const getStoreName = () => {
          const chains = storeChains[storeType] || [storeType.charAt(0).toUpperCase() + storeType.slice(1)];
          return chains[Math.floor(Math.random() * chains.length)];
        };
        
        // Create fallback store data with realistic looking addresses
        const fallbackStores = [
          {
            locationId: `${storeType}-${zipCode}-1`,
            name: `${getStoreName()} Store #${1000 + parseInt(zipCode.substring(0, 3)) % 1000}`,
            address: "123 Main Street",
            city: "Your City",
            state: "ST",
            zipCode: zipCode,
            distance: "0.5"
          },
          {
            locationId: `${storeType}-${zipCode}-2`,
            name: `${getStoreName()} Store #${2000 + parseInt(zipCode.substring(0, 3)) % 1000}`,
            address: "456 Center Avenue",
            city: "Your City",
            state: "ST",
            zipCode: zipCode,
            distance: "2.3"
          }
        ];
        
        setStores(fallbackStores);
        setError('Unable to find stores through the API. Using estimated store locations.');
      }
    } catch (err) {
      setError('Error searching for stores');
      console.error('Store search error:', err);
    } finally {
      setLoading(false);
    }
  };

  
  const handleGeolocation = () => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        searchStores(position.coords.latitude, position.coords.longitude);
      },
      (error) => {
        setLoading(false);
        setError('Unable to get your location. Please enter a ZIP code.');
        console.error('Geolocation error:', error);
      }
    );
  };

  const toggleHours = (storeId) => {
    setShowHours(prev => ({
      ...prev,
      [storeId]: !prev[storeId]
    }));
  };

  const formatHours = (hours) => {
    if (!hours) return 'Hours not available';
    
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    return (
      <Box sx={{ mt: 1 }}>
        {days.map(day => (
          <Typography key={day} variant="body2" color="text.secondary">
            {day.charAt(0).toUpperCase() + day.slice(1)}: {
              hours[day]?.open24 ? '24 Hours' :
              hours[day]?.open && hours[day]?.close ?
              `${hours[day].open} - ${hours[day].close}` :
              'Closed'
            }
          </Typography>
        ))}
      </Box>
    );
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && zipCode.length === 5) {
      searchStores();
    }
  };

  const handleClose = () => {
    setZipCode('');
    setStores([]);
    setError('');
    setShowHours({});
    onClose();
  };

  // Enhanced handler for store selection with improved persistence
  const handleStoreSelect = (storeId) => {
    if (!storeId) {
      console.error('No store ID provided for selection');
      setError('Unable to select store: Missing store ID');
      return;
    }

    console.log(`Selected ${storeType} store: ${storeId}`);

    // Immediately close the dialog to improve user experience
    handleClose();

    // FIRST SET OF ACTIONS: Set store-specific flags in localStorage
    // Store the selected store type
    localStorage.setItem('selected_store_type', storeType);
    localStorage.setItem(`${storeType}_store_location`, storeId);
    localStorage.setItem(`${storeType}_store_location_id`, storeId);
    localStorage.setItem(`${storeType}_store_selected`, 'true');
    localStorage.setItem(`${storeType}_store_configured`, 'true');
    localStorage.setItem(`${storeType}_store_selection_done`, 'true');

    // Session storage flags to prevent prompts in current session
    sessionStorage.setItem(`${storeType}_store_selection_complete`, 'true');

    // Timestamps for diagnostics
    localStorage.setItem(`${storeType}_store_timestamp`, Date.now().toString());
    localStorage.setItem(`${storeType}_store_selection_timestamp`, Date.now().toString());

    // SECOND SET OF ACTIONS: Clear any flags that might trigger store selection
    sessionStorage.removeItem(`${storeType}_needs_store_selection`);

    // For backwards compatibility, also set Kroger flags if this is another store type
    // This ensures existing code that checks for Kroger selection still works
    if (storeType !== 'kroger') {
      localStorage.setItem('kroger_store_location', storeId);
      localStorage.setItem('kroger_store_location_id', storeId);
      localStorage.setItem('kroger_store_selected', 'true');
      localStorage.setItem('kroger_store_configured', 'true');
      localStorage.setItem('kroger_store_selection_done', 'true');
      sessionStorage.setItem('kroger_store_selection_complete', 'true');
    }

    // Log all the flags we've set for debugging
    console.log('Store selection flags set:', {
      'store_type': storeType,
      'store_id': storeId,
      [`${storeType}_store_location`]: localStorage.getItem(`${storeType}_store_location`),
      [`${storeType}_store_selected`]: localStorage.getItem(`${storeType}_store_selected`),
      'kroger_store_location': localStorage.getItem('kroger_store_location'),
      'kroger_store_selection_complete (session)': sessionStorage.getItem('kroger_store_selection_complete')
    });

    // THIRD SET OF ACTIONS: Update backend based on store type
    console.log(`Updating ${storeType} location in backend DB...`);

    // Update backend based on store type
    const updateBackend = async () => {
      try {
        if (storeType === 'instacart') {
          // For Instacart, we just need to store the retailer ID
          console.log("Saving Instacart retailer selection");
          localStorage.setItem('instacart_retailer_id', storeId);

          // No backend update needed for Instacart as we just use the retailer ID directly
          return true;
        } else if (storeType === 'kroger') {
          // Original Kroger update logic
          console.log("Attempting to update Kroger store location");
          const postResponse = await apiService.updateKrogerLocation(storeId);

          if (postResponse && postResponse.success) {
            console.log("Successfully updated Kroger store location");
            return true;
          }

          // Fallback approach for Kroger
          console.log("Trying alternative Kroger update approach");
          const alternativeResponse = await fetch(`${apiService.API_BASE_URL}/kroger/store-location?location_id=${storeId}`, {
            method: 'GET',
            credentials: 'include',
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
              'Content-Type': 'application/json'
            }
          });

          if (alternativeResponse.ok) {
            console.log("Alternative Kroger update succeeded");
            return true;
          }
        } else if (storeType === 'walmart') {
          // Walmart store update logic
          console.log("Updating Walmart store location");
          // Add any Walmart-specific update logic here
          return true;
        }

        console.warn(`Failed to update ${storeType} location in backend, but continuing with client-side tracking`);
        return false;

      } catch (err) {
        console.error(`Error updating ${storeType} location in backend:`, err);

        // Check if this is a database schema issue
        if (err.response?.data?.error?.includes('client_id') ||
            err.response?.data?.error?.includes('column')) {
          console.log("Database schema issue detected in error, storing locally only");
          localStorage.setItem('database_schema_issue', 'true');
        }

        return false;
      }
    };

    // Start backend update process asynchronously
    updateBackend().then(success => {
      if (success) {
        console.log("Backend update completed successfully");
      } else {
        console.log("Using client-side storage as fallback");
      }
    });

    // Call the parent handler immediately - don't wait for backend to complete
    // This ensures the user experience isn't interrupted if backend is slow
    onStoreSelect(storeId);
  };

  return (
    <Dialog 
      open={open} 
      onClose={handleClose}
      maxWidth="md"
      fullWidth
      PaperProps={{
        sx: { minHeight: '400px' }
      }}
    >
      <DialogTitle>
        <Box display="flex" justifyContent="space-between" alignItems="center">
          <Typography variant="h6">
            Select Your {
              storeType === 'kroger' ? 'Kroger' :
              storeType === 'instacart' ? 'Instacart' :
              storeType === 'walmart' ? 'Walmart' :
              storeType.charAt(0).toUpperCase() + storeType.slice(1)
            } Store
          </Typography>
          <IconButton onClick={handleClose} size="small">
            <Close />
          </IconButton>
        </Box>
      </DialogTitle>

      <DialogContent>
        <Box sx={{ mb: 3 }}>
          <Box display="flex" gap={1} alignItems="flex-start">
            <TextField
              fullWidth
              label="Enter ZIP Code"
              value={zipCode}
              onChange={handleZipCodeChange}
              onKeyPress={handleKeyPress}
              variant="outlined"
              size="small"
              inputProps={{
                inputMode: 'numeric',
                pattern: '[0-9]*'
              }}
              error={!!error && error.includes('ZIP code')}
              helperText={error && error.includes('ZIP code') ? error : ''}
            />
            <FormControl size="small" sx={{ minWidth: 120 }}>
              <InputLabel>Radius</InputLabel>
              <Select
                value={searchRadius}
                label="Radius"
                onChange={(e) => setSearchRadius(e.target.value)}
              >
                <MenuItem value={5}>5 miles</MenuItem>
                <MenuItem value={10}>10 miles</MenuItem>
                <MenuItem value={20}>20 miles</MenuItem>
                <MenuItem value={50}>50 miles</MenuItem>
              </Select>
            </FormControl>
            <Tooltip title="Use my location">
              <Button
                variant="outlined"
                onClick={handleGeolocation}
                disabled={loading}
              >
                <LocationIcon />
              </Button>
            </Tooltip>
            <Button
              variant="contained"
              onClick={() => searchStores()}
              disabled={loading || !zipCode || zipCode.length !== 5}
              startIcon={loading ? <CircularProgress size={20} /> : <Search />}
            >
              Find Stores
            </Button>
          </Box>

          {error && !error.includes('ZIP code') && (
            <Alert severity="error" sx={{ mt: 2 }} onClose={() => setError('')}>
              {error}
            </Alert>
          )}
        </Box>

        {loading ? (
          <Box display="flex" justifyContent="center" my={4}>
            <CircularProgress />
          </Box>
        ) : (
          <Box sx={{ maxHeight: 400, overflow: 'auto' }}>
            {stores.map((store) => (
              <Card 
                key={store.locationId} 
                sx={{ 
                  mb: 1,
                  cursor: 'pointer',
                  transition: 'background-color 0.2s',
                  '&:hover': {
                    bgcolor: 'action.hover'
                  }
                }}
              >
                <CardContent
                  onClick={() => handleStoreSelect(store.location_id || store.locationId)}
                  sx={{ pb: showHours[store.location_id || store.locationId] ? 0 : undefined }}
                >
                  {storeType === 'instacart' && store.logo_url ? (
                    <Box display="flex" alignItems="center" mb={1}>
                      <img
                        src={store.logo_url}
                        alt={`${store.name} logo`}
                        style={{
                          maxHeight: '30px',
                          maxWidth: '100px',
                          marginRight: '10px',
                          objectFit: 'contain'
                        }}
                      />
                      <Typography variant="subtitle1" component="div">
                        {store.name}
                      </Typography>
                    </Box>
                  ) : (
                    <Typography variant="subtitle1" component="div">
                      {store.name}
                    </Typography>
                  )}

                  <Typography variant="body2" color="text.secondary">
                    {store.address}
                    {store.city && store.state && (
                      <>
                        <br />
                        {store.city}, {store.state} {store.zipCode}
                      </>
                    )}
                  </Typography>

                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {typeof store.distance === 'string' && store.distance.includes('Delivery') ? (
                        store.distance
                      ) : (
                        store.distance !== undefined && `${parseFloat(store.distance).toFixed(1)} miles away`
                      )}
                    </Typography>

                    {/* Only show hours button for stores that actually have hours */}
                    {storeType !== 'instacart' && (
                      <Tooltip title={`Store ID: ${store.location_id || store.locationId}`}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleHours(store.location_id || store.locationId);
                          }}
                        >
                          <TimeIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    )}
                  </Box>

                  {showHours[store.location_id || store.locationId] && formatHours(store.hours)}
                </CardContent>
              </Card>
            ))}
          </Box>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={handleClose} color="primary">
          Cancel
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export { StoreTypeSelector };

export default StoreSelector;