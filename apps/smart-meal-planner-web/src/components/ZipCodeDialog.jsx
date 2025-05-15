import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';
import { LocationOn as LocationIcon } from '@mui/icons-material';
import { useAuth } from '../context/AuthContext';

/**
 * Dialog component for getting user's zip code
 * - Attempts to get zip code from user profile first
 * - If not available, asks user to enter it
 */
const ZipCodeDialog = ({ 
  open, 
  onClose, 
  onZipCodeSubmit,
  zipCodeFieldName = 'zip_code',
  rememberZipCode = true
}) => {
  const { user } = useAuth();
  const [zipCode, setZipCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [autoSubmitted, setAutoSubmitted] = useState(false);

  useEffect(() => {
    // Reset state when dialog opens or closes
    if (open) {
      setError('');
      setAutoSubmitted(false);

      // Clear saved zip code if the dialog is explicitly opened
      // This allows "Change ZIP Code" to work properly
      const forceZipCodeChange = localStorage.getItem('force_zip_code_change');
      if (forceZipCodeChange === 'true') {
        console.log('Forcing ZIP code change, not auto-submitting');
        localStorage.removeItem('force_zip_code_change');
        return; // Don't auto-submit
      }

      // Try to get zip code from user profile first
      if (user && user[zipCodeFieldName]) {
        setZipCode(user[zipCodeFieldName]);

        // Auto-submit if we have a zip code and haven't auto-submitted yet
        if (!autoSubmitted) {
          handleSubmit(user[zipCodeFieldName]);
          setAutoSubmitted(true);
        }
      } else {
        // Try to get saved zip code from localStorage
        const savedZipCode = localStorage.getItem('instacart_zip_code');
        if (savedZipCode) {
          setZipCode(savedZipCode);

          // Auto-submit if we have a saved zip code and haven't auto-submitted yet
          if (!autoSubmitted) {
            handleSubmit(savedZipCode);
            setAutoSubmitted(true);
          }
        }
      }
    } else {
      // Reset error and loading state when dialog closes
      setError('');
      setLoading(false);
    }
  }, [open, user, zipCodeFieldName, autoSubmitted]);

  // Validate US zip code
  const isValidZipCode = (zip) => {
    return /^\d{5}(-\d{4})?$/.test(zip);
  };

  const handleSubmit = (submittedZipCode = null) => {
    // Use provided zip code or state value
    const zipToSubmit = submittedZipCode || zipCode;
    
    // Validate zip code
    if (!isValidZipCode(zipToSubmit)) {
      setError('Please enter a valid 5-digit US ZIP code');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // Save to localStorage if option is enabled
      if (rememberZipCode) {
        localStorage.setItem('instacart_zip_code', zipToSubmit);
      }
      
      // Call the callback with the zip code
      if (onZipCodeSubmit) {
        onZipCodeSubmit(zipToSubmit);
      }
    } catch (err) {
      console.error('Error submitting zip code:', err);
      setError(err.message || 'Error submitting zip code');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="xs">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center' }}>
        <LocationIcon sx={{ mr: 1 }} />
        Enter Your ZIP Code
      </DialogTitle>
      
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        
        <Typography variant="body2" paragraph>
          Please enter your ZIP code to find Instacart retailers near you.
        </Typography>
        
        <TextField
          label="ZIP Code"
          value={zipCode}
          onChange={(e) => setZipCode(e.target.value.trim())}
          margin="normal"
          fullWidth
          placeholder="Enter 5-digit ZIP code"
          variant="outlined"
          error={!!error}
          disabled={loading}
          inputProps={{
            maxLength: 5,
            pattern: '[0-9]*', // Only numbers
            inputMode: 'numeric'
          }}
        />
        
        {rememberZipCode && (
          <Typography variant="caption" color="text.secondary">
            Your ZIP code will be remembered for future searches.
          </Typography>
        )}
      </DialogContent>
      
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>
          Cancel
        </Button>
        <Button 
          onClick={() => handleSubmit()} 
          variant="contained" 
          color="primary"
          disabled={!zipCode || loading}
          startIcon={loading ? <CircularProgress size={20} /> : null}
        >
          Find Retailers
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ZipCodeDialog;