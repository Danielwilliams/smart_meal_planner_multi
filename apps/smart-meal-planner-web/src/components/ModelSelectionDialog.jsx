// src/components/ModelSelectionDialog.jsx
import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  RadioGroup,
  FormControlLabel,
  Radio,
  Button,
  Typography,
  Box,
  CircularProgress,
  Alert
} from '@mui/material';
import apiService from '../services/apiService';

const ModelSelectionDialog = ({ open, onClose, onModelSelect }) => {
  const [modelStatus, setModelStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedModel, setSelectedModel] = useState('default');

  useEffect(() => {
    if (open) {
      fetchModelStatus();
    }
  }, [open]);

  const fetchModelStatus = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await apiService.getAIModelStatus();
      setModelStatus(response);
      
      // If local model exists, select it by default
      if (response.localModelExists) {
        setSelectedModel('local');
      }
    } catch (err) {
      console.error('Error fetching model status:', err);
      setError('Could not fetch AI model status');
    } finally {
      setLoading(false);
    }
  };

  const handleSelect = () => {
    if (selectedModel) {
      onModelSelect(selectedModel);
      onClose();
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Select AI Model</DialogTitle>
      <DialogContent>
        {loading ? (
          <Box display="flex" justifyContent="center" my={3}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        ) : (
          <>
            <Typography variant="body1" gutterBottom>
              Choose the AI model to use for recipe generation:
            </Typography>
            
            {modelStatus && !modelStatus.isAvailable && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {modelStatus.message || "AI enhanced features are not currently available"}
              </Alert>
            )}
            
            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <RadioGroup
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                <FormControlLabel
                  value="default"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle1">Standard</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Default menu generation without customization
                      </Typography>
                    </Box>
                  }
                />
                
                <FormControlLabel
                  value="enhanced"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle1">Enhanced</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Better recipe variety and customization
                      </Typography>
                    </Box>
                  }
                />
                
                <FormControlLabel
                  value="hybrid"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle1">Hybrid</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Combines standard and enhanced features for balanced results
                      </Typography>
                    </Box>
                  }
                />
                
                {modelStatus && modelStatus.localModelExists && (
                  <FormControlLabel
                    value="local"
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1">Locally Trained</Typography>
                        <Typography variant="body2" color="text.secondary">
                          Uses your locally trained model for personalized results
                        </Typography>
                      </Box>
                    }
                  />
                )}
              </RadioGroup>
            </FormControl>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          onClick={handleSelect}
          disabled={loading || !selectedModel}
        >
          Select
        </Button>
      </DialogActions>
    </Dialog>
  );
};

export default ModelSelectionDialog;