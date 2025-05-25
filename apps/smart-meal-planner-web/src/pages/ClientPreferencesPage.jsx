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
import PreferencesForm from '../components/PreferencesForm';

function ClientPreferencesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { clientId } = useParams();
  
  const [client, setClient] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  
  // Preferences state - matching individual user preference structure
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
        
        // Check if client has existing preferences or if we should load organization defaults
        const hasExistingPreferences = clientPrefs && (
          clientPrefs.diet_type || 
          clientPrefs.dietary_restrictions ||
          clientPrefs.servings_per_meal ||
          clientPrefs.prepComplexity ||
          clientPrefs.prep_complexity ||
          Object.keys(clientPrefs.appliances || {}).some(key => clientPrefs.appliances[key]) ||
          Object.keys(clientPrefs.mealTimes || clientPrefs.meal_times || {}).some(key => (clientPrefs.mealTimes || clientPrefs.meal_times)[key])
        );
        
        if (hasExistingPreferences) {
          // Parse stored preferences - handle both new camelCase and legacy snake_case
          const savedDietTypes = clientPrefs.diet_type ? 
            clientPrefs.diet_type.split(',').map(t => t.trim()) : [];
          const savedRecipeTypes = clientPrefs.recipe_type ? 
            clientPrefs.recipe_type.split(',').map(t => t.trim()) : [];
          
          // Convert diet types from string to object
          const dietTypesObj = { ...preferences.dietTypes };
          savedDietTypes.forEach(type => {
            if (dietTypesObj.hasOwnProperty(type)) {
              dietTypesObj[type] = true;
            }
          });
          
          // Convert recipe types from string to object
          const recipeTypesObj = { ...preferences.recipeTypes };
          savedRecipeTypes.forEach(type => {
            if (recipeTypesObj.hasOwnProperty(type)) {
              recipeTypesObj[type] = true;
            }
          });
          
          const updatedPrefs = {
            ...preferences,
            servingsPerMeal: clientPrefs.servingsPerMeal || clientPrefs.servings_per_meal || 1,
            appliances: clientPrefs.appliances || preferences.appliances,
            prepComplexity: clientPrefs.prepComplexity || clientPrefs.prep_complexity || 50,
            dietTypes: clientPrefs.dietTypes || dietTypesObj,
            otherDietType: clientPrefs.otherDietType || '',
            recipeTypes: clientPrefs.recipeTypes || recipeTypesObj,
            otherRecipeType: clientPrefs.otherRecipeType || '',
            dietaryRestrictions: clientPrefs.dietaryRestrictions || clientPrefs.dietary_restrictions || '',
            dislikedIngredients: clientPrefs.dislikedIngredients || clientPrefs.disliked_ingredients || '',
            mealTimes: clientPrefs.mealTimes || clientPrefs.meal_times || preferences.mealTimes,
            snacksPerDay: clientPrefs.snacksPerDay || clientPrefs.snacks_per_day || 1,
            macroGoals: clientPrefs.macroGoals || {
              protein: clientPrefs.macro_protein || '',
              carbs: clientPrefs.macro_carbs || '',
              fat: clientPrefs.macro_fat || '',
              calories: clientPrefs.calorie_goal || ''
            },
            krogerUsername: clientPrefs.krogerUsername || clientPrefs.kroger_username || '',
            krogerPassword: clientPrefs.krogerPassword || clientPrefs.kroger_password || ''
          };
          
          setPreferences(updatedPrefs);
          
          // Load advanced preference types - support both camelCase and snake_case
          if (clientPrefs.flavorPreferences || clientPrefs.flavor_preferences) {
            setFlavorPreferences(clientPrefs.flavorPreferences || clientPrefs.flavor_preferences);
          }
          
          if (clientPrefs.spiceLevel || clientPrefs.spice_level) {
            setSpiceLevel(clientPrefs.spiceLevel || clientPrefs.spice_level);
          }
          
          if (clientPrefs.recipeTypePreferences || clientPrefs.recipe_type_preferences) {
            setRecipeTypePreferences(clientPrefs.recipeTypePreferences || clientPrefs.recipe_type_preferences);
          }
          
          if (clientPrefs.mealTimePreferences || clientPrefs.meal_time_preferences) {
            setMealTimePreferences(clientPrefs.mealTimePreferences || clientPrefs.meal_time_preferences);
          }
          
          if (clientPrefs.timeConstraints || clientPrefs.time_constraints) {
            setTimeConstraints(clientPrefs.timeConstraints || clientPrefs.time_constraints);
          }
          
          if (clientPrefs.prepPreferences || clientPrefs.prep_preferences) {
            setPrepPreferences(clientPrefs.prepPreferences || clientPrefs.prep_preferences);
          }
        } else {
          // Client has no existing preferences - load organization defaults
          try {
            console.log('Loading organization defaults for new client...');
            
            // Get client's organization ID from client data
            const organizationId = clientData.organization_id;
            if (organizationId) {
              const defaultPrefs = await apiService.getDefaultClientPreferences(organizationId);
              
              if (defaultPrefs.auto_assign_default_preferences && defaultPrefs.default_client_preferences) {
                console.log('Applying organization defaults:', defaultPrefs.default_client_preferences);
                
                const orgDefaults = defaultPrefs.default_client_preferences;
                
                // Apply organization default preferences to client
                if (orgDefaults.dietTypes) {
                  setPreferences(prev => ({
                    ...prev,
                    dietTypes: orgDefaults.dietTypes,
                    otherDietType: orgDefaults.otherDietType || ''
                  }));
                }
                
                if (orgDefaults.recipeTypes) {
                  setPreferences(prev => ({
                    ...prev,
                    recipeTypes: orgDefaults.recipeTypes,
                    otherRecipeType: orgDefaults.otherRecipeType || ''
                  }));
                }
                
                if (orgDefaults.appliances) {
                  setPreferences(prev => ({
                    ...prev,
                    appliances: orgDefaults.appliances
                  }));
                }
                
                if (orgDefaults.mealTimes) {
                  setPreferences(prev => ({
                    ...prev,
                    mealTimes: orgDefaults.mealTimes
                  }));
                }
                
                if (orgDefaults.macroGoals) {
                  setPreferences(prev => ({
                    ...prev,
                    macroGoals: orgDefaults.macroGoals
                  }));
                }
                
                // Apply other default settings
                setPreferences(prev => ({
                  ...prev,
                  servingsPerMeal: orgDefaults.servingsPerMeal || prev.servingsPerMeal,
                  prepComplexity: orgDefaults.prepComplexity || prev.prepComplexity,
                  snacksPerDay: orgDefaults.snacksPerDay || prev.snacksPerDay,
                  dietaryRestrictions: orgDefaults.dietaryRestrictions || '',
                  dislikedIngredients: orgDefaults.dislikedIngredients || '',
                  krogerUsername: orgDefaults.krogerUsername || '',
                  krogerPassword: orgDefaults.krogerPassword || ''
                }));
                
                // Apply advanced preferences
                if (orgDefaults.flavorPreferences) {
                  setFlavorPreferences(orgDefaults.flavorPreferences);
                }
                
                if (orgDefaults.spiceLevel) {
                  setSpiceLevel(orgDefaults.spiceLevel);
                }
                
                if (orgDefaults.recipeTypePreferences) {
                  setRecipeTypePreferences(orgDefaults.recipeTypePreferences);
                }
                
                if (orgDefaults.mealTimePreferences) {
                  setMealTimePreferences(orgDefaults.mealTimePreferences);
                }
                
                if (orgDefaults.timeConstraints) {
                  setTimeConstraints(orgDefaults.timeConstraints);
                }
                
                if (orgDefaults.prepPreferences) {
                  setPrepPreferences(orgDefaults.prepPreferences);
                }
                
                console.log('Organization defaults applied successfully');
              }
            }
          } catch (defaultsErr) {
            console.warn('Could not load organization defaults:', defaultsErr);
            // Continue with empty preferences - this is not a critical error
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

  // Save client preferences - updated for new structure
  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError('');
      setSuccess('');
      
      // Convert nested objects to comma-separated strings for backward compatibility
      const selectedDietTypes = Object.keys(preferences.dietTypes)
        .filter(key => preferences.dietTypes[key])
        .join(', ');
      
      const selectedRecipeTypes = Object.keys(preferences.recipeTypes)
        .filter(key => preferences.recipeTypes[key])
        .join(', ');

      // Calculate snacks per day based on meal time preferences
      const selectedSnackTimes = 
        [mealTimePreferences['morning-snack'], 
         mealTimePreferences['afternoon-snack'], 
         mealTimePreferences['evening-snack']]
        .filter(Boolean).length;
      
      const prefsToSave = {
        user_id: clientId,
        // New camelCase structure (primary)
        servingsPerMeal: preferences.servingsPerMeal,
        appliances: preferences.appliances,
        prepComplexity: preferences.prepComplexity,
        dietTypes: preferences.dietTypes,
        otherDietType: preferences.otherDietType,
        recipeTypes: preferences.recipeTypes,
        otherRecipeType: preferences.otherRecipeType,
        dietaryRestrictions: preferences.dietaryRestrictions,
        dislikedIngredients: preferences.dislikedIngredients,
        mealTimes: preferences.mealTimes,
        snacksPerDay: selectedSnackTimes > 0 ? preferences.snacksPerDay : 0,
        macroGoals: preferences.macroGoals,
        krogerUsername: preferences.krogerUsername,
        krogerPassword: preferences.krogerPassword,
        flavorPreferences: flavorPreferences,
        spiceLevel: spiceLevel,
        recipeTypePreferences: recipeTypePreferences,
        mealTimePreferences: mealTimePreferences,
        timeConstraints: timeConstraints,
        prepPreferences: prepPreferences,
        
        // Legacy snake_case for backward compatibility
        diet_type: selectedDietTypes,
        dietary_restrictions: preferences.dietaryRestrictions,
        disliked_ingredients: preferences.dislikedIngredients,
        recipe_type: selectedRecipeTypes,
        meal_times: preferences.mealTimes,
        macro_protein: parseInt(preferences.macroGoals.protein) || 0,
        macro_carbs: parseInt(preferences.macroGoals.carbs) || 0,
        macro_fat: parseInt(preferences.macroGoals.fat) || 0,
        calorie_goal: parseInt(preferences.macroGoals.calories) || 0,
        snacks_per_day: selectedSnackTimes > 0 ? preferences.snacksPerDay : 0,
        servings_per_meal: preferences.servingsPerMeal,
        prep_complexity: preferences.prepComplexity,
        flavor_preferences: flavorPreferences,
        recipe_type_preferences: recipeTypePreferences,
        meal_time_preferences: mealTimePreferences,
        time_constraints: timeConstraints,
        prep_preferences: prepPreferences,
        kroger_username: preferences.krogerUsername,
        kroger_password: preferences.krogerPassword
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
        <PreferencesForm
          preferences={preferences}
          setPreferences={setPreferences}
          flavorPreferences={flavorPreferences}
          setFlavorPreferences={setFlavorPreferences}
          spiceLevel={spiceLevel}
          setSpiceLevel={setSpiceLevel}
          recipeTypePreferences={recipeTypePreferences}
          setRecipeTypePreferences={setRecipeTypePreferences}
          mealTimePreferences={mealTimePreferences}
          setMealTimePreferences={setMealTimePreferences}
          timeConstraints={timeConstraints}
          setTimeConstraints={setTimeConstraints}
          prepPreferences={prepPreferences}
          setPrepPreferences={setPrepPreferences}
          loading={saving}
          message={success}
          error={error}
          onSubmit={handleSave}
          submitButtonText="Save Client Preferences"
          title={client ? `${client.name}'s Preferences` : 'Client Preferences'}
        />
      </Paper>
    </Container>
  );
}

export default ClientPreferencesPage;