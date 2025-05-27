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
import instacartBackendService from '../services/instacartBackendService';
import ZipCodeDialog from './ZipCodeDialog';
import instacartLogo from '../assets/instacart/Instacart_Logo.png';
import instacartCarrot from '../assets/instacart/Instacart_Carrot.png';

// Instacart brand colors as per their guidelines
const INSTACART_COLORS = {
  carrot: '#F36D00', // Instacart's carrot orange color
  brand: '#43B02A',  // Instacart's brand green color
  white: '#FFFFFF',
  dark: '#343538'
};

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

  // Handle dialog open/close state
  useEffect(() => {
    if (open) {
      // Open ZIP code dialog if we don't have a ZIP code yet
      if (!zipCode) {
        setShowZipCodeDialog(true);
      }
    } else {
      // Clean up states when dialog closes
      setLoading(false);
      setError('');
      // Don't reset the retailer data to avoid flashing when reopening
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
      // Use the backend service to get retailers
      const response = await instacartBackendService.getNearbyRetailers(zipCode);
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
      if (err.response && err.response.status === 404) {
        setError('The Instacart retailer lookup API is not available. Please try again later.');
      } else if (err.response && err.response.status === 401) {
        setError('Authentication error: Unable to access Instacart API.');
      } else if (err.response && err.response.status === 403) {
        setError('Access denied: The Instacart API key does not have permission to access this resource.');
      } else if (err.response && err.response.status === 429) {
        setError('Too many requests to Instacart API. Please try again in a few minutes.');
      } else if (err.response && err.response.status === 500) {
        setError('The server encountered an error processing your request. Please try again later.');
      } else {
        setError(`Error loading retailers: ${err.message || 'Unknown error'}`);
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
      <Dialog
        open={open}
        onClose={onClose}
        fullWidth
        maxWidth="md"
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
            backgroundColor: INSTACART_COLORS.brand,
            color: INSTACART_COLORS.white,
            py: 2
          }}
        >
          <Box
            component="img"
            src={instacartCarrot}
            alt=""
            sx={{ width: 24, height: 24, mr: 1 }}
          />
          <Typography variant="h6" component="div" sx={{ fontWeight: 600 }}>
            Select Instacart Retailer
          </Typography>
        </DialogTitle>

        <DialogContent>
          {/* Instacart logo display */}
          <Box display="flex" alignItems="center" justifyContent="center" my={2}>
            <Box
              component="img"
              src={instacartLogo}
              alt="Instacart"
              sx={{ height: 35 }}
            />
          </Box>

          {error && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
            >
              {error}
            </Alert>
          )}

          {loading ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress
                size={60}
                sx={{
                  mb: 2,
                  color: INSTACART_COLORS.brand
                }}
              />
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
                  variant="outlined"
                  startIcon={<LocationIcon />}
                  onClick={handleChangeZipCode}
                  sx={{
                    borderColor: INSTACART_COLORS.brand,
                    color: INSTACART_COLORS.brand,
                    '&:hover': {
                      borderColor: INSTACART_COLORS.brand,
                      backgroundColor: `${INSTACART_COLORS.brand}10`
                    }
                  }}
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
                      "This is likely a configuration issue with the API key. Try clearing your browser cache or contact support at support@smartmealplannerio.com." :
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
                    sx={{
                      mt: 2,
                      borderColor: INSTACART_COLORS.brand,
                      color: INSTACART_COLORS.brand,
                      '&:hover': {
                        borderColor: INSTACART_COLORS.brand,
                        backgroundColor: `${INSTACART_COLORS.brand}10`
                      }
                    }}
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
                          '&.Mui-selected': {
                            bgcolor: `${INSTACART_COLORS.brand}15`
                          },
                          '&:hover': {
                            bgcolor: `${INSTACART_COLORS.brand}05`
                          }
                        }}
                      >
                        <ListItemAvatar>
                          {retailer.logo_url ? (
                            <Avatar src={retailer.logo_url} alt={retailer.name} />
                          ) : (
                            <Avatar sx={{ bgcolor: INSTACART_COLORS.brand + '20' }}>
                              <StoreIcon sx={{ color: INSTACART_COLORS.brand }} />
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
                                  sx={{
                                    ml: 1,
                                    color: INSTACART_COLORS.brand,
                                    borderColor: INSTACART_COLORS.brand,
                                    bgcolor: INSTACART_COLORS.brand + '10'
                                  }}
                                  variant="outlined"
                                />
                              )}
                            </Box>
                          }
                          secondary={
                            <>
                              <Typography variant="body2" component="span">
                                {retailer.address && retailer.address.city && retailer.address.state ? (
                                  <Box component="span" sx={{ display: 'flex', alignItems: 'center' }}>
                                    <LocationIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                                    {`${retailer.address.city}, ${retailer.address.state}`}
                                  </Box>
                                ) : (
                                  <Box component="span" sx={{ display: 'flex', alignItems: 'center', color: 'text.disabled' }}>
                                    <LocationIcon fontSize="small" sx={{ mr: 0.5, fontSize: '1rem' }} />
                                    Location information not available
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

        <DialogActions sx={{ borderTop: '1px solid', borderColor: 'divider', px: 3 }}>
          <Typography
            variant="caption"
            color="text.secondary"
            sx={{ flexGrow: 1 }}
          >
            Powered by Instacart
          </Typography>
          <Button onClick={onClose}>
            Cancel
          </Button>
          <Button
            onClick={handleRetailerSelect}
            variant="contained"
            sx={{
              bgcolor: INSTACART_COLORS.carrot,
              color: INSTACART_COLORS.white,
              fontWeight: 600,
              '&:hover': {
                bgcolor: '#E05D00', // Darker orange on hover
              },
              '&.Mui-disabled': {
                bgcolor: '#F2F2F2',
                color: '#AAAAAA'
              }
            }}
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