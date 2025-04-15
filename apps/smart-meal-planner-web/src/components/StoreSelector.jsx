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
import apiService from '../services/apiService';

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

const searchStores = async () => {
    if (!zipCode || zipCode.length !== 5) {
      setError('Please enter a valid 5-digit ZIP code');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      // Use apiService instead of direct get call
      const response = await apiService.findNearbyStores(storeType, {
        zipCode,
        radius: searchRadius
      });
      
      if (response.success) {
        setStores(response.stores || []);
        if (response.stores?.length === 0) {
          setError('No stores found in this area');
        }
      } else {
        setError(response.message || `Failed to find ${storeType} stores`);
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
            Select Your {storeType === 'kroger' ? 'Kroger' : 'Walmart'} Store
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
                  onClick={() => onStoreSelect(store.location_id || store.locationId)}
                  sx={{ pb: showHours[store.location_id || store.locationId] ? 0 : undefined }}
                >
                  <Typography variant="subtitle1" component="div">
                    {store.name}
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    {store.address}<br />
                    {store.city}, {store.state} {store.zipCode}
                  </Typography>
                  <Box display="flex" justifyContent="space-between" alignItems="center" mt={0.5}>
                    <Typography variant="body2" color="text.secondary">
                      {store.distance !== undefined && `${parseFloat(store.distance).toFixed(1)} miles away`}
                    </Typography>
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

export default StoreSelector;