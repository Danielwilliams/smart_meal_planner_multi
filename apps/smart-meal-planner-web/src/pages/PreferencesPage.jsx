import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Box, 
  Typography, 
  TextField, 
  FormControlLabel, 
  Checkbox, 
  Button,
  Container, 
  FormControl, 
  InputLabel, 
  Select, 
  MenuItem,
  Grid,
  Paper,
  CircularProgress,
  InputAdornment,
  Alert,
  Divider,
  Slider,
  FormGroup,
  FormHelperText
} from '@mui/material';
import apiService from '../services/apiService';
import { useAuth } from '../context/AuthContext';
import MacroDefaults from '../components/MacroDefaults';


function PreferencesPage() {
  const { user, updateUserProgress } = useAuth();
  const navigate = useNavigate();

  const [preferences, setPreferences] = useState({
    servingsPerMeal: 1,
    appliances: {
      airFryer: false,
      instapot: false,
      crockpot: false
    },
    prepComplexity: 50,
    
    dietTypes: {
      Vegetarian: false,
      Vegan: false,
      Pescatarian: false,
      Mediterranean: false,
      Ketogenic: false,
      Paleo: false,
      'Low-Carb': false,
      'Low-Fat': false,
      'Gluten-Free': false,
      'Dairy-Free': false,
      Other: false
    },
    otherDietType: '',
    dietaryRestrictions: '',
    dislikedIngredients: '',
    recipeTypes: {
      American: false,
      Italian: false,
      Mexican: false,
      Asian: false,
      Mediterranean: false,
      Indian: false,
      French: false,
      Greek: false,
      Japanese: false,
      Thai: false,
      Chinese: false,
      Korean: false,
      Spanish: false,
      'Middle Eastern': false,
      Vietnamese: false,
      Brazilian: false,
      Caribbean: false,
      Other: false
    },
    otherRecipeType: '',
    mealTimes: {
      breakfast: false,
      lunch: false,
      dinner: false,
      snacks: false
    },
    snacksPerDay: 1,
    macroGoals: {
      protein: '',
      carbs: '',
      fat: '',
      calories: ''
    },
    krogerUsername: '',
    krogerPassword: ''
  });

  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
  const fetchUserPreferences = async () => {
    if (!user?.userId) {
      setError('Please log in to view preferences');
      navigate('/login');
      return;
    }

    try {
      setLoading(true);
      setError('');
      
      const existingPreferences = await apiService.getUserPreferences(user.userId);
      console.log('Fetched preferences:', existingPreferences);
      
      // Parse the stored preferences
      const savedDietTypes = existingPreferences.diet_type ? 
        existingPreferences.diet_type.split(',').map(t => t.trim()) : [];
      const savedRecipeTypes = existingPreferences.recipe_type ? 
        existingPreferences.recipe_type.split(',').map(t => t.trim()) : [];
      
      // Parse JSONB fields
      const savedMealTimes = existingPreferences.meal_times || {
        breakfast: false,
        lunch: false,
        dinner: false,
        snacks: false
      };

      const savedAppliances = existingPreferences.appliances || {
        airFryer: false,
        instapot: false,
        crockpot: false
      };

      // Initialize the state with all saved preferences
      setPreferences(prevState => ({
        ...prevState,
        // Diet Types
        dietTypes: {
          ...prevState.dietTypes,
          ...Object.fromEntries(
            Object.keys(prevState.dietTypes).map(type => [
              type,
              type === 'Other' 
                ? savedDietTypes.some(dt => !Object.keys(prevState.dietTypes).includes(dt))
                : savedDietTypes.includes(type)
            ])
          )
        },
        otherDietType: savedDietTypes.find(dt => !Object.keys(prevState.dietTypes).includes(dt)) || '',

        // Recipe Types
        recipeTypes: {
          ...prevState.recipeTypes,
          ...Object.fromEntries(
            Object.keys(prevState.recipeTypes).map(type => [
              type,
              type === 'Other'
                ? savedRecipeTypes.some(rt => !Object.keys(prevState.recipeTypes).includes(rt))
                : savedRecipeTypes.includes(type)
            ])
          )
        },
        otherRecipeType: savedRecipeTypes.find(rt => !Object.keys(prevState.recipeTypes).includes(rt)) || '',

        // Restrictions and Ingredients
        dietaryRestrictions: existingPreferences.dietary_restrictions || '',
        dislikedIngredients: existingPreferences.disliked_ingredients || '',

        // Meal Times and Servings
        mealTimes: savedMealTimes,
        snacksPerDay: existingPreferences.snacks_per_day || 1,
        servingsPerMeal: existingPreferences.servings_per_meal || 1,

        // Appliances and Complexity
        appliances: savedAppliances,
        prepComplexity: existingPreferences.prep_complexity || 50,

        // Macro Goals
        macroGoals: {
          protein: existingPreferences.macro_protein?.toString() || '',
          carbs: existingPreferences.macro_carbs?.toString() || '',
          fat: existingPreferences.macro_fat?.toString() || '',
          calories: existingPreferences.calorie_goal?.toString() || ''
        },

        // Kroger Settings
        krogerUsername: existingPreferences.kroger_username || '',
        krogerPassword: existingPreferences.kroger_password || ''
      }));

      // Log the loaded preferences for debugging
      console.log('Updated preferences state:', preferences);

    } catch (err) {
      console.error('Error fetching preferences:', err);
      setError(err.response?.data?.detail || 'Failed to load preferences');
      
      if (err.response?.status === 401) {
        navigate('/login');
      }
    } finally {
      setLoading(false);
    }
  };

  fetchUserPreferences();
}, [user, navigate]);


  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    if (type === 'checkbox') {
      if (name.startsWith('mealTimes.')) {
        const mealTime = name.split('.')[1];
        setPreferences(prev => ({
          ...prev,
          mealTimes: {
            ...prev.mealTimes,
            [mealTime]: checked
          }
        }));
      }
    } else {
      setPreferences(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  const handleMacroPercentageChange = (e) => {
      const { name, value } = e.target;
      const macroName = name.split('.')[1];

      // Allow unrestricted values for "calories"
      if (macroName === "calories") {
          if (value === '' || /^\d+$/.test(value)) {
              setPreferences(prev => ({
                  ...prev,
                  macroGoals: {
                      ...prev.macroGoals,
                      [macroName]: value
                  }
              }));
          }
      } else {
          // Keep 0-100 range for macros
          if (value === '' || (/^\d+$/.test(value) && parseInt(value) >= 0 && parseInt(value) <= 100)) {
              setPreferences(prev => ({
                  ...prev,
                  macroGoals: {
                      ...prev.macroGoals,
                      [macroName]: value
                  }
              }));
          }
      }
  };


  const calculateRemaining = () => {
    const total = ['protein', 'carbs', 'fat'].reduce((sum, macro) => 
      sum + (parseInt(preferences.macroGoals[macro]) || 0), 0
    );
    return 100 - total;
  };

  const handleSave = async () => {
    try {
      setError('');
      setMessage('');

      // Gather selected diet types
      const selectedDietTypes = Object.entries(preferences.dietTypes)
        .filter(([type, checked]) => checked && type !== 'Other')
        .map(([type]) => type);
      if (preferences.dietTypes.Other && preferences.otherDietType) {
        selectedDietTypes.push(preferences.otherDietType);
      }

      // Gather selected recipe types
      const selectedRecipeTypes = Object.entries(preferences.recipeTypes)
        .filter(([type, checked]) => checked && type !== 'Other')
        .map(([type]) => type);
      if (preferences.recipeTypes.Other && preferences.otherRecipeType) {
        selectedRecipeTypes.push(preferences.otherRecipeType);
      }

      const prefsToSave = {
        user_id: user.userId,
        diet_type: selectedDietTypes.join(', '),
        dietary_restrictions: preferences.dietaryRestrictions,
        disliked_ingredients: preferences.dislikedIngredients,
        recipe_type: selectedRecipeTypes.join(', '),
        meal_times: preferences.mealTimes,
        snacks_per_day: preferences.mealTimes.snacks ? preferences.snacksPerDay : 0,
        macro_protein: preferences.macroGoals.protein ? parseInt(preferences.macroGoals.protein) : null,
        macro_carbs: preferences.macroGoals.carbs ? parseInt(preferences.macroGoals.carbs) : null,
        macro_fat: preferences.macroGoals.fat ? parseInt(preferences.macroGoals.fat) : null,
        calorie_goal: preferences.macroGoals.calories ? parseInt(preferences.macroGoals.calories) : null,
        appliances: preferences.appliances,
        prep_complexity: preferences.prepComplexity,
        kroger_username: preferences.krogerUsername,
        servings_per_meal: preferences.servingsPerMeal,
        kroger_password: preferences.krogerPassword
      };

      await apiService.savePreferences(prefsToSave);
      setMessage('Preferences saved successfully!');


      updateUserProgress({ has_preferences: true });

      if (!user.profile_complete) {
        navigate('/menu', { 
          state: { 
            isNewUser: true,
            showWalkthrough: true 
          }
        });
      }

    } catch (err) {
      console.error('Error saving preferences:', err);
      setError(err.response?.data?.detail || 'Failed to save preferences');
    }
  };
    // Function to format the prep complexity label
  const getPrepComplexityLabel = (value) => {
    if (value <= 25) return 'Minimal Prep (Quick & Easy)';
    if (value <= 50) return 'Moderate Prep';
    if (value <= 75) return 'Standard Cooking';
    return 'Complex Recipes';
  };
  
  if (loading) {
    return (
      <Container maxWidth="md" sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Container>
    );
  }

  return (
    <Container maxWidth="md">
      <Paper elevation={3} sx={{ p: 4, mt: 4 }}>
        <Typography variant="h4" gutterBottom>
          Set Your Meal Preferences
        </Typography>

        {/* Diet Types */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Diet Types
          </Typography>
          <Grid container spacing={2}>
            {Object.keys(preferences.dietTypes).map((type) => (
              <Grid item xs={6} sm={4} key={type}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.dietTypes[type]}
                      onChange={(e) => {
                        setPreferences(prev => ({
                          ...prev,
                          dietTypes: {
                            ...prev.dietTypes,
                            [type]: e.target.checked
                          }
                        }));
                      }}
                    />
                  }
                  label={type}
                />
              </Grid>
            ))}
          </Grid>
          {preferences.dietTypes.Other && (
            <TextField
              fullWidth
              margin="normal"
              label="Other Diet Type"
              value={preferences.otherDietType}
              onChange={(e) => {
                setPreferences(prev => ({
                  ...prev,
                  otherDietType: e.target.value
                }));
              }}
              placeholder="Please specify your diet type"
            />
          )}
        </Box>

        {/* Recipe Types */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Recipe Types
          </Typography>
          <Grid container spacing={2}>
            {Object.keys(preferences.recipeTypes).map((type) => (
              <Grid item xs={6} sm={4} key={type}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.recipeTypes[type]}
                      onChange={(e) => {
                        setPreferences(prev => ({
                          ...prev,
                          recipeTypes: {
                            ...prev.recipeTypes,
                            [type]: e.target.checked
                          }
                        }));
                      }}
                    />
                  }
                  label={type}
                />
              </Grid>
            ))}
          </Grid>
          {preferences.recipeTypes.Other && (
            <TextField
              fullWidth
              margin="normal"
              label="Other Recipe Type"
              value={preferences.otherRecipeType}
              onChange={(e) => {
                setPreferences(prev => ({
                  ...prev,
                  otherRecipeType: e.target.value
                }));
              }}
              placeholder="Please specify your preferred cuisine type"
            />
          )}
        </Box>

        {/* Dietary Restrictions and Disliked Ingredients */}
        <TextField
          name="dietaryRestrictions"
          label="Dietary Restrictions"
          fullWidth
          margin="normal"
          value={preferences.dietaryRestrictions}
          onChange={handleChange}
          helperText="Enter dietary restrictions, separated by commas"
        />

        <TextField
          name="dislikedIngredients"
          label="Disliked Ingredients"
          fullWidth
          margin="normal"
          value={preferences.dislikedIngredients}
          onChange={handleChange}
          helperText="Enter ingredients you dislike, separated by commas"
        />

        {/* Meal Times */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Meal Times
          </Typography>
          <Grid container>
            {Object.entries(preferences.mealTimes).map(([meal, checked]) => (
              <Grid item xs={6} key={meal}>
                <FormControlLabel
                  control={
                    <Checkbox
                      name={`mealTimes.${meal}`}
                      checked={checked}
                      onChange={handleChange}
                    />
                  }
                  label={meal.charAt(0).toUpperCase() + meal.slice(1)}
                />
              </Grid>
            ))}
          </Grid>
          
          {preferences.mealTimes.snacks && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Snacks Per Day</InputLabel>
              <Select
                name="snacksPerDay"
                value={preferences.snacksPerDay}
                label="Snacks Per Day"
                onChange={handleChange}
              >
                {[1, 2, 3].map((num) => (
                  <MenuItem key={num} value={num}>
                    {num}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          )}
        </Box>
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
             Servings per Meal
          </Typography>
      <FormControl fullWidth>
          <InputLabel>Servings per Meal</InputLabel>
            <Select
              value={preferences.servingsPerMeal}
              label="Servings per Meal"
              onChange={(e) => setPreferences(prev => ({
              ...prev,
              servingsPerMeal: e.target.value
            }))}
          >
            {[1, 2, 3, 4, 5, 6].map((num) => (
              <MenuItem key={num} value={num}>
                {num} {num === 1 ? 'serving' : 'servings'}
              </MenuItem>
            ))}
          </Select>
          <FormHelperText>Choose how many servings each meal should make</FormHelperText>
      </FormControl>
    </Box>
                {/* Cooking Appliances Section */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Available Cooking Appliances
          </Typography>
          <FormGroup>
            <Grid container spacing={2}>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.appliances.airFryer}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        appliances: {
                          ...prev.appliances,
                          airFryer: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Air Fryer"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.appliances.instapot}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        appliances: {
                          ...prev.appliances,
                          instapot: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Instant Pot"
                />
              </Grid>
              <Grid item xs={12} sm={4}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={preferences.appliances.crockpot}
                      onChange={(e) => setPreferences(prev => ({
                        ...prev,
                        appliances: {
                          ...prev.appliances,
                          crockpot: e.target.checked
                        }
                      }))}
                    />
                  }
                  label="Crock Pot"
                />
              </Grid>
            </Grid>
          </FormGroup>
        </Box>

        {/* Meal Preparation Complexity Section */}
        <Box sx={{ mt: 4, mb: 4 }}>
          <Typography variant="subtitle1" gutterBottom>
            Meal Preparation Complexity
          </Typography>
          <Box sx={{ px: 2 }}>
            <Slider
              value={preferences.prepComplexity}
              onChange={(e, newValue) => setPreferences(prev => ({
                ...prev,
                prepComplexity: newValue
              }))}
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
            {getPrepComplexityLabel(preferences.prepComplexity)}
          </Typography>
        </Box>

        <Divider sx={{ my: 3 }} />

        
        {/* Macro Goals */}
        <Typography variant="subtitle1" gutterBottom>
          Daily Macro Goals
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <Typography variant="body2" color="text.secondary">
              Set your macro split (must total 100%)
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <MacroDefaults 
              initialValues={{
                protein: preferences.macroGoals.protein,
                carbs: preferences.macroGoals.carbs,
                fat: preferences.macroGoals.fat,
                calories: preferences.macroGoals.calories
              }}
              onChange={(newMacros) => {
                setPreferences(prev => ({
                  ...prev,
                  macroGoals: {
                    ...prev.macroGoals,
                    protein: newMacros.protein,
                    carbs: newMacros.carbs,
                    fat: newMacros.fat,
                    calories: newMacros.calories
                  }
                }));
              }}
            />
          </Grid>
        

          <Grid item xs={12}>
            <Typography 
              variant="body2" 
              color={calculateRemaining() === 0 ? "success.main" : "warning.main"}
              sx={{ mt: 1 }}
            >
              {calculateRemaining() === 0 
                ? "Perfect! Your macros total 100%" 
                : `Remaining: ${calculateRemaining()}%`}
            </Typography>
          </Grid>

        </Grid>

        <Divider sx={{ my: 3 }} />

        {/* Kroger Account Settings */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Kroger Account Settings
          </Typography>
          <TextField
            name="krogerUsername"
            label="Kroger Username"
            fullWidth
            margin="normal"
            value={preferences.krogerUsername}
            onChange={handleChange}
            helperText="Enter your Kroger website username"
          />

          <TextField
            name="krogerPassword"
            label="Kroger Password"
            type="password"
            fullWidth
            margin="normal"
            value={preferences.krogerPassword}
            onChange={handleChange}
            helperText="Enter your Kroger website password"
          />
        </Box>

        {/* Save Button and Messages */}
        <Box sx={{ mt: 4 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}

          {message && (
            <Alert severity="success" sx={{ mb: 2 }}>
              {message}
            </Alert>
          )}

          <Button
            variant="contained"
            color="primary"
            fullWidth
            onClick={handleSave}
          >
            Save Preferences
          </Button>
        </Box>
      </Paper>
    </Container>
  );
}

export default PreferencesPage;