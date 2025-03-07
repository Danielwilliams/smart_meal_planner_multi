// src/pages/ClientPreferencesPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Paper,
  TextField,
  FormControlLabel,
  Checkbox,
  Button,
  Alert,
  CircularProgress,
  Divider,
  Slider,
  FormGroup,
  Select,
  MenuItem,
  InputLabel,
  FormControl
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import apiService from '../services/apiService';
import MacroDefaults from '../components/MacroDefaults';

function ClientPreferencesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clientId } = useParams();
  
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Preferences state
  const [preferences, setPreferences] = useState({
    diet_type: '',
    dietary_restrictions: '',
    disliked_ingredients: '',
    recipe_type: '',
    meal_times: {
      breakfast: false,
      lunch: false,
      dinner: false,
      snacks: false
    },
    macro_protein: 40,
    macro_carbs: 30,
    macro_fat: 30,
    calorie_goal: 2000,
    snacks_per_day: 0,
    servings_per_meal: 1,
    appliances: {
      airFryer: false,
      instapot: false,
      crockpot: false
    },
    prep_complexity: 50
  });

  // Fetch client data and preferences
  useEffect(() => {
    const fetchClientData = async () => {
      if (!user || !clientId) return;

      try {
        setLoading(true);
        setError('');
        
        // Fetch client details
        const clientData = await apiService.getClientDetails(clientId);
        setClient(clientData);
        
        // Fetch client preferences
        const clientPrefs = await apiService.getUserPreferences(clientId);
        
        if (clientPrefs) {
          // Parse stored preferences
          const updatedPrefs = {
            ...preferences,
            diet_type: clientPrefs.diet_type || '',
            dietary_restrictions: clientPrefs.dietary_restrictions || '',
            disliked_ingredients: clientPrefs.disliked_ingredients || '',
            recipe_type: clientPrefs.recipe_type || '',
            meal_times: clientPrefs.meal_times || preferences.meal_times,
            macro_protein: clientPrefs.macro_protein || 40,
            macro_carbs: clientPrefs.macro_carbs || 30,
            macro_fat: clientPrefs.macro_fat || 30,
            calorie_goal: clientPrefs.calorie_goal || 2000,
            snacks_per_day: clientPrefs.snacks_per_day || 0,
            servings_per_meal: clientPrefs.servings_per_meal || 1,
            appliances: clientPrefs.appliances || preferences.appliances,
            prep_complexity: clientPrefs.prep_complexity || 50
          };
          
          setPreferences(updatedPrefs);
        }
      } catch (err) {
        console.error('Error fetching client data:', err);
        setError('Failed to load client data');
      } finally {
        setLoading(false);
      }
    };
    
    fetchClientData();
  }, [clientId, user]);

  // Handle preference changes
  const handleChange = (name, value) => {
    setPreferences(prev => ({
      ...prev,
      [name]: value
    }));
  };
  
  // Handle checkbox changes
  const handleCheckboxChange = (category, item, checked) => {
    setPreferences(prev => ({
      ...prev,
      [category]: {
        ...prev[category],
        [item]: checked
      }
    }));
  };
  
  // Handle macro changes
  const handleMacroChange = (macros) => {
    setPreferences(prev => ({
      ...prev,
      macro_protein: macros.protein,
      macro_carbs: macros.carbs,
      macro_fat: macros.fat,
      calorie_goal: macros.calories
    }));
  };

  // Save client preferences
  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      const prefsToSave = {
        user_id: clientId,
        diet_type: preferences.diet_type,
        dietary_restrictions: preferences.dietary_restrictions,
        disliked_ingredients: preferences.disliked_ingredients,
        recipe_type: preferences.recipe_type,
        meal_times: preferences.meal_times,
        macro_protein: preferences.macro_protein,
        macro_carbs: preferences.macro_carbs,
        macro_fat: preferences.macro_fat,
        calorie_goal: preferences.calorie_goal,
        snacks_per_day: preferences.meal_times.snacks ? preferences.snacks_per_day : 0,
        servings_per_meal: preferences.servings_per_meal,
        appliances: preferences.appliances,
        prep_complexity: preferences.prep_complexity
      };
      
      const response = await apiService.savePreferences(prefsToSave);
      setSuccess('Client preferences saved successfully');
    } catch (err) {
      console.error('Error saving preferences:', err);
      setError('Failed to save preferences');
    } finally {
      setSaving(false);
    }
  };

  const getPrepComplexityLabel = (value) => {
    if (value <= 25) return 'Minimal Prep (Quick & Easy)';
    if (value <= 50) return 'Moderate Prep';
    if (value <= 75) return 'Standard Cooking';
    return 'Complex Recipes';
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="80vh">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          {client ? `${client.name}'s Preferences` : 'Client Preferences'}
        </Typography>
        
        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}
        
        {success && (
          <Alert severity="success" sx={{ mb: 3 }}>
            {success}
          </Alert>
        )}

        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Dietary Preferences
          </Typography>
          
          <TextField
            label="Diet Type"
            fullWidth
            margin="normal"
            value={preferences.diet_type}
            onChange={(e) => handleChange('diet_type', e.target.value)}
            helperText="Example: Keto, Vegan, Paleo, etc."
          />
          
          <TextField
            label="Dietary Restrictions"
            fullWidth
            margin="normal"
            value={preferences.dietary_restrictions}
            onChange={(e) => handleChange('dietary_restrictions', e.target.value)}
            helperText="Enter any restrictions separated by commas"
          />
          
          <TextField
            label="Disliked Ingredients"
            fullWidth
            margin="normal"
            value={preferences.disliked_ingredients}
            onChange={(e) => handleChange('disliked_ingredients', e.target.value)}
            helperText="Enter ingredients to avoid, separated by commas"
          />
          
          <TextField
            label="Recipe Types"
            fullWidth
            margin="normal"
            value={preferences.recipe_type}
            onChange={(e) => handleChange('recipe_type', e.target.value)}
            helperText="Example: American, Italian, Mexican, etc."
          />
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Meal Times
          </Typography>
          
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.meal_times.breakfast}
                  onChange={(e) => handleCheckboxChange('meal_times', 'breakfast', e.target.checked)}
                />
              }
              label="Breakfast"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.meal_times.lunch}
                  onChange={(e) => handleCheckboxChange('meal_times', 'lunch', e.target.checked)}
                />
              }
              label="Lunch"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.meal_times.dinner}
                  onChange={(e) => handleCheckboxChange('meal_times', 'dinner', e.target.checked)}
                />
              }
              label="Dinner"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.meal_times.snacks}
                  onChange={(e) => handleCheckboxChange('meal_times', 'snacks', e.target.checked)}
                />
              }
              label="Snacks"
            />
          </FormGroup>
          
          {preferences.meal_times.snacks && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Snacks Per Day</InputLabel>
              <Select
                value={preferences.snacks_per_day}
                label="Snacks Per Day"
                onChange={(e) => handleChange('snacks_per_day', e.target.value)}
              >
                <MenuItem value={1}>1 Snack</MenuItem>
                <MenuItem value={2}>2 Snacks</MenuItem>
                <MenuItem value={3}>3 Snacks</MenuItem>
              </Select>
            </FormControl>
          )}
          
          <FormControl fullWidth margin="normal">
            <InputLabel>Servings Per Meal</InputLabel>
            <Select
              value={preferences.servings_per_meal}
              label="Servings Per Meal"
              onChange={(e) => handleChange('servings_per_meal', e.target.value)}
            >
              {[1, 2, 3, 4, 5, 6].map(num => (
                <MenuItem key={num} value={num}>{num} {num === 1 ? 'serving' : 'servings'}</MenuItem>
              ))}
            </Select>
          </FormControl>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Cooking Preferences
          </Typography>
          
          <Typography variant="subtitle1" gutterBottom>
            Available Appliances
          </Typography>
          <FormGroup row>
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.appliances.airFryer}
                  onChange={(e) => handleCheckboxChange('appliances', 'airFryer', e.target.checked)}
                />
              }
              label="Air Fryer"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.appliances.instapot}
                  onChange={(e) => handleCheckboxChange('appliances', 'instapot', e.target.checked)}
                />
              }
              label="Instant Pot"
            />
            <FormControlLabel
              control={
                <Checkbox
                  checked={preferences.appliances.crockpot}
                  onChange={(e) => handleCheckboxChange('appliances', 'crockpot', e.target.checked)}
                />
              }
              label="Crock Pot"
            />
          </FormGroup>
          
          <Box sx={{ mt: 3 }}>
            <Typography variant="subtitle1" gutterBottom>
              Recipe Complexity
            </Typography>
            <Box sx={{ px: 2 }}>
              <Slider
                value={preferences.prep_complexity}
                onChange={(e, value) => handleChange('prep_complexity', value)}
                valueLabelDisplay="auto"
                valueLabelFormat={getPrepComplexityLabel}
                step={25}
                marks={[
                  { value: 0, label: 'Minimal' },
                  { value: 25, label: 'Easy' },
                  { value: 50, label: 'Moderate' },
                  { value: 75, label: 'Standard' },
                  { value: 100, label: 'Complex' }
                ]}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1, textAlign: 'center' }}>
              {getPrepComplexityLabel(preferences.prep_complexity)}
            </Typography>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />
        
        <Box sx={{ mb: 4 }}>
          <Typography variant="h6" gutterBottom>
            Nutrition Goals
          </Typography>
          
          <MacroDefaults
            initialValues={{
              protein: preferences.macro_protein,
              carbs: preferences.macro_carbs,
              fat: preferences.macro_fat,
              calories: preferences.calorie_goal
            }}
            onChange={handleMacroChange}
          />
        </Box>

        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button 
            variant="outlined" 
            onClick={() => navigate(`/organization/clients/${clientId}`)}
          >
            Cancel
          </Button>
          <Button
            variant="contained"
            onClick={handleSave}
            disabled={saving}
          >
            {saving ? (
              <>
                <CircularProgress size={24} sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              'Save Preferences'
            )}
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default ClientPreferencesPage;