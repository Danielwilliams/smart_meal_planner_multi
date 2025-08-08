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
      <DialogTitle>Choose Generation Mode</DialogTitle>
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
              Choose the AI generation mode for your meal plan:
            </Typography>
            
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Different modes use different AI models with varying capabilities. Enhanced mode provides the best results but may take longer.
            </Typography>
            
            <Box sx={{ p: 2, bgcolor: 'info.main', color: 'info.contrastText', borderRadius: 1, mb: 2 }}>
              <Typography variant="body2" sx={{ fontWeight: 'bold' }}>
                💡 Recommendation: Use Standard for quick daily meals, Enhanced for special occasions, and Hybrid for complex dietary needs.
              </Typography>
            </Box>
            
            {modelStatus && !modelStatus.isAvailable && (
              <Alert severity="warning" sx={{ mb: 2 }}>
                {modelStatus.message || "AI enhanced features are not currently available"}
              </Alert>
            )}
            
            <FormControl component="fieldset" sx={{ mt: 2 }}>
              <RadioGroup
                value={selectedModel}
                onChange={(e) => setSelectedModel(e.target.value)}
                sx={{ '& .MuiFormControlLabel-root': { mb: 2 } }}
              >
                <FormControlLabel
                  value="default"
                  control={<Radio />}
                  label={
                    <Box>
                      <Typography variant="subtitle1">Standard</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Fast generation with GPT-3.5. Good for basic meal plans with standard recipes and quick results.
                      </Typography>
                      <Typography variant="caption" color="primary">
                        ⚡ Fastest • ✅ Recommended for daily use
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
                        Premium quality with GPT-4. Creates more creative, detailed recipes with better personalization and variety.
                      </Typography>
                      <Typography variant="caption" color="success.main">
                        🏆 Best Quality • 🎨 Most Creative • ⏱️ Slower
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
                        Extended context GPT-3.5. Better at handling complex meal plans with many dietary restrictions and preferences.
                      </Typography>
                      <Typography variant="caption" color="warning.main">
                        🔄 Balanced • 📋 Great for Complex Plans • ⚖️ Medium Speed
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
                          Custom AI model trained on your recipe preferences and rating history for maximum personalization.
                        </Typography>
                        <Typography variant="caption" color="info.main">
                          🎯 Most Personalized • 🔒 Private • ⚡ Fast
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