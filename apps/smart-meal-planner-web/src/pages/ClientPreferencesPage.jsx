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
  FormControl,
  Radio,
  RadioGroup,
  Grid
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
  
  // New preference states
  const [flavorPreferences, setFlavorPreferences] = useState({
    creamy: false,
    cheesy: false,
    herbs: false,
    umami: false,
    sweet: false,
    spiced: false,
    smoky: false,
    garlicky: false,
    tangy: false,
    peppery: false,
    hearty: false,
    spicy: false
  });

  const [spiceLevel, setSpiceLevel] = useState('medium');

  const [recipeTypePreferences, setRecipeTypePreferences] = useState({
    'stir-fry': false,
    'grain-bowl': false,
    'salad': false,
    'pasta': false,
    'main-sides': false,
    'pizza': false,
    'burger': false,
    'sandwich': false,
    'tacos': false,
    'wrap': false,
    'soup-stew': false,
    'bake': false,
    'family-meals': false
  });

  const [mealTimePreferences, setMealTimePreferences] = useState({
    'breakfast': false,
    'morning-snack': false,
    'lunch': false,
    'afternoon-snack': false,
    'dinner': false,
    'evening-snack': false
  });

  const [timeConstraints, setTimeConstraints] = useState({
    'weekday-breakfast': 10, // minutes
    'weekday-lunch': 15,
    'weekday-dinner': 30,
    'weekend-breakfast': 20,
    'weekend-lunch': 30,
    'weekend-dinner': 45
  });

  const [prepPreferences, setPrepPreferences] = useState({
    'batch-cooking': false,
    'meal-prep': false,
    'quick-assembly': false,
    'one-pot': false,
    'minimal-dishes': false
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
          
          // Load new preference types if they exist
          if (clientPrefs.flavor_preferences) {
            setFlavorPreferences(clientPrefs.flavor_preferences);
          }
          
          if (clientPrefs.spice_level) {
            setSpiceLevel(clientPrefs.spice_level);
          }
          
          if (clientPrefs.recipe_type_preferences) {
            setRecipeTypePreferences(clientPrefs.recipe_type_preferences);
          }
          
          if (clientPrefs.meal_time_preferences) {
            setMealTimePreferences(clientPrefs.meal_time_preferences);
          }
          
          if (clientPrefs.time_constraints) {
            setTimeConstraints(clientPrefs.time_constraints);
          }
          
          if (clientPrefs.prep_preferences) {
            setPrepPreferences(clientPrefs.prep_preferences);
          }
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
  
  // Handle changes for new preference states
  const handleFlavorPreferenceChange = (flavor, checked) => {
    setFlavorPreferences(prev => ({
      ...prev,
      [flavor]: checked
    }));
  };
  
  const handleSpiceLevelChange = (level) => {
    setSpiceLevel(level);
  };
  
  const handleRecipeTypePreferenceChange = (type, checked) => {
    setRecipeTypePreferences(prev => ({
      ...prev,
      [type]: checked
    }));
  };
  
  const handleMealTimePreferenceChange = (mealTime, checked) => {
    setMealTimePreferences(prev => ({
      ...prev,
      [mealTime]: checked
    }));
    
    // Update regular meal times for compatibility
    if (['breakfast', 'lunch', 'dinner'].includes(mealTime)) {
      handleCheckboxChange('meal_times', mealTime, checked);
    } else if (['morning-snack', 'afternoon-snack', 'evening-snack'].includes(mealTime)) {
      const anySnackEnabled = checked || 
        Object.entries(mealTimePreferences)
          .filter(([key]) => ['morning-snack', 'afternoon-snack', 'evening-snack'].includes(key) && key !== mealTime)
          .some(([, isEnabled]) => isEnabled);
          
      handleCheckboxChange('meal_times', 'snacks', anySnackEnabled);
    }
  };
  
  const handleTimeConstraintChange = (constraint, value) => {
    setTimeConstraints(prev => ({
      ...prev,
      [constraint]: value
    }));
  };
  
  const handlePrepPreferenceChange = (prep, checked) => {
    setPrepPreferences(prev => ({
      ...prev,
      [prep]: checked
    }));
  };

  // Save client preferences
  const handleSave = async () => {
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      // Calculate snacks per day based on meal time preferences
      const selectedSnackTimes = 
        [mealTimePreferences['morning-snack'], 
         mealTimePreferences['afternoon-snack'], 
         mealTimePreferences['evening-snack']]
        .filter(Boolean).length;
      
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
        snacks_per_day: selectedSnackTimes > 0 ? preferences.snacks_per_day : 0,
        servings_per_meal: preferences.servings_per_meal,
        appliances: preferences.appliances,
        prep_complexity: preferences.prep_complexity,
        // New preference fields
        flavor_preferences: flavorPreferences,
        spice_level: spiceLevel,
        recipe_type_preferences: recipeTypePreferences,
        meal_time_preferences: mealTimePreferences,
        time_constraints: timeConstraints,
        prep_preferences: prepPreferences
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
          
          {/* Diet Types - Using checkboxes like the user preferences page */}
          <Typography variant="subtitle1" gutterBottom>
            Diet Types
          </Typography>
          <Grid container spacing={2}>
            {[
              'Vegetarian', 'Vegan', 'Pescatarian', 'Mediterranean', 
              'Ketogenic', 'Paleo', 'Low-Carb', 'Low-Fat', 
              'Gluten-Free', 'Dairy-Free'
            ].map((dietType) => (
              <Grid item xs={6} sm={4} key={dietType}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.diet_type.includes(dietType)}
                      onChange={(e) => {
                        let currentDietTypes = preferences.diet_type ? 
                          preferences.diet_type.split(',').map(t => t.trim()) : [];
                        
                        if (e.target.checked) {
                          if (!currentDietTypes.includes(dietType)) {
                            currentDietTypes.push(dietType);
                          }
                        } else {
                          currentDietTypes = currentDietTypes.filter(t => t !== dietType);
                        }
                        
                        handleChange('diet_type', currentDietTypes.join(', '));
                      }}
                    />
                  }
                  label={dietType}
                />
              </Grid>
            ))}
          </Grid>
          
          <TextField
            label="Other Diet Types"
            fullWidth
            margin="normal"
            value={preferences.diet_type}
            onChange={(e) => handleChange('diet_type', e.target.value)}
            helperText="Edit or add other diet types separated by commas"
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
          
          {/* Recipe Types - Using checkboxes like the user preferences page */}
          <Typography variant="subtitle1" sx={{ mt: 2 }} gutterBottom>
            Recipe Types
          </Typography>
          <Grid container spacing={2}>
            {[
              'American', 'Italian', 'Mexican', 'Asian', 'Mediterranean',
              'Indian', 'French', 'Greek', 'Japanese', 'Thai', 'Chinese'
            ].map((recipeType) => (
              <Grid item xs={6} sm={4} key={recipeType}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.recipe_type.includes(recipeType)}
                      onChange={(e) => {
                        let currentRecipeTypes = preferences.recipe_type ? 
                          preferences.recipe_type.split(',').map(t => t.trim()) : [];
                        
                        if (e.target.checked) {
                          if (!currentRecipeTypes.includes(recipeType)) {
                            currentRecipeTypes.push(recipeType);
                          }
                        } else {
                          currentRecipeTypes = currentRecipeTypes.filter(t => t !== recipeType);
                        }
                        
                        handleChange('recipe_type', currentRecipeTypes.join(', '));
                      }}
                    />
                  }
                  label={recipeType}
                />
              </Grid>
            ))}
          </Grid>
          
          <TextField
            label="Other Recipe Types"
            fullWidth
            margin="normal"
            value={preferences.recipe_type}
            onChange={(e) => handleChange('recipe_type', e.target.value)}
            helperText="Edit or add other cuisine types separated by commas"
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

        {/* Flavor Preferences (NEW) */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Flavor Preferences
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the flavors your client enjoys most in their meals
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(flavorPreferences).map(([flavor, checked]) => (
              <Grid item xs={6} sm={4} key={flavor}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => handleFlavorPreferenceChange(flavor, e.target.checked)}
                    />
                  }
                  label={flavor.charAt(0).toUpperCase() + flavor.slice(1)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Spice Level (NEW) */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Spice Level Preference
          </Typography>
          <FormControl component="fieldset">
            <RadioGroup
              row
              name="spice-level"
              value={spiceLevel}
              onChange={(e) => handleSpiceLevelChange(e.target.value)}
            >
              <FormControlLabel value="mild" control={<Radio />} label="Mild" />
              <FormControlLabel value="medium" control={<Radio />} label="Medium" />
              <FormControlLabel value="hot" control={<Radio />} label="Hot" />
            </RadioGroup>
          </FormControl>
        </Box>

        {/* Recipe Type Preferences (NEW) */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Recipe Format Preferences
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the types of meal formats your client prefers
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(recipeTypePreferences).map(([type, checked]) => (
              <Grid item xs={6} sm={4} key={type}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => handleRecipeTypePreferenceChange(type, e.target.checked)}
                    />
                  }
                  label={type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Enhanced Meal Schedule */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Detailed Meal Schedule
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select all meal times to include in the client's plan
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(mealTimePreferences).map(([mealTime, checked]) => (
              <Grid item xs={6} sm={4} key={mealTime}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => handleMealTimePreferenceChange(mealTime, e.target.checked)}
                    />
                  }
                  label={mealTime.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        {/* Time Constraints (NEW) */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Time Constraints
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Maximum prep time (minutes) for each meal
          </Typography>
          {Object.entries(timeConstraints).map(([mealType, minutes]) => (
            <Box key={mealType} sx={{ mb: 2 }}>
              <Typography variant="body2">
                {mealType.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
              </Typography>
              <Slider
                value={minutes}
                min={5}
                max={60}
                step={5}
                marks
                valueLabelDisplay="auto"
                onChange={(e, value) => handleTimeConstraintChange(mealType, value)}
              />
            </Box>
          ))}
        </Box>

        {/* Meal Preparation Preferences (NEW) */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Meal Preparation Preferences
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(prepPreferences).map(([prep, checked]) => (
              <Grid item xs={6} sm={4} key={prep}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => handlePrepPreferenceChange(prep, e.target.checked)}
                    />
                  }
                  label={prep.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                />
              </Grid>
            ))}
          </Grid>
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