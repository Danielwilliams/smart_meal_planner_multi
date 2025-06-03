import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import ShoppingCartIcon from '@mui/icons-material/ShoppingCart';
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
  FormHelperText,
  Radio,
  RadioGroup
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
      'Low-Sodium': false,
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
    }
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

  const [preferredProteins, setPreferredProteins] = useState({
    meat: {
      chicken: false,
      beef: false,
      pork: false,
      turkey: false,
      lamb: false,
      bison: false
    },
    seafood: {
      salmon: false,
      tuna: false,
      cod: false,
      shrimp: false,
      crab: false,
      mussels: false
    },
    vegetarian_vegan: {
      tofu: false,
      tempeh: false,
      seitan: false,
      lentils: false,
      chickpeas: false,
      black_beans: false
    },
    other: {
      eggs: false,
      dairy_milk: false,
      dairy_yogurt: false,
      protein_powder_whey: false,
      protein_powder_pea: false,
      quinoa: false
    }
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
        }
      }));

      // Load new preference types if they exist in the database
      if (existingPreferences.flavor_preferences) {
        setFlavorPreferences(existingPreferences.flavor_preferences);
      }
      
      if (existingPreferences.spice_level) {
        setSpiceLevel(existingPreferences.spice_level);
      }
      
      if (existingPreferences.recipe_type_preferences) {
        setRecipeTypePreferences(existingPreferences.recipe_type_preferences);
      }
      
      if (existingPreferences.meal_time_preferences) {
        setMealTimePreferences(existingPreferences.meal_time_preferences);
      }
      
      if (existingPreferences.time_constraints) {
        setTimeConstraints(existingPreferences.time_constraints);
      }
      
      if (existingPreferences.prep_preferences) {
        setPrepPreferences(existingPreferences.prep_preferences);
      }
      
      if (existingPreferences.preferred_proteins) {
        setPreferredProteins(existingPreferences.preferred_proteins);
      }
      
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

const updateSnackConsistency = () => {
  const selectedSnackTimes = 
    [mealTimePreferences['morning-snack'], 
     mealTimePreferences['afternoon-snack'], 
     mealTimePreferences['evening-snack']]
    .filter(Boolean).length;
  
  // Update the snacks per day value based on selected snack times
  if (selectedSnackTimes > 0 && preferences.snacksPerDay === 0) {
    setPreferences(prev => ({
      ...prev,
      snacksPerDay: selectedSnackTimes,
      mealTimes: {
        ...prev.mealTimes,
        snacks: true
      }
    }));
  } else if (selectedSnackTimes === 0 && preferences.snacksPerDay > 0) {
    setPreferences(prev => ({
      ...prev,
      snacksPerDay: 0,
      mealTimes: {
        ...prev.mealTimes,
        snacks: false
      }
    }));
  }
};

useEffect(() => {
  updateSnackConsistency();
}, [mealTimePreferences]);


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

      const selectedSnackTimes = 
      [mealTimePreferences['morning-snack'], 
       mealTimePreferences['afternoon-snack'], 
       mealTimePreferences['evening-snack']]
      .filter(Boolean).length;

      // Derive the basic meal_times from the detailed mealTimePreferences for backward compatibility
      const derivedMealTimes = {
        breakfast: mealTimePreferences.breakfast || false,
        lunch: mealTimePreferences.lunch || false,
        dinner: mealTimePreferences.dinner || false,
        snacks: mealTimePreferences['morning-snack'] || 
                mealTimePreferences['afternoon-snack'] || 
                mealTimePreferences['evening-snack'] || false
      };

      const prefsToSave = {
        user_id: user.userId,
        diet_type: selectedDietTypes.join(', '),
        dietary_restrictions: preferences.dietaryRestrictions,
        disliked_ingredients: preferences.dislikedIngredients,
        recipe_type: selectedRecipeTypes.join(', '),
        // Use derived meal times from detailed preferences instead of the deprecated section
        meal_times: derivedMealTimes,
        snacks_per_day: selectedSnackTimes > 0 ? preferences.snacksPerDay : 0,
        macro_protein: preferences.macroGoals.protein ? parseInt(preferences.macroGoals.protein) : null,
        macro_carbs: preferences.macroGoals.carbs ? parseInt(preferences.macroGoals.carbs) : null,
        macro_fat: preferences.macroGoals.fat ? parseInt(preferences.macroGoals.fat) : null,
        calorie_goal: preferences.macroGoals.calories ? parseInt(preferences.macroGoals.calories) : null,
        appliances: preferences.appliances,
        prep_complexity: preferences.prepComplexity,
        servings_per_meal: preferences.servingsPerMeal,
        // Enhanced preference fields (these take precedence in the menu generation process)
        flavor_preferences: flavorPreferences,
        spice_level: spiceLevel,
        recipe_type_preferences: recipeTypePreferences,
        meal_time_preferences: mealTimePreferences,
        time_constraints: timeConstraints,
        prep_preferences: prepPreferences,
        preferred_proteins: preferredProteins
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

        <Divider sx={{ my: 3 }} />

        {/* Preferred Proteins */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Preferred Proteins
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the protein sources you prefer to see in your meals
          </Typography>
          
          {/* Meat Proteins */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
              Meat
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(preferredProteins?.meat || {}).map(([protein, selected]) => (
                <Grid item xs={6} sm={4} key={protein}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected}
                        onChange={(e) => {
                          setPreferredProteins(prev => ({
                            ...prev,
                            meat: {
                              ...prev.meat,
                              [protein]: e.target.checked
                            }
                          }));
                        }}
                      />
                    }
                    label={protein.charAt(0).toUpperCase() + protein.slice(1)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Seafood Proteins */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
              Seafood
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(preferredProteins?.seafood || {}).map(([protein, selected]) => (
                <Grid item xs={6} sm={4} key={protein}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected}
                        onChange={(e) => {
                          setPreferredProteins(prev => ({
                            ...prev,
                            seafood: {
                              ...prev.seafood,
                              [protein]: e.target.checked
                            }
                          }));
                        }}
                      />
                    }
                    label={protein.charAt(0).toUpperCase() + protein.slice(1)}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Vegetarian/Vegan Proteins */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
              Vegetarian/Vegan
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(preferredProteins?.vegetarian_vegan || {}).map(([protein, selected]) => (
                <Grid item xs={6} sm={4} key={protein}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected}
                        onChange={(e) => {
                          setPreferredProteins(prev => ({
                            ...prev,
                            vegetarian_vegan: {
                              ...prev.vegetarian_vegan,
                              [protein]: e.target.checked
                            }
                          }));
                        }}
                      />
                    }
                    label={protein.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>

          {/* Other Proteins */}
          <Box sx={{ mb: 3 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ color: 'primary.main' }}>
              Other
            </Typography>
            <Grid container spacing={2}>
              {Object.entries(preferredProteins?.other || {}).map(([protein, selected]) => (
                <Grid item xs={6} sm={4} key={protein}>
                  <FormControlLabel
                    control={
                      <Checkbox
                        checked={selected}
                        onChange={(e) => {
                          setPreferredProteins(prev => ({
                            ...prev,
                            other: {
                              ...prev.other,
                              [protein]: e.target.checked
                            }
                          }));
                        }}
                      />
                    }
                    label={protein.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
                  />
                </Grid>
              ))}
            </Grid>
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

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

        {/* Removed basic Meal Times section in favor of detailed Meal Schedule below */}
        
        {/* Meal Schedule (Enhanced) - Moved above servings per meal */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Meal Schedule
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select all meal times you want included in your plan
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(mealTimePreferences).map(([mealTime, checked]) => (
              <Grid item xs={6} sm={4} key={mealTime}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        // Update the enhanced preference
                        setMealTimePreferences(prev => ({
                          ...prev,
                          [mealTime]: e.target.checked
                        }));
                        
                        // Also update the original mealTimes for backward compatibility
                        // Map enhanced preferences to original format
                        if (mealTime === 'breakfast' || mealTime === 'lunch' || 
                            mealTime === 'dinner') {
                          setPreferences(prev => ({
                            ...prev,
                            mealTimes: {
                              ...prev.mealTimes,
                              [mealTime]: e.target.checked
                            }
                          }));
                        } else if (mealTime === 'morning-snack' || mealTime === 'afternoon-snack' ||
                                   mealTime === 'evening-snack') {
                          // If any snack is enabled, enable snacks in original format
                          setPreferences(prev => ({
                            ...prev,
                            mealTimes: {
                              ...prev.mealTimes,
                              snacks: e.target.checked || 
                                      mealTimePreferences['morning-snack'] ||
                                      mealTimePreferences['afternoon-snack'] || 
                                      mealTimePreferences['evening-snack']
                            }
                          }));
                        }
                      }}
                    />
                  }
                  label={mealTime.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                />
              </Grid>
            ))}
          </Grid>
          
          {/* Keep the snacks per day selector if any snack is selected */}
          {(mealTimePreferences['morning-snack'] || 
            mealTimePreferences['afternoon-snack'] || 
            mealTimePreferences['evening-snack']) && (
            <FormControl fullWidth margin="normal">
              <InputLabel>Snacks Per Day</InputLabel>
              <Select
                value={preferences.snacksPerDay}
                label="Snacks Per Day"
                onChange={(e) => setPreferences(prev => ({
                  ...prev,
                  snacksPerDay: e.target.value
                }))}
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

        {/* Flavor Preferences (NEW) */}
        <Box sx={{ mt: 3, mb: 2 }}>
          <Typography variant="subtitle1" gutterBottom>
            Flavor Preferences
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the flavors you enjoy most in your meals
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(flavorPreferences).map(([flavor, checked]) => (
              <Grid item xs={6} sm={4} key={flavor}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        setFlavorPreferences(prev => ({
                          ...prev,
                          [flavor]: e.target.checked
                        }));
                      }}
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
              onChange={(e) => setSpiceLevel(e.target.value)}
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
            Select the types of meal formats you prefer
          </Typography>
          <Grid container spacing={2}>
            {Object.entries(recipeTypePreferences).map(([type, checked]) => (
              <Grid item xs={6} sm={4} key={type}>
                <FormControlLabel
                  control={
                    <Checkbox
                      checked={checked}
                      onChange={(e) => {
                        setRecipeTypePreferences(prev => ({
                          ...prev,
                          [type]: e.target.checked
                        }));
                      }}
                    />
                  }
                  label={type.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                />
              </Grid>
            ))}
          </Grid>
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
                      onChange={(e) => {
                        setPrepPreferences(prev => ({
                          ...prev,
                          [prep]: e.target.checked
                        }));
                      }}
                    />
                  }
                  label={prep.split('-').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ')}
                />
              </Grid>
            ))}
          </Grid>
        </Box>

        <Divider sx={{ my: 3 }} />

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
                onChange={(e, value) => {
                  setTimeConstraints(prev => ({
                    ...prev,
                    [mealType]: value
                  }));
                }}
              />
            </Box>
          ))}
        </Box>

        {/* Meal Schedule section has been moved above Servings per Meal */}
        
        {/* Kroger Integration Note */}
        <Box sx={{ mb: 3 }}>
          <Typography variant="subtitle1" gutterBottom>
            Kroger Integration
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            Kroger integration is now handled through the official Kroger OAuth flow.
            When you add items to your Kroger cart, you'll be redirected to log in with your Kroger account.
          </Typography>
          <Button
            variant="outlined"
            color="primary"
            component={Link}
            to="/kroger-auth"
            startIcon={<ShoppingCartIcon />}
            sx={{ mt: 1 }}
          >
            Connect Kroger Account
          </Button>
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