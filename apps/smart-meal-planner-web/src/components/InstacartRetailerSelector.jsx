import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  CircularProgress,
  Alert,
  List,
  ListItem,
  ListItemText,
  ListItemAvatar,
  Avatar,
  Box,
  Divider,
  Paper,
  Chip
} from '@mui/material';
import {
  Store as StoreIcon,
  LocationOn as LocationIcon,
  Check as CheckIcon
} from '@mui/icons-material';
import instacartService from '../services/instacartService';
import ZipCodeDialog from './ZipCodeDialog';

/**
 * Component for selecting an Instacart retailer
 * Shows a dialog with nearby retailers based on ZIP code
 */
const InstacartRetailerSelector = ({
  open,
  onClose,
  onRetailerSelect,
  defaultRetailerId = null,
  initialZipCode = null
}) => {
  const [retailers, setRetailers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedRetailerId, setSelectedRetailerId] = useState(defaultRetailerId);
  const [zipCode, setZipCode] = useState(initialZipCode);
  const [showZipCodeDialog, setShowZipCodeDialog] = useState(false);

  // Open ZIP code dialog if we don't have a ZIP code yet
  useEffect(() => {
    if (open && !zipCode) {
      setShowZipCodeDialog(true);
    }
  }, [open, zipCode]);

  // Load retailers when ZIP code is set
  useEffect(() => {
    if (zipCode) {
      loadRetailers(zipCode);
    }
  }, [zipCode]);

  // Function to load retailers based on ZIP code
  const loadRetailers = async (zipCode) => {
    setLoading(true);
    setError('');
    setRetailers([]); // Clear previous retailers while loading

    try {
      const response = await instacartService.getNearbyRetailers(zipCode);
      console.log('Loaded retailers:', response);

      if (Array.isArray(response)) {
        // Check if we actually have any retailers
        if (response.length === 0) {
          setError(`No Instacart retailers found for ZIP code ${zipCode}. Try a different ZIP code.`);
          return;
        }

        setRetailers(response);

        // If we have a default retailer ID, check if it's in the list
        if (defaultRetailerId) {
          const retailerExists = response.some(r => r.id === defaultRetailerId);
          if (!retailerExists && response.length > 0) {
            // Default retailer not available, select first one
            setSelectedRetailerId(response[0].id);
          } else {
            setSelectedRetailerId(defaultRetailerId);
          }
        } else if (response.length > 0) {
          // No default, select first one
          setSelectedRetailerId(response[0].id);
        }
      } else {
        setError('Invalid response format from Instacart API. Please try a different ZIP code.');
      }
    } catch (err) {
      console.error('Error loading Instacart retailers:', err);

      // Show a more user-friendly error message
      if (err.isApiKeyError) {
        setError('API key error: The Instacart API key appears to be invalid or unauthorized. Please contact support.');
      } else if (err.message.includes('API key error')) {
        setError(err.message);
      } else if (err.message.includes('CORS')) {
        setError('Cross-origin resource sharing (CORS) error. The server is not configured to allow requests from this domain.');
      } else if (err.message.includes('Network Error')) {
        setError('Network error connecting to Instacart API. Please check your internet connection or try again later.');
      } else if (err.message.includes('404')) {
        setError('The Instacart retailer lookup API is not available. Please try again later.');
      } else if (err.response && err.response.status === 401) {
        setError('Authentication error: Unable to access Instacart API. The API key may be missing or invalid.');
      } else if (err.response && err.response.status === 403) {
        setError('Access denied: The Instacart API key does not have permission to access this resource.');
      } else if (err.response && err.response.status === 429) {
        setError('Too many requests to Instacart API. Please try again in a few minutes.');
      } else {
        setError(`Error loading retailers: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle ZIP code submission
  const handleZipCodeSubmit = (zipCode) => {
    setZipCode(zipCode);
    setShowZipCodeDialog(false);
  };

  // Handle retailer selection
  const handleRetailerSelect = () => {
    if (selectedRetailerId && onRetailerSelect) {
      // Find the complete retailer object
      const selectedRetailer = retailers.find(r => r.id === selectedRetailerId);
      onRetailerSelect(selectedRetailerId, selectedRetailer);
    }
    onClose();
  };

  // Handle change ZIP code
  const handleChangeZipCode = () => {
    // Set a flag in localStorage to prevent auto-submit in ZipCodeDialog
    localStorage.setItem('force_zip_code_change', 'true');
    setShowZipCodeDialog(true);
  };

  return (
    <>
      <Dialog open={open} onClose={onClose} fullWidth maxWidth="md">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
          <StoreIcon sx={{ mr: 1 }} />
          Select Instacart Retailer
        </DialogTitle>
        
        <DialogContent>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress size={60} sx={{ mb: 2 }} />
              <Typography variant="body1">
                Finding Instacart retailers near {zipCode}...
              </Typography>
            </Box>
          ) : (
            <>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="subtitle1">
                  Retailers near {zipCode}
                </Typography>
                <Button
                  size="small"
                  startIcon={<LocationIcon />}
                  onClick={handleChangeZipCode}
                >
                  Change ZIP Code
                </Button>
              </Box>
              
              {retailers.length === 0 ? (
                <Paper variant="outlined" sx={{ p: 3, textAlign: 'center' }}>
                  <Typography variant="body1" color="error" sx={{ mb: 2 }}>
                    {error || "No Instacart retailers found in your area."}
                  </Typography>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                    {error && error.includes('API key') ?
                      "This is likely a configuration issue with the API key. Try clearing your browser cache or contact support." :
                      error && error.includes('CORS') ?
                        "This is a server configuration issue. The development environment may need to be updated." :
                        error ?
                          "This might be due to a server configuration issue or API limitation." :
                          "This could be because Instacart doesn't serve this area or there was an issue with the API."}
                  </Typography>
                  <Button
                    variant="outlined"
                    startIcon={<LocationIcon />}
                    onClick={handleChangeZipCode}
                    sx={{ mt: 2 }}
                  >
                    Try a Different ZIP Code
                  </Button>
                </Paper>
              ) : (
                <List sx={{ maxHeight: '50vh', overflow: 'auto' }}>
                  {retailers.map((retailer, index) => (
                    <React.Fragment key={retailer.id}>
                      <ListItem
                        button
                        selected={selectedRetailerId === retailer.id}
                        onClick={() => setSelectedRetailerId(retailer.id)}
                        sx={{ 
                          borderRadius: 1,
                          '&.Mui-selected': { bgcolor: 'action.selected' }
                        }}
                      >
                        <ListItemAvatar>
                          {retailer.logo_url ? (
                            <Avatar src={retailer.logo_url} alt={retailer.name} />
                          ) : (
                            <Avatar>
                              <StoreIcon />
                            </Avatar>
                          )}
                        </ListItemAvatar>
                        <ListItemText
                          primary={
                            <Box display="flex" alignItems="center">
                              {retailer.name}
                              {selectedRetailerId === retailer.id && (
                                <Chip
                                  size="small"
                                  icon={<CheckIcon />}
                                  label="Selected"
                                  color="primary"
                                  variant="outlined"
                                  sx={{ ml: 1 }}
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span">
                                {retailer.address && (
                                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                                    <LocationIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                                    {`${retailer.address.city}, ${retailer.address.state}`}
                                  </Box>
                                )}
                              </Typography>
                            </>
                          }
                        />
                      </ListItem>
                      {index < retailers.length - 1 && <Divider variant="inset" component="li" />}
                    </React.Fragment>
                  ))}
                </List>
              )}
            </>
          )}
        </DialogContent>
        
        <DialogActions>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleRetailerSelect} 
            variant="contained" 
            color="primary"
            disabled={!selectedRetailerId || loading}
          >
            Select Retailer
          </Button>
        </DialogActions>
      </Dialog>
      
      <ZipCodeDialog
        open={showZipCodeDialog}
        onClose={() => {
          setShowZipCodeDialog(false);
          // If we don't have a ZIP code yet and the user cancels, close the parent dialog too
          if (!zipCode) {
            onClose();
          }
        }}
        onZipCodeSubmit={handleZipCodeSubmit}
      />
    </>
  );
};

export default InstacartRetailerSelector;