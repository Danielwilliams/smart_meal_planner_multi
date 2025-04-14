// src/components/ClientMenuGenerator.jsx
import React, { useState, useEffect } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  CircularProgress,
  Alert,
  Paper
} from '@mui/material';
import apiService from '../services/apiService';
import ModelSelectionDialog from './ModelSelectionDialog';

function ClientMenuGenerator({ client, onMenuGenerated }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [clientPreferences, setClientPreferences] = useState(null);
  const [durationDays, setDurationDays] = useState(7);
  const [loadingPreferences, setLoadingPreferences] = useState(false);
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [selectedModel, setSelectedModel] = useState('default');
  const [menuRequest, setMenuRequest] = useState(null);

  // Fetch client preferences
  useEffect(() => {
    const fetchClientPreferences = async () => {
      if (!client || !client.id) return;
      
      try {
        setLoadingPreferences(true);
        const preferences = await apiService.getUserPreferences(client.id);
        setClientPreferences(preferences);
      } catch (err) {
        console.error('Error fetching client preferences:', err);
        setError('Failed to load client preferences');
      } finally {
        setLoadingPreferences(false);
      }
    };
    
    fetchClientPreferences();
  }, [client]);

  // This function is now simpler - it's just used to validate inputs and prepare the request
  const handleGenerateMenu = () => {
    console.log("handleGenerateMenu called");
    
    if (!client || !client.id) {
      setError('Client information is missing');
      return;
    }
    
    if (!clientPreferences) {
      setError('Client preferences are required to generate a menu');
      return;
    }
    
    // Prepare the menu request using client preferences
    const request = {
      user_id: client.id,  // This will be overridden by the backend
      duration_days: durationDays,
      diet_type: clientPreferences.diet_type || '',
      dietary_preferences: clientPreferences.dietary_restrictions ? 
        clientPreferences.dietary_restrictions.split(',').map(item => item.trim()) : [],
      disliked_foods: clientPreferences.disliked_ingredients ? 
        clientPreferences.disliked_ingredients.split(',').map(item => item.trim()) : [],
      meal_times: Object.keys(clientPreferences.meal_times || {}).filter(
        time => clientPreferences.meal_times[time] && time !== 'snacks'
      ),
      snacks_per_day: clientPreferences.meal_times?.snacks ? clientPreferences.snacks_per_day || 0 : 0,
      servings_per_meal: clientPreferences.servings_per_meal || 1,
      calorie_goal: clientPreferences.calorie_goal || 2000,
      macro_protein: clientPreferences.macro_protein || 40,
      macro_carbs: clientPreferences.macro_carbs || 30,
      macro_fat: clientPreferences.macro_fat || 30,
      prep_complexity: clientPreferences.prep_complexity || 50,
      appliances: clientPreferences.appliances || {
        airFryer: false,
        instapot: false,
        crockpot: false
      }
    };
    
    // Save the request data
    setMenuRequest(request);
    console.log("Menu request prepared:", request);
    console.log("Opening model dialog");
    
    // The dialog open is now handled in the button click handler
  };
  
  // This function will be called after model selection
  const continueGenerateMenu = async (model) => {
    if (!menuRequest) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess('');
      
      // Add the selected model to the request
      const finalRequest = {
        ...menuRequest,
        ai_model: model
      };
      
      console.log('Generating menu with model:', model);
      
      // Call the API to generate the menu for this specific client
      // This will store the menu with the organization as the owner but with a reference to the client
      const newMenu = await apiService.generateMenuForClient(client.id, finalRequest);
      
      // Check if we got a valid menu response
      if (newMenu && (newMenu.menu_id || (newMenu.meal_plan && newMenu.meal_plan.days))) {
        // Set success message
        setSuccess('Menu generated successfully!');
        
        // Call the callback if provided
        if (onMenuGenerated) {
          onMenuGenerated(newMenu);
        }
      } else {
        // Handle the case where we got a response but not a valid menu
        console.warn('Menu generation response did not contain expected data:', newMenu);
        throw new Error('Menu response format was unexpected. The menu may have been generated but couldn\'t be loaded.');
      }
    } catch (err) {
      console.error('Error generating menu:', err);
      
      // Check if we already have a menu with a valid ID in local state
      // This can happen if the generation was actually successful but had a connection issue after
      if (err.message && err.message.includes('unexpected') && onMenuGenerated) {
        // Try to fetch the latest menu for this client - the menu might have been saved successfully
        try {
          console.log("Attempting to fetch latest menu despite error...");
          const latestMenus = await apiService.getClientMenus(client.id);
          if (latestMenus && latestMenus.length > 0) {
            // Get the most recent menu
            const latestMenu = latestMenus[0];
            console.log("Found latest menu despite error:", latestMenu);
            
            // Set success with warning
            setSuccess('Menu was generated but had a minor loading issue. The menu is available in the client\'s menu list.');
            
            // Call the callback with the latest menu
            onMenuGenerated(latestMenu);
            
            // Exit the error handler since we recovered
            setLoading(false);
            return;
          }
        } catch (recoveryErr) {
          console.error("Error during recovery attempt:", recoveryErr);
        }
      }
      
      // Display a more specific error message for timeouts
      if (err.message && err.message.includes('timed out')) {
        setError('Menu generation timed out. This may happen with longer menus or complex requirements. Try reducing the number of days or try again.');
      } else if (err.response && err.response.status === 504) {
        setError('The server took too long to respond. Try generating a shorter menu or try again later.');
      } else {
        setError(`Failed to generate menu: ${err.message || 'Please try again.'}`);
      }
    } finally {
      setLoading(false);
    }
  };
  
  // Handle model selection from dialog
  const handleModelSelect = (model) => {
    setSelectedModel(model);
    continueGenerateMenu(model);
  };

  if (loadingPreferences) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
        <CircularProgress />
      </Box>
    );
  }

  console.log('Model dialog state:', { modelDialogOpen, selectedModel });
  
  return (
    <Paper sx={{ p: 3, mb: 3 }}>
      <Typography variant="h6" gutterBottom>
        Generate Menu for {client?.name || 'Client'}
      </Typography>
      
      {!clientPreferences ? (
        <Alert severity="warning" sx={{ mb: 2 }}>
          This client doesn't have preferences set up. Please set up preferences first.
        </Alert>
      ) : null}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}
      
      <Box sx={{ mb: 3 }}>
        <TextField
          label="Number of Days"
          type="number"
          value={durationDays}
          onChange={(e) => setDurationDays(Math.max(1, Math.min(30, parseInt(e.target.value) || 7)))}
          InputProps={{ inputProps: { min: 1, max: 30 } }}
          fullWidth
          margin="normal"
          helperText="Choose how many days of meals to generate (1-30)"
        />
      </Box>
      
      <Button
        variant="contained"
        onClick={() => {
          console.log('Generate Menu button clicked');
          handleGenerateMenu(); // First prepare the request data
          setModelDialogOpen(true); // Then open the model selection dialog
        }}
        disabled={loading || !clientPreferences}
        fullWidth
      >
        {loading ? (
          <>
            <CircularProgress size={24} sx={{ mr: 1 }} />
            Generating Menu...
          </>
        ) : (
          'Generate Menu'
        )}
      </Button>
      
      {/* AI Model Selection Dialog */}
      <ModelSelectionDialog
        open={modelDialogOpen}
        onClose={() => {
          console.log('Closing model dialog');
          setModelDialogOpen(false);
        }}
        onModelSelect={(model) => {
          console.log('Model selected:', model);
          handleModelSelect(model);
        }}
      />
    </Paper>
  );
}

export default ClientMenuGenerator;